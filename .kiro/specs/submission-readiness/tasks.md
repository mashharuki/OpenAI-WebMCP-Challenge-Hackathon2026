# Implementation Plan

- [x] 1. Minimal local release gate
  - Add one root read-only command for frozen install verification, Biome, frontend test/build, server typecheck/build/contract tests, facilitator typecheck/build, and cross-app conformance tests.
  - Print the tested commit and failed command without introducing a typed report or artifact manifest.
  - Run the same command in CI with pinned Node/pnpm and safe failure artifacts only.
  - _Requirements: 1.1–1.5_

- [x] 2. Deployable public shell
  - Replace starter-facing deployment metadata and document frontend API URL, exact allowed origin, Origin Trial token, release SHA, payTo, hosted facilitator, and Base Sepolia configuration placeholders.
  - Add deterministic server typecheck/build/start commands and safe environment examples.
  - Configure the resource server as one instance with autoscaling disabled; document that restarts invalidate active attempts.
  - _Requirements: 2.1–2.6, 4.3–4.6_

- [x] 3. Public read-only smoke probe
  - Check HTTPS health, exact-origin CORS for all three API routes, `Authorization` and x402 headers, exposed settlement headers, no-store, production preview 404, and Origin Trial presence.
  - When payment is ready require one Base Sepolia exact 0.01-USDC offer; when unavailable require safe payment-disabled state and a working sponsor path instead of a 402.
  - Reject secret-like responses, disallowed-origin disclosure, malformed/multiple offers, or reachable production preview.
  - Report facilitator health/Base exact support as optional payment readiness, not sponsor-release readiness.
  - _Requirements: 2.1–2.6_

- [ ] 4. Fake-host browser E2E
  - Exercise document-first, navigator-only, unsupported, registration failure, and abort-capable WebMCP modes.
  - Verify the sponsor-first path keeps the original invocation pending through server session and eight visible seconds, then returns one canonical result.
  - Cover visible UI parity, cancellation, duplicate rejection/busy UX, grant expiry, five-minute same-identity replay, and late-result isolation.
  - Verify payment terms/receipt and safe sponsor fallback with fake ports; do not use a browser private key or real transaction in automation.
  - _Requirements: 3.1–3.6_

- [ ] 5. Hand-written public documentation
  - Write the English README/runbooks, architecture and provenance, deployment constraints, environment reference, and testnet/prototype limitations.
  - Remove the obsolete Todo D1 guide, replace starter metadata, align package license metadata with MIT, and document owned `Open Table Journal`/`Open Table Weekly` assets.
  - Write the Devpost draft, judging evidence map, English sub-three-minute script/shot list, screenshot checklist, and rights checklist as version-controlled files.
  - _Requirements: 4.1–5.7_

- [ ] 6. Human release and submission checklist
  - Manually verify ChatGPT and Chrome sponsor paths, keyboard/accessibility, final public URLs, and matching release SHA.
  - Attempt the injected-wallet Base Sepolia path; if hosted facilitator is unverified, disable it publicly and use a same-release local recording labeled as a prototype.
  - Confirm video duration, public YouTube URL, Devpost fields, repository/license visibility, asset rights, and the 2026-09-04 03:00 JST internal deadline.
  - Keep every upload, publication, and submission step human-only.
  - _Requirements: 5.1–6.6_
