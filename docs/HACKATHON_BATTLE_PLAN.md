# The WebMCP Challenge Battle Plan — AdGate for WebMCP

## 1. Mission

Win on all four equally weighted criteria by proving one memorable thesis: **when agents use the web, publishers can preserve free access without removing human choice**.

- **WebMCP Leverage**: a WebMCP invocation visibly pauses and resumes around a human decision in the same page.
- **Execution**: one coherent recipe experience, two working unlock paths, safe failure states, and a public deployment.
- **Potential Impact**: publishers need a monetization path as agent traffic bypasses conventional page-view advertising.
- **Creativity & Ambition**: sponsor attention and x402 payment become interchangeable access evidence for an agent-invoked browser tool.

The official deadline is September 3, 2026 at 1:00 PM PDT, or September 4 at 5:00 AM JST.

## 2. Idea

> As agents consume web services, publishers lose the human attention that funds free content. AdGate for WebMCP lets a premium browser tool pause for a human choice: view a short sponsor message for free access, or approve a tiny x402 payment to continue immediately.

### Golden demo

1. Open the recipe page and ask ChatGPT to analyze the recipe for nutrition and substitutions.
2. ChatGPT selects `analyze_recipe`; the site opens a gate while that exact invocation waits.
3. Choose **Watch sponsor**. Show the short countdown, then show the agent receiving the analysis without a second prompt.
4. Repeat briefly with **Pay to skip**, show explicit wallet approval and x402 settlement receipt.
5. End on the architecture view: one tool, one protected resource, two human-approved access paths.

The sponsor path is the judge-safe live path. The paid path is demonstrated live when possible and backed by a pre-recorded clip.

## 3. Architecture

```text
ChatGPT / Chrome agent
        |
        | analyze_recipe(input, AbortSignal)
        v
WebMCP adapter (document first, navigator fallback, host result normalization)
        |
        v
GateCoordinator.requestAccess(resource, nonce) ----> React gate modal
        |                                                |
        |                         +----------------------+------------------+
        |                         |                                         |
        |                  sponsor countdown                       injected wallet approval
        |                         |                                         |
        |                  short-lived grant                         x402 signature
        |                         |                                         |
        +-------------------------+----------------------+------------------+
                                                       |
                                                       v
                                      Hono premium resource server
                                      sponsor grant OR x402 middleware
                                                       |
                                                       v
                                      Hosted testnet facilitator verify -> settle
                                                       |
                                                       v
                                      deterministic analysis response
                                                       |
                                                       v
                                         original tool promise resolves
```

### MVP

1. One polished `Open Table Journal` recipe page for `Roasted Chickpea Quinoa Bowl` and one deterministic premium analysis.
2. One shared gate modal with sponsor and x402 choices.
3. One WebMCP tool whose execution waits for and resumes after the human decision.

The tool accepts only the canonical recipe ID plus optional dietary goals. Recipe title, ingredients, and instructions come from the publisher-owned canonical recipe rather than agent-supplied content.

### Deliberate product decisions

- React/Vite remains; migrating to Next.js creates schedule risk without improving judging value.
- Base Sepolia (`eip155:84532`) only, using x402 `exact` and testnet USDC. World Chain and mainnet support are removed from the MVP because multi-network branching adds failure modes without improving the judging story.
- Injected wallet only; browser private keys are forbidden.
- Cloudflare hosts the frontend with an Origin Trial token; a single-instance Node host such as Render runs the Hono resource server with strict x402 CORS. A hosted testnet facilitator is the preferred candidate pending capability verification; if it is not verified, payment is disabled publicly and demonstrated with a same-release local recording.
- The repository's self-hosted facilitator remains optional because exposing a gas-funded signer safely would require authentication, rate limits, rail allowlists, and operational hardening beyond the MVP.
- Sponsor verification is explicitly a prototype capability, not claimed as fraud-proof ad measurement.
- The sponsor path uses a server-issued, resource-bound 90-second session. The browser counts eight visible seconds and pauses while the page is hidden; the server independently enforces eight seconds of wall-clock time before issuing a single-use 60-second grant. This proves elapsed session time, not human attention.
- Sponsor sessions, grants, and successful-result replay are process-local. The public resource server runs as one instance with autoscaling disabled; a restart invalidates active attempts and requires a new sponsor attempt.
- Successful protected results may be replayed for five minutes only when the idempotency key, request digest, and access-evidence fingerprint all match. A reused key with different content is rejected.
- No LLM is needed in the backend; deterministic output keeps the demo fast, repeatable, and inexpensive.
- `Open Table Weekly` is a fictional self-sponsor rendered with repository-owned CSS/illustration, with no external tracking or link.

