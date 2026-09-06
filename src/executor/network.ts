import https from "node:https";
import crypto from "node:crypto";

export interface BinanceTestnetResponse {
  statusCode: number;
  body: any;
  ok: boolean;
  endpoint: string;
  queryString: string;
}

const resolvedIps: Record<string, string> = {};

async function resolveHostname(hostname: string): Promise<string> {
  if (resolvedIps[hostname]) return resolvedIps[hostname];
  try {
    const res = await fetch(`https://dns.google/resolve?name=${hostname}&type=A`);
    if (res.ok) {
      const data = (await res.json()) as { Answer?: { data: string }[] };
      if (data.Answer && data.Answer.length > 0) {
        resolvedIps[hostname] = data.Answer[0].data;
        return resolvedIps[hostname];
      }
    }
  } catch {
    // fallback to original hostname
  }
  return hostname;
}

/**
 * Dispatch real authenticated order request to Binance Spot Testnet (https://testnet.binance.vision)
 */
export async function sendBinanceTestnetOrder(
  params: {
    symbol: string;
    side: "BUY" | "SELL";
    type: "MARKET" | "LIMIT";
    quoteOrderQty?: number;
    quantity?: number;
    price?: number;
    timeInForce?: "GTC" | "IOC" | "FOK";
  },
  apiKey: string,
  apiSecret: string,
  testnetHost: string = "testnet.binance.vision"
): Promise<BinanceTestnetResponse> {
  const timestamp = Date.now();
  const queryParams: Record<string, string | number> = {
    symbol: params.symbol.toUpperCase(),
    side: params.side.toUpperCase(),
    type: params.type.toUpperCase(),
    timestamp,
    recvWindow: 5000
  };

  if (params.quoteOrderQty) {
    queryParams.quoteOrderQty = params.quoteOrderQty;
  } else if (params.quantity) {
    queryParams.quantity = params.quantity;
  }

  if (params.type === "LIMIT" && params.price) {
    queryParams.price = params.price;
    queryParams.timeInForce = params.timeInForce || "GTC";
  }

  const queryString = Object.entries(queryParams)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

  // Sign query string with HMAC-SHA256
  const signature = crypto.createHmac("sha256", apiSecret).update(queryString).digest("hex");
  const fullPath = `/api/v3/order?${queryString}&signature=${signature}`;

  const ip = await resolveHostname(testnetHost);

  return new Promise<BinanceTestnetResponse>((resolve, reject) => {
    const req = https.request(
      {
        host: ip,
        path: fullPath,
        method: "POST",
        headers: {
          Host: testnetHost,
          "User-Agent": "Kaven-Executor/1.0",
          "X-MBX-APIKEY": apiKey,
          Accept: "application/json"
        },
        servername: testnetHost, // TLS SNI
        timeout: 10000
      },
      (res) => {
        let rawBody = "";
        res.on("data", (chunk) => (rawBody += chunk));
        res.on("end", () => {
          let parsedBody: any;
          try {
            parsedBody = JSON.parse(rawBody);
          } catch {
            parsedBody = { raw: rawBody };
          }
          const statusCode = res.statusCode || 500;
          resolve({
            statusCode,
            body: parsedBody,
            ok: statusCode >= 200 && statusCode < 300,
            endpoint: `POST https://${testnetHost}/api/v3/order`,
            queryString
          });
        });
      }
    );

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Timeout connecting to ${testnetHost}`));
    });
    req.end();
  });
}
