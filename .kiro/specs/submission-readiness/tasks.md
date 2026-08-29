# Implementation Plan

- [ ] 1. Release validation foundation
- [ ] 1.1 Define the typed release report and artifact manifest contracts
  - Model required, optional, passed, failed, and skipped checks without importing product domain modules.
  - Bind every report and submission manifest to one commit SHA and reject missing or malformed release identities.
  - Keep command output, reports, and errors free of environment values, authorization headers, wallet data, and raw response bodies.
  - Done when contract tests serialize a complete report and reject invalid status, duration, URL, and approval values.
  - _Requirements: 1.2, 1.5, 6.2, 6.3, 6.5_
  - _Boundary: ReleaseReporter_

- [ ] 1.2 Build the deterministic workspace release command
  - Add explicit read-only lint, typecheck, build, and test scripts for every workspace application, including production build/start support for the Node resource server.
  - Run all required checks without a live wallet, mainnet, or external deployment and aggregate their outcomes into the release report.
  - Return a nonzero status when any required check fails while retaining safe summaries for all checks that could run.
  - Done when one root command executes the upstream contract, publisher, sponsor, payment, WebMCP, frontend, server, and facilitator validation and writes a secretless report.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - _Boundary: WorkspaceReleaseGate, ReleaseReporter_

- [ ] 1.3 Add the frozen-candidate CI quality gate
  - Pin the documented Node and pnpm versions, install from the lockfile, and invoke the same release command used locally.
  - Preserve browser traces and safe test reports only on failure; do not upload environment files or raw payment data.
  - Done when a pull request and manual workflow run produce the same pass/fail decision and identify the tested commit SHA.
  - _Requirements: 1.1, 1.3, 1.5, 6.1, 6.2, 6.3_
  - _Boundary: ReleaseWorkflow_

- [ ] 2. Public deployment and boundary validation
- [ ] 2.1 (P) Make the frontend deployment release-verifiable
  - Rename starter-facing deployment metadata to AdGate and document the public API URL and release SHA build inputs.
  - Add the origin-bound Origin Trial token placement without classifying the public token as a wallet or service secret.
  - Fail artifact validation when the production candidate has no Origin Trial value or still exposes starter title/description metadata.
  - Done when a production frontend build contains AdGate metadata, the expected release SHA, and a non-empty Origin Trial declaration for public deployment.
  - _Requirements: 2.1, 2.3, 4.1, 4.6, 6.3_
  - _Boundary: FrontendDeploymentConfig_
  - _Depends: 1.1_

- [ ] 2.2 (P) Make the resource server deployable on a Node host
  - Add deterministic production build/start/typecheck commands and a Node-host manifest with health check and required environment declarations.
  - Expand example configuration for the exact allowed frontend origin, hosted facilitator, Base Sepolia recipient and policy without adding real values.
  - Keep the optional self-hosted facilitator outside the public critical path and document its separate local configuration.
  - Done when a clean install can build and start the server from compiled output and the deploy manifest exposes no secret default.
  - _Requirements: 2.1, 2.2, 2.4, 4.3, 4.5, 4.6_
  - _Boundary: ResourceServerDeploymentConfig_
  - _Depends: 1.1_

- [ ] 2.3 Build the public smoke probe
  - Validate HTTPS reachability, release identity, allowed-origin preflight, required request headers, exposed x402 response headers, no-store behavior, and one Base Sepolia exact challenge.
  - Validate hosted facilitator health and supported capability with bounded timeouts.
  - Treat a reachable production preview route, disallowed-origin disclosure, malformed challenge, or secret-like public response as a blocker.
  - Done when fixture tests cover every pass/fail branch and the command returns a concise probe report for user-supplied public URLs.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - _Boundary: PublicSmokeProbe, OriginTrialProbe, FacilitatorProbe_
  - _Depends: 2.1, 2.2_

