# AdGate for WebMCP

## One-line Summary

AdGate lets a publisher's WebMCP tool pause for a human choice—view an owned
sponsor message or approve a tiny testnet payment—then resume the original
agent invocation with one structured result.

## Problem

The open web is often funded by human attention. When an AI agent consumes
content or services without a person visiting the publisher, the user gains
convenience but the publisher can lose the interaction that funds free access.
Blocking agents harms usefulness; giving every premium capability away is not
sustainable; forcing payment removes the free path.

## Solution

AdGate demonstrates a human-in-the-loop access layer for WebMCP. A fictional
food publisher, Open Table Journal, exposes one premium `analyze_recipe` tool.
When an agent invokes it, the same promise remains pending while the page asks
the person to choose:

- view the repository-owned Open Table Weekly sponsor message for eight visible seconds; or
- explicitly approve an x402 `exact` payment of 0.01 testnet USDC on Base Sepolia.

Either path authorizes the same protected Hono endpoint. The original WebMCP
call then receives a validated canonical analysis without a second prompt. The
visible page action uses that same gate and result contract.

## Why This Matters

Agent-native browsing needs business models that preserve user agency. AdGate
separates the premium capability from the access evidence: a publisher can
offer a wallet-free sponsor path, a paid path, or a safe fallback without
building unrelated agent and human products. The pattern could apply to news,
research, recipes, creator tools, and other structured premium services.

## How We Used AI

The product uses WebMCP to expose a typed browser capability directly to an AI
host. The tool declares a strict JSON schema, validates input, forwards the host
abort signal, and returns a normalized structured result. The important AI
interaction is not an opaque backend model call; it is the agent's ability to
discover and invoke a page-owned capability while the page retains a visible
human approval boundary. Analysis output is deterministic so judging remains
fast, repeatable, and inexpensive.

## How We Used Codex

Codex helped turn the idea into executable specifications and implementation
waves across the frontend, resource server, and facilitator. It was used to
review contract boundaries, implement sponsor and x402 flows, write focused
tests before fixes, diagnose lifecycle and receipt-display failures, build a
fake WebMCP browser host, and run the final cross-workspace release gate. Human
decisions remained explicit for product scope, payment policy, security
constraints, deployment choices, and all external publication actions.

## Key Features

- One WebMCP `analyze_recipe` invocation that stays pending through human choice
- Shared gate for agent and visible UI entry points
- Wallet-free sponsor access with visible-time and server-time enforcement
- Resource/nonce-bound, one-time, short-lived sponsor evidence
- Base Sepolia x402 terms shown before explicit injected-wallet approval
- Normalized payment receipt without exposing raw payment payloads
- Safe cancellation, abort, duplicate, expiry, replay, and dependency outcomes
- Five-minute replay only for the same request identity, digest, and evidence
- Fake-host Chromium E2E with no private key or real transaction
- One deterministic release command plus a read-only public boundary probe

## Architecture

The React/Vite frontend registers the WebMCP tool and owns the visible gate. A
single `GateCoordinator` captures one request and keeps it alive across the
human choice. Sponsor or payment evidence is sent to a Hono resource server,
which owns authorization and returns canonical deterministic analysis. The
optional Hono/viem facilitator verifies and settles the fixed Base Sepolia
policy. Sponsor access remains available when payment infrastructure is not.

Detailed architecture, trust boundaries, fixed invariants, and provenance are
in [`architecture-and-provenance.md`](./architecture-and-provenance.md).

## Technology

- TypeScript, React 19, Vite, Zod, Vitest, Testing Library, Playwright
- WebMCP imperative tool registration
- Hono resource server and optional facilitator
- x402 Core/EVM, viem, Base Sepolia testnet USDC
- Cloudflare Workers frontend and resource server, with one named Durable
  Object coordinator and a persisted sponsor ledger
- Biome and pnpm workspace release automation

## Challenges

