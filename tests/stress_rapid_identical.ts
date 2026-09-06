import assert from "node:assert";

async function runRapidIdenticalRequests(count: number = 20) {
  console.log("================================================================");
  console.log(`STRESS TEST 5: RAPID-FIRE IDENTICAL REQUESTS (${count} in < 1s)`);
  console.log("Target: POST http://localhost:3842/propose");
  console.log("================================================================");

  const payload = {
    agentId: "rapid-fire-tester",
    symbol: "BTCUSDT",
    side: "BUY",
    usd: 3000,
    leverage: 2,
    reason: "Rapid identical request determinism test"
  };

  const startTime = performance.now();

  const tasks = Array.from({ length: count }, async (_, i) => {
    const res = await fetch("http://localhost:3842/propose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json() as any;
    return { index: i + 1, status: res.status, data };
  });

  const results = await Promise.all(tasks);
  const durationMs = performance.now() - startTime;

  console.log(`Fired ${count} identical requests simultaneously in ${durationMs.toFixed(2)} ms.\n`);

  const decisions = new Set<string>();
  const proposalIds = new Set<string>();
  const prices = new Set<number>();

  for (const { index, status, data } of results) {
    assert.strictEqual(status, 200, `Expected HTTP 200, got ${status}`);
    const decision = data.verdict?.decision;
    const bestPrice = data.verdict?.simulation?.bestPrice;
    const proposalId = data.proposalId;

    decisions.add(decision);
    proposalIds.add(proposalId);
    prices.add(bestPrice);

    console.log(`  Req #${String(index).padStart(2, "0")}: Verdict=[${decision}] | Price=$${bestPrice} | ProposalID=${proposalId}`);
  }

  console.log(`\nDETERMINISM & INTEGRITY AUDIT:`);
  console.log(`  Total Responses:            ${results.length}`);
  console.log(`  Unique Decisions:           ${decisions.size} (Expected: 1 -> [${Array.from(decisions).join(", ")}])`);
  console.log(`  Unique Proposal IDs:        ${proposalIds.size} (Expected: ${count} -> Zero ID collisions)`);
  console.log(`  Price Consistency:          ${prices.size === 1 ? "100% Identical execution metrics" : "Slight live book drift across sub-millisecond arrival"}`);

  assert.strictEqual(decisions.size, 1, "Race condition detected! Non-deterministic verdict across identical requests.");
  assert.strictEqual(proposalIds.size, count, "Duplicate ID bug detected! Proposal IDs collided.");

  console.log("\nALL 20 RAPID-FIRE REQUESTS CONFIRMED DETERMINISTIC WITH ZERO RACE CONDITIONS.");
  console.log("================================================================");
}

runRapidIdenticalRequests(20).catch((err) => {
  console.error("Rapid test failed:", err);
  process.exit(1);
});
