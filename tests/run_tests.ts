import assert from "node:assert";
import { walkOrderBook } from "../src/market/order-book-walker.js";
import { DepthSnapshot } from "../src/market/binance-client.js";
import { CovenantEvaluator } from "../src/engine/evaluator.js";
import { TradeIntent } from "../src/types.js";

async function testOrderBookWalker() {
  console.log("[TEST 1] Order Book Walker Math Validation...");

  // Mock depth:
  // Asks:
  // level 1: 100.00 @ 10 ($1000 notional)
  // level 2: 105.00 @ 20 ($2100 notional)
  // level 3: 110.00 @ 50 ($5500 notional)
  const mockDepth: DepthSnapshot = {
    lastUpdateId: 12345,
    bids: [
      ["99.00", "10"],
      ["95.00", "20"]
    ],
    asks: [
      ["100.00", "10"],
      ["105.00", "20"],
      ["110.00", "50"]
    ]
  };

  // Case 1: Order fits entirely within level 1 ($500 notional)
  const res1 = walkOrderBook(mockDepth, "BUY", 500);
  assert.strictEqual(res1.bestPrice, 100);
  assert.strictEqual(res1.vwap, 100);
  assert.strictEqual(res1.slippageBps, 0);
  assert.strictEqual(res1.levelsConsumed, 1);
  assert.strictEqual(res1.fullyFilled, true);

  // Case 2: Order crosses into level 2 ($2000 notional: $1000 from L1, $1000 from L2)
  // L1: 10 qty @ 100 = $1000
  // L2: $1000 / 105 = 9.5238095 qty
  // Total qty = 19.5238095
  // VWAP = 2000 / 19.5238095 = 102.439024
  // Slippage = (102.439024 - 100) / 100 * 10000 = 243.90 bps
  const res2 = walkOrderBook(mockDepth, "BUY", 2000);
  assert.strictEqual(res2.bestPrice, 100);
  assert.strictEqual(res2.levelsConsumed, 2);
  assert.strictEqual(res2.fullyFilled, true);
  assert.ok(Math.abs(res2.vwap - 102.439) < 0.01, `Expected VWAP ~102.44, got ${res2.vwap}`);
  assert.ok(Math.abs(res2.slippageBps - 243.9) < 0.5, `Expected slippage ~243.9 bps, got ${res2.slippageBps}`);

  // Case 3: Sell order walking bids
  // Bids:
  // L1: 99.00 @ 10 ($990)
  // L2: 95.00 @ 20 ($1900)
  const resSell = walkOrderBook(mockDepth, "SELL", 500);
  assert.strictEqual(resSell.bestPrice, 99);
  assert.strictEqual(resSell.vwap, 99);
  assert.strictEqual(resSell.slippageBps, 0);

  console.log("  ✓ L2 Order book walking math verified successfully.");
}

