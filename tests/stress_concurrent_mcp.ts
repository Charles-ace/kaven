import assert from "node:assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runConcurrentMcpClients() {
  console.log("================================================================");
  console.log("STRESS TEST 3: MULTIPLE CONCURRENT MCP CLIENT CONNECTIONS (4 stdio clients)");
  console.log("================================================================");

  const serverScript = path.resolve(__dirname, "../src/mcp/server.ts");
  const isWin = process.platform === "win32";

  // Define 4 test clients with distinct identities and payloads
  const clientConfigs = [
    {
      id: "client-1",
      agentId: "agent-1-safe-btc",
      symbol: "BTCUSDT",
      usd: 3000,
      leverage: 2,
      expectedDecision: "PASS"
    },
    {
      id: "client-2",
      agentId: "agent-2-danger-doge",
      symbol: "DOGEUSDT",
      usd: 25000,
      leverage: 10,
      expectedDecision: "VETO"
    },
    {
      id: "client-3",
      agentId: "agent-3-invalid-sym",
      symbol: "FAKECOINUSDT",
      usd: 1000,
      leverage: 1,
      expectedDecision: "VETO"
    },
    {
      id: "client-4",
      agentId: "agent-4-extreme-lev",
      symbol: "BTCUSDT",
      usd: 3000,
      leverage: 9999,
      expectedDecision: "VETO"
    }
  ];

  console.log("Spawning 4 independent MCP server child processes...");

  const instances = await Promise.all(
    clientConfigs.map(async (cfg) => {
      const transport = new StdioClientTransport({
        command: isWin ? "cmd.exe" : "npx",
        args: isWin ? ["/c", "npx", "tsx", serverScript] : ["tsx", serverScript]
      });

      const client = new Client(
        { name: `test-mcp-${cfg.id}`, version: "1.0.0" },
        { capabilities: {} }
      );

      await client.connect(transport);
      return { cfg, transport, client };
    })
  );

  console.log("All 4 MCP clients connected. Firing simultaneous tool calls across all stdio channels...");

  const startTime = performance.now();

  const results = await Promise.all(
    instances.map(async ({ cfg, client }) => {
      const callStart = performance.now();
      const res = await client.callTool({
        name: "limbo_evaluate_proposal",
        arguments: {
          agentId: cfg.agentId,
          symbol: cfg.symbol,
          side: "BUY",
          usd: cfg.usd,
          leverage: cfg.leverage,
          reason: `Concurrent stdio test for ${cfg.id}`
        }
      });
      const duration = performance.now() - callStart;
      const verdict = JSON.parse((res.content[0] as any).text);
      return { cfg, verdict, duration };
    })
  );

  const totalTime = performance.now() - startTime;

  console.log(`\nRESULTS ACROSS CONCURRENT MCP CLIENTS (Total time: ${totalTime.toFixed(2)}ms):`);

  for (const { cfg, verdict, duration } of results) {
    console.log(`\n[${cfg.id.toUpperCase()}] (${duration.toFixed(2)}ms)`);
    console.log(`  Sent:     Agent=${cfg.agentId} | Symbol=${cfg.symbol} | Lev=${cfg.leverage}x | Usd=$${cfg.usd}`);
    console.log(`  Received: Agent=${verdict.agentId} | Symbol=${verdict.symbol} | Decision=${verdict.decision}`);
    console.log(`  Proposal ID: ${verdict.proposalId}`);

    // Assert absolute data isolation (no crossed wires)
    assert.strictEqual(verdict.agentId, cfg.agentId, `Cross-talk bug! Expected ${cfg.agentId} but got ${verdict.agentId}`);
    assert.strictEqual(verdict.symbol, cfg.symbol, `Cross-talk bug! Expected ${cfg.symbol} but got ${verdict.symbol}`);
    assert.strictEqual(verdict.decision, cfg.expectedDecision, `Decision mismatch for ${cfg.id}`);
  }

  console.log("\nClosing all 4 MCP stdio connections...");
  await Promise.all(instances.map(({ transport }) => transport.close()));
  console.log("All 4 connections cleanly closed. ZERO cross-talk detected.");
  console.log("================================================================");
}

runConcurrentMcpClients().catch((err) => {
  console.error("Concurrent MCP test failed:", err);
  process.exit(1);
});
