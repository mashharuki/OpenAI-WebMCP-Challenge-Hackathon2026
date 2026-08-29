# Technology Stack

## Architecture

The repository is a pnpm TypeScript workspace with a browser application and two Node HTTP services. The frontend owns interactive todo state and WebMCP registration; the resource server gates paid access with x402; the facilitator handles EVM payment verification and settlement.

## Core Technologies

- **Language**: TypeScript; facilitator compilation is strict and uses NodeNext ESM settings.
- **Frontend**: React 19, Vite, Tailwind CSS, and Cloudflare Workers/Wrangler.
- **Services**: Hono with the Node server adapter; `tsx` drives local watch mode.
- **Payments**: x402 packages, viem for EVM integration, and Worldcoin AgentKit for resource-server functionality.

## Development Standards

### Type Safety

Use TypeScript and ESM imports. Treat Zod schemas as the runtime boundary for frontend tool arguments; keep schema-derived behavior aligned with UI actions.

### Code Quality

Biome formats and lints the workspace: space indentation, double quotes, recommended rules, and import organization. Run `pnpm exec biome check .` for a read-only quality check; root `pnpm check` writes fixes.

### Testing

The frontend uses Vitest, Testing Library, and jsdom. The services do not yet expose package-level test scripts; validate changes with focused route testing and add reproducible tests with new behavior.

## Development Environment

Use pnpm 11.24.0 at the workspace root. The frontend requires Node 24 or newer.

```bash
pnpm --filter frontend run start
pnpm --filter frontend run test
pnpm --filter facilitator run build
pnpm --filter x402server run dev
```

## Key Technical Decisions

- WebMCP tools call the same frontend state actions as visible controls.
- Imperative WebMCP registrations are tied to React lifecycle cleanup via `AbortController`.
- Payment policy, resource-server configuration, and facilitator settlement remain separate services to keep trust boundaries explicit.

---
_Document durable technology choices and standards, not all dependencies._
