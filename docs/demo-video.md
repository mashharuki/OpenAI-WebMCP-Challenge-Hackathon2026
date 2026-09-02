# Demo video script and shot list

**Target runtime: 2:45. Maximum allowed by this plan: 2:59.** The English
voice-over uses short sentences and simple words so that it is easier to speak
clearly. A slash (`/`) marks a short pause. Do not add music or media whose
rights have not been verified.

## 0:00–0:20 — Problem

**Shot:** Open on the Open Table Journal recipe page, with the publisher name
and full recipe visible.

**Voice-over:** “Many free websites depend on visits and ads. / But when AI
reads the web for us, / websites may lose those visits. / AdGate shows a new
way for AI to use web content, / while people stay in control.”

## 0:20–0:40 — Product

**Shot:** Scroll briefly through the published recipe and show the premium
analysis section and its visible action.

**Voice-over:** “This is a recipe website called Open Table Journal. / It
offers a premium recipe analysis. / A person can use the page directly, / and
an AI agent can use the same service through Web M-C-P.”

## 0:40–1:05 — WebMCP invocation

**Shot:** Ask the supported agent to analyze the published recipe. Show it
finding and invoking `analyze_recipe`, while keeping the agent and page visible.

**Voice-over:** “I ask the agent to analyze this recipe. / The agent finds a
tool called ‘Analyze Recipe.’ / It uses the tool directly. / It does not copy
the page, / and it does not press the visible button.”

## 1:05–1:45 — x402 payment

**Shot:** Show the WebMCP request automatically opening the Base Sepolia payment
route. Keep the 0.01 testnet USDC terms visible before wallet access. Connect
the wallet, review the terms, and approve the payment and signature yourself.

**Voice-over:** “The tool now starts an X-four-oh-two payment on Base Sepolia. /
The request stays open while I check the payment. / The price is zero point zero
one test U-S-D-C. / I connect my wallet, / confirm the payment, / and approve
the signature myself. / The AI never controls my wallet.”

## 1:45–2:05 — Original result

**Shot:** Keep the original WebMCP invocation visible as it resumes. Show the
returned recipe summary, nutritional insights, practical suggestions, and
disclaimer.

**Voice-over:** “After the payment is complete, / the first tool request
continues. / There is no reload, / and the agent does not send a second request.
/ The result includes a recipe summary, / nutrition notes, / and useful
meal-prep ideas.”

## 2:05–2:30 — Architecture and safety

**Shot:** Show the architecture section of the README, then briefly show the
successful automated test or release output.

**Voice-over:** “The app has three main parts. / React connects the page and the
Web M-C-P tool. / A Hono server checks the payment proof. / A separate service
completes the test payment. / Our tests also check repeated requests, time
limits, errors, and secret data.”

## 2:30–2:45 — Closing

**Shot:** Return to the successful publisher result and finish on the AdGate
name and access experience.

**Voice-over:** “This idea can work for news, research, recipes, and creator
tools. / People keep control. / Websites can still earn money. / And AI agents
receive clear, trusted results. / This is AdGate.”

## Pronunciation guide

- **WebMCP:** “Web M-C-P”
- **x402:** “X four-oh-two”
- **Base Sepolia:** “Base seh-POH-lee-uh”
- **USDC:** “U-S-D-C”
- **Hono:** “HO-no”
- **AdGate:** “Ad Gate”

## Recording checks

- Warm up the public resource server and facilitator before recording.
- Show the full release SHA once without exposing environment values.
- Keep the agent invocation and the payment panel visible in the same sequence.
- Show Base Sepolia and 0.01 testnet USDC before opening the wallet.
- Perform the payment confirmation and wallet signature manually.
- Do not reload, navigate away, cancel, or invoke `analyze_recipe` a second time
  while the original call is pending.
- Show that the returned result belongs to the invocation started before payment.
- Keep all captions and voice-over in English.
- Export below three minutes and verify the duration after upload.
