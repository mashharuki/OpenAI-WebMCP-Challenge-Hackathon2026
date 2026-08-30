# Deployment runbook

This runbook prepares the AdGate demo for a public judging release. It does not
publish anything by itself. Run the repository release gate and record the full
commit SHA before deploying:

```bash
git rev-parse HEAD
pnpm release:check
```

## 1. Resource server

The root `render.yaml` is the reference deployment for `apps/server`. It pins
the build and start commands, disables automatic deploys, and requests one
instance. In the Render dashboard, confirm **Manual scaling: one instance** and
**Autoscaling: disabled** before judging. Do not deploy or restart the service
during a demo recording.

Set these public configuration values in the host:

| Variable | Value |
| --- | --- |
| `FACILITATOR_URL` | Public HTTPS origin of the hosted facilitator. Do not include credentials. |
| `EVM_ADDRESS` | Public Base Sepolia USDC recipient address used as x402 `payTo`. |
| `ALLOWED_ORIGINS` | The exact final frontend origin, such as `https://adgate.example.workers.dev`; no wildcard, path, or trailing slash. |
| `RELEASE_SHA` | The full Git commit SHA deployed to the server. |

The sponsor session, grant, replay registry, and bounded attempt registry are
process-local. A resource-server restart makes active attempts invalid and also
clears active 90-second sponsor sessions, 60-second grants, and five-minute
same-identity success replays. The client must start a new attempt after a
restart. One instance and disabled autoscaling are therefore release
correctness constraints, not performance recommendations.

## 2. Payment readiness

The fixed demo payment policy is x402 `exact` on Base Sepolia
(`eip155:84532`) using testnet USDC at
`0x036CbD53842c5426634e7929541eC2318f3dCF7e`. The amount is 10,000 base units,
or 0.01 USDC. `EVM_ADDRESS` supplies the public `payTo` recipient.

The hosted facilitator is optional for sponsor-path release readiness. Set
`FACILITATOR_URL` only to a verified HTTPS deployment that supports the exact
Base Sepolia policy. If that deployment cannot be verified, expose the safe
payment-disabled state and keep the sponsor path working; do not advertise a
payment path that cannot settle.

When hosting `apps/facilitator`, copy its `.env.example`. Store
`EVM_PRIVATE_KEY` only in the hosting provider's secret store. Never place a
private key in a frontend variable, committed file, log, screenshot, or build
artifact.

## 3. Frontend

Set the following values in the frontend build environment. Vite embeds them at
build time, so changing the host environment requires a new build:

| Variable | Value |
| --- | --- |
| `VITE_API_BASE_URL` | Public HTTPS origin of the resource server, without a trailing slash. |
| `VITE_ORIGIN_TRIAL_TOKEN` | Chrome Origin Trial token issued for the exact final frontend origin. |
| `VITE_RELEASE_SHA` | The same full Git commit SHA used for `RELEASE_SHA`. |

Obtain the final Cloudflare Workers origin before issuing the Origin Trial
token, then build and deploy that same commit:

```bash
pnpm --filter frontend run build
pnpm --filter frontend run deploy
```

After deployment, confirm that the page's Origin Trial and release-SHA metadata
are present, that the API accepts only the exact frontend origin, and that the
frontend and server expose the same release SHA. Public smoke probing is handled
by the next implementation task.

## Release placeholders

Before a public release, replace every example value in
`apps/frontend/.env.example`, `apps/server/.env.example`, and
`apps/facilitator/.env.example` through build configuration or the host's
environment/secret store. Keep the examples themselves secret-free.
