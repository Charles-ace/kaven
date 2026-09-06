import express from "express";
import cors from "cors";
import { KavenExecutorService } from "./service.js";

export { KavenExecutorService } from "./service.js";
export { sendBinanceTestnetOrder, BinanceTestnetResponse } from "./network.js";

export function createExecutorApiServer(executor = new KavenExecutorService()) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get("/health", (_req, res) => {
    res.json({
      status: "healthy",
      service: "Kaven Execution Service (Testnet)",
      version: "1.0.0",
      pendingOrders: executor.getPendingOrders().length,
      redeemedOrders: executor.getRedeemedCount(),
      timestamp: new Date().toISOString()
    });
  });

  // Submit signed action for execution
  app.post("/execute", async (req, res) => {
    try {
      const signedAction = req.body;
      const result = await executor.processAction(signedAction);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // List pending Tier 2 orders awaiting human ack
  app.get("/execute/pending", (_req, res) => {
    res.json({
      pending: executor.getPendingOrders()
    });
  });

  // Confirm or reject a pending Tier 2 order
  app.post("/execute/confirm", async (req, res) => {
    try {
      const { actionId, approve } = req.body;
      if (!actionId || typeof approve !== "boolean") {
        return res.status(400).json({ error: "Missing actionId or approve boolean." });
      }
      const result = await executor.confirmAction(actionId, approve);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}

// Standalone runner when launched directly
if (process.argv[1]?.endsWith("executor/index.js") || process.argv[1]?.endsWith("executor/index.ts")) {
  try {
    if (typeof process.loadEnvFile === "function") process.loadEnvFile();
  } catch {}
  const port = process.env.EXECUTOR_PORT || 3843;
  const app = createExecutorApiServer();
  app.listen(port, () => {
    const hasKeys = Boolean(process.env.BINANCE_TESTNET_API_KEY && process.env.BINANCE_TESTNET_SECRET_KEY);
    console.log(`[Kaven Executor] Service active on http://localhost:${port}`);
    if (hasKeys) {
      console.log(`[Kaven Executor] Active Binance Spot Testnet credentials detected from .env`);
    } else {
      console.log(`[Kaven Executor] No credentials configured. Please set BINANCE_TESTNET_API_KEY and BINANCE_TESTNET_SECRET_KEY in .env`);
    }
  });
}
