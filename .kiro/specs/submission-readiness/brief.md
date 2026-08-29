# Brief: submission-readiness

## Problem

A clever prototype will not score well if judges cannot open it, understand it in under three minutes, reproduce it, or distinguish hackathon-period work from the existing reference apps.

## Current State

The repository has an OSS license and basic app READMEs but no AdGate deployment runbook, provenance section, end-to-end test matrix, demo assets, or Devpost-ready copy.

## Desired Outcome

The live app and both access paths are reliably judgeable; the repository clearly documents setup and new work; all required English submission assets are ready before the deadline.

## Approach

Treat submission as a release with a fixed golden demo path, automated contract/unit tests, manual ChatGPT/Chrome checks, health diagnostics, a recorded fallback, and a checklist mapped directly to the four equal judging criteria.

## Scope

- **In**: Cross-app release checks; Cloudflare frontend and Node-hosted server deployment/env docs; Origin Trial token verification; hosted facilitator health check; health/CORS/x402-header validation; golden-path and failure-path tests; fallback messaging; README architecture/provenance; OSS visibility check; English Devpost copy; screenshots; sub-3-minute video script/shot list; submission checklist.
- **Out**: New product features after freeze, paid production infrastructure, marketing campaign, and post-hackathon roadmap implementation.

## Boundary Candidates

- Release validation and judge diagnostics.
- Public repository documentation and provenance.
- Demo/video/submission artifacts.

## Out of Boundary

- Does not redesign upstream feature behavior unless a release blocker is found.
- Does not submit externally without the user's explicit action.

## Upstream / Downstream

- **Upstream**: webmcp-gated-tool and all transitive slices.
- **Downstream**: Devpost submission and judging.

## Existing Spec Touchpoints

- **Extends**: None.
- **Adjacent**: Root README/LICENSE, app READMEs, Cloudflare config, server/facilitator environment examples.

## Constraints

Live URL must work in ChatGPT's in-app browser or WebMCP-enabled Chrome; video must be public YouTube, under three minutes, with audio; all materials must be English or include English translations; secrets must never be committed.
