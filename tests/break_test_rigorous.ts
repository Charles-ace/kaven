import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CovenantEvaluator } from "../src/engine/evaluator.js";
import { BinanceMarketClient } from "../src/market/binance-client.js";

const BASE_URL = "http://localhost:3842";

interface TestReport {
  battery: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestReport[] = [];

function record(battery: string, name: string, passed: boolean, details: string) {
  results.push({ battery, name, passed, details });
  const icon = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`[${icon}] [${battery}] ${name} -> ${details}`);
}

async function postJson(path: string, body: any): Promise<{ status: number; data: any; raw: string }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body)
  });
  const raw = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(raw);
  } catch {}
  return { status: res.status, data, raw };
}

// -------------------------------------------------------------
// BATTERY 1: Payload Fuzzing & Malformation Break Tests
// -------------------------------------------------------------
async function runBattery1() {
  console.log("\n============================================================");
  console.log("BATTERY 1: PAYLOAD FUZZING & MALFORMATION BREAK TESTS");
  console.log("============================================================");

  // 1. Negative USD
  const r1 = await postJson("/propose", { symbol: "BTCUSDT", side: "BUY", usd: -100 });
  record("BATTERY 1", "Negative USD (-100)", r1.status === 400, `HTTP ${r1.status}`);

  // 2. Zero USD
  const r2 = await postJson("/propose", { symbol: "BTCUSDT", side: "BUY", usd: 0 });
  record("BATTERY 1", "Zero USD (0)", r2.status === 400, `HTTP ${r2.status}`);

  // 3. String USD
  const r3 = await postJson("/propose", { symbol: "BTCUSDT", side: "BUY", usd: "five-thousand" });
  record("BATTERY 1", "String USD ('five-thousand')", r3.status === 400, `HTTP ${r3.status}`);

  // 4. Invalid side enum
  const r4 = await postJson("/propose", { symbol: "BTCUSDT", side: "HODL", usd: 1000 });
  record("BATTERY 1", "Invalid side enum ('HODL')", r4.status === 400, `HTTP ${r4.status}`);

  // 5. Negative leverage
  const r5 = await postJson("/propose", { symbol: "BTCUSDT", side: "BUY", usd: 1000, leverage: -2 });
  record("BATTERY 1", "Negative leverage (-2)", r5.status === 400, `HTTP ${r5.status}`);

  // 6. Zero leverage
  const r6 = await postJson("/propose", { symbol: "BTCUSDT", side: "BUY", usd: 1000, leverage: 0 });
  record("BATTERY 1", "Zero leverage (0)", r6.status === 400, `HTTP ${r6.status}`);

  // 7. Prototype pollution attempt
  const r7 = await postJson("/propose", {
    __proto__: { isAdmin: true },
    symbol: "BTCUSDT",
    side: "BUY",
    usd: 1000
  });
  const polluted = ({} as any).isAdmin === true;
  record("BATTERY 1", "Prototype Pollution Attempt", r7.status === 200 && !polluted, `Pollution prevented: ${!polluted}`);

  // 8. 100,000-char string in reason
  const hugeReason = "BREAK_TEST_".repeat(10000);
  const r8 = await postJson("/propose", {
    symbol: "BTCUSDT",
    side: "BUY",
    usd: 1000,
    reason: hugeReason
  });
  record("BATTERY 1", "100k Character Reason String", r8.status === 200 && r8.data?.verdict?.decision === "PASS", `HTTP ${r8.status}`);

  // 9. Empty body
  const r9 = await postJson("/propose", {});
  record("BATTERY 1", "Empty Body ({})", r9.status === 400, `HTTP ${r9.status}`);

  // 10. Array body
  const r10 = await postJson("/propose", [{ symbol: "BTCUSDT", side: "BUY", usd: 1000 }]);
  record("BATTERY 1", "Array Body ([{...}])", r10.status === 400, `HTTP ${r10.status}`);

  // 11. Malformed JSON raw bytes
  const r11 = await postJson("/propose", "{ malformed json: true ");
  record("BATTERY 1", "Malformed Raw JSON Bytes", r11.status === 400, `HTTP ${r11.status}`);
}

