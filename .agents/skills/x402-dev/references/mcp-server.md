# x402 MCP Server Integration

## Table of Contents
1. [Overview: Monetizing MCP Tools](#overview-monetizing-mcp-tools)
2. [MCP Server with Payment-Gated Tools](#mcp-server-with-payment-gated-tools)
3. [MCP Client with Auto-Payment](#mcp-client-with-auto-payment)
4. [Full Fullstack Example](#full-fullstack-example)
5. [Service Discovery via /mcp/tools Endpoint](#service-discovery-via-mcptools-endpoint)
6. [Payment Lifecycle Hooks](#payment-lifecycle-hooks)
7. [Testing MCP + x402 Integration](#testing-mcp--x402-integration)

---

## Overview: Monetizing MCP Tools

x402 enables AI agents to pay for MCP tools automatically. The flow:

```
AI Agent (Claude)
  → calls MCP tool
  → tool server returns 402 PaymentRequired
  → x402MCPClient creates signed payment payload
  → retries tool call with X-PAYMENT-SIGNATURE header
  → tool executes, returns result
  → payment settles on-chain
```

This allows tool providers to **charge per-call** without any session management, API keys, or billing infrastructure.

---

## MCP Server with Payment-Gated Tools

```typescript
// server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { x402MCPServer } from "@x402/mcp";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "https://x402.org/facilitator";
const WALLET_ADDRESS = process.env.WALLET_ADDRESS!;
const NETWORK = "eip155:84532"; // Base Sepolia testnet

// Initialize x402 server
const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const x402Server = new x402MCPServer(facilitator)
  .register(NETWORK, new ExactEvmScheme());

// Create MCP server
const mcpServer = new McpServer({
  name: "paid-tools-server",
  version: "1.0.0",
});

// Register payment-gated tools
x402Server.wrapTool(mcpServer, "get_weather", {
  description: "Get real-time weather data for a location",
  inputSchema: z.object({
    location: z.string().describe("City name or coordinates"),
  }),
  accepts: [{
    scheme: "exact",
    price: "$0.001",
    network: NETWORK,
    payTo: WALLET_ADDRESS,
  }],
  handler: async ({ location }) => {
    // Your actual implementation
    const weatherData = await fetchWeatherAPI(location);
    return {
      content: [{
        type: "text",
        text: JSON.stringify(weatherData),
      }],
    };
  },
});

x402Server.wrapTool(mcpServer, "analyze_data", {
  description: "Run AI-powered analysis on provided data",
  inputSchema: z.object({
    data: z.string().describe("JSON data to analyze"),
    type: z.enum(["sentiment", "summary", "classification"]),
  }),
  accepts: [{
    scheme: "exact",
    price: "$0.01",
    network: NETWORK,
    payTo: WALLET_ADDRESS,
  }],
  handler: async ({ data, type }) => {
    const result = await runAnalysis(data, type);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  },
});

// Also register free tools normally
mcpServer.tool("ping", {}, async () => ({
  content: [{ type: "text", text: "pong" }],
}));

// Start server
const transport = new StdioServerTransport();
await mcpServer.connect(transport);
```

### HTTP Transport (for remote MCP)

```typescript
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(4022, () => console.log("MCP server running on :4022"));
```

---

## MCP Client with Auto-Payment

```typescript
// client.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createX402MCPClient, x402MCPClient } from "@x402/mcp";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

// Option A: Factory function (recommended for most cases)
const client = await createX402MCPClient({
  serverUrl: process.env.MCP_SERVER_URL ?? "http://localhost:4022",
  privateKey: process.env.EVM_PRIVATE_KEY as `0x${string}`,
  autoPayment: true,
  onPaymentRequested: async (context) => {
    const amount = context.paymentRequired.accepts[0].amount;
    const tool = context.toolName;
    console.log(`Paying ${amount} USDC for tool: ${tool}`);
    return true; // return false to decline payment
  },
  onAfterPayment: async (context) => {
    const txHash = context.settlementResponse?.txHash;
    console.log(`Payment complete. TX: ${txHash}`);
  },
});

// List available tools
const tools = await client.listTools();
console.log("Available tools:", tools.tools.map(t => t.name));

// Call a paid tool — payment is handled automatically
const result = await client.callTool("get_weather", { location: "San Francisco" });
console.log(result.content[0].text);


// Option B: Manual instantiation (for existing MCP client setup)
const mcpClient = new Client({ name: "my-agent", version: "1.0.0" }, { capabilities: {} });

// Connect via HTTP
const transport = new StreamableHTTPClientTransport(
  new URL(process.env.MCP_SERVER_URL ?? "http://localhost:4022/mcp")
);
await mcpClient.connect(transport);

// Wrap with x402 payment capability
const signer = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
const paymentClient = new x402Client();
paymentClient.register("eip155:*", new ExactEvmScheme(signer));

const x402Mcp = new x402MCPClient(mcpClient, paymentClient, {
  autoPayment: true,
});

// Same interface as regular MCP client, but with auto-payment
const result2 = await x402Mcp.callTool("analyze_data", {
  data: JSON.stringify({ sales: [100, 200, 300] }),
  type: "summary",
});
```

---

## Full Fullstack Example

```
my-paid-api/
├── server/
│   ├── index.ts          # Express + x402 seller middleware
│   └── mcp-server.ts     # MCP server with paid tools
├── client/
│   ├── agent.ts          # AI agent with auto-payment
│   └── mcp-client.ts     # MCP client wrapper
└── .env
```

### .env

```bash
# Server
WALLET_ADDRESS=0x...            # Receives payments
FACILITATOR_URL=https://x402.org/facilitator

# Client
EVM_PRIVATE_KEY=0x...           # Pays for requests
MCP_SERVER_URL=http://localhost:4022
```

### Running the Fullstack

```bash
# Terminal 1: Start MCP server
npx ts-node server/mcp-server.ts

# Terminal 2: Run agent
npx ts-node client/agent.ts
```

---

## Service Discovery via /mcp/tools Endpoint

For HTTP-based MCP servers, expose a discovery endpoint so agents can dynamically discover tools and their prices:

```typescript
// Express route for tool discovery
app.get("/mcp/tools", (req, res) => {
  const tools = x402Server.getRegisteredTools().map(tool => ({
    tool_name: tool.name,
    tool_description: tool.description,
    endpoint_path: `/mcp/tools/${tool.name}`,
    x402_metadata: {
      price_usdc_display: tool.accepts[0].price,
      network: tool.accepts[0].network,
      scheme: tool.accepts[0].scheme,
    },
    input_schema: tool.inputSchema,
  }));

  res.json({ version: "1.0", tools });
});
```

### Discovering Tools from Client

```typescript
async function discoverTools(serverUrl: string) {
  const response = await fetch(`${serverUrl}/mcp/tools`);
  const { tools } = await response.json();

  return tools.map((t: any) => ({
    name: t.tool_name,
    description: t.tool_description,
    price: t.x402_metadata.price_usdc_display,
    network: t.x402_metadata.network,
  }));
}

const tools = await discoverTools("http://localhost:4022");
console.log("Available paid tools:");
tools.forEach(t => console.log(`  ${t.name}: ${t.price} on ${t.network}`));
```

---

## Payment Lifecycle Hooks

```typescript
const x402Mcp = new x402MCPClient(mcpClient, paymentClient, {
  autoPayment: true,

  // Called when tool returns 402 — return false to decline
  onPaymentRequested: async (context) => {
    const { toolName, toolParams, paymentRequired } = context;
    const amount = paymentRequired.accepts[0].amount;
    const maxBudget = process.env.MAX_PAYMENT_PER_CALL ?? "10000"; // atomic units

    if (parseInt(amount) > parseInt(maxBudget)) {
      console.warn(`Payment ${amount} exceeds budget ${maxBudget}, declining`);
      return false;
    }
    return true;
  },

  // Called just before signing and submitting payment
  onBeforePayment: async (context) => {
    const { toolName, paymentRequired } = context;
    await logPaymentAttempt(toolName, paymentRequired);
  },

  // Called after successful payment and tool execution
  onAfterPayment: async (context) => {
    const { toolName, settlementResponse, result } = context;
    await recordPayment({
      tool: toolName,
      txHash: settlementResponse?.txHash,
      timestamp: new Date(),
    });
  },

  // Called when payment or tool execution fails
  onError: async (context) => {
    const { toolName, error } = context;
    console.error(`Tool ${toolName} failed:`, error.message);
  },
});
```

---

## Testing MCP + x402 Integration

```typescript
// test/mcp-payment.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createX402MCPClient } from "@x402/mcp";

// Use Base Sepolia testnet — get test USDC from faucet
const TEST_PRIVATE_KEY = process.env.TEST_EVM_PRIVATE_KEY as `0x${string}`;
const SERVER_URL = "http://localhost:4022";

describe("MCP Payment Integration", () => {
  let client: Awaited<ReturnType<typeof createX402MCPClient>>;

  beforeAll(async () => {
    client = await createX402MCPClient({
      serverUrl: SERVER_URL,
      privateKey: TEST_PRIVATE_KEY,
      autoPayment: true,
    });
  });

  it("should list available tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.find(t => t.name === "get_weather")).toBeDefined();
  });

  it("should automatically pay for a tool", async () => {
    const payments: string[] = [];

    const clientWithTracking = await createX402MCPClient({
      serverUrl: SERVER_URL,
      privateKey: TEST_PRIVATE_KEY,
      autoPayment: true,
      onAfterPayment: async (ctx) => {
        if (ctx.settlementResponse?.txHash) {
          payments.push(ctx.settlementResponse.txHash);
        }
      },
    });

    const result = await clientWithTracking.callTool("get_weather", {
      location: "New York",
    });

    expect(result.content[0].type).toBe("text");
    expect(payments.length).toBe(1); // One payment was made
  });

  it("should decline payment when budget exceeded", async () => {
    const stingyClient = await createX402MCPClient({
      serverUrl: SERVER_URL,
      privateKey: TEST_PRIVATE_KEY,
      autoPayment: true,
      onPaymentRequested: async () => false, // Always decline
    });

    await expect(
      stingyClient.callTool("get_weather", { location: "Paris" })
    ).rejects.toThrow(/payment declined/i);
  });
});
```

### Get Test USDC for Base Sepolia

```bash
# Coinbase Developer Platform faucet:
# https://faucet.coinbase.com/

# Or use the x402.org faucet:
curl -X POST https://x402.org/faucet \
  -H "Content-Type: application/json" \
  -d '{"address": "0xYOUR_WALLET_ADDRESS", "network": "eip155:84532"}'
```
