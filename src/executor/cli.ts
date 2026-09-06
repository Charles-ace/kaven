import readline from "node:readline";
import { CovenantEvaluator } from "../engine/evaluator.js";
import { KavenExecutorService } from "./service.js";

async function main() {
  try {
    if (typeof process.loadEnvFile === "function") process.loadEnvFile();
  } catch {}

  const hasKeys = Boolean(process.env.BINANCE_TESTNET_API_KEY && process.env.BINANCE_TESTNET_SECRET_KEY);
  const evaluator = new CovenantEvaluator();
  const executor = new KavenExecutorService();

  console.log("======================================================================");
  console.log("          KAVEN EXECUTOR INTERACTIVE OPERATOR CONSOLE                ");
  console.log("======================================================================");
  console.log(`[CREDENTIALS] ${hasKeys ? "Active Binance Spot Testnet credentials loaded." : "No credentials found in .env."}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const promptMenu = () => {
    console.log("\nSelect a trade scenario to test live execution:");
    console.log("  1) Safe Trade (Tier 1: $100 BTCUSDT @ 1x) -> Auto-Execute on Binance");
    console.log("  2) Borderline Trade (Tier 2: $6,500 BTCUSDT @ 9x) -> Human Prompt (y/n)");
    console.log("  3) Dangerous Trade (Tier 3: $15,000 DOGEUSDT @ 10x) -> VETO Blocked");
    console.log("  4) Exit");
    rl.question("\nEnter choice (1-4): ", async (choice) => {
      const c = choice.trim();
      if (c === "1") {
        console.log("\n[1] Evaluating Safe Trade ($100 BTC @ 1x)...");
        const verdict = await evaluator.evaluate({
          agentId: "operator-cli",
          symbol: "BTCUSDT",
          side: "BUY",
          usd: 100,
          leverage: 1,
          orderType: "MARKET",
          execute: true
        });
        console.log(`    Verdict: ${verdict.decision} | Tier: ${verdict.tier}`);
        console.log(`    Signed Action: ${verdict.signedAction?.payload.actionId}`);
        console.log("    Dispatching to Binance Spot Testnet...");
        const res = await executor.processAction(verdict.signedAction!);
        console.log(`    Execution Status: ${res.status} (${res.executionType || "N/A"})`);
        if (res.status === "FILLED") {
          console.log(`    Binance Order ID: ${res.binanceResponse.orderId}`);
          console.log(`    Filled Amount: ${res.binanceResponse.executedQty} BTC`);
          console.log(`    Filled Price: $${res.binanceResponse.fills?.[0]?.price || "N/A"}`);
        } else {
          console.log(`    Server Response:`, res.binanceResponse?.msg || res.error || res.reason);
        }
        promptMenu();
      } else if (c === "2") {
        console.log("\n[2] Evaluating Caution Trade ($6,500 BTC @ 9x)...");
        const verdict = await evaluator.evaluate({
          agentId: "operator-cli",
          symbol: "BTCUSDT",
          side: "BUY",
          usd: 6500,
          leverage: 9,
          orderType: "MARKET",
          execute: true
        });
        console.log(`    Verdict: ${verdict.decision} | Tier: ${verdict.tier}`);
        console.log(`    Action ID: ${verdict.signedAction?.payload.actionId}`);
        const res = await executor.processAction(verdict.signedAction!);
        console.log(`    Status: ${res.status}`);
        
        // Human prompt
        rl.question(`\n[HUMAN APPROVAL GATEWAY]\n${res.prompt} `, async (ans) => {
          const approved = ans.trim().toLowerCase() === "y" || ans.trim().toLowerCase() === "yes";
          if (!approved) {
            const discardRes = await executor.confirmAction(verdict.signedAction!.payload.actionId, false);
            console.log(`    Result: ${discardRes.status} (${discardRes.reason})`);
          } else {
            console.log("    Approved! Dispatching to Binance Spot Testnet...");
            const fillRes = await executor.confirmAction(verdict.signedAction!.payload.actionId, true);
            console.log(`    Execution Status: ${fillRes.status} (${fillRes.executionType || "N/A"})`);
            if (fillRes.status === "FILLED") {
              console.log(`    Binance Order ID: ${fillRes.binanceResponse.orderId}`);
              console.log(`    Filled Amount: ${fillRes.binanceResponse.executedQty} BTC`);
            } else {
              console.log(`    Server Response:`, fillRes.binanceResponse?.msg || fillRes.error || fillRes.reason);
            }
          }
          promptMenu();
        });
      } else if (c === "3") {
        console.log("\n[3] Evaluating Dangerous Trade ($15,000 DOGE @ 10x)...");
        const verdict = await evaluator.evaluate({
          agentId: "operator-cli",
          symbol: "DOGEUSDT",
          side: "BUY",
          usd: 15000,
          leverage: 10,
          orderType: "MARKET",
          execute: true
        });
        console.log(`    Verdict: ${verdict.decision} | Tier: ${verdict.tier}`);
        console.log(`    Veto Reason: ${verdict.reasons[0]}`);
        console.log(`    Signed Action Token Issued: ${verdict.signedAction ? "YES" : "NO (Blocked at source)"}`);
        console.log(`    Physical Execution: BLOCKED. Zero credentials or tokens reach the Executor.`);
        promptMenu();
      } else if (c === "4") {
        console.log("\nExiting Kaven Operator Console. Goodbye!");
        rl.close();
        process.exit(0);
      } else {
        console.log("Invalid option, please choose 1-4.");
        promptMenu();
      }
    });
  };

  promptMenu();
}

main().catch(console.error);
