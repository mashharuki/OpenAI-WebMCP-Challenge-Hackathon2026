# AdGate resource server

Hono service that owns sponsor authorization, bounded process-local attempt
state, and the protected deterministic recipe analysis. It also issues the
single Base Sepolia x402 challenge used by the optional paid path.

## Run locally

```bash
pnpm --filter x402server run dev
```

Production-style validation:

```bash
pnpm --filter x402server run typecheck
pnpm --filter x402server run build
pnpm --filter x402server run test
pnpm --filter x402server run start
```

## Public routes

| Route | Purpose |
| --- | --- |
| `GET /health` | Safe health and release identity |
| `POST /api/sponsor-sessions` | Create a resource-bound 90-second session |
| `POST /api/sponsor-grants` | Issue a one-time 60-second sponsor grant after the server minimum |
| `POST /api/recipe-analysis` | Require sponsor evidence or x402 payment and return canonical analysis |

The production preview bypass remains unavailable. Protected responses use
`Cache-Control: no-store`, and CORS permits only the exact configured frontend
origin and required authorization/x402 headers.

## Deployment invariant

All attempt, sponsor, consumption, and five-minute success-replay registries are
in memory. Production must therefore run **exactly one instance with autoscaling
disabled**. A restart invalidates active sessions, grants, attempts, and cached
results; clients must begin a new attempt. Do not redeploy while recording or judging.

Copy `.env.example` as a reference. Its values are public configuration, but
local overrides must remain uncommitted. See [environment](../../docs/environment.md)
and [deployment](../../docs/deployment.md).
