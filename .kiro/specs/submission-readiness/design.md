# Design Document

## Overview

Submission readinessはプロダクト本体と競合しない最小release layerとする。自動化は再現可能なbuild/test、fake-host sponsor E2E、公開boundary smokeだけを所有する。README、Devpost、動画台本、screenshots、実ブラウザ・wallet証跡はversion-controlledな手書き資料と人間のchecklistで管理する。

スポンサー経路はrequired public live pathである。paid pathはbest-effort liveとし、hosted facilitatorを検証できない場合は同じrelease SHAのlocal recordingへ降格する。generator、evidence recorder、artifact manifest schema、final readiness evaluatorは実装しない。

## Goals

- 一つのread-only commandで必須のlocal checksを再現する。
- 公開HTTPS、CORS、402、Base-only、preview非公開、Origin Trial設定をsmoke検証する。
- fake WebMCP hostで、元のtool promiseが8秒スポンサー経路を待って同じ結果へ再開することを検証する。
- 手書き提出物と同一release SHAを人間が確認できるchecklistを提供する。

## Non-Goals

- documentation/artifact generator、manual evidence recorder、typed final evaluator。
- Devpost、YouTube、repositoryへの自動投稿または権限変更。
- 実wallet、実ChatGPT、実ChromeをCIから操作すること。
- paid pathをpublic release blockerにすること。

## Release Gates

### Automated local blockers

1. frozen-lockfile install
2. `pnpm exec biome check .`
3. frontend test and production build
4. resource server typecheck/build and contract tests
5. facilitator typecheck/build
6. shared contract conformance tests
7. fake-host sponsor golden-path E2E, including pending/resume, abort, duplicate rejection, expiry, and late-result isolation

The command is read-only apart from normal build/test artifacts. It prints the tested commit and failed command, but does not create a bespoke report format.

### Automated public smoke

- frontend and resource server are reachable over HTTPS
- exact frontend origin passes preflight for `/api/sponsor-sessions`, `/api/sponsor-grants`, and `/api/recipe-analysis`
- `Authorization`, `Content-Type`, `Idempotency-Key`, and the adopted x402 request header are allowed
- required x402 response headers are exposed and all protected responses use `Cache-Control: no-store`
- when payment readiness is ready, unauthenticated protected analysis returns exactly one Base Sepolia exact offer for 0.01 testnet USDC
- when payment readiness is unavailable, the public UI disables payment with a safe reason, sponsor access remains successful, and the probe does not require a 402 offer
- production preview route returns 404
- frontend response/build contains an Origin Trial token for the deployed origin
- public responses contain no token, signature, raw payment payload, stack, or environment value

Hosted facilitator health and Base Sepolia exact support are reported separately as payment readiness. Failure does not fail the sponsor-live release.

### Manual mandatory checks

- public URL and sponsor path in ChatGPT's supported browser
- public URL and sponsor path in WebMCP-enabled Chrome
- keyboard/focus/live-region behavior
- README, MIT license/package metadata consistency, provenance, environment examples, and asset rights
- English Devpost draft, screenshots, public YouTube video under three minutes, and final URLs
- release SHA matches deployment, recording, README, and submission copy

### Manual optional payment checks

- injected wallet confirmation is initiated only by a human click
- Base Sepolia and 0.01 testnet USDC terms are shown
- normalized receipt shows short tx hash/explorer link, network, asset, amount, and confirmedAt
- if hosted payment is unavailable, label the evidence `recorded local prototype` and use a same-release clip

## Deployment Invariants

- Frontend is deployed to the final Cloudflare origin before Origin Trial enrollment.
- Resource server runs as exactly one Node instance with autoscaling disabled.
- Recording/judging happens without redeploying the resource server; restart invalidates active process-local sessions/grants/results and requires a new attempt.
- Public CORS uses the exact final frontend origin.
- Sponsor session TTL is 90 seconds, visible/server minimum is eight seconds, grant TTL is 60 seconds, and same-identity success replay is five minutes.

## Public Documentation

The root README and app runbooks are edited by hand and must explain the problem, WebMCP pending invocation, two access paths, architecture, local setup, deployment, testnet-only payment, single-instance/process-local limitations, and hackathon provenance. The old Todo D1 guide is removed; Git history retains it. Starter metadata is replaced during implementation, and all package license metadata is aligned with the root MIT license.

Required hand-written submission files:

- root README and app runbooks
- architecture/provenance section
- Devpost draft mapped to the four judging criteria
- English video script and shot list below three minutes
- screenshot checklist and asset-rights checklist
- final human submission checklist with internal deadline 2026-09-04 03:00 JST

## Failure Policy

- Any automated local blocker failure stops release.
- Public sponsor path, CORS, preview exposure, secret exposure, or Origin Trial failure stops release.
- Hosted facilitator failure disables the payment choice and activates the recorded/local payment fallback; it does not stop sponsor release.
- Manual ChatGPT/Chrome sponsor failure stops release until fixed or explicitly reclassified by the user.
- No automated task publishes externally.

## Testing Strategy

- Unit/contract tests cover command selection, public probe parsers, CORS/header policy, and safe output redaction.
- Browser E2E uses production schemas/components with fake WebMCP and payment ports; it does not duplicate product logic.
- Public smoke accepts URLs as inputs and performs no mutation.
- Manual checklists capture only safe captions/paths; never record tokens, signatures, full wallet addresses, seed phrases, or browser profile data.
