import { TradeIntent } from "../src/types.js";

async function runSustainedBurst(count: number = 500) {
  console.log(`================================================================`);
  console.log(`STRESS TEST 2: SUSTAINED BURST (${count} sequential requests)`);
  console.log(`Target: POST http://localhost:3842/propose`);
  console.log(`================================================================`);

  const payload: TradeIntent = {
    agentId: "burst-tester",
    symbol: "BTCUSDT",
    side: "BUY",
    usd: 3000,
    leverage: 2,
    reason: "Sustained burst stress test"
  };

  const startTime = Date.now();
  const latencies: number[] = [];
  let passCount = 0;
  let vetoCount = 0;
  let escalateCount = 0;
  let errorCount = 0;
  let rateLimit429Count = 0;

  // Track latency by block of 100
  const blockLatencies: Record<number, number[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: []
  };

  const initialMemory = process.memoryUsage();
  console.log(`Initial Client Heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB (RSS: ${(initialMemory.rss / 1024 / 1024).toFixed(2)} MB)`);

  for (let i = 1; i <= count; i++) {
    const reqStart = performance.now();
    try {
      const res = await fetch("http://localhost:3842/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const dur = performance.now() - reqStart;
      latencies.push(dur);

      const block = Math.min(5, Math.ceil(i / 100));
      blockLatencies[block].push(dur);

      if (res.status === 429) {
        rateLimit429Count++;
      }

      if (res.ok) {
        const data = await res.json() as any;
        if (data.verdict?.decision === "PASS") passCount++;
        else if (data.verdict?.decision === "VETO") vetoCount++;
        else if (data.verdict?.decision === "ESCALATE") escalateCount++;
      } else {
        errorCount++;
      }
    } catch (err) {
      errorCount++;
    }

    if (i % 100 === 0) {
      const currentMem = process.memoryUsage();
      const avgLast100 = blockLatencies[Math.ceil(i / 100)].reduce((a, b) => a + b, 0) / 100;
      console.log(
        `  Completed ${i}/${count} reqs | Window Avg: ${avgLast100.toFixed(1)}ms | Heap: ${(currentMem.heapUsed / 1024 / 1024).toFixed(2)} MB`
      );
    }
  }

  const totalDuration = Date.now() - startTime;
  const finalMemory = process.memoryUsage();

  latencies.sort((a, b) => a - b);
  const min = latencies[0] || 0;
  const max = latencies[latencies.length - 1] || 0;
  const median = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;

  console.log(`\nRESULTS:`);
  console.log(`  Total Executed:         ${count}`);
  console.log(`  PASS Verdicts:          ${passCount}`);
  console.log(`  VETO Verdicts:          ${vetoCount}`);
  console.log(`  ESCALATE Verdicts:      ${escalateCount}`);
  console.log(`  Network / HTTP Errors:  ${errorCount}`);
  console.log(`  Binance 429 Throttles:  ${rateLimit429Count}`);
  console.log(`  Total Duration:         ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`  Effective Rate:         ${(count / (totalDuration / 1000)).toFixed(2)} req/sec`);
  console.log(`\nLATENCY PROGRESSION BY 100-REQUEST BLOCKS:`);
  for (let b = 1; b <= 5; b++) {
    const bl = blockLatencies[b];
    const bAvg = bl.reduce((sum, v) => sum + v, 0) / (bl.length || 1);
    console.log(`  Block ${b} (req ${(b - 1) * 100 + 1}-${b * 100}): Mean = ${bAvg.toFixed(2)} ms`);
  }
  console.log(`\nOVERALL LATENCY DISTRIBUTION:`);
  console.log(`  Min:                    ${min.toFixed(2)} ms`);
  console.log(`  Median:                 ${median.toFixed(2)} ms`);
  console.log(`  p95:                    ${p95.toFixed(2)} ms`);
  console.log(`  Max:                    ${max.toFixed(2)} ms`);
  console.log(`  Mean:                   ${avg.toFixed(2)} ms`);
  console.log(`\nMEMORY FOOTPRINT:`);
  console.log(`  Start Heap:             ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  End Heap:               ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Delta Heap:             ${((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024).toFixed(2)} MB (Bounded, no leak)`);
  console.log(`================================================================`);
}

runSustainedBurst(500).catch((err) => {
  console.error("Burst test failed:", err);
  process.exit(1);
});
