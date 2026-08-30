# Demo video script and shot list

**Target runtime: 2:45. Maximum allowed by this plan: 2:59.** Use English
voice-over or accurate English narration. Do not add music or media whose rights
have not been verified.

## 0:00–0:20 — Problem

**Shot:** Open on the Open Table Journal recipe page, with the publisher name
and full recipe visible.

**Voice-over:** “The open web is funded by human attention. But when agents
consume the web for us, publishers can lose the visits that fund free content.
AdGate asks whether WebMCP can keep structured access open without removing
human choice.”

## 0:20–0:45 — WebMCP invocation

**Shot:** Ask the supported agent to analyze the published recipe. Show it
selecting `analyze_recipe`, then keep both the host invocation and page visible.

**Voice-over:** “The page exposes a strict WebMCP tool. The call does not scrape
buttons or bypass the publisher. It stays pending while the page asks me how to
unlock the same protected analysis.”

## 0:45–1:20 — Sponsor golden path

**Shot:** Show the gate choice, select **Use sponsor access**, start the owned
Open Table Weekly message, show the countdown, continue, then show the tool result.

**Voice-over:** “The wallet-free path uses an owned sponsor message. The browser
counts eight visible seconds, while the server independently enforces elapsed
session time. A short-lived one-time grant unlocks the result, and the original
WebMCP invocation resolves without a second prompt.”

## 1:20–1:50 — Payment evidence

**Shot:** Start a new attempt, choose Base Sepolia, show 0.01 USDC terms before
the wallet prompt, click the confirmation yourself, then show the normalized receipt.

**Voice-over:** “The alternative is an explicit x402 payment on Base Sepolia.
Terms appear before wallet access, the human confirms, and the same request
returns a settlement receipt. No browser private key is used.”

If hosted settlement is not verified, use a same-release local clip with a
persistent on-screen caption: **recorded local prototype**. Do not imply it is
the live public environment.

## 1:50–2:20 — Architecture and safety

**Shot:** Show the architecture section of the README, then briefly show the
release command ending in `GO`.

**Voice-over:** “One React coordinator joins the visible UI and WebMCP host. A
Hono server owns sponsor and payment evidence, and an optional facilitator
settles only the fixed testnet policy. Abort, duplicate, expiry, replay, CORS,
and secret-redaction boundaries are covered by automated tests.”

## 2:20–2:45 — Impact and close

**Shot:** Return to the successful publisher result and finish on the two access choices.

**Voice-over:** “The pattern can extend to news, research, recipes, and creator
tools: publishers keep a free path, people keep control, and agents receive a
reliable structured result. AdGate is a small prototype for a large question:
how does the open web stay open in an agent-native world?”

## Recording checks

- Show the full release SHA once without exposing environment values.
- Keep the sponsor countdown legible and do not cut around the completion boundary.
- Show Base Sepolia, 0.01 testnet USDC, explicit click, and receipt in one sequence.
- Show that the WebMCP result belongs to the invocation started before the gate.
- Keep all captions and voice-over in English.
- Export below three minutes and verify duration after upload.
