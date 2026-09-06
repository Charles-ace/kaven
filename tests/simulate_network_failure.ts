import { CovenantEvaluator } from "../src/engine/evaluator.js";

async function runNetworkFailureSimulation() {
  // Point Binance base URL to an unreachable endpoint to simulate network / API outage
  process.env.BINANCE_API_BASE_URL = "http://127.0.0.1:59999";

  console.log("Simulating complete network failure (BINANCE_API_BASE_URL=http://127.0.0.1:59999)...");
  const evaluator = new CovenantEvaluator();

  const verdict = await evaluator.evaluate({
    agentId: "network-test-agent",
    symbol: "BTCUSDT",
    side: "BUY",
    usd: 3000.0,
    leverage: 2.0,
    orderType: "MARKET"
  });

  console.log(JSON.stringify(verdict, null, 2));
}

runNetworkFailureSimulation().catch((err) => {
  console.error("Simulation error:", err);
  process.exit(1);
});
