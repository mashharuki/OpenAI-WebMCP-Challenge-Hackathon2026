# Roadmap

## Overview

AdGate for WebMCP is a publisher monetization demo for the agent-native web. A premium recipe-analysis tool is exposed through WebMCP; when an agent invokes it, execution pauses and the page asks the human to either view a short sponsor message for free access or pay a small x402 fee to continue immediately. The same gate is also available from the visible UI so the human and agent paths share one state machine and one protected resource.

The implementation reuses the existing React/Vite WebMCP frontend, Hono x402 resource server, and EVM facilitator. Work is organized as vertical, demoable slices, with contracts first and submission hardening last. The deadline is September 3, 2026 at 1:00 PM PDT (September 4 at 5:00 AM JST).

## Approach Decision

- **Chosen**: Human-in-the-loop suspended tool execution. A gate coordinator returns a pending promise while the page renders the sponsor/payment choice; the WebMCP tool resumes only after access is granted.
- **Why**: It makes human-agent collaboration visible, uses WebMCP non-trivially, preserves user control around payment, and reuses the existing x402 services.
- **Rejected alternatives**: A server-only paid MCP tool hides the shared-page collaboration that judges want; injecting ads into agent text weakens user trust and WebMCP leverage; a full multi-tenant SDK/dashboard is too broad for the submission window.

## Scope

- **In**: One polished recipe publisher demo; one premium analysis tool; sponsor-view and Base Sepolia x402 unlock paths; visible human confirmation; dual `document`/`navigator` namespace detection; automated tests; deployable services; English submission assets.
- **Out**: Real ad-network integration, ad impression fraud prevention, production wallet custody, mainnet funds, publisher dashboard, multi-tenant billing, multiple premium tools, and generalized npm package publication.

## Constraints

- Preserve TypeScript/ESM, React/Vite/Cloudflare, Hono, Zod boundary validation, and the existing facilitator trust boundary.
- Use testnet only. Never ship or expose a private key in browser code.
- Treat WebMCP as a changing draft: target `document.modelContext` first for ChatGPT, feature-detect `navigator.modelContext` for Chrome compatibility, normalize tool results to the host contract, and enroll the deployed origin in the Chrome Origin Trial.
- Base Sepolia (`eip155:84532`) is the only supported blockchain network for the MVP. Use the x402 `exact` scheme with testnet USDC and an injected EIP-1193 wallet; remove World Chain and all multi-network branching from the paid path. The sponsor path must remain fully judge-testable without a wallet.
- Deploy the frontend on Cloudflare and the Node Hono resource server on Render (or an equivalent Node host) with a strict origin allowlist and exposed x402 headers. Use the hosted Base Sepolia facilitator as the reliable submission path; keep the self-hosted facilitator optional for local demonstration.
- Do not rely on the current isolate-local AgentKit free-trial storage for access control. Sponsor grants use their own narrow prototype ledger; production durability is explicitly out of scope.
- Tool cancellation, duplicate execution, expired grants, CORS, and unavailable payment infrastructure must fail safely and visibly.
- Freeze features by September 3 at 12:00 JST; reserve the remaining time for deployment, recording, upload, and Devpost submission.

## Boundary Strategy

- **Why this split**: Contracts stabilize the seams first; the publisher UI, sponsor unlock, and payment unlock can then be developed independently; WebMCP orchestration integrates only proven paths; submission readiness owns cross-app release work without expanding product scope.
- **Shared seams to watch**: Access-grant shape and expiry, premium resource request/response schemas, gate state transitions, API base URL/CORS, abort propagation, and ownership of top-level frontend composition.

## Specs (dependency order)

- [ ] adgate-contracts -- Define premium-resource schemas, access grants, gate state machine, error taxonomy, and cross-app HTTP contracts. Dependencies: none
- [ ] publisher-demo -- Replace the todo reference UI with a polished recipe publisher and deterministic premium analysis service, without monetization logic. Dependencies: adgate-contracts
- [ ] sponsor-access -- Implement the sponsor-choice UI, timed viewing flow, and short-lived single-use sponsor access grant. Dependencies: adgate-contracts
- [ ] x402-payment-access -- Adapt the protected resource and browser payer flow for Base Sepolia x402 with explicit human wallet confirmation. Dependencies: adgate-contracts
- [ ] webmcp-gated-tool -- Register the premium WebMCP tool, suspend execution on the shared gate coordinator, resume through either access path, and handle abort/security behavior. Dependencies: publisher-demo, sponsor-access, x402-payment-access
- [ ] submission-readiness -- Add end-to-end validation, deployment configuration, fallback behavior, hackathon provenance, English documentation, and the demo/submission checklist. Dependencies: webmcp-gated-tool

## Delivery Calendar (JST)

- **Aug 30**: Approve specs, lock the demo script, and validate local service prerequisites.
- **Aug 31**: Complete contracts and publisher demo; establish a deployed frontend shell with Origin Trial enrollment early.
- **Sep 1**: Complete sponsor and x402 access slices; record the first successful paid-path backup clip.
- **Sep 2**: Complete WebMCP integration in ChatGPT and Chrome; fix only end-to-end blockers.
- **Sep 3 12:00**: Feature freeze. Run release checks, deploy, record and upload the sub-3-minute video, finalize README and Devpost copy.
- **Sep 4 03:00**: Internal submission deadline, leaving a two-hour buffer before the 05:00 JST official deadline.
