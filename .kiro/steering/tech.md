# Technology Stack

## Architecture

The repository is a pnpm TypeScript workspace with a browser application and two Node HTTP services. The frontend owns recipe presentation, the human-in-the-loop gate, injected-wallet interaction, and WebMCP registration; the resource server accepts sponsor grants or x402 evidence; the facilitator handles EVM payment verification and settlement.

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

- WebMCP tools and visible controls call the same gate coordinator and premium-resource client.
- Imperative WebMCP registrations are tied to React lifecycle cleanup via `AbortController`.
- Payment policy, resource-server configuration, and facilitator settlement remain separate services to keep trust boundaries explicit.
- Target `document.modelContext` for ChatGPT and feature-detect `navigator.modelContext` for Chrome compatibility while the draft API is in flux.
- Use only Base Sepolia (`eip155:84532`), the x402 `exact` scheme, testnet USDC, and an injected EIP-1193 wallet. Reject other chain IDs and never bundle a payer private key in frontend code.
- Use 0.01 testnet USDC for the demo payment. Keep `payTo`, canonical asset address, facilitator URL, public API URL, allowed origin, and Origin Trial token in validated environment/deployment configuration.
- Keep sponsor sessions (90 seconds), sponsor grants (60 seconds), and five-minute successful-result replay in bounded process-local registries. The public Node deployment is exactly one instance with autoscaling disabled; durable or multi-instance guarantees are out of scope.
- Apply strict CORS to all sponsor and protected-analysis API routes. Allow `Authorization`, `Content-Type`, `Idempotency-Key`, and the x402 request header; expose the required x402 response headers and use `Cache-Control: no-store`.

---
_Document durable technology choices and standards, not all dependencies._
