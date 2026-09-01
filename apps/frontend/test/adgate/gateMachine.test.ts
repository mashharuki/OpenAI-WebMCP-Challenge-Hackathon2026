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

  it("starts a new attempt and records a payment choice", () => {
    const started = transitionGate(
      { type: "idle" },
      {
        type: "start",
        attemptId: "attempt-0",
        input: { recipeId: "roasted-chickpea-quinoa-bowl" },
      },
    );
    expect(started.ok && started.state.type).toBe("awaiting_choice");

    const payment = transitionGate(started.state, {
      type: "choose_payment",
      attemptId: "attempt-0",
      paymentRequestId: "payment-0",
    });
    expect(payment).toEqual({
      ok: true,
      state: {
        type: "awaiting_payment",
        attemptId: "attempt-0",
        paymentRequestId: "payment-0",
      },
    });
  });

  it("moves a sponsor attempt through granted access and execution", () => {
    const awaitingChoice: GateState = {
      type: "awaiting_choice",
      attemptId: "attempt-1",
      input: { recipeId: "roasted-chickpea-quinoa-bowl" },
    };

    const viewing = transitionGate(awaitingChoice, {
      type: "choose_sponsor",
      attemptId: "attempt-1",
      sponsorId: "open-table-weekly",
    });
    expect(viewing.ok && viewing.state.type).toBe("viewing_sponsor");

    const granted = transitionGate(viewing.state, {
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
    const awaitingChoice: GateState = {
      type: "awaiting_choice",
      attemptId: "attempt-3",
      input: { recipeId: "roasted-chickpea-quinoa-bowl" },
    };

    const cancelled = transitionGate(awaitingChoice, {
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
      type: "choose_payment",
      attemptId: "attempt-4",
      paymentRequestId: "payment-5",
    });
    expect(reopen.ok).toBe(false);
    expect(reopen.state).toEqual(failed.state);
  });

  it("rejects events from another attempt and preserves deterministic state", () => {
    const state: GateState = {
      type: "awaiting_choice",
      attemptId: "attempt-current",
      input: { recipeId: "roasted-chickpea-quinoa-bowl" },
    };
    const event = {
      type: "choose_payment" as const,
      attemptId: "attempt-stale",
      paymentRequestId: "payment-stale",
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
        type: "awaiting_choice",
        attemptId: "attempt-invalid",
        input: { recipeId: "roasted-chickpea-quinoa-bowl" },
      },
      event: { type: "execute", attemptId: "attempt-invalid" },
    },
    {
      state: {
        type: "viewing_sponsor",
        attemptId: "attempt-invalid",
        sponsorId: "open-table-weekly",
      },
      event: {
        type: "choose_payment",
        attemptId: "attempt-invalid",
        paymentRequestId: "payment-invalid",
      },
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
        type: "choose_sponsor",
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
