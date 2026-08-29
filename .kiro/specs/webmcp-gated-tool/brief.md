# Brief: webmcp-gated-tool

## Problem

AdGate only satisfies the challenge if WebMCP is essential to the shared human-agent workflow rather than a superficial wrapper around an ordinary paid endpoint.

## Current State

The todo app registers four imperative tools against `document.modelContext`; no tool can wait for visible human input or continue through two authorization paths.

## Desired Outcome

An agent invokes one precise premium analysis tool; the page visibly transitions into the gate; the human chooses sponsor or payment; the same invocation resumes and returns the analysis; cancellation and failures are unambiguous.

## Approach

Register `analyze_recipe` as a thin orchestration layer over the shared gate coordinator and premium resource client. Feature-detect `document.modelContext` then `navigator.modelContext`, register exactly once, normalize tool results for the active host contract, validate with Zod, propagate the WebMCP abort signal, and mark external recipe/result content as untrusted where appropriate.

## Scope

- **In**: One tool definition; namespace compatibility; lifecycle cleanup; gate request/resume; sponsor/payment selection; abort/concurrency/idempotency handling; tool status UI; agent-oriented result/error shape; security and browser tests.
- **Out**: Multiple tools, cross-origin exposure, autonomous payment approval, background/headless invocation, and server MCP.

## Boundary Candidates

- WebMCP registration adapter.
- Tool orchestration over the gate coordinator.
- Agent-safe presentation and error mapping.

## Out of Boundary

- Does not implement sponsor verification or x402 signing internals.
- Does not duplicate analysis business logic.

## Upstream / Downstream

- **Upstream**: publisher-demo, sponsor-access, x402-payment-access.
- **Downstream**: submission-readiness.

## Existing Spec Touchpoints

- **Extends**: None.
- **Adjacent**: Existing `useWebMCPTools.ts`, `webmcp.d.ts`, schemas, and visible WebMCP support status.

## Constraints

Tool names/descriptions must follow the draft limits; `additionalProperties: false`; no raw external text in descriptions; one active gate at a time or a documented queue; unmount/navigation aborts pending work. The deployed frontend origin must carry a valid Chrome Origin Trial token and expose a useful unsupported-browser state.
