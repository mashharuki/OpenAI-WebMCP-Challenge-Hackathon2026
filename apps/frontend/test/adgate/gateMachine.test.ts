import { describe, expect, it } from "vitest";
import {
  type GateEvent,
  type GateState,
  transitionGate,
} from "../../src/adgate/gateMachine";

const result = {
  summary: "A balanced plant-forward bowl.",
  nutritionalInsights: ["Chickpeas provide plant protein."],
  suggestions: ["Add lemon juice."],
  disclaimer: "General information only.",
};

const evidence = {
  kind: "sponsor_grant" as const,
  grantId: "grant-invalid-table",
  resourceId: "recipe_analysis" as const,
  issuedAt: "2026-08-30T00:00:00.000Z",
  expiresAt: "2026-08-30T00:01:00.000Z",
  nonce: "request-invalid-table",
};

describe("transitionGate", () => {
  it("starts an agent payment attempt without exposing an access choice", () => {
    expect(
      transitionGate(
        { type: "idle" },
        {
          type: "start_payment",
          attemptId: "attempt-agent",
          paymentRequestId: "request-agent",
        },
      ),
    ).toEqual({
      ok: true,
      state: {
        type: "awaiting_payment",
        attemptId: "attempt-agent",
        paymentRequestId: "request-agent",
      },
    });
  });

  it("starts a visible UI sponsor attempt without exposing an access choice", () => {
    expect(
      transitionGate(
        { type: "idle" },
        {
          type: "start_sponsor",
          attemptId: "attempt-0",
          sponsorId: "open-table-weekly",
        },
      ),
    ).toEqual({
      ok: true,
      state: {
        type: "viewing_sponsor",
        attemptId: "attempt-0",
        sponsorId: "open-table-weekly",
      },
    });
  });

  it("moves a sponsor attempt through granted access and execution", () => {
    const viewingState: GateState = {
      type: "viewing_sponsor",
      attemptId: "attempt-1",
      sponsorId: "open-table-weekly",
    };

    const granted = transitionGate(viewingState, {
      type: "sponsor_granted",
      attemptId: "attempt-1",
      evidence: {
        kind: "sponsor_grant",
        grantId: "grant-1",
        resourceId: "recipe_analysis",
        issuedAt: "2026-08-30T00:00:00.000Z",
        expiresAt: "2026-08-30T00:01:00.000Z",
        nonce: "request-1",
      },
    });
    expect(granted.ok && granted.state.type).toBe("access_granted");

    const executing = transitionGate(granted.state, {
      type: "execute",
      attemptId: "attempt-1",
    });
    expect(executing.ok && executing.state.type).toBe("executing");

    const resolved = transitionGate(executing.state, {
      type: "resolve",
      attemptId: "attempt-1",
      result: {
        summary: "A balanced plant-forward bowl.",
        nutritionalInsights: ["Chickpeas and quinoa provide protein."],
        suggestions: ["Add citrus for brightness."],
        disclaimer: "General information only; not medical advice.",
      },
    });
    expect(resolved.ok && resolved.state.type).toBe("succeeded");
  });

  it("settles a paid attempt atomically without invented intermediate states", () => {
    const awaitingPayment: GateState = {
      type: "awaiting_payment",
      attemptId: "attempt-2",
      paymentRequestId: "payment-1",
    };

    const transition = transitionGate(awaitingPayment, {
      type: "payment_succeeded",
      attemptId: "attempt-2",
      result: {
        summary: "A balanced plant-forward bowl.",
        nutritionalInsights: ["Chickpeas and quinoa provide protein."],
        suggestions: ["Add citrus for brightness."],
        disclaimer: "General information only; not medical advice.",
      },
      access: { kind: "x402_payment", referenceId: "0xabc" },
    });

    expect(transition).toEqual({
      ok: true,
      state: {
        type: "succeeded",
        attemptId: "attempt-2",
        result: {
          summary: "A balanced plant-forward bowl.",
          nutritionalInsights: ["Chickpeas and quinoa provide protein."],
          suggestions: ["Add citrus for brightness."],
          disclaimer: "General information only; not medical advice.",
        },
        access: { kind: "x402_payment", referenceId: "0xabc" },
      },
    });
  });

  it("keeps cancellation terminal and preserves the original attempt", () => {
    const sponsorView: GateState = {
      type: "viewing_sponsor",
      attemptId: "attempt-3",
      sponsorId: "open-table-weekly",
    };

    const cancelled = transitionGate(sponsorView, {
      type: "cancel",
      attemptId: "attempt-3",
      reason: "user",
    });
    expect(cancelled).toEqual({
      ok: true,
      state: { type: "cancelled", attemptId: "attempt-3", reason: "user" },
    });

    const repeated = transitionGate(cancelled.state, {
      type: "cancel",
      attemptId: "attempt-3",
      reason: "user",
    });
    expect(repeated.ok).toBe(false);
    expect(repeated.state).toEqual(cancelled.state);
  });

  it("keeps failures terminal", () => {
    const failed = transitionGate(
      {
        type: "awaiting_payment",
        attemptId: "attempt-4",
        paymentRequestId: "payment-4",
      },
      {
        type: "reject",
        attemptId: "attempt-4",
        error: {
          code: "DEPENDENCY_UNAVAILABLE",
          message: "Payment is temporarily unavailable.",
          retryable: true,
        },
      },
    );

    expect(failed.ok && failed.state.type).toBe("failed");
    const reopen = transitionGate(failed.state, {
      type: "payment_succeeded",
      attemptId: "attempt-4",
      result,
      access: { kind: "x402_payment", referenceId: "payment-5" },
    });
    expect(reopen.ok).toBe(false);
    expect(reopen.state).toEqual(failed.state);
  });

  it("rejects events from another attempt and preserves deterministic state", () => {
    const state: GateState = {
      type: "viewing_sponsor",
      attemptId: "attempt-current",
      sponsorId: "open-table-weekly",
    };
    const event = {
      type: "sponsor_granted" as const,
      attemptId: "attempt-stale",
      evidence,
    };

    const first = transitionGate(state, event);
    const second = transitionGate(state, event);
    expect(first).toEqual(second);
    expect(first).toEqual({
      ok: false,
      state,
      error: {
        code: "INVALID_TRANSITION",
        message: "This gate action is not available in the current state.",
        retryable: true,
      },
    });
  });

  it.each<{ state: GateState; event: GateEvent }>([
    {
      state: { type: "idle" },
      event: { type: "cancel", attemptId: "attempt-invalid", reason: "user" },
    },
    {
      state: {
        type: "viewing_sponsor",
        attemptId: "attempt-invalid",
        sponsorId: "open-table-weekly",
      },
      event: { type: "execute", attemptId: "attempt-invalid" },
    },
    {
      state: {
        type: "access_granted",
        attemptId: "attempt-invalid",
        evidence,
      },
      event: { type: "resolve", attemptId: "attempt-invalid", result },
    },
    {
      state: {
        type: "executing",
        attemptId: "attempt-invalid",
        evidence,
      },
      event: {
        type: "start_sponsor",
        attemptId: "attempt-invalid",
        sponsorId: "open-table-weekly",
      },
    },
    {
      state: {
        type: "awaiting_payment",
        attemptId: "attempt-invalid",
        paymentRequestId: "payment-invalid",
      },
      event: { type: "execute", attemptId: "attempt-invalid" },
    },
    {
      state: {
        type: "succeeded",
        attemptId: "attempt-invalid",
        result,
        access: { kind: "sponsor_grant", referenceId: "grant-invalid" },
      },
      event: { type: "cancel", attemptId: "attempt-invalid", reason: "user" },
    },
    {
      state: {
        type: "failed",
        attemptId: "attempt-invalid",
        error: {
          code: "DEPENDENCY_UNAVAILABLE",
          message: "Dependency unavailable.",
          retryable: true,
        },
      },
      event: { type: "cancel", attemptId: "attempt-invalid", reason: "user" },
    },
    {
      state: {
        type: "cancelled",
        attemptId: "attempt-invalid",
        reason: "user",
      },
      event: {
        type: "reject",
        attemptId: "attempt-invalid",
        error: {
          code: "DEPENDENCY_UNAVAILABLE",
          message: "Dependency unavailable.",
          retryable: true,
        },
      },
    },
  ])(
    "rejects a representative invalid event from $state.type",
    ({ state, event }) => {
      const first = transitionGate(state, event);
      const second = transitionGate(state, event);

      expect(first).toEqual(second);
      expect(first).toMatchObject({
        ok: false,
        state,
        error: { code: "INVALID_TRANSITION" },
      });
    },
  );
});
