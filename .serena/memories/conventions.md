# Conventions

- Biome is authoritative: spaces for indentation and double quotes for JavaScript/TypeScript; recommended lint rules and import organization are enabled.
- Keep frontend UI actions and exposed WebMCP tools on the same `useTodos` action state; validate tool arguments with the Zod schemas in `src/schemas.ts`.
- Frontend WebMCP imperative registrations are lifecycle-scoped with `AbortController` cleanup; declarative actions use semantic form tool attributes.
- TypeScript modules use named constants/functions and ESM imports; avoid duplicating product behavior outside the app-specific entry points.