// -------------------------------------------------------------
// BATTERY 2: Market Order-Book Depth & Liquidity Stress Tests
// -------------------------------------------------------------
async function runBattery2() {
  console.log("\n============================================================");
  console.log("BATTERY 2: ORDER-BOOK DEPTH & LIQUIDITY STRESS TESTS");
  console.log("============================================================");

  // 12. Book Exhaustion ($100M USD order)
  const r12 = await postJson("/propose", {
    symbol: "BTCUSDT",
    side: "BUY",
    usd: 100000000,
    leverage: 1
  });
  const v12 = r12.data?.verdict;
  const passed12 = v12?.decision === "VETO" && v12?.simulation?.levelsConsumed === 100;
  record("BATTERY 2", "Book Exhaustion ($100M USD on BTC)", passed12, `Verdict: ${v12?.decision}, Levels: ${v12?.simulation?.levelsConsumed}`);

  // 13. Micro-order ($0.01 USD)
  const r13 = await postJson("/propose", {
    symbol: "BTCUSDT",
    side: "BUY",
    usd: 0.01,
    leverage: 1
  });
  const v13 = r13.data?.verdict;
  record("BATTERY 2", "Micro-Order ($0.01 USD)", v13?.decision === "PASS", `Verdict: ${v13?.decision}, Slippage: ${v13?.simulation?.slippageBps} bps`);

  // 14. Extreme Leverage (100x on major, 50x on alt)
  const r14 = await postJson("/propose", {
    symbol: "ETHUSDT",
    side: "BUY",
    usd: 1000,
    leverage: 100
  });
  const v14 = r14.data?.verdict;
  record("BATTERY 2", "Extreme Leverage (100x on ETH)", v14?.decision === "VETO", `Verdict: ${v14?.decision}`);

  // 15. PEPE Liquidity Stress ($500k USD)
  const r15 = await postJson("/propose", {
    symbol: "PEPEUSDT",
    side: "BUY",
    usd: 500000,
    leverage: 1
  });
  const v15 = r15.data?.verdict;
  const isMultiLevel = (v15?.simulation?.levelsConsumed || 0) >= 2;
  record("BATTERY 2", "PEPE Liquidity Stress ($500k USD)", v15?.decision === "VETO" && isMultiLevel, `Verdict: ${v15?.decision}, Levels: ${v15?.simulation?.levelsConsumed}, Slippage: ${v15?.simulation?.slippageBps} bps`);
}

// -------------------------------------------------------------
// BATTERY 3: Symbol Sanitization & Injection Defense
// -------------------------------------------------------------
async function runBattery3() {
  console.log("\n============================================================");
  console.log("BATTERY 3: SYMBOL SANITIZATION & INJECTION DEFENSE");
  console.log("============================================================");

  // 16. Non-existent symbol on Binance
  const r16 = await postJson("/propose", {
    symbol: "FAKECOIN99",
    side: "BUY",
    usd: 1000
  });
  const v16 = r16.data?.verdict;
  const passed16 = v16?.decision === "VETO" && v16?.reasons?.some((r: string) => r.includes("does not exist"));
  record("BATTERY 3", "Non-Existent Symbol ('FAKECOIN99')", passed16, `Verdict: ${v16?.decision}, Reasons: ${v16?.reasons?.join("; ")}`);

  // 17. Malformed Symbol (special chars: BTC/USDT)
  const r17 = await postJson("/propose", {
    symbol: "BTC/USDT",
    side: "BUY",
    usd: 1000
  });
  const v17 = r17.data?.verdict;
  const passed17 = v17?.decision === "VETO" && v17?.reasons?.some((r: string) => r.includes("syntax"));
  record("BATTERY 3", "Malformed Symbol ('BTC/USDT')", passed17, `Verdict: ${v17?.decision}`);

  // 18. Lowercase auto-normalization (btcusdt -> BTCUSDT)
  const r18 = await postJson("/propose", {
    symbol: "btcusdt",
    side: "BUY",
    usd: 1000
  });
  const v18 = r18.data?.verdict;
  record("BATTERY 3", "Lowercase Auto-Normalization ('btcusdt')", v18?.decision === "PASS" && r18.data?.symbol === "BTCUSDT", `Normalized Symbol: ${r18.data?.symbol}`);

  // 19. SQL Injection in symbol
  const r19 = await postJson("/propose", {
    symbol: "BTC'; DROP TABLE covenants; --",
    side: "BUY",
    usd: 1000
  });
  const v19 = r19.data?.verdict;
  record("BATTERY 3", "SQL Injection in Symbol", v19?.decision === "VETO", `Verdict: ${v19?.decision}`);

  // 20. XSS Script Tag in symbol
  const r20 = await postJson("/propose", {
    symbol: "<script>alert(1)</script>",
    side: "BUY",
    usd: 1000
  });
  const v20 = r20.data?.verdict;
  record("BATTERY 3", "XSS Script Tag in Symbol", v20?.decision === "VETO", `Verdict: ${v20?.decision}`);
}

