# AdGate for WebMCP

## Live demo

- **Public app:** <https://adgate-frontend.avp-104-106-107-a78.workers.dev/>
- **Public source:** <https://github.com/mashharuki/OpenAI-WebMCP-Challenge-Hackathon2026>
- **Demo video:** <https://youtu.be/FKDXyClLxJY>
- **License:** [MIT](./LICENSE)

The sponsor path is the required live judging path and needs no wallet. The
payment path is testnet-only and may be presented as a same-release recording
when the hosted facilitator is unavailable.

## See the flow

| WebMCP payment review | Human-controlled sponsor access |
| --- | --- |
| ![The Open Table Journal publisher page with the analyze_recipe WebMCP tool visible in the tool inspector.](./docs/img/0.jpg) | ![The sponsor-access gate over the publisher page, with its visible countdown for a publisher-initiated analysis.](./docs/img/3.jpg) |

| x402 payment receipt | Canonical recipe-analysis result |
| --- | --- |
| ![The completed Base Sepolia 0.01 testnet USDC receipt.](./docs/img/6.jpg) | ![The returned recipe-analysis summary, nutritional insights, and practical suggestions.](./docs/img/2.jpg) |

The demo video shows the payment-approved WebMCP invocation and the separate
sponsor-supported publisher journey. A sponsor completion does not resume a
previously declined or cancelled WebMCP invocation.

## Inspiration

The arrival of AI agents is dramatically changing how people consume web content. In the past, people would visit and read websites one by one. Today, AI can collect information on their behalf by scraping sources such as technical blogs.

This is a great user experience for end users. However, it can also mean that website operators and the businesses that advertise on those sites lose their opportunity to reach users.

This product was inspired by that problem. I wanted agents to be able to use a publisher’s structured capabilities while keeping people clearly in control of how access is granted. By combining WebMCP with x402, I wanted to explore a model where users who value convenience can make a micropayment for a nearly automated experience, while users who do not want to pay can access premium content by viewing a short advertisement.

## What it does

For this project, I created a fictional recipe website. It includes a WebMCP-compatible tool called `analyze_recipe`, which provides more detailed analysis as a premium feature.

There are two ways to access the premium feature:

1. View an owned sponsor message (advertisement) for eight seconds.
2. Explicitly approve a 0.01 testnet USDC x402 payment on Base Sepolia.

Both paths authorize the same protected analysis endpoint. The original tool invocation then resumes with one structured result containing a recipe summary, nutrition notes, practical suggestions, and a general-information disclaimer.

The same gate is also used by the visible **Analyze this recipe** button, so people and agents use one coherent product flow rather than separate experiences.

I felt WebMCP was a good fit because agents can discover and invoke typed, page-owned capabilities instead of scraping a page or guessing which buttons to click. Users can make an important decision in the middle of the same invocation without losing the shared context.

## How we built it

The React/Vite frontend registers `analyze_recipe` with
`document.modelContext.registerTool`, with a `navigator.modelContext`
compatibility fallback. A shared `GateCoordinator` keeps one request alive while
the page renders the sponsor or payment experience, propagates cancellation,
and resolves the result exactly once.

The x402-enabled resource server, built with Hono, manages authorization and
canonical deterministic analysis. Sponsor sessions, single-use grants, and
their consumption state are stored in a named Cloudflare Durable Object. For
the payment path, the app displays Base Sepolia terms before wallet access and
then uses x402 exact-payment authorization. A person can use a browser wallet
or authenticate with a passkey to create or restore a Privy embedded wallet.
An optional Hono/viem facilitator verifies and settles the testnet payment. The
application never receives a private key, and the AI never controls the wallet.

I used Codex to turn product decisions into executable specifications, build
the frontend/server/facilitator boundaries, write focused tests, diagnose
lifecycle and payment-receipt issues, create fake-host browser journeys, and
run the final release checks. Human decisions remained explicit for product
scope, payment policy, security constraints, deployment, and publication.

Both the frontend and backend are deployed on Cloudflare.

## Architecture

```text
WebMCP host                         Visible publisher UI
          |                                  |
          +----------------+-----------------+
                           v
             React publisher + GateCoordinator
                           |
              +------------+------------+
              |                         |
              v                         v
       x402 payment review       8-second sponsor view
              |                         |
      +-------+--------+        one-time sponsor grant
      |                |                 |
      v                v                 |
Browser wallet    Passkey → Privy         |
(MetaMask etc.)   embedded wallet          |
      |                |                 |
      |        Copy address → Circle      |
      |        Faucet → testnet USDC      |
      +------ signed x402 payload --------+
                           |
                           v
                 Hono resource server
                           |
        x402 verification / protected analysis
                           |
                           v
       payment invocation resolves / UI renders result
```

