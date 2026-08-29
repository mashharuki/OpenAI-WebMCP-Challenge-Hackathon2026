# Core

- pnpm workspace repository with three independent TypeScript apps under `apps/`.
- Architecture/source map:
  - Browser WebMCP todo UI and Cloudflare Worker entry: `mem:frontend/core`.
  - x402-protected AgentKit resource server: `mem:server/core`.
  - x402 EVM facilitator used for payment verification/settlement: `mem:facilitator/core`.
- Shared stack, package manager, and pinned tooling: `mem:tech_stack`.
- Runnable commands: `mem:suggested_commands`; completion checks: `mem:task_completion`; style rules: `mem:conventions`.