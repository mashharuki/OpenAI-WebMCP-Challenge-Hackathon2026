# Repository Guidelines

## Project Structure & Module Organization

`src/index.ts` is the facilitator HTTP entry point. It configures Hono routes for `/health`, `/supported`, `/verify`, and `/settle`, and wires x402 lifecycle callbacks. Keep chain-specific client and signer construction in `src/viem.ts`; do not duplicate viem setup in route handlers. Build output is written to `dist/` and is generated, not hand-edited.

The facilitator is one app in the repository's pnpm workspace. Its counterpart resource server lives in `../server/`; make cross-service API changes deliberately and document any required environment changes.

## Build, Test, and Development Commands

Run commands from this directory or use the root workspace filter:

- `pnpm run dev` — start `tsx watch src/index.ts` for local development.
- `pnpm run build` — type-check and compile TypeScript into `dist/`.
- `pnpm run start` — run the compiled `dist/index.js`.
- `pnpm --filter facilitator run build` — invoke the same build from the repository root.
- `pnpm exec biome check .` (root) — run formatting and lint checks without writing changes. Use `pnpm check` only when automatic fixes are intended.

## Coding Style & Naming Conventions

Use TypeScript and ESM imports. Repository Biome settings require space indentation and double quotes. Use camelCase for values and functions, PascalCase for types, and meaningful names such as `getViemClientForChain`. Prefer small route callbacks that delegate chain and signing work to `viem.ts`; keep error responses explicit and safe to expose.

## Testing Guidelines

There is currently no package-local automated test script. For each functional change, run `pnpm run build` at minimum and manually exercise the affected HTTP route with development configuration. When adding tests, use a `*.test.ts` filename near the module under test and add a package script so they are reproducible in CI.

## Commit & Pull Request Guidelines

Recent repository history uses short imperative summaries; write a specific scoped summary instead, e.g. `facilitator: validate settle response`. Keep commits focused. Pull requests should state the changed endpoint or chain behavior, list environment/configuration requirements, link an issue when applicable, and record validation performed. Never commit `.env` or `.env.local` secrets.