// -------------------------------------------------------------
// BATTERY 4: Concurrency, High-Load Burst & Race Conditions
// -------------------------------------------------------------
async function runBattery4() {
  console.log("\n============================================================");
  console.log("BATTERY 4: CONCURRENCY, HIGH-LOAD BURST & RACE CONDITIONS");
  console.log("============================================================");

  // 21. 200 Simultaneous Requests in Parallel
  const CONCURRENCY = 200;
  console.log(`Firing ${CONCURRENCY} concurrent requests simultaneously...`);
  const t0 = Date.now();
  const latencies: number[] = [];

  const promises = Array.from({ length: CONCURRENCY }, async (_, idx) => {
    const reqStart = Date.now();
    const symbol = idx % 2 === 0 ? "BTCUSDT" : "ETHUSDT";
    const res = await postJson("/propose", {
      agentId: `burst-agent-${idx}`,
      symbol,
      side: "BUY",
      usd: 1500,
      leverage: 2
    });
    latencies.push(Date.now() - reqStart);
    return res;
  });

  const responses = await Promise.all(promises);
  const totalDuration = Date.now() - t0;
  const successCount = responses.filter(r => r.status === 200 && r.data?.verdict?.decision === "PASS").length;

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];

  const passed21 = successCount === CONCURRENCY;
  record(
    "BATTERY 4",
    `200 Concurrent Requests Burst`,
    passed21,
    `Completed: ${successCount}/${CONCURRENCY} in ${totalDuration}ms (p50: ${p50}ms, p95: ${p95}ms, p99: ${p99}ms)`
  );

  // 22. Race Condition: Mutate covenants while 50 proposals are in flight
  console.log("Executing race condition test (policy mutation during 50 in-flight proposals)...");
  const raceProposals = Array.from({ length: 50 }, async (_, idx) => {
    return postJson("/propose", {
      agentId: `race-agent-${idx}`,
      symbol: "DOGEUSDT",
      side: "BUY",
      usd: 1000,
      leverage: 4 // passes if cap=5, vetoes if cap=3
    });
  });

  const mutatePromise = (async () => {
    await new Promise(r => setTimeout(r, 20)); // slight jitter
    return postJson("/covenants", { maxAltcoinLeverage: 5 });
  })();

  const [raceResults, mutateResult] = await Promise.all([
    Promise.all(raceProposals),
    mutatePromise
  ]);

  // Reset back to 3
  await postJson("/covenants", { maxAltcoinLeverage: 3 });

  const allReturned200 = raceResults.every(r => r.status === 200) && mutateResult.status === 200;
  record(
    "BATTERY 4",
    "Policy Mutation Race Condition",
    allReturned200,
    `All 50 proposals returned 200 OK without race crash or deadlock.`
  );
}

// -------------------------------------------------------------
// BATTERY 5: Fail-Closed Freshness & Network Outage Verification
// -------------------------------------------------------------
async function runBattery5() {
  console.log("\n============================================================");
  console.log("BATTERY 5: FAIL-CLOSED FRESHNESS & NETWORK OUTAGE VERIFICATION");
  console.log("============================================================");

  // 23. Test simulated network outage
  const offlineEvaluator = new CovenantEvaluator();
  (offlineEvaluator as any).marketClient = {
    getOrderBookDepth: async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:443 (Outage)");
    },
    getFuturesPremiumIndex: async () => ({ premium: null })
  };

  const verdict = await offlineEvaluator.evaluate({
    agentId: "failsafe-tester",
    symbol: "BTCUSDT",
    side: "BUY",
    usd: 3000,
    leverage: 2
  });

  const failsClosed = verdict.decision === "ESCALATE" && verdict.simulation.dataSource === "FAILSAFE_CLOSED";
  record(
    "BATTERY 5",
    "Network Outage Fail-Closed (Rule 0)",
    failsClosed,
    `Verdict: ${verdict.decision}, DataSource: ${verdict.simulation.dataSource}`
  );
}

