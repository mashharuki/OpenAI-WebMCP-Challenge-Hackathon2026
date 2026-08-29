# Suggested commands

- Install workspace dependencies: `pnpm install` (root).
- Root quality tooling: `pnpm format`, `pnpm check`, `pnpm jscpd`, `pnpm knip`.
- Filtered package commands: `pnpm --filter frontend run start|build|test|types|deploy`; `pnpm --filter x402server run dev`; `pnpm --filter facilitator run dev|build|start`.
- Root script aliases expose package filters as `pnpm frontend`, `pnpm x402server`, and `pnpm facilitator`; append the package subcommand after `--` if needed.