import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { CovenantEvaluator } from "../engine/evaluator.js";
import { TradeIntentSchema } from "../types.js";

export async function runMcpServer() {
  const evaluator = new CovenantEvaluator();

  const server = new Server(
    {
      name: "kaven",
      version: "1.0.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const inputSchema = {
      type: "object" as const,
      properties: {
        symbol: {
          type: "string",
          description: "Trading pair symbol, e.g. BTCUSDT, DOGEUSDT"
        },
        side: {
          type: "string",
          enum: ["BUY", "SELL", "buy", "sell"],
          description: "Order side: BUY or SELL"
        },
        usd: {
          type: "number",
          description: "Trade notional in USD"
        },
        leverage: {
          type: "number",
          description: "Proposed leverage multiple (default: 1x)"
        },
        agentId: {
          type: "string",
          description: "Identifier of the calling AI agent (e.g. claude-code, cursor-agent)"
        },
        orderType: {
          type: "string",
          enum: ["MARKET", "LIMIT"],
          description: "Order type (MARKET or LIMIT)"
        },
        reason: {
          type: "string",
          description: "Agent's strategic rationale for the trade"
        },
        action_ref: {
          type: "string",
          description: "Optional upstream action hash for idempotency and audit trails"
        }
      },
      required: ["symbol", "side", "usd"]
    };

    return {
      tools: [
        {
          name: "kaven_evaluate_proposal",
          description:
            "Pre-flight safety covenant check for proposed trade intents. Intercepts order payloads, runs L2 book-walking for realistic slippage, evaluates NAV concentration and leverage policies, and returns a PASS/VETO/ESCALATE verdict with deterministic RFC 8785 proof before any order is submitted to execution.",
          inputSchema
        },
        {
          name: "kaven_get_covenants",
          description:
            "Returns active safety covenant limits, including declared NAV, max concentration %, leverage ceilings, and slippage tolerance.",
          inputSchema: { type: "object", properties: {} }
        },
        {
          name: "limbo_evaluate_proposal",
          description: "Backward-compatible alias for kaven_evaluate_proposal",
          inputSchema
        },
        {
          name: "limbo_get_covenants",
          description: "Backward-compatible alias for kaven_get_covenants",
          inputSchema: { type: "object", properties: {} }
        },
        {
          name: "sentinel_evaluate_proposal",
          description: "Backward-compatible alias for kaven_evaluate_proposal",
          inputSchema
        },
        {
          name: "sentinel_get_covenants",
          description: "Backward-compatible alias for kaven_get_covenants",
          inputSchema: { type: "object", properties: {} }
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "kaven_get_covenants" || name === "limbo_get_covenants" || name === "sentinel_get_covenants") {
      const policy = evaluator.getPolicy();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(policy, null, 2)
          }
        ]
      };
    }

    if (name === "kaven_evaluate_proposal" || name === "limbo_evaluate_proposal" || name === "sentinel_evaluate_proposal") {
      try {
        const parsed = TradeIntentSchema.parse(args);
        const verdict = await evaluator.evaluate(parsed);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(verdict, null, 2)
            }
          ]
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Limbo Evaluation Error: ${err.message}`
            }
          ]
        };
      }
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr so stdout remains clean for MCP JSON-RPC protocol
  console.error("Limbo MCP Server running on stdio.");
}

// Auto-run if executed as entry point
runMcpServer().catch((err) => {
  console.error("Fatal MCP server error:", err);
  process.exit(1);
});
