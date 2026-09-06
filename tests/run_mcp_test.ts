import assert from "node:assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testMcpServer() {
  console.log("[TEST MCP] Starting Limbo MCP Client -> Stdio Server test...");

  const serverScript = path.resolve(__dirname, "../src/mcp/server.ts");

  const isWin = process.platform === "win32";
  const transport = new StdioClientTransport({
    command: isWin ? "cmd.exe" : "npx",
    args: isWin ? ["/c", "npx", "tsx", serverScript] : ["tsx", serverScript]
  });

  const client = new Client(
    {
      name: "test-mcp-client",
      version: "1.0.0"
    },
    {
      capabilities: {}
    }
  );

  await client.connect(transport);
  console.log("  ✓ MCP Client connected to Limbo stdio transport.");

  // 1. List tools
  const toolsResult = await client.listTools();
  assert.ok(toolsResult.tools.some((t) => t.name === "limbo_evaluate_proposal"));
  assert.ok(toolsResult.tools.some((t) => t.name === "limbo_get_covenants"));
  console.log(`  ✓ Discovered ${toolsResult.tools.length} MCP tools (limbo_evaluate_proposal, limbo_get_covenants, + aliases).`);

  // 2. Call limbo_get_covenants
  const covCall = await client.callTool({
    name: "limbo_get_covenants",
    arguments: {}
  });
  const covContent = JSON.parse((covCall.content[0] as any).text);
  assert.strictEqual(covContent.accountNavUsd, 20000);
  console.log("  ✓ Tool call limbo_get_covenants returned valid policy.");

  // 3. Call limbo_evaluate_proposal (PASS case)
  const evalPassCall = await client.callTool({
    name: "limbo_evaluate_proposal",
    arguments: {
      symbol: "BTCUSDT",
      side: "BUY",
      usd: 3000,
      leverage: 2,
      agentId: "mcp-test-agent",
      reason: "Safe test trade"
    }
  });
  const passVerdict = JSON.parse((evalPassCall.content[0] as any).text);
  assert.strictEqual(passVerdict.decision, "PASS");
  console.log("  ✓ Tool call sentinel_evaluate_proposal returned PASS for safe BTC trade.");

  // 4. Call limbo_evaluate_proposal (VETO case)
  const evalVetoCall = await client.callTool({
    name: "limbo_evaluate_proposal",
    arguments: {
      symbol: "DOGEUSDT",
      side: "BUY",
      usd: 25000,
      leverage: 10,
      agentId: "mcp-fomo-agent",
      reason: "Unsafe doge trade"
    }
  });
  const vetoVerdict = JSON.parse((evalVetoCall.content[0] as any).text);
  assert.strictEqual(vetoVerdict.decision, "VETO");
  console.log("  ✓ Tool call sentinel_evaluate_proposal returned VETO for unsafe DOGE trade.");

  await transport.close();
  console.log("  ✓ MCP stdio transport cleanly closed.");
  console.log("  ✓ All MCP integration tests passed!");
}

testMcpServer().catch((err) => {
  console.error("MCP test failed:", err);
  process.exit(1);
});
