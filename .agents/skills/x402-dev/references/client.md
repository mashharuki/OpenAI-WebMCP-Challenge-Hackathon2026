# x402 Client (Buyer) Implementation

## Table of Contents
1. [TypeScript - Fetch Client](#typescript---fetch-client)
2. [TypeScript - Axios Client](#typescript---axios-client)
3. [TypeScript - Multi-Network Client](#typescript---multi-network-client)
4. [Python Client](#python-client)
5. [AI Agent Integration](#ai-agent-integration)
6. [Error Handling](#error-handling)
7. [MCP Client with Auto-Payment](#mcp-client-with-auto-payment)

---

## TypeScript - Fetch Client

```typescript
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const signer = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(signer));

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

// Drop-in replacement for fetch — handles 402 → sign → retry automatically
const response = await fetchWithPayment("https://api.example.com/premium-data");
const data = await response.json();
console.log(data);
```

### With Custom Options

```typescript
const fetchWithPayment = wrapFetchWithPayment(fetch, client, {
  maxRetries: 3,
  onPaymentRequired: async (paymentRequired) => {
    console.log(`Payment required: ${paymentRequired.accepts[0].amount}`);
    return true; // approve payment
  },
});
```

---

## TypeScript - Axios Client

```typescript
import { wrapAxiosWithPayment } from "@x402/axios";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import axios from "axios";

const signer = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(signer));

const api = wrapAxiosWithPayment(
  axios.create({ baseURL: "https://api.example.com" }),
  client
);

// Automatically pays and retries on 402
const response = await api.get("/premium-data");
const { data } = response;
```

---

## TypeScript - Multi-Network Client

Support EVM + Solana in the same client:

```typescript
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";

const client = new x402Client();

// Register EVM (Base, Ethereum, etc.)
client.register(
  "eip155:*",
  new ExactEvmScheme(privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`))
);

// Register Solana
client.register(
  "solana:*",
  new ExactSvmScheme(
    await createKeyPairSignerFromBytes(base58.decode(process.env.SVM_PRIVATE_KEY!))
  )
);

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

// Client automatically picks the right network based on the server's 402 response
const response = await fetchWithPayment("https://api.example.com/paid-resource");
```

### Also Available: Aptos and Stellar

```typescript
import { ExactAptosScheme } from "@x402/aptos/exact/client";
import { ExactStellarScheme, createEd25519Signer } from "@x402/stellar";
import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

client.register("aptos:*", new ExactAptosScheme(
  Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(process.env.APTOS_PRIVATE_KEY!) })
));
client.register("stellar:*", new ExactStellarScheme(
  createEd25519Signer(process.env.STELLAR_PRIVATE_KEY!, "stellar:testnet")
));
```

---

## Python Client

### Async with httpx

```python
import os
from x402.http import FacilitatorConfig, HTTPFacilitatorClient
from x402.http.client import x402Client
from x402.mechanisms.evm.exact import ExactEvmClientScheme
from x402.http.adapters.httpx import wrapHttpxWithPayment
import httpx
from eth_account import Account

signer = Account.from_key(os.environ["EVM_PRIVATE_KEY"])
client = x402Client()
client.register("eip155:*", ExactEvmClientScheme(signer))

async def main():
    async with httpx.AsyncClient() as http:
        wrapped = wrapHttpxWithPayment(http, client)
        response = await wrapped.get("https://api.example.com/paid-endpoint")
        print(response.json())
```

### Sync with requests

```python
import os
import requests
from x402.http.client import x402Client
from x402.mechanisms.evm.exact import ExactEvmClientScheme
from x402.http.adapters.requests import wrapRequestsWithPayment
from eth_account import Account

signer = Account.from_key(os.environ["EVM_PRIVATE_KEY"])
client = x402Client()
client.register("eip155:*", ExactEvmClientScheme(signer))

session = wrapRequestsWithPayment(requests.Session(), client)
response = session.get("https://api.example.com/paid-endpoint")
print(response.json())
```

---

## AI Agent Integration

x402 is designed for AI agents to autonomously pay for tools. The client handles the full 402 → sign → retry cycle without human intervention.

### Claude Agent with CDP Wallet (Python / Strands SDK)

```python
from strands import Agent, tool
from x402.http.client import x402Client
from x402.mechanisms.evm.exact import ExactEvmClientScheme
from cdp import CdpClient
import httpx, base64, json

# Initialize CDP wallet
cdp = CdpClient(api_key_id=os.environ["CDP_API_KEY_ID"])
wallet = cdp.wallets.load(os.environ["CDP_WALLET_SECRET"])

client = x402Client()
client.register("eip155:*", ExactEvmClientScheme(wallet))
http = httpx.Client(timeout=30.0)

@tool
def call_paid_api(url: str) -> dict:
    """Call an x402-protected API endpoint. Handles payment automatically."""
    # First request — may return 402
    response = http.get(url)

    if response.status_code == 402:
        # Parse payment requirements
        payment_data = json.loads(base64.b64decode(
            response.headers["x-payment-required"]
        ))
        req = payment_data["accepts"][0]

        # Create and sign payment payload
        payload = client.createPaymentPayload(req)

        # Retry with payment signature
        headers = {
            "X-PAYMENT-SIGNATURE": base64.b64encode(
                json.dumps(payload).encode()
            ).decode()
        }
        response = http.get(url, headers=headers)

    return response.json()

agent = Agent(tools=[call_paid_api])
agent("Fetch the premium market analysis from https://api.example.com/api/market-analysis")
```

### TypeScript Agent with Anthropic SDK

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const signer = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
const x402 = new x402Client();
x402.register("eip155:*", new ExactEvmScheme(signer));
const fetchWithPayment = wrapFetchWithPayment(fetch, x402);

const anthropic = new Anthropic();

const tools: Anthropic.Tool[] = [
  {
    name: "call_paid_api",
    description: "Call an x402-protected API — payment is handled automatically",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The API endpoint URL" },
      },
      required: ["url"],
    },
  },
];

async function runAgent(userMessage: string) {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  while (true) {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      tools,
      messages,
    });

    if (response.stop_reason === "end_turn") break;

    const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUse) break;

    // Execute tool with automatic x402 payment
    const result = await fetchWithPayment(toolUse.input.url).then(r => r.json());

    messages.push(
      { role: "assistant", content: response.content },
      { role: "user", content: [{ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) }] }
    );
  }

  return messages.at(-1);
}
```

---

## Error Handling

```typescript
try {
  const response = await fetchWithPayment(url);
  const data = await response.json();
} catch (error) {
  if (error.message.includes("No scheme registered")) {
    // Network not supported — register the appropriate scheme
    console.error("Add client.register() for this network");
  } else if (error.message.includes("Payment already attempted")) {
    // Payment failed on retry — likely insufficient balance
    console.error("Check USDC balance on the target network");
  } else if (error.message.includes("insufficient funds")) {
    console.error("Wallet needs more USDC");
  } else {
    throw error;
  }
}
```

### Check Wallet Balance Before Requests

```typescript
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { erc20Abi } from "viem";

const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
const balance = await publicClient.readContract({
  address: USDC_BASE_SEPOLIA,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [signer.address],
});
console.log(`Balance: ${balance} (atomic units)`); // 1 USDC = 1_000_000
```

---

## MCP Client with Auto-Payment

Use `@x402/mcp` to wrap an MCP client so it automatically handles payment when a tool returns 402:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { x402MCPClient, createX402MCPClient } from "@x402/mcp";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

// Option 1: Factory function (recommended)
const x402Mcp = await createX402MCPClient({
  serverUrl: process.env.MCP_SERVER_URL ?? "http://localhost:4022",
  privateKey: process.env.EVM_PRIVATE_KEY as `0x${string}`,
  autoPayment: true,
  onPaymentRequested: async (context) => {
    console.log(`Payment requested for tool: ${context.toolName}`);
    console.log(`Amount: ${context.paymentRequired.accepts[0].amount}`);
    return true; // approve
  },
  onAfterPayment: async (context) => {
    console.log(`Payment settled. TX: ${context.settlementResponse?.txHash}`);
  },
});

// Call tools — payment is automatic
const result = await x402Mcp.callTool("get_premium_data", {});
console.log(result);

// Option 2: Manual instantiation (more control)
const mcpClient = new Client({ name: "my-agent", version: "1.0.0" }, { capabilities: {} });
const signer = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
const paymentClient = new x402Client();
paymentClient.register("eip155:*", new ExactEvmScheme(signer));

const x402McpManual = new x402MCPClient(mcpClient, paymentClient, {
  autoPayment: true,
  onBeforePayment: async (context) => {
    console.log(`About to pay for: ${context.toolName}`);
  },
});
```