- [ ] 3. Browser golden-path and fallback validation
- [ ] 3.1 Add the WebMCP browser test host and local E2E lifecycle
  - Provide document-priority, navigator-only, unsupported, registration-failure, and abort-capable fake host modes at the browser boundary.
  - Start the local frontend and resource server with deterministic test configuration and reuse production tool schemas and callbacks.
  - Do not reproduce the gate coordinator, sponsor flow, payment flow, or analysis logic inside the fixture.
  - Done when the test runner discovers exactly one `analyze_recipe` tool in supported modes and normal publisher browsing in unsupported mode.
  - _Requirements: 3.1, 3.2, 3.4, 3.6_
  - _Boundary: BrowserE2EHarness_
  - _Depends: 1.2_

- [ ] 3.2 Verify the sponsor-first judge golden path
  - Invoke the registered tool, assert that the original invocation remains pending, and complete the visible sponsor choice and countdown.
  - Compare the page result and returned tool result against the same canonical `recipe_analysis` contract and assert one protected execution.
  - Cover the equivalent visible-UI start without creating a second gate implementation.
  - Done when the wallet-free journey passes from a fresh browser context and produces the same analysis through WebMCP and visible UI.
  - _Requirements: 3.1, 3.2_
  - _Boundary: SponsorGoldenPathE2E_
  - _Depends: 3.1_

- [ ] 3.3 (P) Verify payment consent and safe degraded behavior
  - Use the upstream payment test ports to assert server-derived Base Sepolia terms, no wallet call before human confirmation, and canonical receipt display after a successful test settlement.
  - Exercise missing provider, rejected confirmation, unavailable facilitator, and wrong network while preserving the sponsor action.
  - Do not use a browser private key or send a real transaction in automated tests.
  - Done when every payment failure remains non-successful and the sponsor path stays selectable whenever it is healthy.
  - _Requirements: 3.3, 3.4, 3.5_
  - _Boundary: PaymentFallbackE2E_
  - _Depends: 3.1_

- [ ] 3.4 (P) Verify cancellation, expiry, duplication, and late-result isolation
  - Cover user cancel, host abort, page teardown, duplicate tool/UI start, expired or reused sponsor access, and delayed completion races.
  - Assert a single safe terminal result, no stale page update, and no second premium execution.
  - Done when all failure cases terminate deterministically without exposing token, provider response, stack, or configuration data.
  - _Requirements: 3.5_
  - _Boundary: FailureFallbackE2E_
  - _Depends: 3.1_

- [ ] 4. Public documentation and provenance
- [ ] 4.1 (P) Build the deterministic English project-documentation generator
  - Define a strict content manifest for the problem, solution, WebMCP role, access paths, setup, tests, deployment, security constraints, live links, and app-specific runbooks.
  - Render the root and app guides from the manifest, preserving public Origin Trial metadata, testnet-only constraints, and prototype-ledger limits as validated facts.
  - Fail the drift check when generated sections are stale or still contain starter title, todo copy, or unsupported product claims.
  - Done when one build command generates byte-identical English project guides twice and a fixture change produces a focused reviewable diff.
  - _Requirements: 4.1, 4.3, 4.4, 4.6_
  - _Boundary: SubmissionArtifactBuilder_
  - _Depends: 2.1, 2.2_

- [ ] 4.2 (P) Extend the artifact generator with architecture, deployment, and provenance outputs
  - Encode browser, resource server, hosted facilitator, sponsor ledger, and protected analysis trust boundaries as structured source data without claiming production durability.
  - Encode the pre-existing Cloudflare WebMCP todo starter and x402/facilitator baseline separately from hackathon-period AdGate work.
  - Generate deploy order, Origin Trial enrollment, public smoke, preview exclusion, rollback triggers, and upstream blocker ownership from the same source.
  - Done when generated architecture and provenance links resolve from the root guide and a validator proves every upstream boundary has one owner.
  - _Requirements: 4.1, 4.2, 4.3, 6.2_
  - _Boundary: SubmissionArtifactBuilder_
  - _Depends: 2.1, 2.2_

