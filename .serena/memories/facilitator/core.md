# Facilitator core

- `apps/facilitator` is the EVM x402 facilitator HTTP service.
- `src/index.ts` exposes health, supported, verify, and settle routes and wires x402 facilitator lifecycle callbacks.
- `src/viem.ts` supplies chain-aware viem clients and facilitator EVM signers.
- Build with TypeScript to `dist/`; develop with tsx watch. Local configuration is via `.env` / `.env.local`.