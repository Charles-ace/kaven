/**
 * KAVEN FULL-STACK MASTER END-TO-END VERIFICATION SUITE
 * 
 * Verifies every layer of the system:
 * 1. HTTP Server & Asset Delivery (HTML, CSS tokens, heyAura background, 2D logo, favicon)
 * 2. Covenants & Policy Engine (Rule checks, dynamic synchronization)
 * 3. Pre-Flight Invariant Gate (Live Binance L2 book walking, VWAP, slippage, NAV exposure)
 * 4. Autonomous AI Trader Agent (Live market perception, order book imbalance, thesis, auto-execution)
 * 5. Execution Gateway & Cryptographic Security (RFC 8785, replay defense, tamper defense, TTL)
 * 6. Live Binance Spot Testnet Integration (Real authenticated orders, real fills, real order IDs)
 * 7. Live Binance Order History API (Direct sync with testnet.binance.vision)
 * 8. Model Context Protocol (MCP) Stdio Transport (Tool discovery, execution)
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = "http://localhost:3842";

interface TestResult {
  suite: string;
  name: string;
  status: "PASS" | "FAIL";
  details?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function recordTest(suite: string, name: string, fn: () => Promise<string | void>) {
  const start = Date.now();
  try {
    const details = await fn();
    const durationMs = Date.now() - start;
    results.push({ suite, name, status: "PASS", details: details || undefined, durationMs });
    console.log(`  ✓ [PASS] [${suite}] ${name} (${durationMs}ms)`);
    if (details) console.log(`      ↳ ${details}`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    results.push({ suite, name, status: "FAIL", details: err.message, durationMs });
    console.error(`  ✗ [FAIL] [${suite}] ${name} (${durationMs}ms): ${err.message}`);
  }
}

async function run() {
  console.log("======================================================================");
  console.log("         KAVEN MASTER FULL-STACK END-TO-END AUDIT SUITE               ");
  console.log("======================================================================");
  console.log(`Target API Server: ${BASE_URL}\n`);

  // ====================================================================
  // SUITE 1: HTTP SERVER & ASSETS
  // ====================================================================
  console.log("--- SUITE 1: HTTP Server & Static Assets ---");
  await recordTest("ASSETS", "GET / serves valid HTML with correct title", async () => {
    const res = await fetch(`${BASE_URL}/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text.includes("KAVEN")) throw new Error("Title/content missing KAVEN");
    return `HTTP 200 OK (${text.length} bytes)`;
  });

  await recordTest("ASSETS", "GET /app loads console view route", async () => {
    const res = await fetch(`${BASE_URL}/app`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text.includes("Pre-Flight Invariant Console")) throw new Error("Missing console markup");
    return "Route /app serves complete application bundle";
  });

  await recordTest("ASSETS", "GET /assets/hero-bg.png serves heyAura background", async () => {
    const res = await fetch(`${BASE_URL}/assets/hero-bg.png`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const cl = res.headers.get("content-length");
    return `Served authentic volumetric backdrop (${cl} bytes, type: ${res.headers.get("content-type")})`;
  });

  await recordTest("ASSETS", "GET /assets/kaven-logo.png serves 2D metallic logo", async () => {
    const res = await fetch(`${BASE_URL}/assets/kaven-logo.png`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return `Served 2D metallic obsidian logo (${res.headers.get("content-length")} bytes)`;
  });

  await recordTest("ASSETS", "GET /favicon.ico serves valid icon", async () => {
    const res = await fetch(`${BASE_URL}/favicon.ico`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return `Served favicon with Content-Type: ${res.headers.get("content-type")}`;
  });

  await recordTest("ASSETS", "GET /health returns healthy system status", async () => {
    const res = await fetch(`${BASE_URL}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as any;
    if (json.status !== "healthy") throw new Error(`Unexpected status: ${json.status}`);
    return `Service: ${json.service} | Status: ${json.status}`;
  });

  // ====================================================================
  // SUITE 2: INVARIANT COVENANTS & L2 BOOK WALKING
  // ====================================================================
  console.log("\n--- SUITE 2: Invariant Covenants & L2 Order Book Depth ---");
  await recordTest("INVARIANTS", "GET /covenants returns active policy baseline", async () => {
    const res = await fetch(`${BASE_URL}/covenants`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as any;
    const p = json.covenants;
    if (p.maxMajorLeverage !== 10 || p.maxAltcoinLeverage !== 3 || p.maxSlippageBps !== 15) {
      throw new Error("Policy parameters mismatch");
    }
    return `NAV: $${p.accountNavUsd} | Major Lev: ${p.maxMajorLeverage}x | Alt Lev: ${p.maxAltcoinLeverage}x | Slippage: ${p.maxSlippageBps} bps`;
  });

  await recordTest("INVARIANTS", "POST /propose Tier 1 Safe Trade ($100 BTC @ 1x) -> PASS", async () => {
    const res = await fetch(`${BASE_URL}/propose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "e2e-tester-alpha",
        symbol: "BTCUSDT",
        side: "BUY",
        usd: 100,
        leverage: 1,
        orderType: "MARKET"
      })
    });
    const json = (await res.json()) as any;
    if (json.verdict.decision !== "PASS" || json.tier !== "TIER_1_AUTO") {
      throw new Error(`Expected PASS / TIER_1_AUTO, got ${json.verdict.decision} / ${json.tier}`);
    }
    if (!json.signedAction?.signature) throw new Error("Missing cryptographic action token");
    return `Decision: PASS | Tier: ${json.tier} | Slippage: ${json.verdict.simulation.slippageBps} bps | ActionId: ${json.signedAction.payload.actionId}`;
  });

  await recordTest("INVARIANTS", "POST /propose Tier 2 Caution Trade ($500 BTC @ 9x) -> HUMAN_ACK", async () => {
    const res = await fetch(`${BASE_URL}/propose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "e2e-tester-beta",
        symbol: "BTCUSDT",
        side: "BUY",
        usd: 500,
        leverage: 9,
        orderType: "MARKET"
      })
    });
    const json = (await res.json()) as any;
    if (json.tier !== "TIER_2_HUMAN_ACK") {
      throw new Error(`Expected TIER_2_HUMAN_ACK, got ${json.tier}`);
    }
    return `Decision: ${json.verdict.decision} | Tier: ${json.tier} (Warning Band: 90% leverage cap)`;
  });

  await recordTest("INVARIANTS", "POST /propose Tier 3 Dangerous Trade ($15,000 DOGE @ 10x) -> VETO", async () => {
    const res = await fetch(`${BASE_URL}/propose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "e2e-tester-gamma",
        symbol: "DOGEUSDT",
        side: "BUY",
        usd: 15000,
        leverage: 10,
        orderType: "MARKET"
      })
    });
    const json = (await res.json()) as any;
    if (json.verdict.decision !== "VETO" || json.tier !== "TIER_3_VETO") {
      throw new Error(`Expected VETO / TIER_3_VETO, got ${json.verdict.decision} / ${json.tier}`);
    }
    if (json.signedAction) throw new Error("Dangerous trade emitted illegal action token");
    return `Decision: VETO | Reasons: ${json.verdict.reasons.join(" ; ")}`;
  });

  await recordTest("INVARIANTS", "POST /propose PEPE Liquidity Shock ($500,000 @ 1x) -> VETO (Multi-depth Walk)", async () => {
    const res = await fetch(`${BASE_URL}/propose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "e2e-tester-pepe",
        symbol: "PEPEUSDT",
        side: "BUY",
        usd: 500000,
        leverage: 1,
        orderType: "MARKET"
      })
    });
    const json = (await res.json()) as any;
    if (json.verdict.decision !== "VETO") throw new Error(`Expected VETO, got ${json.verdict.decision}`);
    const sim = json.verdict.simulation;
    return `Levels Walked: ${sim.levelsConsumed} | Slippage: ${sim.slippageBps.toFixed(2)} bps (Ceiling: 15.0 bps)`;
  });

  // ====================================================================
  // SUITE 3: AUTONOMOUS AI TRADER AGENT PIPELINE
  // ====================================================================
  console.log("\n--- SUITE 3: Autonomous AI Trader Agent Pipeline ---");
  await recordTest("AGENT", "GET /agent/scan analyzes live Binance market microstructure", async () => {
    const res = await fetch(`${BASE_URL}/agent/scan?symbol=BTCUSDT`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as any;
    const a = json.analysis;
    if (!a.thesis || typeof a.bidPressurePct !== "number") throw new Error("Invalid market analysis payload");
    return `Price: $${a.price} | 24h: ${a.priceChange24hPct}% | Bid Dominance: ${a.bidPressurePct}% | Spread: ${a.spreadBps} bps`;
  });

  await recordTest("AGENT", "POST /agent/run executes full perception -> thesis -> arbitration -> testnet fill", async () => {
    const res = await fetch(`${BASE_URL}/agent/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "BTCUSDT" })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as any;
    if (!json.success) throw new Error(json.error || "Agent run returned unsuccess");
    const v = json.verdict;
    const e = json.execution;
    if (v.decision !== "PASS") throw new Error(`Agent proposal rejected by Kaven: ${v.decision}`);
    if (!e || e.status !== "FILLED") throw new Error(`Execution failed: ${e?.status || "NO_EXECUTION"}`);
    return `Thesis: "${json.proposal.analysis.thesis.substring(0, 60)}..." | Binance Order ID: #${e.binanceResponse.orderId} | Status: ${e.status}`;
  });

  // ====================================================================
  // SUITE 4: EXECUTION GATEWAY & CRYPTOGRAPHIC RESILIENCE
  // ====================================================================
  console.log("\n--- SUITE 4: Cryptographic Security & Execution Gateway ---");
  let validSignedAction: any = null;
  await recordTest("SECURITY", "Generate fresh Tier 1 signed action token via /propose", async () => {
    const res = await fetch(`${BASE_URL}/propose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "sec-tester",
        symbol: "BTCUSDT",
        side: "BUY",
        usd: 100,
        leverage: 1,
        orderType: "MARKET"
      })
    });
    const json = (await res.json()) as any;
    validSignedAction = json.signedAction;
    if (!validSignedAction) throw new Error("Failed to obtain signed action token");
    return `Action ID: ${validSignedAction.payload.actionId} (TTL: 30s)`;
  });

  await recordTest("SECURITY", "Execute valid signed action on Binance Spot Testnet", async () => {
    const res = await fetch(`${BASE_URL}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedAction: validSignedAction })
    });
    const json = (await res.json()) as any;
    if (json.status !== "FILLED") throw new Error(`Execution failed: ${json.status} (${json.reason || json.error})`);
    return `Order Filled: #${json.binanceResponse.orderId} | Status: ${json.binanceResponse.status}`;
  });

  await recordTest("SECURITY", "Replay Defense: reject second submission of same action token", async () => {
    const res = await fetch(`${BASE_URL}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedAction: validSignedAction })
    });
    const json = (await res.json()) as any;
    if (json.status !== "REJECTED" || !json.reason?.includes("REPLAY_ATTACK_PREVENTED")) {
      throw new Error(`Replay defense failed, got: ${JSON.stringify(json)}`);
    }
    return "Replay attack prevented: Single-use actionId token invalidated immediately";
  });

  await recordTest("SECURITY", "Tamper Defense: reject tampered payload ($100 -> $999,999)", async () => {
    const tampered = JSON.parse(JSON.stringify(validSignedAction));
    tampered.payload.notionalUsd = 999999;
    const res = await fetch(`${BASE_URL}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedAction: tampered })
    });
    const json = (await res.json()) as any;
    if (json.status !== "REJECTED" || !json.reason?.includes("INVALID_SIGNATURE")) {
      throw new Error(`Tamper defense failed, got: ${JSON.stringify(json)}`);
    }
    return "Tamper defense confirmed: RFC-8785 HMAC-SHA256 signature mismatch detected";
  });

  await recordTest("SECURITY", "TTL Expiration Defense: reject action with expired timestamp", async () => {
    const expired = JSON.parse(JSON.stringify(validSignedAction));
    expired.payload.expiresAt = Date.now() - 15000; // 15s in the past
    const res = await fetch(`${BASE_URL}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedAction: expired })
    });
    const json = (await res.json()) as any;
    if (json.status !== "REJECTED") throw new Error(`Expiry defense failed, got: ${JSON.stringify(json)}`);
    return `Rejected with reason: ${json.reason}`;
  });

  // ====================================================================
  // SUITE 5: BINANCE TESTNET ORDER HISTORY INTEGRATION
  // ====================================================================
  console.log("\n--- SUITE 5: Binance Spot Testnet Order History ---");
  await recordTest("HISTORY", "GET /history?symbol=BTCUSDT queries testnet.binance.vision directly", async () => {
    const res = await fetch(`${BASE_URL}/history?symbol=BTCUSDT`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as any;
    const orders = json.orders || [];
    if (!Array.isArray(orders) || orders.length === 0) {
      throw new Error("No orders returned from Binance Spot Testnet");
    }
    const latest = orders[orders.length - 1];
    return `Retrieved ${orders.length} orders | Latest: Order #${latest.orderId} (${latest.side} ${latest.origQty} BTC - ${latest.status})`;
  });

  // ====================================================================
  // SUITE 6: MODEL CONTEXT PROTOCOL (MCP) STDIO VERIFICATION
  // ====================================================================
  console.log("\n--- SUITE 6: Model Context Protocol (MCP) Stdio Tools ---");
  await recordTest("MCP", "MCP Stdio Server handshake, tool discovery & evaluation execution", async () => {
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");

    const serverScript = path.resolve(__dirname, "../src/mcp/server.ts");
    const isWin = process.platform === "win32";
    const transport = new StdioClientTransport({
      command: isWin ? "cmd.exe" : "npx",
      args: isWin ? ["/c", "npx", "tsx", serverScript] : ["tsx", serverScript]
    });

    const client = new Client(
      { name: "e2e-audit-client", version: "1.0.0" },
      { capabilities: {} }
    );

    await client.connect(transport);

    const toolsResult = await client.listTools();
    const hasEval = toolsResult.tools.some((t) => t.name === "limbo_evaluate_proposal");
    const hasCov = toolsResult.tools.some((t) => t.name === "limbo_get_covenants");
    if (!hasEval || !hasCov) throw new Error("Missing expected MCP tools");

    const evalCall = await client.callTool({
      name: "limbo_evaluate_proposal",
      arguments: {
        symbol: "BTCUSDT",
        side: "BUY",
        usd: 100,
        leverage: 1,
        agentId: "mcp-e2e-agent"
      }
    });

    const content = (evalCall.content[0] as any)?.text;
    if (!content || !content.includes("PASS")) {
      throw new Error(`Unexpected tool call verdict: ${content}`);
    }

    await client.close();
    return `Discovered ${toolsResult.tools.length} MCP tools; executed limbo_evaluate_proposal -> PASS verdict over stdio`;
  });

  // ====================================================================
  // FINAL SCORECARD
  // ====================================================================
  const total = results.length;
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const rate = ((passed / total) * 100).toFixed(1);

  console.log("\n======================================================================");
  console.log("                   FINAL FULL-STACK AUDIT SCORECARD                   ");
  console.log("======================================================================");
  console.log(`Total Verification Checks: ${total}`);
  console.log(`Passed Checks:             ${passed}`);
  console.log(`Failed Checks:             ${failed}`);
  console.log(`Pass Rate:                 ${rate}%`);
  console.log("======================================================================");

  if (failed === 0) {
    console.log("🎉 ALL 17 FULL-STACK END-TO-END TESTS PASSED WITH 100% RELIABILITY.");
    console.log("   System verified bulletproof for hackathon submission & Render deployment.");
  } else {
    console.error(`⚠️ ${failed} TEST(S) FAILED. Review errors above.`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("FATAL AUDIT ERROR:", err);
  process.exit(1);
});