The hardest constraint was keeping one host invocation correct across a long
human interaction. Cancellation, unmounting, duplicate entry points, late HTTP
results, grant expiry, and consumed evidence all had to end once without
leaking credentials. Payment also needed to display server-provided terms
before wallet access and keep the same request identity through settlement.
Finally, the sponsor ledger had to remain correct across Worker isolates and
Durable Object recreation, which required serialized request handling and a
storage snapshot restored before serving traffic.

## Accomplishments

- Preserved one original tool invocation through an eight-second sponsor flow
- Unified agent and visible UI behavior behind one coordinator and contract
- Added safe two-path access without a browser private key
- Verified document-first, navigator-compatible, unsupported, failure, and abort hosts
- Covered sponsor, payment, replay, CORS, secret-redaction, and release boundaries
- Found and fixed a real browser-only bug where the payment receipt disappeared after success

## What We Learned and What's Next

WebMCP makes a web page an active participant in agent workflows, not merely a
document to scrape. Human approval can be part of a tool invocation without
breaking structured context. Next steps would persist the remaining
protected-attempt replay registry, add storage cleanup and observability,
harden facilitator authentication/key management, measure sponsor outcomes
with privacy-preserving fraud controls, generalize the gate to more publisher
resources, and evaluate production payment rails beyond the fixed testnet demo.

## Testing Instructions

Prerequisites are Node.js 24.20.0 and the repository-pinned pnpm version.

```bash
nvm use
corepack enable
pnpm release:check
```

The release gate runs frozen installation, lint, documentation contracts,
frontend/server/facilitator tests and builds, ten fake-host Chromium journeys,
cross-app contracts, public-smoke tests, and payment-boundary validation. No
real wallet or external transaction is used.

For a local interactive sponsor demo:

```bash
pnpm --filter x402server run dev
pnpm --filter frontend run start
```

Open <http://localhost:5173>, choose **Analyze this recipe**, then **Use sponsor
access**. Start the sponsor view, keep the page visible for eight seconds, and
continue to the canonical result.

## Public Demo Link

`TODO: add the final HTTPS frontend URL after deployment and smoke verification`

## Public Repository Link

<https://github.com/mashharuki/OpenAI-WebMCP-Challenge-Hackathon2026>

## Demo Video

`TODO: add the public YouTube URL after manual upload and duration verification`

Outline: problem → WebMCP invocation → sponsor path → Base Sepolia evidence →
architecture/release proof → impact. The full 2:45 English script and shot list
are in [`demo-video.md`](./demo-video.md).

## Screenshot Shot List

1. Open Table Journal publisher and recipe context
2. Pending analysis with sponsor/payment human choice
3. Open Table Weekly sponsor view and countdown
4. Base Sepolia 0.01-USDC receipt, labeled if locally recorded
5. Original WebMCP invocation showing the canonical result

Capture requirements are in [`screenshots.md`](./screenshots.md).

## Submission Readiness Notes

- The sponsor path is the required live path and does not need a wallet.
- The paid path is Base Sepolia testnet only.
- If hosted settlement is unverified, payment is disabled publicly and the
  evidence is a same-release clip labeled `recorded local prototype`.
- Open Table Journal, Open Table Weekly, recipe/sponsor copy, CSS, and the hero
  SVG are repository-owned fictional demo assets.
- Nothing has been uploaded or sent to Devpost by this document workflow.

## Known Limitations

- WebMCP browser support is experimental and real-host validation remains manual.
- Sponsor timing is not proof of attention or fraud-resistant ad measurement.
- Sponsor authorization is persisted in Durable Object Storage and restored
  after object recreation. Protected-analysis attempt/result replay remains
  in-memory within the named coordinator. If a final response is lost across
  eviction or deployment, the client must begin a new access attempt.
- The facilitator lacks production authentication, rate limiting, monitoring,
  treasury controls, and hardened key management.
- Analysis is deterministic demo content and not medical advice.

## TODO Official Form Fields

- Official project/application identifier, if the form requests one: `TODO`
- Final live app URL: `TODO`
- Final public YouTube URL: `TODO`
- Final full release SHA: `TODO`
- Team member/profile fields required by the live form: `TODO`
- Any event-specific question not represented above: `TODO — copy only from the live official form`
