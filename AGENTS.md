# Repository Guidelines

## Project Structure & Module Organization

This pnpm workspace contains three TypeScript applications under `apps/`:

- `apps/frontend/`: React/Vite WebMCP todo UI. Source is in `src/`; tests and test setup belong under `test/`; static assets are in `public/`.
- `apps/server/`: Hono resource server that protects endpoints with x402 and AgentKit. Source is in `src/`; tests belong under `test/` and should mirror the relevant source-module structure.
- `apps/facilitator/`: Hono/viem service that verifies and settles EVM x402 payments. Source is in `src/`; tests belong under `test/`.

Keep changes within the relevant app. The frontend's `useTodos.ts`, `schemas.ts`, and `useWebMCPTools.ts` deliberately share state, validation, and tool behavior.

## Build, Test, and Development Commands

- `pnpm install`: install all workspace dependencies.
- `pnpm --filter frontend run start`: run the Vite frontend locally (normally `http://localhost:5173`).
- `pnpm --filter frontend run test`: execute the Vitest/jsdom test suite.
- `pnpm --filter frontend run build`: create a production frontend build.
- `pnpm --filter x402server run dev`: watch and run the resource server.
- `pnpm --filter x402server run test`: execute the server Vitest suite under `apps/server/test/`.
- `pnpm --filter x402server run typecheck`: type-check the resource server.
- `pnpm --filter x402server run build`: build the resource server.
- `pnpm --filter facilitator run dev`: watch and run the facilitator; use `run build` before distribution.
- `pnpm exec biome check .`: run repository formatting and lint checks without modifying files. `pnpm check` applies automatic fixes.

## Coding Style & Naming Conventions

Use TypeScript and ESM imports. Biome is authoritative: use spaces for indentation and double quotes. Favor descriptive camelCase variables/functions, PascalCase React components and types, and `use…` names for hooks. Validate externally supplied frontend tool inputs through the Zod schemas in `apps/frontend/src/schemas.ts`.

## Testing Guidelines

Frontend tests use Vitest with Testing Library and jsdom. Put them under `apps/frontend/test/`, mirror the corresponding `src/` subdirectory where useful, and name them `*.test.ts` or `*.test.tsx`. Do not colocate frontend tests or test setup in `apps/frontend/src/`. For UI or WebMCP behavior changes, add or update focused tests, then run the frontend test and build commands.

Server tests use Vitest. Put every server test under `apps/server/test/`, mirror the corresponding `src/` subdirectory where useful, and name it `*.test.ts`. Do not colocate server tests in `apps/server/src/`. For server behavior changes, add or update focused tests and run the server test, typecheck, and build commands.

Facilitator tests belong under `apps/facilitator/test/`, should mirror the corresponding `src/` subdirectory where useful, and use the `*.test.ts` suffix. Do not colocate facilitator tests in `apps/facilitator/src/`. Until an automated test script is introduced, build the facilitator and manually exercise affected routes.

## Commit & Pull Request Guidelines

History currently uses short, imperative summaries such as `update` and `add Agent SKILL`; use a more specific equivalent, for example `frontend: validate renamed todo text`. Keep commits scoped. Pull requests should describe the affected app and behavior, link related issues when available, list validation commands run, and include screenshots for visible frontend changes.

## Configuration & WebMCP

Do not commit secrets from `.env` or `.env.local`; use `apps/server/.env.example` as the configuration reference. For Chrome WebMCP testing setup, follow `apps/frontend/AGENTS.md`.
