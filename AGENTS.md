# Repository Guidelines

## Project Structure & Module Organization

This pnpm workspace contains three TypeScript applications under `apps/`:

- `apps/frontend/`: React/Vite WebMCP todo UI. Source is in `src/`; tests live beside the UI in `src/App.test.tsx`; static assets are in `public/`.
- `apps/server/`: Hono resource server that protects endpoints with x402 and AgentKit.
- `apps/facilitator/`: Hono/viem service that verifies and settles EVM x402 payments.

Keep changes within the relevant app. The frontend's `useTodos.ts`, `schemas.ts`, and `useWebMCPTools.ts` deliberately share state, validation, and tool behavior.

## Build, Test, and Development Commands

- `pnpm install`: install all workspace dependencies.
- `pnpm --filter frontend run start`: run the Vite frontend locally (normally `http://localhost:5173`).
- `pnpm --filter frontend run test`: execute the Vitest/jsdom test suite.
- `pnpm --filter frontend run build`: create a production frontend build.
- `pnpm --filter x402server run dev`: watch and run the resource server.
- `pnpm --filter facilitator run dev`: watch and run the facilitator; use `run build` before distribution.
- `pnpm exec biome check .`: run repository formatting and lint checks without modifying files. `pnpm check` applies automatic fixes.

## Coding Style & Naming Conventions

Use TypeScript and ESM imports. Biome is authoritative: use spaces for indentation and double quotes. Favor descriptive camelCase variables/functions, PascalCase React components and types, and `use…` names for hooks. Validate externally supplied frontend tool inputs through the Zod schemas in `apps/frontend/src/schemas.ts`.

## Testing Guidelines

Frontend tests use Vitest with Testing Library and jsdom. Name tests `*.test.tsx` and place them near the component or feature they cover. For UI or WebMCP behavior changes, add or update focused tests, then run the frontend test and build commands.

## Commit & Pull Request Guidelines

History currently uses short, imperative summaries such as `update` and `add Agent SKILL`; use a more specific equivalent, for example `frontend: validate renamed todo text`. Keep commits scoped. Pull requests should describe the affected app and behavior, link related issues when available, list validation commands run, and include screenshots for visible frontend changes.

## Configuration & WebMCP

Do not commit secrets from `.env` or `.env.local`; use `apps/server/.env.example` as the configuration reference. For Chrome WebMCP testing setup, follow `apps/frontend/AGENTS.md`.