## 4. Timeline

See `.kiro/steering/roadmap.md` for spec dependency waves and the JST delivery calendar. The non-negotiable controls are:

- Feature freeze: September 3, 12:00 JST.
- First deployed shell: August 31.
- First complete sponsor flow: September 1.
- First WebMCP golden-path recording: September 2.
- Devpost draft and README are written before final recording.
- Internal submission deadline: September 4, 03:00 JST.

## 5. Pitch Script

### 0:00–0:25 — Hook

“The open web is funded by human attention. But when agents consume the web for us, who sees the ads that pay publishers? If we do nothing, agent convenience can make free content harder to sustain.”

### 0:25–1:30 — Demo

“I’ll ask my agent to analyze this recipe. The site exposes a real WebMCP tool, so the agent does not scrape buttons or guess the UI. But before premium work runs, AdGate brings the human back into the loop.”

Show sponsor choice, countdown, automatic resume and result. Then show the paid choice and the short settlement receipt clip.

### 1:30–2:20 — How

“The WebMCP execution stays pending while the page asks for consent. A sponsor grant or x402 payment authorizes the same protected Hono resource. The original tool call then resolves, so the page and agent never lose shared context.”

Mention `document.modelContext`, schema validation, abort handling, Base Sepolia, and facilitator verify/settle.

### 2:20–2:50 — Impact

“This pattern can wrap premium tools on recipe, news, research, and creator sites. Publishers keep a free path; users keep control; agents get reliable structured access.”

### 2:50–2:59 — Close

“AdGate is a small protocol for a large question: how does the open web stay open in an agent-native world?”

## 6. Risk & Fallback

| Risk | Prevention | Demo fallback |
|---|---|---|
| Wallet or testnet failure | Preflight network, balance and facilitator health | Use sponsor path live; insert a clearly labeled paid-path recording |
| ChatGPT WebMCP API drift | `document` first, `navigator` fallback; normalize results; test both hosts | Show Chrome inspector execution and backup recording |
| Chrome deployment not WebMCP-enabled | Enroll the production origin and verify the Origin Trial token before freeze | Judge via ChatGPT browser and show flag-enabled Chrome backup |
| Gate promise hangs | Abort propagation, timeout, single-active-request invariant | Cancel visibly and restart the golden path |
| Sponsor grant replay | Resource/nonce binding, short TTL, one-time consumption | Fall back to in-memory demo grant with limitation disclosed |
| Resource response lost after grant consumption | Five-minute same-identity success replay | Start a new sponsor attempt after replay expiry or server restart |
| CORS/header mismatch | Explicitly expose x402 headers and run deployed-origin smoke tests | Same-origin proxy only if already validated before freeze |
| Scope creep | One recipe, one tool, two access paths | Cut dashboard, analytics and SDK packaging first |
| Existing-project eligibility ambiguity | Timestamped commits and README section separating prior reference work | Provide a concise before/after file list in Devpost text |

## Release Gate

- Live URL works in ChatGPT's browser and WebMCP-enabled Chrome.
- Sponsor path needs no credentials or wallet.
- Paid path never exposes a private key and clearly says testnet.
- Tool input rejects unknown/oversized values; external content is marked untrusted.
- Cancellation, duplicate invocation, grant expiry, declined payment, server outage, and unsupported browser have visible outcomes.
- A second invocation is rejected with a retryable `INVALID_TRANSITION`; the visible CTA is disabled and both page and tool explain that another analysis is awaiting approval.
- The live server is a single non-autoscaling instance and is not redeployed during recording or judging.
- Public repository includes source, setup, environment examples, license visibility, architecture, and hackathon-period provenance.
- Public YouTube video is under three minutes, has English audio, and contains no unlicensed music/assets.
