# Brief: sponsor-access

## Problem

Judges and users need a wallet-free access path that demonstrates publisher sponsorship while preserving an explicit human decision inside the agent workflow.

## Current State

There is no gate coordinator, sponsor creative, viewing state, or server-recognized sponsor grant.

## Desired Outcome

When access is requested, the page can show a clear sponsor option, require a short visible countdown, issue a short-lived single-use grant, and resume the original request without losing page or agent context.

## Approach

Use a dedicated React gate coordinator and sponsor modal. After the countdown completes, call a narrowly scoped server endpoint for an opaque capability tied to the resource and request nonce; consume it once using a prototype single-instance ledger on the premium request. Present this as a hackathon sponsorship signal, not durable or fraud-proof ad verification.

## Scope

- **In**: Sponsor creative component; accessible modal; countdown; cancellation; request nonce; short-lived one-time grant issuance/consumption; replay/expiry tests.
- **Out**: Third-party ad network, viewability/fraud vendor, user tracking, personalization, and analytics dashboard.

## Boundary Candidates

- Gate coordinator interface used by UI and WebMCP.
- Sponsor presentation state.
- Server sponsor-grant service and middleware branch.

## Out of Boundary

- Does not sign x402 payments.
- Does not register browser tools.

## Upstream / Downstream

- **Upstream**: adgate-contracts.
- **Downstream**: webmcp-gated-tool and submission-readiness.

## Existing Spec Touchpoints

- **Extends**: None.
- **Adjacent**: Premium route authorization and top-level modal composition.

## Constraints

No dark patterns, autoplay audio, external tracking, or claim of fraud resistance. Escape/cancel must reject the pending request cleanly. Grant TTL should be demo-short and clocks testable. The implementation must not reuse isolate-local AgentKit free-trial counters as sponsor authorization.
