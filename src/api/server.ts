import dns from "node:dns";
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {}

import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { CovenantEvaluator } from "../engine/evaluator.js";
import { TradeIntentSchema } from "../types.js";
import { KavenExecutorService } from "../executor/service.js";
import { getBinanceTestnetOrders } from "../executor/history.js";
import { runMarketScan } from "../agent/trader.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApiServer(
  evaluator = new CovenantEvaluator(),
  executor = new KavenExecutorService()
) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "5mb" }));
  app.use("/assets", express.static(path.resolve(__dirname, "../../public/assets")));
  app.use("/assets", express.static(path.resolve(process.cwd(), "public/assets")));
  app.get("/favicon.ico", (_req, res) => {
    const icoPath = path.resolve(process.cwd(), "public/assets/favicon.png");
    if (fs.existsSync(icoPath)) return res.sendFile(icoPath);
    res.status(204).end();
  });
  app.get("/video.mp4", (_req, res) => res.sendFile(path.resolve(process.cwd(), "out/video.mp4")));

  // Gracefully handle malformed JSON syntax errors with JSON response (never HTML error page)
  app.use((err: any, _req: any, res: any, next: any) => {
    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({
        error: "Malformed JSON syntax in request body",
        details: [err.message]
      });
    }
    next(err);
  });

  // PR #325 compatible proposal evaluation endpoint
  app.post("/propose", async (req, res) => {
    try {
      const intent = TradeIntentSchema.parse(req.body);
      const verdict = await evaluator.evaluate(intent);

      // Return PR #325 compatible structure
      res.json({
        proposalId: verdict.proposalId,
        verdict: {
          decision: verdict.decision,
          reasons: verdict.reasons,
          ruleChecks: verdict.ruleChecks,
          simulation: verdict.simulation
        },
        remediation: verdict.remediation,
        agentId: verdict.agentId,
        symbol: verdict.symbol,
        side: verdict.side,
        notionalUsd: verdict.notionalUsd,
        timestamp: verdict.timestamp,
        actionRef: verdict.actionRef,
        tier: verdict.tier,
        signedAction: verdict.signedAction
      });
    } catch (err: any) {
      const details = err.errors
        ? err.errors.map((e: any) => `${e.path.join(".") || "field"}: ${e.message}`)
        : [err.message || "Unknown validation error"];
      res.status(400).json({
        error: "Invalid trade proposal",
        details
      });
    }
  });

  // Execution Gateway: Execute an approved signed action
  app.post("/execute", async (req, res) => {
    try {
      const signedAction = req.body.signedAction || req.body;
      const result = await executor.processAction(signedAction);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
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

  // Query pending Tier 2 orders
  app.get("/execute/pending", (_req, res) => {
    res.json({ pending: executor.getPendingOrders() });
  });

  // Autonomous Trader Agent Pipeline: Scans market -> Evaluates invariants -> Executes on Testnet
  app.post("/agent/run", async (req, res) => {
    try {
      const symbol = req.body?.symbol || "BTCUSDT";
      const proposal = await runMarketScan(symbol);

      const intent = TradeIntentSchema.parse({
        agentId: proposal.agentId,
        symbol: proposal.symbol,
        side: proposal.side,
        usd: proposal.notionalUsd,
        leverage: proposal.leverage,
        orderType: proposal.orderType,
        reason: proposal.analysis.thesis
      });

      const verdict = await evaluator.evaluate(intent);

      let executionResult = null;
      if (verdict.decision === "PASS" && verdict.tier === "TIER_1_AUTO" && verdict.signedAction) {
        executionResult = await executor.processAction(verdict.signedAction);
      }

      res.json({
        success: true,
        proposal,
        verdict: {
          decision: verdict.decision,
          tier: verdict.tier,
          reasons: verdict.reasons,
          ruleChecks: verdict.ruleChecks,
          simulation: verdict.simulation,
          signedAction: verdict.signedAction
        },
        execution: executionResult
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/agent/scan", async (req, res) => {
    try {
      const symbol = (req.query.symbol as string) || "BTCUSDT";
      const proposal = await runMarketScan(symbol);
      res.json(proposal);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Query live Binance Testnet order history
  app.get("/history", async (req, res) => {
    try {
      const symbol = (req.query.symbol as string) || "BTCUSDT";
      const orders = await getBinanceTestnetOrders(symbol);
      res.json({ orders });
    } catch (err: any) {
      res.status(500).json({ error: err.message, orders: [] });
    }
  });

  // Query active safety covenants (JSON for API callers, HTML fall-through for browsers)
  app.get("/covenants", (req, res, next) => {
    if (req.headers["accept"]?.includes("text/html")) {
      return next();
    }
    res.json({
      covenants: evaluator.getPolicy(),
      status: "ACTIVE"
    });
  });

  // Update covenants dynamically
  app.post("/covenants", (req, res) => {
    try {
      evaluator.updatePolicy(req.body);
      res.json({
        success: true,
        covenants: evaluator.getPolicy()
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Health and connectivity check
  app.get("/health", (_req, res) => {
    res.json({
      status: "healthy",
      service: "Kaven Pre-Flight Invariant Gate",
      version: "1.0.0",
      timestamp: new Date().toISOString()
    });
  });

  // Multi-Page Routes: Landing Page & Dedicated Sub-Pages (including /app console)
  app.get(["/", "/app", "/portfolio", "/landing", "/copilot", "/agents", "/covenants", "/docs", "/dashboard"], (_req, res) => {
    const htmlPath = path.resolve(__dirname, "../../public/index.html");
    if (fs.existsSync(htmlPath)) {
      return res.sendFile(htmlPath);
    }
    const fallbackPath = path.resolve(process.cwd(), "public/index.html");
    if (fs.existsSync(fallbackPath)) {
      return res.sendFile(fallbackPath);
    }
    res.send("<h1>KAVEN Pre-Flight Invariant Gate API</h1><p>POST /propose</p>");
  });

  return app;
}

export function startApiServer(port: number = 3842) {
  const app = createApiServer();
  return app.listen(port, () => {
    console.log(`[Limbo] REST API listening on port ${port} (PR #325 compatible)`);
    console.log(`[Limbo] Endpoints:`);
    console.log(`  POST http://localhost:${port}/propose`);
    console.log(`  GET  http://localhost:${port}/covenants`);
    console.log(`  GET  http://localhost:${port}/health`);
  });
}

// Auto-run if executed directly
if (process.argv[1] && (process.argv[1].replace(/\\/g, "/").includes("api/server.ts") || process.argv[1].replace(/\\/g, "/").includes("api/server.js"))) {
  const port = parseInt(process.env.PORT || "3842", 10);
  startApiServer(port);
}
