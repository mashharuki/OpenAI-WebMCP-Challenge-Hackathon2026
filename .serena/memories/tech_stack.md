# Tech stack

- Node/TypeScript monorepo, pnpm 11.24.0 lockfile at root; packages are ESM where configured.
- Root tooling: TypeScript 7, Biome 2.5.11, Knip, jscpd.
- `apps/frontend`: React 19 + Vite 8 + Tailwind 4, Cloudflare Workers/Wrangler 4, Vitest 4/jsdom; requires Node >=24.
- `apps/server`: Hono, x402 core/hono/evm/avm/svm/extensions, Worldcoin AgentKit, tsx.
- `apps/facilitator`: Hono Node server, x402 core/evm, viem, tsx.