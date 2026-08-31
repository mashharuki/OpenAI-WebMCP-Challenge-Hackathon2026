# Architecture and hackathon provenance

## System boundary

AdGate wraps one premium publisher capability rather than creating a second
agent-only backend. The visible button and WebMCP tool both call the same
`GateCoordinator`, and only the resource server decides whether access
evidence authorizes the canonical analysis.

```text
Agent host                              Person in publisher page
    |                                             |
    | analyze_recipe(input, invocation signal)    | Analyze this recipe
    +-----------------------+---------------------+
                            v
                    frontend GateCoordinator
                            |
             +--------------+---------------+
             |                              |
       sponsor session                 payment challenge
       + visible timer                 + displayed terms
       + server minimum                + explicit wallet click
             |                              |
       one-time grant                   x402 signature
             |                              |
             +--------------+---------------+
                            v
                     resource server
                            |
                canonical protected result
                            |
              original caller resolves once
```

## App ownership

### Frontend

The React/Vite app owns presentation, local interaction, WebMCP registration,
invocation cancellation, and wallet prompting. It validates external tool input
with Zod. The browser timer pauses when the page is hidden, but its elapsed time
is never treated as server authorization.

### Resource server

The Hono server owns sponsor-session creation, the independent eight-second
wall-clock minimum, one-time grants, evidence consumption, bounded attempts,
five-minute same-identity result replay, x402 challenges, and deterministic
analysis. Cloudflare routes it through one named Durable Object coordinator.
Sponsor sessions, grants, consumption state, and grant-issue replay are stored
in Durable Object Storage; only the protected-analysis attempt/result replay
registry remains in memory within the active coordinator instance.

### Facilitator

The optional Hono/viem facilitator verifies and settles the exact Base Sepolia
payment. Its signer is a server-side testnet secret. The sponsor release remains
valid when this service is absent; the frontend must disable payment instead of
advertising an unavailable settlement path.

## Trust boundaries

| Boundary | Untrusted input | Enforcement |
| --- | --- | --- |
| WebMCP host → frontend | Tool arguments and abort signal | Strict recipe schema, one active attempt, safe normalized result |
| Person → frontend | Access choice and wallet confirmation | Explicit buttons, locked duplicate choice, no automatic signature |
| Frontend → server | IDs, timing claim, sponsor token, payment header | Exact-origin CORS, server clock, evidence binding, digest/idempotency checks |
| Server → facilitator | Payment payload and fixed requirements | Base Sepolia/exact/asset/amount validation |
| Facilitator → chain | Testnet settlement | Server-held signer; no browser private key |
| Every service → public response | Errors and receipts | No stack, environment value, sponsor token, raw signature, or private key |

## Fixed demo invariants

- Resource: `recipe_analysis`
- Network: Base Sepolia (`eip155:84532`)
- Scheme and amount: x402 `exact`, 10,000 base units (0.01 testnet USDC)
- Sponsor session TTL: 90 seconds
- Minimum sponsor time: eight seconds in both browser and server boundaries
- Sponsor grant TTL: 60 seconds and one successful consumption
- Same-identity successful result replay: five minutes
- Runtime: one named Durable Object coordinator with a persisted sponsor ledger

## Provenance

### Existing starter/reference work

The repository started as a React/Cloudflare WebMCP Todo experiment. It supplied
the workspace layout, early browser tool-registration examples, and basic
Cloudflare project scaffolding. The original nested frontend MIT license
credits that starter author. Git history is the authoritative record of those
files and dates.

The obsolete `apps/frontend/docs/d1.md` Todo/D1 guide was removed before this
release and remains available in Git history. Unused `useTodos.ts` and related
starter modules are deliberately not presented as AdGate product features and
are not imported by the publisher application.

### Hackathon-period AdGate work

The following product and release layers were built for this project:

- Open Table Journal recipe publisher UI and deterministic premium analysis
- Shared visible-UI/WebMCP gate coordinator and contract normalization
- Sponsor session, visible timer, grant issuance, consumption, and replay rules
- Bounded attempt registry and safe duplicate/abort/late-result handling
- Base Sepolia x402 challenge, injected-wallet approval, and receipt experience
- Optional self-hosted facilitator boundary
- Cross-app contracts, fake-host Chromium E2E, public smoke, and release gate
- Deployment controls, environment references, and hand-written submission packet

This provenance is a functional boundary, not a claim that every dependency or
starter line was authored during the event.
