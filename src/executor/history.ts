import https from "node:https";
import crypto from "node:crypto";

export async function getBinanceTestnetOrders(symbol: string = "BTCUSDT"): Promise<any[]> {
  try {
    if (typeof process.loadEnvFile === "function") process.loadEnvFile();
  } catch {}

  const apiKey = process.env.BINANCE_TESTNET_API_KEY;
  const apiSecret = process.env.BINANCE_TESTNET_SECRET_KEY;

  if (!apiKey || !apiSecret) {
    return [];
  }

  const timestamp = Date.now();
  const qs = `symbol=${symbol.toUpperCase()}&timestamp=${timestamp}&recvWindow=5000`;
  const sig = crypto.createHmac("sha256", apiSecret).update(qs).digest("hex");

  const ip = await (async () => {
    try {
      const res = await fetch("https://dns.google/resolve?name=testnet.binance.vision&type=A");
      const d = (await res.json()) as any;
      return d.Answer?.[0]?.data || "testnet.binance.vision";
    } catch {
      return "testnet.binance.vision";
    }
  })();

  return new Promise<any[]>((resolve) => {
    const req = https.request(
      {
        host: ip,
        path: `/api/v3/allOrders?${qs}&signature=${sig}`,
        method: "GET",
        headers: {
          Host: "testnet.binance.vision",
          "X-MBX-APIKEY": apiKey,
          Accept: "application/json"
        },
        servername: "testnet.binance.vision",
        timeout: 10000
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            const orders = JSON.parse(body);
            resolve(Array.isArray(orders) ? orders : []);
          } catch {
            resolve([]);
          }
        });
      }
    );
    req.on("error", () => resolve([]));
    req.on("timeout", () => {
      req.destroy();
      resolve([]);
    });
    req.end();
  });
}

// Standalone CLI runner when executed directly
if (process.argv[1]?.endsWith("history.js") || process.argv[1]?.endsWith("history.ts")) {
  (async () => {
    const orders = await getBinanceTestnetOrders("BTCUSDT");
    console.log("\n==================================================================================");
    console.log("             OFFICIAL BINANCE SPOT TESTNET: BTCUSDT ORDER HISTORY                 ");
    console.log("==================================================================================");
    console.log(`Total Orders Recorded on Binance: ${orders.length}\n`);
    if (orders.length > 0) {
      console.table(
        orders.map((o: any) => ({
          "Order ID": o.orderId,
          Symbol: o.symbol,
          Side: o.side,
          Type: o.type,
          "Executed (BTC)": o.executedQty,
          "Quote ($)": `$${Number(o.cummulativeQuoteQty).toFixed(2)}`,
          Status: o.status,
          Timestamp: new Date(o.time).toLocaleTimeString()
        }))
      );
    } else {
      console.log("No orders found or credentials missing.");
    }
  })();
}
