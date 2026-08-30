# AdGate x402 facilitator

Optional hosted verifier and settler for the AdGate Base Sepolia payment path.
The sponsor path does not depend on this service.

```bash
pnpm --filter facilitator run build
pnpm --filter facilitator run start
```

Copy `.env.example` into the hosting configuration. `EVM_PRIVATE_KEY` is a
secret and must be supplied only through the host's secret store. See the
[deployment runbook](../../docs/deployment.md) before exposing payment publicly.