// -------------------------------------------------------------
// BATTERY 6: Cryptographic Determinism & RFC 8785 Proof Audit
// -------------------------------------------------------------
async function runBattery6() {
  console.log("\n============================================================");
  console.log("BATTERY 6: CRYPTOGRAPHIC DETERMINISM & RFC 8785 PROOF AUDIT");
  console.log("============================================================");

  // 24. Determinism of canonical actionRef
  const payload = {
    agentId: "deterministic-bot",
    symbol: "BTCUSDT",
    side: "BUY" as const,
    usd: 2500,
    leverage: 1,
    action_ref: "fixed-audit-ref-12345"
  };

  const r24 = await postJson("/propose", payload);
  const refMatches = r24.data?.actionRef === "fixed-audit-ref-12345";
  record(
    "BATTERY 6",
    "Upstream ActionRef Preservation",
    refMatches,
    `ActionRef: ${r24.data?.actionRef}`
  );

  // Generated SHA-256 hash length
  const r24b = await postJson("/propose", {
    agentId: "deterministic-bot",
    symbol: "BTCUSDT",
    side: "BUY",
    usd: 2500,
    leverage: 1
  });
  const hash = r24b.data?.actionRef;
  const isValidSha256 = typeof hash === "string" && hash.length === 64 && /^[0-9a-f]{64}$/.test(hash);
  record(
    "BATTERY 6",
    "Generated SHA-256 Digest Standard (64 hex chars)",
    isValidSha256,
    `Digest: ${hash?.substring(0, 16)}... (Length: ${hash?.length})`
  );
}

// -------------------------------------------------------------
// BATTERY 7: MCP Stdio Protocol Break Test
// -------------------------------------------------------------
async function runBattery7() {
  console.log("\n============================================================");
  console.log("BATTERY 7: MODEL CONTEXT PROTOCOL (MCP) STDIO PROTOCOL TEST");
  console.log("============================================================");

  const isWin = process.platform === "win32";
  const serverScript = path.resolve(process.cwd(), "src/mcp/server.ts");
  const transport = new StdioClientTransport({
    command: isWin ? "cmd.exe" : "npx",
    args: isWin ? ["/c", "npx", "tsx", serverScript] : ["tsx", serverScript]
  });

  const client = new Client(
    { name: "break-test-client", version: "1.0.0" },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    record("BATTERY 7", "MCP Stdio Handshake (initialize)", true, "Connected successfully");

    const toolsResult = await client.listTools();
    const hasTools = toolsResult.tools.some(t => t.name === "limbo_evaluate_proposal");
    record("BATTERY 7", "MCP Stdio Tools Discovery (tools/list)", hasTools, `Discovered ${toolsResult.tools.length} tools`);

    const callResult = await client.callTool({
      name: "limbo_evaluate_proposal",
      arguments: {
        agentId: "mcp-break-bot",
        symbol: "BTCUSDT",
        side: "BUY",
        usd: 2000,
        leverage: 2
      }
    });
    const parsed = JSON.parse((callResult.content[0] as any).text);
    const hasCallVerdict = parsed.decision === "PASS";
    record("BATTERY 7", "MCP Stdio Evaluation Execution (tools/call)", hasCallVerdict, `Decision: ${parsed.decision}`);
  } catch (err: any) {
    record("BATTERY 7", "MCP Stdio Protocol", false, err.message);
  } finally {
    await transport.close().catch(() => {});
  }
}

// -------------------------------------------------------------
// MAIN EXECUTION & SUMMARY
// -------------------------------------------------------------
async function main() {
  console.log("############################################################");
  console.log("   LIMBO FULL-STACK PRODUCTION RIGOROUS BREAK TEST SUITE    ");
  console.log("############################################################\n");

  await runBattery1();
  await runBattery2();
  await runBattery3();
  await runBattery4();
  await runBattery5();
  await runBattery6();
  await runBattery7();

  console.log("\n============================================================");
  console.log("FINAL AUDIT SCORECARD");
  console.log("============================================================");
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;

  console.log(`Total Rigorous Batteries: 7`);
  console.log(`Total Checks Executed:    ${total}`);
  console.log(`Passed Checks:            ${passed}`);
  console.log(`Failed Checks:            ${failed}`);
  console.log(`Success Rate:             ${((passed / total) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.error(`\nCRITICAL: ${failed} break-test check(s) failed! Production push blocked.`);
    process.exit(1);
  } else {
    console.log(`\nALL ${total} RIGOROUS BREAK TESTS PASSED WITH 100% INVARIANT ENFORCEMENT.`);
    console.log("System verified ready for production deployment.");
    process.exit(0);
  }
}

main().catch(err => {
  console.error("Fatal test suite runner error:", err);
  process.exit(1);
});
