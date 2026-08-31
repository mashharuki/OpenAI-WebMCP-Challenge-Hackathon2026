# Deployment runbook

This runbook prepares the AdGate demo for a public judging release. It does not
publish anything by itself. Run the repository release gate and record the full
commit SHA before deploying:

```bash
git rev-parse HEAD
pnpm release:check
```

## 1. Cloudflare deployment layout

All three applications deploy with Wrangler:

| Application | Cloudflare runtime | Worker name |
| --- | --- | --- |
| `apps/frontend` | Workers Static Assets + the Vite plugin | `adgate-open-table-journal` |
| `apps/server` | Worker routed through one Durable Object coordinator | `adgate-resource-server` |
| `apps/facilitator` | Worker | `adgate-facilitator` |

Install dependencies, authenticate Wrangler, generate binding/runtime types,
and validate all three bundles before the first deployment:

```bash
pnpm install --frozen-lockfile
pnpm --filter frontend exec wrangler login
pnpm cloudflare:types
pnpm cloudflare:dry-run
```

The resource server's short-lived sponsor and idempotency registries are still
in memory by design. Cloudflare routes every request to the same named Durable
Object, preserving the existing single-coordinator invariant across Worker
isolates. A Durable Object eviction or deployment resets those short-lived
registries, just like restarting the former single-process deployment. Do not
deploy during a demo recording.

## 2. Deploy the facilitator

Create an uncommitted `apps/facilitator/.env.production` containing only:

```dotenv
EVM_PRIVATE_KEY=0x...
```

Deploy the code and encrypted secret together on the first release:

```bash
cd apps/facilitator
pnpm exec wrangler deploy --secrets-file .env.production
```

Record the resulting `https://adgate-facilitator.<account-subdomain>.workers.dev`
origin. For later releases, `pnpm --filter facilitator run deploy` reuses the
already configured secret.

## 3. Deploy the resource server

Create an uncommitted `apps/server/.env.production` with these values. Wrangler
declares them as required encrypted bindings so a deployment cannot silently
omit environment-specific configuration, even though the values themselves are
public:

| Variable | Value |
| --- | --- |
| `FACILITATOR_URL` | Public HTTPS origin of the hosted facilitator. Do not include credentials. |
| `EVM_ADDRESS` | Public Base Sepolia USDC recipient address used as x402 `payTo`. |
| `ALLOWED_ORIGINS` | The exact final frontend origin, such as `https://adgate.example.workers.dev`; no wildcard, path, or trailing slash. |
| `RELEASE_SHA` | The full Git commit SHA deployed to the server. |

`RELEASE_SHA` is release metadata and is not currently consumed by the Worker.
The three bindings declared in `wrangler.jsonc` are `FACILITATOR_URL`,
`EVM_ADDRESS`, and `ALLOWED_ORIGINS`.

```bash
cd apps/server
pnpm exec wrangler deploy --secrets-file .env.production
```

For later releases, `pnpm --filter x402server run deploy` reuses the configured
bindings.

## 4. Payment readiness

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

## 5. Frontend

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

Vite automatically loads an uncommitted `apps/frontend/.env.production` for the
production build. The frontend is deployed last so `VITE_API_BASE_URL` can point
to the resource-server URL. Set the server's `ALLOWED_ORIGINS` to the exact
frontend Workers URL (or custom domain) before the public smoke test. Worker
names are fixed in the checked-in Wrangler files, so both `workers.dev` origins
can be determined from the Cloudflare account subdomain before deployment.

After deployment, run the read-only public-boundary probe with exact HTTPS
origins:

```bash
pnpm smoke:public -- \
  --frontend-url https://frontend.example.com \
  --server-url https://api.example.com \
  --facilitator-url https://facilitator.example.com
```

`--facilitator-url` is optional. An unavailable facilitator is reported as a
warning and requires a same-release local payment recording; it does not block
the public sponsor path. The probe never sends a payment signature, touches a
wallet, or settles a transaction. To prove sponsor access, it creates one
ephemeral process-local sponsor session, waits the required eight seconds,
consumes its one-time grant, and verifies one canonical analysis. It prints only
fixed check names and safe reasons—not credentials, challenges, response bodies,
or full addresses.

The probe requires the page's Origin Trial metadata, exact-origin CORS on all
three API routes, private-response headers, one safe payment state, a working
sponsor path, and a 404 from the production preview POST. Run it after every
public deployment and before recording.

## Release placeholders

Before a public release, replace every example value in
`apps/frontend/.env.example`, `apps/server/.env.example`, and
`apps/facilitator/.env.example` through build configuration or the host's
environment/secret store. Keep the examples themselves secret-free.
