# AdGate resource server

Hono resource server for the shared sponsor and Base Sepolia x402 access gate.

```bash
pnpm --filter x402server run typecheck
pnpm --filter x402server run build
pnpm --filter x402server run start
```

Use `.env.example` as the public configuration reference. The production
deployment must remain at one instance with autoscaling disabled because access
attempts and grants are process-local. See the
[deployment runbook](../../docs/deployment.md) for the exact-origin, payment,
release-SHA, and restart constraints.