- [ ] 4.3 Add artifact, license, and secret validation
  - Verify required English sections and files, MIT license consistency in package metadata, environment example completeness, and absence of tracked runtime environment files.
  - Scan only known private-key, seed, token, and credential patterns; exclude public Origin Trial metadata from secret classification.
  - Validate final URL placeholders, release SHA references, screenshot manifest entries, and video duration before sign-off.
  - Done when intentionally seeded license, placeholder, tracked-env, secret-marker, and 180-second boundary fixtures each fail with an actionable message.
  - _Requirements: 2.6, 4.1, 4.2, 4.4, 4.5, 4.6, 5.3, 5.4, 5.5, 5.7, 6.3_
  - _Boundary: ArtifactValidator_
  - _Depends: 4.1, 4.2_

- [ ] 5. Submission evidence and final sign-off
- [ ] 5.1 (P) Generate the English Devpost draft and judging evidence map
  - Extend the typed content manifest with title, tagline, problem, solution, WebMCP use, human-in-the-loop flow, technology, challenges, accomplishments, and next steps.
  - Render each of the four equal judging criteria with a machine-linked live behavior, repository artifact, screenshot, or video timestamp.
  - Represent live, repository, video, and release identity as validated finalization fields rather than free-form placeholders.
  - Done when generation and schema tests reject missing narrative sections, unowned production claims, or incomplete judging rows.
  - _Requirements: 5.1, 5.2, 5.3, 5.7_
  - _Boundary: SubmissionArtifactBuilder_
  - _Depends: 4.1, 4.2_

- [ ] 5.2 (P) Generate and validate the timed demo and screenshot manifests
  - Model English narration segments and shots for value, WebMCP invocation, pending choice, sponsor success, Base Sepolia receipt, and shared result with explicit durations.
  - Model screenshot filenames, captions, redaction rules, public URL, capture time, release SHA, and the same-release paid-path fallback.
  - Render the demo script and screenshot instructions and reject aggregate duration at or above 180 seconds.
  - Done when boundary tests cover 179/180 seconds and every generated shot has a purpose, capture condition, evidence field, and fallback.
  - _Requirements: 5.2, 5.4, 5.5, 5.6, 5.7_
  - _Boundary: SubmissionArtifactBuilder_
  - _Depends: 3.2, 3.3_

- [ ] 5.3 Implement the manual-evidence recorder and release-checklist evaluator
  - Accept human-supplied ChatGPT, Chrome, and Base Sepolia wallet check records for one public release candidate without initiating those interactions.
  - Validate and redact evidence paths and pass/fail/blocked status so wallet secrets, signatures, tokens, full addresses, and browser profile data cannot enter reports.
  - Evaluate feature freeze, internal 2026-09-04 03:00 JST deadline, official 05:00 JST deadline, and owner-based blocker revalidation as typed checklist rules.
  - Done when fixtures prove every mandatory row requires one release SHA and a blocked mandatory item can never produce a ready verdict.
  - _Requirements: 3.3, 3.4, 3.5, 3.6, 6.1, 6.2, 6.3, 6.4_
  - _Boundary: ManualEvidenceRecorder_
  - _Depends: 2.3, 3.2, 3.3, 3.4, 4.3_

- [ ] 5.4 Implement the final readiness evaluator without external side effects
  - Compose workspace, public smoke, artifact, URL visibility, and validated manual-evidence results for one release identity.
  - Require live app, public repository, MIT license, public video below three minutes, screenshot evidence, English copy, and matching commit before returning ready-for-human-submission.
  - Model YouTube upload, repository visibility change, and Devpost submission as human-only checklist inputs that no command can execute or approve.
  - Done when integration fixtures distinguish ready, failed, missing-evidence, SHA-mismatch, and `pending-human-approval` outcomes without network mutation.
  - _Requirements: 1.1, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.3, 5.4, 5.5, 5.6, 5.7, 6.3, 6.4, 6.5_
  - _Boundary: FinalReadinessEvaluator_
  - _Depends: 5.1, 5.2, 5.3_
