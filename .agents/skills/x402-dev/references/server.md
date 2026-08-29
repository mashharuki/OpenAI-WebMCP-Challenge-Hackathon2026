# x402 Server (Seller) Implementation

## Table of Contents
1. [Express.js](#expressjs)
2. [Next.js App Router](#nextjs-app-router)
3. [Hono](#hono)
4. [Python FastAPI](#python-fastapi)
5. [Python Flask](#python-flask)
6. [Route Configuration Deep Dive](#route-configuration-deep-dive)
7. [Custom Verification (No Facilitator)](#custom-verification-no-facilitator)
8. [Paywall UI Component](#paywall-ui-component)

---

## Express.js

```typescript
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

const app = express();
app.use(express.json());

const facilitator = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL ?? "https://x402.org/facilitator",
});

const server = new x402ResourceServer(facilitator)
  .register("eip155:84532", new ExactEvmScheme())          // Base Sepolia
  .register("eip155:8453", new ExactEvmScheme())            // Base Mainnet
  .register("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", new ExactSvmScheme()); // Solana Devnet

// Apply payment middleware before route handlers
app.use(paymentMiddleware({
  "GET /weather": {
    accepts: [
      {
        scheme: "exact",
        price: "$0.001",
        network: "eip155:84532",
        payTo: process.env.EVM_WALLET_ADDRESS!,
      },
      {
        scheme: "exact",
        price: "$0.001",
        network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
        payTo: process.env.SOL_WALLET_ADDRESS!,
      },
    ],
    description: "Real-time weather data",
    mimeType: "application/json",
  },
  "POST /analyze": {
    accepts: [{
      scheme: "exact",
      price: "$0.01",
      network: "eip155:84532",
      payTo: process.env.EVM_WALLET_ADDRESS!,
    }],
    description: "AI-powered data analysis",
    mimeType: "application/json",
  },
  "GET /report/:id": {
    accepts: [{
      scheme: "upto",              // Variable pricing
      price: "$0.05",
      network: "eip155:84532",
      payTo: process.env.EVM_WALLET_ADDRESS!,
    }],
    description: "Detailed report (variable pricing)",
    mimeType: "application/pdf",
  },
}, server));

// Route handlers — only reached after successful payment verification
app.get("/weather", (req, res) => {
  res.json({ weather: "sunny", temperature: 72, humidity: 45 });
});

app.post("/analyze", (req, res) => {
  const { data } = req.body;
  res.json({ analysis: "completed", insights: [] });
});

app.get("/report/:id", (req, res) => {
  res.json({ report: req.params.id, content: "..." });
});

app.listen(4021, () => console.log("Seller running on :4021"));
```

### Pattern Matching for Route Configs

```typescript
// Exact match
"GET /weather": { ... }

// Wildcard path parameter
"GET /report/:id": { ... }

// All methods on a path
"/admin": { ... }

// Glob patterns
"GET /api/*": { ... }
```

---

## Next.js App Router

```typescript
// app/api/weather/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { x402ResourceServer } from "@x402/core/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

// Create server instance (shared across routes)
// app/lib/x402.ts
export const facilitator = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL ?? "https://x402.org/facilitator",
});
export const x402Server = new x402ResourceServer(facilitator)
  .register("eip155:84532", new ExactEvmScheme());

// Route handler
const handler = async (_: NextRequest) => {
  return NextResponse.json({
    weather: "sunny",
    temperature: 72,
    timestamp: new Date().toISOString(),
  });
};

// Wrap with x402 — first arg is handler, second is config, third is server
export const GET = withX402(handler, {
  accepts: [{
    scheme: "exact",
    price: "$0.001",
    network: "eip155:84532",
    payTo: process.env.NEXT_PUBLIC_WALLET_ADDRESS!,
  }],
  description: "Real-time weather data",
  mimeType: "application/json",
}, x402Server);
```

### Next.js Middleware (Global Protection)

```typescript
// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { x402NextMiddleware } from "@x402/next";
import { x402Server } from "./app/lib/x402";

const paymentRoutes = {
  "GET /api/premium/:path*": {
    accepts: [{
      scheme: "exact",
      price: "$0.001",
      network: "eip155:84532",
      payTo: process.env.WALLET_ADDRESS!,
    }],
  },
};

export function middleware(request: NextRequest) {
  return x402NextMiddleware(paymentRoutes, x402Server)(request);
}

export const config = {
  matcher: ["/api/premium/:path*"],
};
```

---

## Hono

```typescript
import { Hono } from "hono";
import { paymentMiddleware } from "@x402/hono";
import { x402ResourceServer } from "@x402/core/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

const app = new Hono();

const facilitator = new HTTPFacilitatorClient({ url: "https://x402.org/facilitator" });
const server = new x402ResourceServer(facilitator)
  .register("eip155:84532", new ExactEvmScheme());

app.use("/api/*", paymentMiddleware({
  "GET /api/data": {
    accepts: [{
      scheme: "exact",
      price: "$0.001",
      network: "eip155:84532",
      payTo: process.env.WALLET_ADDRESS!,
    }],
    description: "Premium API data",
    mimeType: "application/json",
  },
}, server));

app.get("/api/data", (c) => c.json({ data: "premium content" }));

export default app;
```

---

## Python FastAPI

```python
import os
from fastapi import FastAPI
from x402.http import FacilitatorConfig, HTTPFacilitatorClient, PaymentOption, RouteConfig
from x402.http.middleware.fastapi import PaymentMiddlewareASGI
from x402.mechanisms.evm.exact import ExactEvmServerScheme
from x402.mechanisms.svm.exact import ExactSvmServerScheme
from x402.server import x402ResourceServer

app = FastAPI()

facilitator = HTTPFacilitatorClient(
    FacilitatorConfig(url=os.environ.get("FACILITATOR_URL", "https://x402.org/facilitator"))
)
server = x402ResourceServer(facilitator)
server.register("eip155:84532", ExactEvmServerScheme())
server.register(
    "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    ExactSvmServerScheme()
)

# Add payment middleware
app.add_middleware(
    PaymentMiddlewareASGI,
    routes={
        "GET /weather": RouteConfig(
            accepts=[
                PaymentOption(
                    scheme="exact",
                    pay_to=os.environ["EVM_WALLET_ADDRESS"],
                    price="$0.001",
                    network="eip155:84532",
                ),
            ],
            mime_type="application/json",
            description="Real-time weather data",
        ),
        "POST /analyze": RouteConfig(
            accepts=[
                PaymentOption(
                    scheme="exact",
                    pay_to=os.environ["EVM_WALLET_ADDRESS"],
                    price="$0.01",
                    network="eip155:84532",
                ),
            ],
            mime_type="application/json",
            description="AI-powered data analysis",
        ),
    },
    server=server,
)

@app.get("/weather")
async def get_weather():
    return {"weather": "sunny", "temperature": 72}

@app.post("/analyze")
async def analyze(data: dict):
    return {"analysis": "completed", "insights": []}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=4021)
```

---

## Python Flask

```python
import os
from flask import Flask, jsonify
from x402.http import FacilitatorConfig, HTTPFacilitatorClient, PaymentOption, RouteConfig
from x402.http.middleware.flask import PaymentMiddlewareWSGI
from x402.mechanisms.evm.exact import ExactEvmServerScheme
from x402.server import x402ResourceServer

app = Flask(__name__)

facilitator = HTTPFacilitatorClient(
    FacilitatorConfig(url=os.environ.get("FACILITATOR_URL", "https://x402.org/facilitator"))
)
server = x402ResourceServer(facilitator)
server.register("eip155:84532", ExactEvmServerScheme())

# Wrap Flask app with payment middleware
app.wsgi_app = PaymentMiddlewareWSGI(
    app.wsgi_app,
    routes={
        "GET /weather": RouteConfig(
            accepts=[PaymentOption(
                scheme="exact",
                pay_to=os.environ["EVM_WALLET_ADDRESS"],
                price="$0.001",
                network="eip155:84532",
            )],
            mime_type="application/json",
            description="Weather data",
        ),
    },
    server=server,
)

@app.route("/weather")
def get_weather():
    return jsonify({"weather": "sunny", "temperature": 72})

if __name__ == "__main__":
    app.run(port=4021)
```

---

## Route Configuration Deep Dive

```typescript
interface RouteConfig {
  accepts: PaymentRequirement[];  // At least one required
  description?: string;           // Human-readable description of the resource
  mimeType?: string;              // Content type (for 402 response)
  extensions?: {
    bazaar?: BazaarConfig;        // Bazaar service discovery
    [key: string]: unknown;
  };
}

interface PaymentRequirement {
  scheme: "exact" | "upto";      // "exact" = fixed price, "upto" = max price
  price: string;                  // Dollar format: "$0.001"
  network: string;                // CAIP-2: "eip155:84532", "solana:..."
  payTo: string;                  // Wallet address to receive payment
  asset?: string;                 // Token address (auto-resolved if omitted)
  maxTimeoutSeconds?: number;     // Payment validity window (default: 60)
}
```

### Pricing Best Practices

| Use Case | Recommended Price | Scheme |
|---|---|---|
| Simple data lookup | $0.001 | `exact` |
| Moderate compute | $0.01 | `exact` |
| Heavy compute / AI | $0.05–$0.10 | `exact` or `upto` |
| Large dataset | $0.10–$1.00 | `upto` |
| Report generation | $0.05 | `exact` |

Use `"upto"` when the actual cost varies — the client sets the max they're willing to pay and you charge what you actually used.

---

## Custom Verification (No Facilitator)

For advanced use cases where you handle verification in-process:

```typescript
import { verifyPayment, settlePayment } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

const scheme = new ExactEvmScheme();

app.get("/premium", async (req, res) => {
  const paymentHeader = req.headers["x-payment-signature"];

  if (!paymentHeader) {
    return res.status(402).json({
      x402Version: 2,
      error: "Payment required",
      accepts: [{
        scheme: "exact",
        amount: "1000",  // atomic units
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        network: "eip155:84532",
        payTo: process.env.WALLET_ADDRESS,
        maxTimeoutSeconds: 60,
      }],
    });
  }

  const payload = JSON.parse(Buffer.from(paymentHeader, "base64").toString());
  const { isValid, error } = await scheme.verify(payload, requirements);

  if (!isValid) {
    return res.status(402).json({ error });
  }

  // Optionally settle on-chain
  const settlement = await scheme.settle(payload, requirements);

  return res.json({ data: "premium content", txHash: settlement.txHash });
});
```

---

## Paywall UI Component

For web apps with a payment-gated frontend:

```tsx
// React / Next.js
import { Paywall } from "@x402/paywall";

export function PremiumContent() {
  return (
    <Paywall
      resourceUrl="/api/premium-data"
      onSuccess={(data) => console.log("Paid and received:", data)}
      onError={(err) => console.error("Payment failed:", err)}
    >
      {({ pay, isPaying, error }) => (
        <div>
          <button onClick={pay} disabled={isPaying}>
            {isPaying ? "Processing payment..." : "Pay $0.001 to access"}
          </button>
          {error && <p>Error: {error.message}</p>}
        </div>
      )}
    </Paywall>
  );
}
```
