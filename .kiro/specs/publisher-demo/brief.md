# Brief: publisher-demo

## Problem

The current todo reference app cannot communicate the publisher monetization problem or produce a compelling before/after demo.

## Current State

The React app is a polished todo UI with localStorage state and WebMCP CRUD tools. The server returns mock weather data behind x402.

## Desired Outcome

A judge can open a credible recipe publisher, select one recipe, run a basic visible experience, and understand why a premium nutrition/substitution analysis has value before any gate appears.

## Approach

Create a deterministic single-recipe vertical slice with static owned content and a server-side premium analyzer. Keep monetization absent from this spec so the resource and UI can be tested directly.

## Scope

- **In**: Publisher shell; recipe detail; owned sample assets/content; premium analysis result panel; loading/error states; deterministic server analysis handler and tests.
- **Out**: Sponsor viewing, payment, WebMCP registration, multi-recipe search, CMS, and generative AI dependencies.

## Boundary Candidates

- Recipe presentation components and local sample data.
- Premium analyzer service/handler behind an internal un-gated seam.
- UI rendering of the shared analysis contract.

## Out of Boundary

- Does not decide whether access is authorized.
- Does not own access tokens or wallet state.

## Upstream / Downstream

- **Upstream**: adgate-contracts.
- **Downstream**: webmcp-gated-tool and submission-readiness.

## Existing Spec Touchpoints

- **Extends**: None.
- **Adjacent**: Replaces todo-specific composition while preserving reusable design primitives, Worker entry, and WebMCP status treatment.

## Constraints

Use only original or license-compatible assets; ensure responsive and accessible states; output must be deterministic enough for a repeatable three-minute demo.

