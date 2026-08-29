# Project Structure

## Organization Philosophy

The workspace separates browser interaction, payment-gated resource delivery, and payment facilitation into independent applications. Within each app, organize by responsibility: entry points compose the application; focused modules own state, schemas, or integration setup.

## Directory Patterns

### WebMCP frontend
**Location**: `apps/frontend/src/`  
**Purpose**: React UI, shared todo state, WebMCP tool definitions, runtime schemas, and Worker/browser entry points.  
**Example**: `useTodos.ts` owns state actions; `useWebMCPTools.ts` exposes those actions to agents.

### Payment-gated resource service
**Location**: `apps/server/src/`  
**Purpose**: Hono route composition, x402 policy, AgentKit resource-server setup, and facilitator client creation.  
**Example**: keep protected-route configuration in `config.ts`, not inline in HTTP handlers.

### EVM facilitator
**Location**: `apps/facilitator/src/`  
**Purpose**: verification/settlement routes and chain-aware viem client or signer setup.  
**Example**: `viem.ts` centralizes chain-specific client construction.

## Naming Conventions

- **Files**: camelCase module names, including hooks such as `useTodos.ts`; React component files may use PascalCase, e.g. `App.tsx`.
- **Components and types**: PascalCase.
- **Functions, variables, and hooks**: descriptive camelCase; hooks begin with `use`.

## Import Organization

Use ESM imports and let Biome organize them. Prefer relative imports for modules within an application; no workspace-wide path-alias convention is established.

## Code Organization Principles

- Keep visible frontend controls and WebMCP tools on one state and validation path.
- Keep service route handlers concise; delegate payment, chain, and integration setup to focused modules.
- Keep `apps/frontend`, `apps/server`, and `apps/facilitator` boundaries explicit. Changes spanning them should state their compatibility and configuration impact.

---
_Describe patterns rather than exhaustive trees; new code following these patterns should require no steering update._
