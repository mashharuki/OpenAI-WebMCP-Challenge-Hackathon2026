# AdGate for WebMCP

## One-line Summary

AdGate lets a publisher's WebMCP tool pause for a human choice—view an owned
sponsor message or approve a tiny testnet payment—then resume the original
agent invocation with one structured result.

## Problem

AI agents can consume publisher capabilities without the human visits that
fund open content. Blocking agents reduces usefulness, while payment-only
access removes the free path.

## Solution

The fictional Open Table Journal publisher exposes one premium
`analyze_recipe` tool. The original invocation waits while the person either
views an owned sponsor message for eight visible seconds or explicitly approves
a 0.01 testnet-USDC x402 payment on Base Sepolia. Both paths authorize the same
protected analysis and return the same validated result.

## Why This Matters

AdGate shows how agent-native publishing can preserve publisher funding and
human agency without splitting the browser and agent into separate products.

## How We Used AI

WebMCP exposes a typed page-owned capability to an AI host. Strict schemas,
abort propagation, and a visible human gate keep the interaction structured
and controllable. The recipe analysis is deterministic for repeatable judging.

## How We Used Codex

Codex helped refine executable specifications, implement the frontend/server/
facilitator boundaries, write regression tests, diagnose lifecycle and payment
receipt issues, construct fake-host browser journeys, and run release checks.
Humans retained product, security, wallet, and publication decisions.

## Key Features

- One pending WebMCP invocation across the human decision
- Wallet-free, time-bound, single-use sponsor access
- Explicit Base Sepolia x402 testnet-payment option
- Shared agent and visible-UI gate contracts
- Safe cancellation, expiry, duplicate, replay, and dependency outcomes
- Deterministic cross-app release and public-smoke checks

## Architecture

The React frontend owns WebMCP registration and the visible gate. A Hono
resource server owns sponsor/payment authorization and canonical analysis. An
optional Hono/viem facilitator verifies and settles the fixed testnet payment
policy. See [architecture and provenance](./docs/architecture-and-provenance.md).

## Testing Instructions

With Node.js 24.20.0 and the pinned pnpm version:

```bash
nvm use
corepack enable
pnpm release:check
```

For an interactive sponsor demo, run the server and frontend, open
<http://localhost:5173>, choose **Analyze this recipe**, and complete **Use
sponsor access**.

## Public Demo Link

`TODO: add the final HTTPS frontend URL after deployment and smoke verification`

## Public Repository Link

<https://github.com/mashharuki/OpenAI-WebMCP-Challenge-Hackathon2026>

## Demo Video

`TODO: add the public YouTube URL after manual upload and duration verification`

## Screenshot Shot List

Capture the publisher, gate choice, sponsor countdown, payment receipt or
truthful disabled state, and original WebMCP result. Follow
[`docs/screenshots.md`](./docs/screenshots.md).

## Submission Readiness Notes

The sponsor path is the required live path. Payment is Base Sepolia testnet
only; when hosted settlement is unverified, disable it publicly and label any
same-release local evidence **recorded local prototype**. Nothing is uploaded
or sent to Devpost by repository automation.

## Known Limitations

WebMCP support is experimental. Sponsor and replay state is process-local and
requires one server instance. The facilitator is not production hardened, and
the deterministic nutrition output is not medical advice.

## TODO Official Form Fields

- Final live app URL: `TODO`
- Final public YouTube URL: `TODO`
- Final full release SHA: `TODO`
- Team/profile and event-specific fields from the live form: `TODO`
