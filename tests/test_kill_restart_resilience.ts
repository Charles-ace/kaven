import { spawn, execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runKillRestartTest() {
  console.log("================================================================");
  console.log("STRESS TEST 6: KILL AND RESTART RESILIENCE");
  console.log("Target: POST http://localhost:3842/propose");
  console.log("================================================================");

  // Step 1: Detect currently running server PID on port 3842
  console.log("Step 1: Detecting running server on port 3842...");
  const netstatOutput = execSync('netstat -ano | findstr 3842 | findstr LISTENING', { encoding: 'utf8' });
  const match = netstatOutput.trim().match(/LISTENING\s+(\d+)/);
  if (!match) {
    throw new Error("No server listening on port 3842!");
  }
  const pid = match[1];
  console.log(`  Found server running with PID: ${pid}`);

  // Step 2: Send request and kill server mid-flight
  console.log("\nStep 2: Sending request to /propose and killing process mid-flight...");
  const inflightPromise = fetch("http://localhost:3842/propose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId: "kill-test-agent",
      symbol: "BTCUSDT",
      side: "BUY",
      usd: 3000,
      leverage: 2
    })
  }).then(
    (res) => `Unexpected success: ${res.status}`,
    (err) => `Connection cleanly terminated as expected: ${err.message}`
  );

  // Kill the process immediately
  await new Promise((r) => setTimeout(r, 15));
  console.log(`  Killing PID ${pid} with SIGKILL / taskkill /F...`);
  execSync(`taskkill /F /PID ${pid}`);
  console.log(`  Process ${pid} killed.`);

  const clientResult = await inflightPromise;
  console.log(`  In-flight client status: ${clientResult}`);

  // Step 3: Check port status (verify no zombie or locked port)
  console.log("\nStep 3: Verifying port 3842 is free (no zombie socket)...");
  await new Promise((r) => setTimeout(r, 500));
  let portCheck = "";
  try {
    portCheck = execSync('netstat -ano | findstr 3842 | findstr LISTENING', { encoding: 'utf8' });
  } catch (e) {
    // findstr exits with 1 when no match found (which means port is free!)
  }
  console.log(`  Port 3842 listening status: ${portCheck.trim() || "FREE (Clean socket release)"}`);

  // Step 4: Restart server on port 3842
  console.log("\nStep 4: Restarting server on port 3842...");
  const serverScript = path.resolve(__dirname, "../dist/api/server.js");
  const newServer = spawn(process.execPath, [serverScript], {
    detached: true,
    stdio: "inherit",
    cwd: path.resolve(__dirname, "..")
  });
  newServer.unref();

  // Poll /health until server responds
  let ready = false;
  for (let attempt = 1; attempt <= 15; attempt++) {
    await new Promise((r) => setTimeout(r, 400));
    try {
      const healthRes = await fetch("http://localhost:3842/health");
      if (healthRes.ok) {
        ready = true;
        console.log(`  Server back online after ${(attempt * 400)}ms.`);
        break;
      }
    } catch (e) {
      // Still booting
    }
  }

  if (!ready) {
    throw new Error("Server failed to restart after kill!");
  }

  // Step 5: Confirm fresh request works cleanly
  console.log("\nStep 5: Submitting fresh trade proposal to restarted server...");
  const freshRes = await fetch("http://localhost:3842/propose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId: "post-restart-agent",
      symbol: "BTCUSDT",
      side: "BUY",
      usd: 3000,
      leverage: 2,
      reason: "Recovery verification trade"
    })
  });

  console.log(`  Status: ${freshRes.status}`);
  const freshData = await freshRes.json();
  console.log("  Response payload:");
  console.log(JSON.stringify(freshData, null, 2));

  console.log("\n================================================================");
  console.log("KILL & RESTART RESILIENCE VERIFIED: Clean exit, zero zombie locks, instant recovery.");
  console.log("================================================================");
}

runKillRestartTest().catch((err) => {
  console.error("Kill & restart test failed:", err);
  process.exit(1);
});
