# Brief: adgate-contracts

## Problem

The frontend, resource server, and facilitator currently demonstrate separate todo and weather flows. AdGate needs one stable vocabulary for premium resources, gate states, access evidence, and errors before those apps can evolve independently.

## Current State

The frontend owns todo schemas and WebMCP actions; the server gates `GET /weather`; the facilitator verifies and settles EVM payments. No AdGate domain contract or sponsor grant exists.

## Desired Outcome

Every downstream slice implements the same documented request/response schemas, deterministic state transitions, expiration rules, and safe error semantics.

## Approach

Define a minimal contract for one `recipe_analysis` resource. Keep runtime schemas at each external boundary and add contract fixtures/tests that prove frontend and server representations remain compatible without introducing a shared package during the hackathon.

## Scope

- **In**: Resource IDs; analysis input/output; gate states/events; sponsor grant and payment evidence shapes; TTL/idempotency rules; typed errors; contract fixtures.
- **Out**: UI, WebMCP registration, payment signing, settlement, ad rendering, and deployment.

## Boundary Candidates

- Browser gate state and events.
- HTTP premium-resource and access-grant contracts.
- Cross-app fixture compatibility.

## Out of Boundary

- No business logic or route middleware.
- No generic SDK/public package API.

## Upstream / Downstream

- **Upstream**: Existing TypeScript, Zod, Hono, and x402 conventions.
- **Downstream**: publisher-demo, sponsor-access, x402-payment-access, webmcp-gated-tool.

## Existing Spec Touchpoints

- **Extends**: None.
- **Adjacent**: `apps/frontend/src/schemas.ts`, `apps/server/src/config.ts`, facilitator verify/settle contracts.

## Constraints

No browser secrets; JSON-safe values; explicit expiry; stable machine-readable error codes; schemas must reject unknown or oversized inputs. WebMCP adapter output must be normalized for the current host contract.
