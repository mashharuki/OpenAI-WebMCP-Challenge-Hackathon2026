# AdGate resource server

Hono service that owns sponsor authorization, bounded protected-attempt state,
and the protected deterministic recipe analysis. In Cloudflare, sponsor state
is persisted through Durable Object Storage. The service also issues the single
Base Sepolia x402 challenge used by the optional paid path.

## Run locally

```bash
pnpm --filter x402server run dev
```

To run in the Cloudflare Workers runtime, copy `.env.example` to the ignored
`.dev.vars`, replace the placeholders, then run:

```bash
pnpm --filter x402server run types
pnpm --filter x402server run dev:worker
```

The development entry point accepts `http://localhost` or a loopback IP for a
local facilitator. The production build/start path still requires an HTTPS
facilitator URL.

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

## Cloudflare deployment invariant

The Cloudflare entry point routes every request through the same named Durable
Object coordinator so multiple Worker isolates cannot split state. Sponsor
sessions, grants, consumption state, and grant-issue replay are persisted to
Durable Object Storage after each request and restored when the object is
recreated. Protected-analysis attempt/result replay remains in memory within
the coordinator. If a final response is lost across eviction or deployment,
the client must begin a new access attempt. Do not redeploy while recording or
judging.

Validate and deploy with:

```bash
pnpm --filter x402server run deploy:dry-run
pnpm --filter x402server run deploy
```

Copy `.env.example` as a reference. Its values are public configuration, but
local overrides must remain uncommitted. See [environment](../../docs/environment.md)
and [deployment](../../docs/deployment.md).
