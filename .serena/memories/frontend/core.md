# Frontend core

- `apps/frontend` is the WebMCP React todo app, served/bundled by Vite and deployable to Cloudflare Workers.
- `src/App.tsx` renders the UI and declarative add-todo form; `src/useTodos.ts` owns localStorage-backed state/actions; `src/useWebMCPTools.ts` defines/registers imperative list/rename/complete/delete tools; `src/schemas.ts` owns runtime schemas and tool inputs.
- `src/client.tsx` is the browser entry and `src/server.ts` is the Worker fallback. WebMCP browser setup requirements are in `apps/frontend/AGENTS.md`.
- Tests are Vitest/jsdom (`src/App.test.tsx`); Worker config is `wrangler.jsonc`.