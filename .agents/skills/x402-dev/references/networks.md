# x402 Networks, Facilitators & Migration

## Table of Contents
1. [Network Reference](#network-reference)
2. [Facilitator Configuration](#facilitator-configuration)
3. [USDC Token Addresses](#usdc-token-addresses)
4. [Testnet Setup](#testnet-setup)
5. [Mainnet Migration Checklist](#mainnet-migration-checklist)
6. [Multi-Network Configuration](#multi-network-configuration)
7. [Custom Facilitator](#custom-facilitator)

---

## Network Reference

| Network | CAIP-2 ID | Environment | Chain ID |
|---|---|---|---|
| Base Mainnet | `eip155:8453` | Production | 8453 |
| Base Sepolia | `eip155:84532` | Testnet | 84532 |
| Ethereum Mainnet | `eip155:1` | Production | 1 |
| Solana Mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | Production | - |
| Solana Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | Testnet | - |

**Recommended starting network: Base Sepolia** — low fees, fast confirmations, easy testnet USDC from faucet.

---

## Facilitator Configuration

### Testnet (Free, Community)

```typescript
const facilitator = new HTTPFacilitatorClient({
  url: "https://x402.org/facilitator",
});
```

Supports:
- Base Sepolia (`eip155:84532`)
- Solana Devnet (`solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`)

### Mainnet (Coinbase CDP)

```typescript
const facilitator = new HTTPFacilitatorClient({
  url: "https://api.cdp.coinbase.com/platform/v2/x402",
  // CDP API key required for mainnet
  apiKey: process.env.CDP_API_KEY,
});
```

Supports:
- Base Mainnet (`eip155:8453`)
- Solana Mainnet (`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`)

### Environment-Based Configuration

```typescript
// Automatically use the right facilitator
const FACILITATOR_URL = process.env.NODE_ENV === "production"
  ? "https://api.cdp.coinbase.com/platform/v2/x402"
  : "https://x402.org/facilitator";

const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
```

---

## USDC Token Addresses

### EVM Networks

| Network | USDC Address |
|---|---|
| Base Mainnet | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Ethereum Mainnet | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Arbitrum One | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| Optimism | `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` |

### Solana Networks

| Network | USDC Mint Address |
|---|---|
| Solana Mainnet | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| Solana Devnet | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |

### Amount Calculation

```typescript
// USDC has 6 decimal places
// $0.001 = 1000 atomic units
// $1.00  = 1_000_000 atomic units

function dollarsToAtomicUnits(dollars: number): string {
  return Math.floor(dollars * 1_000_000).toString();
}

function atomicUnitsToDollars(units: string): number {
  return parseInt(units) / 1_000_000;
}

// Price string format used in route configs: "$0.001"
// x402 automatically converts to atomic units
```

---

## Testnet Setup

### Get Test USDC (Base Sepolia)

**Option 1: Coinbase Faucet**
- Visit: https://faucet.coinbase.com/
- Select: Base Sepolia
- Connect wallet or enter address

**Option 2: x402.org Faucet**
```bash
curl -X POST https://x402.org/faucet \
  -H "Content-Type: application/json" \
  -d '{"address": "0xYOUR_WALLET", "network": "eip155:84532"}'
```

**Option 3: Programmatic**
```typescript
// Only works from x402.org test accounts
import { mintTestUSDC } from "@x402/test-utils";
await mintTestUSDC({ address: walletAddress, network: "eip155:84532", amount: 10 });
```

### Create Test Wallet

```typescript
// Using viem
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

console.log("Private key:", privateKey); // Save to .env as EVM_PRIVATE_KEY
console.log("Address:", account.address);  // Fund this address with test USDC
```

### Using CDP Wallet (for agents)

```typescript
import { CdpClient } from "@coinbase/cdp-sdk";

const cdp = new CdpClient({
  apiKeyId: process.env.CDP_API_KEY_ID!,
  apiKeySecret: process.env.CDP_API_KEY_SECRET!,
});

// Create wallet
const wallet = await cdp.evm.createAccount();
console.log("Address:", wallet.address);

// Request test USDC via faucet
await cdp.evm.requestFaucet({
  address: wallet.address,
  network: "base-sepolia",
  token: "usdc",
});
```

---

## Mainnet Migration Checklist

When moving from testnet to mainnet:

### 1. Update Facilitator URL
```typescript
// Before (testnet)
url: "https://x402.org/facilitator"

// After (mainnet)
url: "https://api.cdp.coinbase.com/platform/v2/x402"
```

### 2. Update Network IDs
```typescript
// Before (testnet)
network: "eip155:84532"        // Base Sepolia
network: "solana:EtWTRA..."    // Solana Devnet

// After (mainnet)
network: "eip155:8453"         // Base Mainnet
network: "solana:5eykt4..."    // Solana Mainnet
```

### 3. Update USDC Addresses (if hardcoded)
```typescript
// Before (Base Sepolia USDC)
asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e"

// After (Base Mainnet USDC)
asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
```

### 4. Update Wallet Addresses
- Use mainnet wallet addresses (different from testnet)
- Ensure wallets have real USDC balance

### 5. Environment-Based Config (Recommended)
```typescript
const isProduction = process.env.NODE_ENV === "production";

const NETWORK = isProduction ? "eip155:8453" : "eip155:84532";
const FACILITATOR_URL = isProduction
  ? "https://api.cdp.coinbase.com/platform/v2/x402"
  : "https://x402.org/facilitator";
const USDC_ADDRESS = isProduction
  ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  : "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
```

---

## Multi-Network Configuration

Accept payments from multiple networks simultaneously:

```typescript
// Server: accept EVM and Solana payments for the same route
"GET /weather": {
  accepts: [
    // Base Mainnet
    {
      scheme: "exact",
      price: "$0.001",
      network: "eip155:8453",
      payTo: process.env.EVM_WALLET_ADDRESS!,
    },
    // Base Sepolia (testnet)
    {
      scheme: "exact",
      price: "$0.001",
      network: "eip155:84532",
      payTo: process.env.EVM_WALLET_ADDRESS!,
    },
    // Solana Mainnet
    {
      scheme: "exact",
      price: "$0.001",
      network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      payTo: process.env.SOL_WALLET_ADDRESS!,
    },
  ],
}

// Server: register handlers for all accepted networks
const server = new x402ResourceServer(facilitator)
  .register("eip155:8453", new ExactEvmScheme())
  .register("eip155:84532", new ExactEvmScheme())
  .register("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", new ExactSvmScheme())
  .register("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", new ExactSvmScheme());

// Client: register wallets for preferred networks
const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(evmSigner));   // Covers all EVM networks
client.register("solana:*", new ExactSvmScheme(solSigner));    // Covers all Solana networks
// Client automatically picks the best match from server's 402 response
```

---

## Custom Facilitator

Run your own facilitator for private deployments or custom logic:

```typescript
// Custom facilitator implementing the x402 facilitator interface
import express from "express";
import { verifyPayload, settlePayload } from "@x402/core/facilitator";

const app = express();
app.use(express.json());

app.post("/verify", async (req, res) => {
  const { payload, requirements } = req.body;

  try {
    const result = await verifyPayload(payload, requirements);
    res.json(result);
  } catch (error) {
    res.status(400).json({ isValid: false, invalidReason: error.message });
  }
});

app.post("/settle", async (req, res) => {
  const { payload, requirements } = req.body;

  try {
    const result = await settlePayload(payload, requirements);
    res.json({ success: true, txHash: result.txHash });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(4023, () => console.log("Custom facilitator on :4023"));

// Configure server to use custom facilitator
const facilitator = new HTTPFacilitatorClient({
  url: "http://localhost:4023",
});
```
