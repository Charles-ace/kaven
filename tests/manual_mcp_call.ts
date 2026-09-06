import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const serverPath = path.resolve(__dirname, "../src/mcp/server.ts");
  const isWin = process.platform === "win32";

  console.log("Spawning Limbo MCP server on stdio...");
  const child = spawn(isWin ? "cmd.exe" : "npx", isWin ? ["/c", "npx", "tsx", serverPath] : ["tsx", serverPath], {
    stdio: ["pipe", "pipe", "inherit"]
  });

  child.stdout.setEncoding("utf8");

  // Step 1: Send Initialize Request
  const initRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "manual-stdio-inspector", version: "1.0.0" }
    }
  };

  // Step 2: Send Tool Call Request
  const toolCallRequest = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "limbo_evaluate_proposal",
      arguments: {
        agentId: "manual-mcp-tester",
        symbol: "BTCUSDT",
        side: "BUY",
        usd: 3000,
        leverage: 2,
        reason: "Manual stdio wire verification"
      }
    }
  };

  let buffer = "";

  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed);
        if (msg.id === 1) {
          console.log("\n>>> RAW STDIN (Step 1: initialize):");
          console.log(JSON.stringify(initRequest));
          console.log("\n<<< RAW STDOUT (Response 1: initialize):");
          console.log(trimmed);

          // Send initialized notification
          child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

          // Send tool call request
          console.log("\n>>> RAW STDIN (Step 2: tools/call limbo_evaluate_proposal):");
          console.log(JSON.stringify(toolCallRequest));
          child.stdin.write(JSON.stringify(toolCallRequest) + "\n");
        } else if (msg.id === 2) {
          console.log("\n<<< RAW STDOUT (Response 2: tools/call response):");
          console.log(trimmed);
          child.kill();
          process.exit(0);
        }
      } catch (err) {
        // Not JSON line or partial line
      }
    }
  });

  child.stdin.write(JSON.stringify(initRequest) + "\n");
}

main().catch((err) => {
  console.error("Manual MCP call error:", err);
  process.exit(1);
});
