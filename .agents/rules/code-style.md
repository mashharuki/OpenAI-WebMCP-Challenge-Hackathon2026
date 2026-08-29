# Code Style

## General

- Prefer `const` over `let`. Never use `var`
- Use early returns to reduce nesting
- Keep functions under 50 lines. Extract helpers when longer
- Name booleans with `is`, `has`, `should` prefix
- Name functions as verb+noun: `getUserById`, `validateInput`

## TypeScript

- Explicit return types on exported functions
- Use `type` for object shapes, `interface` for extendable contracts
- Prefer `unknown` over `any`. If `any` is unavoidable, add `// eslint-disable-next-line` with justification
- Use discriminated unions over optional fields where state is mutually exclusive
- Prefer `satisfies` over `as` for type assertions

## Error Handling

- Never swallow errors with empty catch blocks
- Use Result pattern (`{ ok: true, data } | { ok: false, error }`) for expected failures
- Throw only for unexpected/programmer errors
- Always log errors with context (operation name, relevant IDs)

## Imports

- Group imports: external libs → internal modules → relative imports
- Use path aliases (`@/`) instead of deep relative paths (`../../../`)
- No circular imports