import assert from "node:assert";
import { createApiServer } from "../src/api/server.js";
import { Server } from "node:http";

async function testApiEndpoint() {
  console.log("[TEST API] Starting Limbo API test on ephemeral port...");
  const app = createApiServer();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(3919, () => resolve(s));
  });

  try {
    // 1. Check /health
    const healthRes = await fetch("http://localhost:3919/health");
    const healthData = await healthRes.json() as any;
    assert.strictEqual(healthData.status, "healthy");
    console.log("  ✓ /health endpoint returned healthy status.");

    // 2. Check /covenants
    const covRes = await fetch("http://localhost:3919/covenants");
    const covData = await covRes.json() as any;
    assert.strictEqual(covData.covenants.accountNavUsd, 20000);
    assert.strictEqual(covData.covenants.maxNavConcentrationPct, 35);
    console.log("  ✓ /covenants endpoint returned default policy.");

    // 3. Test POST /propose (Proposal A - Safe)
    const propARes = await fetch("http://localhost:3919/propose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "claude-code",
        symbol: "BTCUSDT",
        side: "BUY",
        usd: 3000,
        leverage: 2,
        reason: "Breakout"
      })
    });
    const propAData = await propARes.json() as any;
    assert.strictEqual(propAData.verdict.decision, "PASS");
    assert.strictEqual(propAData.symbol, "BTCUSDT");
    assert.ok(propAData.actionRef !== undefined);
    console.log("  ✓ POST /propose returned PASS for conservative BTC proposal.");

    // 4. Test POST /propose (Proposal B - Dangerous VETO)
    const propBRes = await fetch("http://localhost:3919/propose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "fomo-bot",
        symbol: "DOGEUSDT",
        side: "BUY",
        usd: 25000,
        leverage: 10,
        reason: "FOMO"
      })
    });
    const propBData = await propBRes.json() as any;
    assert.strictEqual(propBData.verdict.decision, "VETO");
    assert.ok(propBData.verdict.reasons.length >= 2);
    assert.ok(propBData.remediation.includes("<= 3x"));
    console.log("  ✓ POST /propose returned VETO and actionable remediation for dangerous proposal.");

    console.log("  ✓ All REST API checks verified successfully!");
  } finally {
    server.close();
  }
}

testApiEndpoint().catch((err) => {
  console.error("API test failed:", err);
  process.exit(1);
});
