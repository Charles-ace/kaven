import https from "node:https";

export interface DepthSnapshot {
  lastUpdateId: number;
  bids: [string, string][]; // [price, qty]
  asks: [string, string][]; // [price, qty]
}

export interface PremiumIndex {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
}

// In-memory cache for IP resolution to bypass local DNS glitches
const resolvedIps: Record<string, string> = {};

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 20000,
  maxSockets: 100
});

// Cache whether direct fetch is reachable from this host network
let directFetchWorks: boolean | null = null;

async function resolveHostname(hostname: string): Promise<string> {
  if (resolvedIps[hostname]) {
    return resolvedIps[hostname];
  }
  try {
    const res = await fetch(`https://dns.google/resolve?name=${hostname}&type=A`);
    if (res.ok) {
      const data = await res.json() as { Answer?: { data: string }[] };
      if (data.Answer && data.Answer.length > 0) {
        resolvedIps[hostname] = data.Answer[0].data;
        return resolvedIps[hostname];
      }
    }
  } catch (err) {
    console.warn(`DoH resolution warning for ${hostname}:`, err);
  }
  return hostname;
}

async function requestWithFallback<T>(urlStr: string): Promise<T> {
  const url = new URL(urlStr);
  const hostname = url.hostname;

  // Attempt 1: Direct fetch with short timeout (1000ms), only if direct fetch hasn't been flagged unreachable
  if (directFetchWorks !== false) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1000);
      const res = await fetch(urlStr, {
        signal: controller.signal,
        headers: { "User-Agent": "SentinelGuard/1.0" }
      });
      clearTimeout(timeout);
      directFetchWorks = true;
      if (res.ok) {
        return (await res.json()) as T;
      } else {
        const errBody = await res.text();
        throw new Error(`Binance HTTP error ${res.status}: ${errBody}`);
      }
    } catch (err: any) {
      if (err.name === "AbortError" || err.message?.includes("fetch failed") || err.code === "ENOTFOUND") {
        directFetchWorks = false;
      } else if (err.message?.includes("Binance HTTP error")) {
        throw err;
      }
    }
  }

  // Attempt 2: Via DoH resolved IP using node https module with SNI servername + KeepAlive
  const ip = await resolveHostname(hostname);
  return new Promise<T>((resolve, reject) => {
    const req = https.request(
      {
        host: ip,
        path: url.pathname + url.search,
        method: "GET",
        headers: {
          Host: hostname,
          "User-Agent": "SentinelGuard/1.0",
          Accept: "application/json"
        },
        servername: hostname, // Crucial for TLS SNI
        agent: httpsAgent,
        timeout: 5000
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body) as T);
            } catch (e) {
              reject(new Error(`Failed to parse response: ${body}`));
            }
          } else {
            reject(new Error(`Binance HTTP error ${res.statusCode}: ${body}`));
          }
        });
      }
    );

    req.on("error", (e) => reject(e));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Request timeout for ${urlStr}`));
    });
    req.end();
  });
}

export class BinanceMarketClient {
  private depthCache = new Map<string, { data: DepthSnapshot; timestamp: number }>();
  private fundingCache = new Map<string, { data: PremiumIndex; timestamp: number }>();
  private inflightDepth = new Map<string, Promise<{ depth: DepthSnapshot; source: "LIVE_BINANCE_API" | "LIVE_CACHE_BURST" | "CACHE_FALLBACK"; cacheAgeMs: number }>>();
  private inflightFunding = new Map<string, Promise<{ premium: PremiumIndex | null; source: string; cacheAgeMs: number }>>();

  clearCache(): void {
    this.depthCache.clear();
    this.fundingCache.clear();
  }

  async getOrderBookDepth(symbol: string, limit: number = 100): Promise<{ depth: DepthSnapshot; source: "LIVE_BINANCE_API" | "LIVE_CACHE_BURST" | "CACHE_FALLBACK"; cacheAgeMs: number }> {
    const upper = symbol.toUpperCase();

    // 1. Fresh Burst Cache: return immediately if fresh within 1500ms to absorb microsecond bursts
    const cached = this.depthCache.get(upper);
    if (cached && Date.now() - cached.timestamp < 1500) {
      return { depth: cached.data, source: "LIVE_CACHE_BURST", cacheAgeMs: Date.now() - cached.timestamp };
    }

    // 2. In-Flight Coalescing (Singleflight): if a network request is already inflight for this symbol, join it
    const inflight = this.inflightDepth.get(upper);
    if (inflight) {
      return inflight;
    }

    const baseUrl = process.env.BINANCE_API_BASE_URL || "https://data-api.binance.vision";
    const url = `${baseUrl}/api/v3/depth?symbol=${upper}&limit=${limit}`;

    const fetchPromise = (async () => {
      try {
        const depth = await requestWithFallback<DepthSnapshot>(url);
        this.depthCache.set(upper, { data: depth, timestamp: Date.now() });
        return { depth, source: "LIVE_BINANCE_API" as const, cacheAgeMs: 0 };
      } catch (err: any) {
        // Fallback to cache ONLY if recent (< 5000ms) on network error or timeout
        const staleCached = this.depthCache.get(upper);
        if (staleCached && Date.now() - staleCached.timestamp < 5000) {
          return { depth: staleCached.data, source: "CACHE_FALLBACK" as const, cacheAgeMs: Date.now() - staleCached.timestamp };
        }
        throw new Error(`Failed to fetch order book depth for ${upper}: ${err.message}`);
      } finally {
        this.inflightDepth.delete(upper);
      }
    })();

    this.inflightDepth.set(upper, fetchPromise);
    return fetchPromise;
  }

  async getFuturesPremiumIndex(symbol: string): Promise<{ premium: PremiumIndex | null; source: string; cacheAgeMs: number }> {
    const upper = symbol.toUpperCase();

    const cached = this.fundingCache.get(upper);
    if (cached && Date.now() - cached.timestamp < 5000) {
      return { premium: cached.data, source: "LIVE_CACHE_BURST", cacheAgeMs: Date.now() - cached.timestamp };
    }

    const inflight = this.inflightFunding.get(upper);
    if (inflight) {
      return inflight;
    }

    const url = `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${upper}`;

    const fetchPromise = (async () => {
      try {
        const premium = await requestWithFallback<PremiumIndex>(url);
        this.fundingCache.set(upper, { data: premium, timestamp: Date.now() });
        return { premium, source: "LIVE_BINANCE_FAPI", cacheAgeMs: 0 };
      } catch (err: any) {
        const stale = this.fundingCache.get(upper);
        if (stale && Date.now() - stale.timestamp < 5000) {
          return { premium: stale.data, source: "CACHE_FALLBACK", cacheAgeMs: Date.now() - stale.timestamp };
        }
        return { premium: null, source: "UNAVAILABLE", cacheAgeMs: 0 };
      } finally {
        this.inflightFunding.delete(upper);
      }
    })();

    this.inflightFunding.set(upper, fetchPromise);
    return fetchPromise;
  }
}
