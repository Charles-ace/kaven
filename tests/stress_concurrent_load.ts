import { TradeIntent } from "../src/types.js";

async function runConcurrentLoadTest(totalRequests: number = 100) {
  console.log(`================================================================`);
  console.log(`STRESS TEST 1: CONCURRENT LOAD (${totalRequests} simultaneous requests)`);
  console.log(`Target: POST http://localhost:3842/propose`);
  console.log(`================================================================`);

  const payloads: TradeIntent[] = [
    { agentId: "agent-alpha", symbol: "BTCUSDT", side: "BUY", usd: 3000, leverage: 2, reason: "Load test safe A" },
    { agentId: "agent-beta", symbol: "DOGEUSDT", side: "BUY", usd: 25000, leverage: 10, reason: "Load test veto B" },
    { agentId: "agent-gamma", symbol: "ETHUSDT", side: "BUY", usd: 4000, leverage: 3, reason: "Load test safe C" },
    { agentId: "agent-delta", symbol: "BTCUSDT", side: "SELL", usd: 2000, leverage: 1, reason: "Load test safe D" }
  ];

  const startTime = Date.now();
  const latencies: number[] = [];
  let successCount = 0;
  let failCount = 0;
  let malformedCount = 0;

  const tasks = Array.from({ length: totalRequests }, async (_, i) => {
    const payload = payloads[i % payloads.length];
    const reqStart = performance.now();
    try {
      const res = await fetch("http://localhost:3842/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const reqDuration = performance.now() - reqStart;
      latencies.push(reqDuration);

      if (res.ok) {
        const data = await res.json() as any;
        if (data.proposalId && data.verdict && ["PASS", "VETO", "ESCALATE"].includes(data.verdict.decision)) {
          successCount++;
        } else {
          malformedCount++;
        }
      } else {
        failCount++;
      }
    } catch (err) {
      failCount++;
    }
  });

  await Promise.all(tasks);
  const totalDuration = Date.now() - startTime;

  latencies.sort((a, b) => a - b);
  const min = latencies[0] || 0;
  const max = latencies[latencies.length - 1] || 0;
  const median = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const avg = latencies.reduce((sum, v) => sum + v, 0) / (latencies.length || 1);

  console.log(`\nRESULTS:`);
  console.log(`  Total Requests:         ${totalRequests}`);
  console.log(`  Successful (HTTP 200):  ${successCount} (${((successCount / totalRequests) * 100).toFixed(1)}%)`);
  console.log(`  Failed / Errors:        ${failCount}`);
  console.log(`  Malformed Responses:    ${malformedCount}`);
  console.log(`  Total Test Time:        ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`  Throughput:             ${(totalRequests / (totalDuration / 1000)).toFixed(2)} req/sec`);
  console.log(`\nLATENCY DISTRIBUTION:`);
  console.log(`  Min Latency:            ${min.toFixed(2)} ms`);
  console.log(`  Median (p50):           ${median.toFixed(2)} ms`);
  console.log(`  p95 Latency:            ${p95.toFixed(2)} ms`);
  console.log(`  Max Latency:            ${max.toFixed(2)} ms`);
  console.log(`  Mean Latency:           ${avg.toFixed(2)} ms`);
  console.log(`================================================================`);
}

runConcurrentLoadTest(100).catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
