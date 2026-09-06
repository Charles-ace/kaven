import { CovenantEvaluator } from "./engine/evaluator.js";
import { TradeIntent } from "./types.js";

async function runDemo() {
  console.log("================================================================================");
  console.log("                    LIMBO — PRE-FLIGHT RISK GOVERNANCE AGENT                    ");
  console.log("                        Binance Agent OS Hackathon 2026                         ");
  console.log("================================================================================");
  console.log("");

  const evaluator = new CovenantEvaluator({
    accountNavUsd: 20000.0,
    maxNavConcentrationPct: 35.0,
    maxMajorLeverage: 10.0,
    maxAltcoinLeverage: 3.0,
    maxSlippageBps: 15.0,
    maxCarryStressFundingRatePct: 0.05
  });

  const policy = evaluator.getPolicy();
  console.log("ACTIVE COVENANT POLICY:");
  console.log(`  Declared Account NAV:      $${policy.accountNavUsd.toLocaleString()}`);
  console.log(`  Max NAV Concentration:     ${policy.maxNavConcentrationPct}% ($${((policy.maxNavConcentrationPct / 100) * policy.accountNavUsd).toLocaleString()})`);
  console.log(`  Major Symbol Leverage Cap: ${policy.maxMajorLeverage}x (${policy.majorSymbols.join(", ")})`);
  console.log(`  Altcoin Leverage Cap:      ${policy.maxAltcoinLeverage}x (DOGE, PEPE, SOL, etc.)`);
  console.log(`  Max Order Book Slippage:   ${policy.maxSlippageBps} bps`);
  console.log(`  Max 8h Funding Carry:      ${policy.maxCarryStressFundingRatePct}%`);
  console.log("--------------------------------------------------------------------------------\n");

  // -------------------------------------------------------------
  // SCENARIO 1: Safe Trade Proposal
  // -------------------------------------------------------------
  console.log(">>> [PROPOSAL A: Conservative Momentum Long]");
  const safeIntent: TradeIntent = {
    agentId: "claude-code-trader",
    symbol: "BTCUSDT",
    side: "BUY",
    usd: 3000.0,
    leverage: 2.0,
    orderType: "MARKET",
    reason: "4h EMA breakout with institutional volume confirmation",
    execute: false
  };

  console.log(`    Agent:    ${safeIntent.agentId}`);
  console.log(`    Pair:     ${safeIntent.symbol}`);
  console.log(`    Side:     ${safeIntent.side}`);
  console.log(`    Size:     $${safeIntent.usd.toLocaleString()}`);
  console.log(`    Leverage: ${safeIntent.leverage}x`);
  console.log(`    Reason:   "${safeIntent.reason}"`);
  console.log("    Evaluating against live Binance order book...");

  const verdictA = await evaluator.evaluate(safeIntent);

  if (verdictA.simulation.dataSource !== "LIVE_BINANCE_API") {
    throw new Error(`DEMO INTEGRITY ERROR: Expected LIVE_BINANCE_API, got ${verdictA.simulation.dataSource}`);
  }

  console.log(`\n    VERDICT: [ ${verdictA.decision} ]`);
  console.log(`    Market Data Feed:     \x1b[32m${verdictA.simulation.dataSource}\x1b[0m (Real-time Binance L2 depth, 0ms cache age)`);
  console.log(`    Simulated Execution:`);
  console.log(`      - Best Ask:         $${verdictA.simulation.bestPrice.toFixed(2)}`);
  console.log(`      - Simulated VWAP:   $${verdictA.simulation.vwap.toFixed(2)}`);
  console.log(`      - Book Slippage:    ${verdictA.simulation.slippageBps.toFixed(2)} bps (${verdictA.simulation.levelsConsumed} L2 levels)`);
  console.log(`      - NAV Impact:       ${verdictA.simulation.navConcentrationPct.toFixed(1)}% of NAV`);
  console.log(`      - Funding Rate:     ${verdictA.simulation.fundingRatePct !== null ? `${verdictA.simulation.fundingRatePct}% / 8h` : "N/A"}`);
  console.log(`    Rule Checks:`);
  for (const rc of verdictA.ruleChecks) {
    console.log(`      [${rc.status}] ${rc.rule}: Actual=${rc.actual} | Threshold=${rc.threshold}`);
  }
  console.log(`    Actionable Remediation: ${verdictA.remediation}`);
  console.log(`    Action Ref / Hash:     ${verdictA.actionRef}`);
  console.log("--------------------------------------------------------------------------------\n");

  // -------------------------------------------------------------
  // SCENARIO 2: Dangerous Trade Proposal
  // -------------------------------------------------------------
  console.log(">>> [PROPOSAL B: Reckless Memecoin Degenerate Long]");
  const dangerousIntent: TradeIntent = {
    agentId: "fomo-subagent-07",
    symbol: "DOGEUSDT",
    side: "BUY",
    usd: 25000.0,
    leverage: 10.0,
    orderType: "MARKET",
    reason: "Viral Twitter sentiment spike; aggressive breakout scalping",
    execute: false
  };

  console.log(`    Agent:    ${dangerousIntent.agentId}`);
  console.log(`    Pair:     ${dangerousIntent.symbol}`);
  console.log(`    Side:     ${dangerousIntent.side}`);
  console.log(`    Size:     $${dangerousIntent.usd.toLocaleString()}`);
  console.log(`    Leverage: ${dangerousIntent.leverage}x`);
  console.log(`    Reason:   "${dangerousIntent.reason}"`);
  console.log("    Evaluating against live Binance order book...");

  const verdictB = await evaluator.evaluate(dangerousIntent);

  if (verdictB.simulation.dataSource !== "LIVE_BINANCE_API") {
    throw new Error(`DEMO INTEGRITY ERROR: Expected LIVE_BINANCE_API, got ${verdictB.simulation.dataSource}`);
  }

  console.log(`\n    VERDICT: [ \x1b[31m${verdictB.decision}\x1b[0m ]`);
  console.log(`    Market Data Feed:     \x1b[32m${verdictB.simulation.dataSource}\x1b[0m (Real-time Binance L2 depth, 0ms cache age)`);
  console.log(`    Simulated Execution:`);
  console.log(`      - Best Ask:         $${verdictB.simulation.bestPrice.toFixed(6)}`);
  console.log(`      - Simulated VWAP:   $${verdictB.simulation.vwap.toFixed(6)}`);
  console.log(`      - Book Slippage:    ${verdictB.simulation.slippageBps.toFixed(2)} bps (${verdictB.simulation.levelsConsumed} L2 levels)`);
  console.log(`      - NAV Impact:       ${verdictB.simulation.navConcentrationPct.toFixed(1)}% of NAV`);
  console.log(`      - Price Impact:     $${verdictB.simulation.estimatedPriceImpactUsd.toFixed(2)}`);
  console.log(`      - Funding Rate:     ${verdictB.simulation.fundingRatePct !== null ? `${verdictB.simulation.fundingRatePct}% / 8h` : "N/A"}`);
  console.log(`    Rule Checks:`);
  for (const rc of verdictB.ruleChecks) {
    const color = rc.status === "FAIL" ? "\x1b[31m" : rc.status === "WARN" ? "\x1b[33m" : "\x1b[32m";
    console.log(`      [${color}${rc.status}\x1b[0m] ${rc.rule}: Actual=${rc.actual} | Threshold=${rc.threshold}`);
  }
  console.log(`    Veto Reasons:`);
  for (const r of verdictB.reasons) {
    console.log(`      * ${r}`);
  }
  console.log(`    Actionable Remediation: \x1b[36m${verdictB.remediation}\x1b[0m`);
  console.log(`    Action Ref / Hash:     ${verdictB.actionRef}`);
  console.log("================================================================================");
}

runDemo().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
