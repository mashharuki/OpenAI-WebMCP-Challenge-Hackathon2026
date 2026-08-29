# Server core

- `apps/server` is the Hono x402 resource server.
- `src/index.ts` composes routes: health plus a paid weather endpoint and x402 middleware.
- `src/config.ts` defines x402 route/payment configuration; `src/resourceServer.ts` configures Worldcoin AgentKit resource-server integration; `src/facilitator.ts` provides the facilitator client.
- Development runs via `tsx watch src/index.ts`; environment templates are `.env.example` and local `.env`.