async function testEvaluatorRulesUnit() {
  console.log("[TEST 2] Evaluator Rules & Policy Logic...");

  // Mock Market Client with deterministic depth
  const mockClient: any = {
    getOrderBookDepth: async (symbol: string) => ({
      source: "MOCK",
      depth: {
        lastUpdateId: 1,
        bids: [["50000.00", "100"]],
        asks: [
          ["50000.00", "100"], // $5,000,000 liquidity
          ["50010.00", "100"]
        ]
      }
    }),
    getFuturesPremiumIndex: async (symbol: string) => ({
      source: "MOCK",
      premium: {
        symbol,
        markPrice: "50000.00",
        indexPrice: "50000.00",
        lastFundingRate: "0.0001", // 0.01%
        nextFundingTime: Date.now() + 3600000
      }
    })
  };

  const evaluator = new CovenantEvaluator(
    {
      accountNavUsd: 20000.0,
      maxNavConcentrationPct: 35.0,
      maxMajorLeverage: 10.0,
      maxAltcoinLeverage: 3.0,
      maxSlippageBps: 15.0
    },
    mockClient
  );

  // 1. Safe major trade ($3k BTC, 2x) -> PASS
  const safeIntent: TradeIntent = {
    agentId: "agent-1",
    symbol: "BTCUSDT",
    side: "BUY",
    usd: 3000.0,
    leverage: 2.0,
    orderType: "MARKET",
    execute: false
  };
  const verdict1 = await evaluator.evaluate(safeIntent);
  assert.strictEqual(verdict1.decision, "PASS");
  assert.strictEqual(verdict1.simulation.navConcentrationPct, 15.0);
  assert.ok(verdict1.actionRef !== undefined);

  // 2. Excessive leverage on altcoin (10x DOGE vs 3x cap) -> VETO
  const excessiveLevIntent: TradeIntent = {
    agentId: "agent-2",
    symbol: "DOGEUSDT",
    side: "BUY",
    usd: 2000.0,
    leverage: 10.0,
    orderType: "MARKET",
    execute: false
  };
  const verdict2 = await evaluator.evaluate(excessiveLevIntent);
  assert.strictEqual(verdict2.decision, "VETO");
  assert.ok(verdict2.reasons.some((r) => r.includes("Excessive leverage")));
  assert.ok(verdict2.remediation?.includes("<= 3x"));

  // 3. Excessive concentration ($15k on $20k NAV = 75% vs 35% cap) -> VETO
  const excessiveConcIntent: TradeIntent = {
    agentId: "agent-3",
    symbol: "BTCUSDT",
    side: "BUY",
    usd: 15000.0,
    leverage: 2.0,
    orderType: "MARKET",
    execute: false
  };
  const verdict3 = await evaluator.evaluate(excessiveConcIntent);
  assert.strictEqual(verdict3.decision, "VETO");
  assert.ok(verdict3.reasons.some((r) => r.includes("Portfolio concentration breach")));

  console.log("  ✓ Policy evaluation rules and veto logic verified.");
}

async function testLiveBinanceEvaluation() {
  console.log("[TEST 3] End-to-End Live Evaluation Against Binance API...");

  const liveEvaluator = new CovenantEvaluator({
    accountNavUsd: 20000.0,
    maxNavConcentrationPct: 35.0,
    maxMajorLeverage: 10.0,
    maxAltcoinLeverage: 3.0,
    maxSlippageBps: 15.0
  });

  // Test Live Safe Case
  const liveSafe: TradeIntent = {
    agentId: "demo-claude",
    symbol: "BTCUSDT",
    side: "BUY",
    usd: 3000.0,
    leverage: 2.0,
    orderType: "MARKET",
    reason: "Trend continuation",
    execute: false
  };

  const verdictSafe = await liveEvaluator.evaluate(liveSafe);
  console.log(`  Live BTCUSDT evaluation: ${verdictSafe.decision}`);
  console.log(`    Best Price: $${verdictSafe.simulation.bestPrice}, Slippage: ${verdictSafe.simulation.slippageBps} bps`);
  assert.strictEqual(verdictSafe.decision, "PASS");
  assert.strictEqual(verdictSafe.simulation.navConcentrationPct, 15.0);

  // Test Live Dangerous Case
  const liveDangerous: TradeIntent = {
    agentId: "demo-fomo",
    symbol: "DOGEUSDT",
    side: "BUY",
    usd: 25000.0,
    leverage: 10.0,
    orderType: "MARKET",
    reason: "Doge pump speculation",
    execute: false
  };

  const verdictDangerous = await liveEvaluator.evaluate(liveDangerous);
  console.log(`  Live DOGEUSDT evaluation: ${verdictDangerous.decision}`);
  console.log(`    Best Price: $${verdictDangerous.simulation.bestPrice}, Slippage: ${verdictDangerous.simulation.slippageBps} bps`);
  console.log(`    NAV Concentration: ${verdictDangerous.simulation.navConcentrationPct}%`);
  assert.strictEqual(verdictDangerous.decision, "VETO");
  assert.strictEqual(verdictDangerous.simulation.navConcentrationPct, 125.0);

  console.log("  ✓ End-to-end live market evaluation verified successfully.");
}

async function main() {
  console.log("=================================================");
  console.log("         LIMBO AUTOMATED TEST SUITE              ");
  console.log("=================================================");
  try {
    await testOrderBookWalker();
    await testEvaluatorRulesUnit();
    await testLiveBinanceEvaluation();
    console.log("\n=================================================");
    console.log("    ALL TESTS PASSED (3/3 SUITES SUCCESSFUL)     ");
    console.log("=================================================");
  } catch (err) {
    console.error("\nTEST SUITE FAILED:", err);
    process.exit(1);
  }
}

main();
