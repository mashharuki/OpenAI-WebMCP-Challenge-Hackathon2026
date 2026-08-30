# AdGate x402 facilitator

Optional Hono/viem verifier and settler for the Base Sepolia payment path. The
public sponsor flow does not depend on this service.

## Run locally

```bash
pnpm --filter facilitator run dev
```

Production-style validation:

```bash
pnpm --filter facilitator run build
pnpm --filter facilitator run test
pnpm --filter facilitator run start
```

## Fixed prototype policy

- Network: Base Sepolia (`eip155:84532`)
- Scheme: x402 `exact`
- Asset: testnet USDC
- Amount: 10,000 base units (0.01 USDC)
- Signer: injected as `EVM_PRIVATE_KEY` only through the host secret store

Never place the signer in Git, frontend variables, logs, screenshots, terminal
recordings, or browser storage. The hosted service must be health/capability
checked before the public payment choice is enabled.

This facilitator is a hackathon prototype. It does not provide the
authentication, rate limiting, monitoring, rail allowlists, treasury controls,
or key-management hardening expected of a production settlement service. If it
cannot be verified, disable public payment and use a same-release clip labeled
`recorded local prototype`; keep sponsor access live.

See [environment](../../docs/environment.md) and
[deployment](../../docs/deployment.md).
