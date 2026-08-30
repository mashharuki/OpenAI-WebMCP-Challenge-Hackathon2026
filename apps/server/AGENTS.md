# Repository Guidelines

## Project Structure & Module Organization

This package is the x402-protected Hono resource server. Source files are all under `src/`:

- `index.ts` creates the HTTP server, health route, paid weather route, and x402 middleware.
- `config.ts` defines the protected-route and payment configuration.
- `resourceServer.ts` configures the Worldcoin AgentKit resource-server extension.
- `facilitator.ts` creates the client used to communicate with the payment facilitator.

Keep payment policy in `config.ts`, AgentKit setup in `resourceServer.ts`, and HTTP composition in `index.ts`. The paired settlement service is `../facilitator/`; coordinate API or chain changes across both packages.

## Build, Test, and Development Commands

- `pnpm run dev` — start `tsx watch src/index.ts` for local server development.
- `pnpm --filter x402server run dev` — run the same command from the repository root.
- `pnpm exec biome check .` — from the root, check formatting and linting without changing files.
- `pnpm check` — run Biome with automatic fixes; use only when modifying the worktree is intended.

Before submitting a server change, run the package's `test`, `typecheck`, and `build` scripts. For integration-sensitive changes, also run the development server with valid local configuration and exercise `/health` plus the affected protected route.

## Coding Style & Naming Conventions

Write TypeScript using ESM imports. The repository uses Biome with space indentation, double quotes, recommended lint rules, and import organization. Use camelCase for variables/functions, PascalCase for types, and descriptive names such as `resourceServer` and `facilitatorClient`. Keep Hono route callbacks short; move reusable setup into focused modules rather than adding unrelated logic to `index.ts`.

## Testing Guidelines

Place server tests under `test/`, mirroring the relevant `src/` module directory when useful, and name them `*.test.ts`. Cover payment middleware behavior, error responses, and route authorization boundaries; do not require live payment infrastructure in unit tests. No coverage threshold is currently configured.

## Commit & Pull Request Guidelines

Recent history uses short imperative summaries; prefer a specific scoped message such as `server: reject unsupported payment network`. Keep commits narrow. Pull requests should identify endpoint and payment-policy changes, link related issues when available, list manual or automated validation, and document configuration changes. Never commit `.env` secrets; use `.env.example` for required variable names.
