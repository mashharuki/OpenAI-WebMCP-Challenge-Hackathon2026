# Task completion

- Run the narrowest applicable command first: frontend changes → `pnpm --filter frontend run test` and `pnpm --filter frontend run build`; facilitator changes → `pnpm --filter facilitator run build`.
- For repository-wide formatting/lint checks, use `pnpm check` (it includes `--write`, so it mutates files). Use `pnpm exec biome check .` for a read-only check when appropriate.
- Run `pnpm knip` or `pnpm jscpd` only when dependency hygiene or duplication is within the task scope.