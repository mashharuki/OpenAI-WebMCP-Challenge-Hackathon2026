# Open Table Journal frontend

React/Vite publisher UI for AdGate. It exposes one imperative WebMCP tool,
`analyze_recipe`, and a matching visible action. Both enter the same
human-in-the-loop gate and return the same validated analysis contract.

## Run locally

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter x402server run dev
pnpm --filter frontend run start
```

Open <http://localhost:5173>. The development proxy forwards `/api` to the
resource server. Copy `.env.example` only when testing a split deployment; do
not commit the resulting local environment file.

## Test and build

```bash
pnpm --filter frontend run test
pnpm --filter frontend run test:e2e
pnpm --filter frontend run typecheck
pnpm --filter frontend run build
```

The production build deploys as Cloudflare Workers Static Assets. Validate the
generated Worker bundle or deploy it with:

```bash
pnpm --filter frontend run deploy:dry-run
pnpm --filter frontend run deploy
```

The Vitest suite covers components, contracts, sponsor/payment orchestration,
and safe errors. Playwright installs a fake browser-visible WebMCP host and fake
HTTP/wallet boundaries; it never holds a private key or sends a transaction.

## WebMCP host setup

The application prefers `document.modelContext` and keeps a
`navigator.modelContext` compatibility fallback. Unsupported or rejected
registration does not prevent the visible publisher flow.

For a compatible Chrome test environment:

1. Enable `chrome://flags/#enable-webmcp-testing`, then relaunch Chrome.
2. Enable remote debugging at `chrome://inspect/#remote-debugging`.
3. Use the checked-in `.mcp.json` from this app directory with a compatible agent.
4. Open the app and ask: “Analyze the published recipe on this page.”
5. Verify that the same tool invocation remains pending while the page waits for
   the sponsor or payment decision.

Browser and agent approvals remain manual. A cross-origin iframe embedding the
app must explicitly allow the experimental `tools` permission.

## Runtime boundaries

- `VITE_API_BASE_URL` is public and points to the resource-server origin.
- `VITE_ORIGIN_TRIAL_TOKEN` is public but origin-bound.
- `VITE_RELEASE_SHA` is public release provenance.
- No wallet private key, sponsor token, or facilitator credential belongs in a
  `VITE_` variable.
- The paid path is Base Sepolia testnet only; sponsor access is the wallet-free fallback.

See the root [environment reference](../../docs/environment.md) and
[deployment runbook](../../docs/deployment.md).

## Important source areas

```text
src/App.tsx            Publisher composition and runtime adapters
src/adgate/            Shared gate, protected client, and payment UI
src/publisher/         Recipe article and visible analysis experience
src/sponsor/           Sponsor provider, timer, and grant client
src/useWebMCPTools.ts  WebMCP tool registration and invocation bridge
test/e2e/              Fake-host Chromium journeys
```

The unused Todo starter modules are retained only as provenance and are not
imported by the production publisher entry point.