| App | Responsibility | Trust boundary |
| --- | --- | --- |
| [`apps/frontend`](./apps/frontend/) | Publisher UI, WebMCP registration, human gate, sponsor timer, browser-wallet and Privy embedded-wallet adapters | Treats tool input, HTTP responses, and wallet responses as untrusted |
| [`apps/server`](./apps/server/) | Sponsor sessions/grants, bounded attempt state, protected analysis, x402 challenge | Owns authorization and never trusts browser elapsed-time claims |
| [`apps/facilitator`](./apps/facilitator/) | Optional x402 verification and settlement | Holds the testnet signer only in its secret store |

See [architecture and provenance](./docs/architecture-and-provenance.md) for
the detailed data flow, trust boundaries, and before/after project history.

## Challenges we ran into

One challenge was deciding how to combine WebMCP and x402, as well as who
should manage the wallet and where it should be managed.

The first version used only an injected wallet, which made the payment path
hard to demonstrate in an in-app browser. The current demo keeps browser-wallet
support and adds Privy passkey authentication with an embedded wallet. A person
can copy that wallet address, request Base Sepolia testnet USDC from Circle
Faucet, and return to the same explicit x402 review.

This keeps the important property of the demo: passkey authentication does not
authorize a payment. The person still reviews the amount and explicitly signs
the x402 payment. WalletConnect and additional wallet providers remain useful
future extensions.

With this architecture, I separated the responsibilities of AI and human
interaction. The AI handles the process automatically up to the payment step.
As the human-in-the-loop, the person reviews the payment details. If they
decide not to pay, they can view an advertisement and be guided to premium
access instead.

Designing this architecture was the most difficult part of the project.

## Accomplishments that we're proud of

Although the development period was short, I am proud that I was able to learn
WebMCP and combine it with x402 and Cloudflare technologies to turn this idea
into a working product. I spent more time than usual thinking through the idea
and designing the architecture.

It is a very simple demo, but I am proud that I was able to build it as a new
advertising model for the AI-native era.

## What we learned

The biggest lesson was gaining a practical understanding of WebMCP. Building
with it helped me understand how it differs from MCP.

Because WebMCP is based in a visible browser environment, I think it makes it
easier to build products with a clear separation of responsibilities between
people and AI. I also found this to be highly compatible with x402.

## What's next for AdGate

Next, I would like to expand this gate to other structured publisher resources,
such as news, research, and creator tools. To make it more broadly useful, I
would like to build a dashboard for sponsors and make the supported blockchains
and assets more flexible.

For production, the payment path would need authentication, rate limits,
monitoring, treasury controls, stronger key management, and evaluation of
production payment rails. I would also like to explore privacy-preserving
sponsor measurement and observability while maintaining a clear boundary for
explicit human choice.

## Local setup

Prerequisites:

- Node.js 24.20.0 (`nvm use` reads [`.nvmrc`](./.nvmrc))
- Corepack with the repository-pinned pnpm version
- Chromium only when running the browser E2E suite

```bash
nvm use
corepack enable
pnpm install --frozen-lockfile
```

Run the resource server and frontend in separate terminals:

```bash
pnpm --filter x402server run dev
pnpm --filter frontend run start
```

Open <http://localhost:5173>. The Vite development proxy sends `/api` to the
local server. Sponsor access works without a wallet. The optional local payment
path supports either a browser wallet or Privy passkey authentication with an
embedded wallet; configure `VITE_PRIVY_APP_ID` and allow
`http://localhost:5173` in the Privy Dashboard. Start the facilitator separately
and provide only testnet configuration through uncommitted environment files.

The app-specific runbooks provide focused instructions:

- [Frontend and WebMCP host setup](./apps/frontend/README.md)
- [Resource server](./apps/server/README.md)
- [Optional facilitator](./apps/facilitator/README.md)
- [Environment reference](./docs/environment.md)

## Testing

Run the complete deterministic release gate:

```bash
pnpm release:check
```

It performs the frozen install check, Biome, documentation checks, all app
tests/types/builds, fake-host Chromium E2E, cross-app contracts, public-probe
tests, and payment-boundary validation. It does not use a real wallet, private
key, mainnet, or external transaction.

Useful focused commands:

```bash
pnpm --filter frontend run test
pnpm --filter frontend run test:e2e
pnpm --filter x402server run test
pnpm --filter facilitator run test
```

After deployment, validate public boundaries without mutating external state:

```bash
pnpm smoke:public -- \
  --frontend-url https://frontend.example.com \
  --server-url https://api.example.com \
  --facilitator-url https://facilitator.example.com
```
