# Open Table Journal WebMCP Demo

A React publisher demo that exposes gated premium recipe analysis to people and browser-based AI agents with [WebMCP](https://github.com/webmachinelearning/webmcp), deployed as a Cloudflare Worker.

> [!IMPORTANT]
> WebMCP is experimental. The Chrome testing setup below is temporary and may change as browser support evolves.

## What it demonstrates

- One imperative `analyze_recipe` tool and the matching visible analysis action
- A shared human-in-the-loop gate with sponsor and Base Sepolia x402 paths
- Runtime validation and JSON Schema generated from Zod
- Lifecycle-managed tool registration with cleanup on unmount
- Safe unsupported-browser and registration-failure states

This differs from [`examples/webmcp`](../webmcp/), which bridges remote `McpAgent` tools into WebMCP with `registerWebMcp()`. This example focuses on page-local React state and the browser's imperative and declarative WebMCP APIs.

## WebMCP tools

| Tool             | API        | Purpose                                               |
| ---------------- | ---------- | ----------------------------------------------------- |
| `analyze_recipe` | Imperative | Request gated premium analysis for the published dish |

Agent and visible-UI invocations enter the same gate and return the same structured recipe-analysis contract.

## Run locally

From this directory:

```bash
pnpm install
pnpm run start
```

Open <http://localhost:5173>. Other useful commands:

```bash
pnpm run test    # Run the jsdom test suite
pnpm run build   # Create a production build
pnpm run types   # Regenerate Worker binding types
pnpm run deploy  # Build and deploy to Cloudflare
```

The Vite development server proxies `/api` to the local resource server. For a
split production deployment, copy `.env.example` and set `VITE_API_BASE_URL` to
the public HTTP(S) origin of `apps/server`. Leave it unset only when production
routes `/api` to that server on the frontend's origin.

For the production environment variables, exact-origin constraint, Origin Trial
token, and release provenance, follow the repository
[deployment runbook](../../docs/deployment.md).

## Connect a coding agent

The checked-in [`.mcp.json`](./.mcp.json) configures [`chrome-devtools-mcp`](https://github.com/ChromeDevTools/chrome-devtools-mcp) with experimental WebMCP support.

1. Open `chrome://flags/#enable-webmcp-testing` in Chrome, enable **WebMCP for testing**, and relaunch Chrome.
2. Open `chrome://inspect/#remote-debugging` and enable **Allow remote debugging for this browser instance**.
3. Open your MCP-compatible coding agent from this directory and enable the project-level **chrome-devtools** server. Restart an already-running agent so it discovers `.mcp.json`.
4. Start the app, open <http://localhost:5173> in that Chrome instance, and ask your agent:

   > Analyze the published recipe on http://localhost:5173

Chrome may ask you to approve the debugging connection, and your coding agent may separately require approval before executing a tool. The MCP configuration exposes only navigation plus WebMCP discovery and execution as direct tools.

WebMCP is governed by the `tools` Permissions Policy. A cross-origin iframe embedding this app must include `allow="tools"`.

## Key pattern

The imperative tool registers for the component lifecycle:

```tsx
useEffect(() => {
  const controller = new AbortController();

  void document.modelContext?.registerTool(tool, {
    signal: controller.signal
  });

  return () => controller.abort();
}, [tool]);
```

The execute callback validates input and delegates to the same gate coordinator used by the visible UI. The registration signal and each invocation signal have separate lifetimes.

## Project structure

```text
.mcp.json              Coding-agent connection for WebMCP tools
src/App.tsx            Publisher composition root and runtime API wiring
src/adgate/            Shared gate, payment UI, and protected API adapters
src/publisher/         Recipe article and visible analysis experience
src/sponsor/           Sponsor access provider and API client
src/useWebMCPTools.ts  Imperative WebMCP definitions and registration
src/webmcp.d.ts        Experimental WebMCP type additions
src/server.ts          Worker fallback for unmatched asset requests
```

## Resources

- [WebMCP proposal and specification](https://github.com/webmachinelearning/webmcp)
- [Chrome WebMCP imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [Chrome WebMCP declarative API](https://developer.chrome.com/docs/ai/webmcp/declarative-api)
- [React on Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/)
- [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)
