import type {
  AdGateError,
  RecipeAnalysisResult,
  SponsorAccessEvidence,
} from "./contracts";

export type GateState =
  | { type: "idle" }
  | {
      type: "viewing_sponsor";
      attemptId: string;
      sponsorId: string;
    }
  | {
      type: "access_granted";
      attemptId: string;
      evidence: SponsorAccessEvidence;
    }
  | {
      type: "executing";
      attemptId: string;
      evidence: SponsorAccessEvidence;
    }
  | {
      type: "awaiting_payment";
      attemptId: string;
      paymentRequestId: string;
    }
  | {
      type: "succeeded";
      attemptId: string;
      result: RecipeAnalysisResult;
      access: {
        kind: "sponsor_grant" | "x402_payment";
        referenceId: string;
      };
    }
  | {
      type: "cancelled";
      attemptId: string;
      reason: "user" | "abort" | "unmounted";
    }
  | {
      type: "failed";
      attemptId: string;
      error: AdGateError;
    };

export type GateEvent =
  | {
      type: "start_sponsor";
      attemptId: string;
      sponsorId: string;
    }
  | {
      type: "start_payment";
      attemptId: string;
      paymentRequestId: string;
    }
  | {
      type: "sponsor_granted";
      attemptId: string;
      evidence: SponsorAccessEvidence;
    }
  | { type: "execute"; attemptId: string }
  | {
      type: "resolve";
      attemptId: string;
      result: RecipeAnalysisResult;
    }
  | {
      type: "payment_succeeded";
      attemptId: string;
      result: RecipeAnalysisResult;
      access: { kind: "x402_payment"; referenceId: string };
    }
  | {
      type: "cancel";
      attemptId: string;
      reason: "user" | "abort" | "unmounted";
    }
  | {
      type: "reject";
      attemptId: string;
      error: AdGateError;
    };

export type GateTransitionResult =
  | { ok: true; state: GateState }
  | { ok: false; state: GateState; error: AdGateError };

const invalidTransition = (state: GateState): GateTransitionResult => ({
  ok: false,
  state,
  error: {
    code: "INVALID_TRANSITION",
    message: "This gate action is not available in the current state.",
    retryable: true,
  },
});

export const transitionGate = (
  state: GateState,
  event: GateEvent,
): GateTransitionResult => {
  if (
    event.type === "start_sponsor" &&
    (state.type === "idle" ||
      state.type === "succeeded" ||
      state.type === "failed" ||
      state.type === "cancelled")
  ) {
    return {
      ok: true,
      state: {
        type: "viewing_sponsor",
        attemptId: event.attemptId,
        sponsorId: event.sponsorId,
      },
    };
  }

  if (
    event.type === "start_payment" &&
    (state.type === "idle" ||
      state.type === "succeeded" ||
      state.type === "failed" ||
      state.type === "cancelled")
  ) {
    return {
      ok: true,
      state: {
        type: "awaiting_payment",
        attemptId: event.attemptId,
        paymentRequestId: event.paymentRequestId,
      },
    };
  }

  if (!("attemptId" in state) || state.attemptId !== event.attemptId) {
    return invalidTransition(state);
  }

  if (state.type === "viewing_sponsor" && event.type === "sponsor_granted") {
    return {
      ok: true,
      state: {
        type: "access_granted",
        attemptId: state.attemptId,
        evidence: event.evidence,
      },
    };
  }

  if (state.type === "access_granted" && event.type === "execute") {
    return {
      ok: true,
      state: {
        type: "executing",
        attemptId: state.attemptId,
        evidence: state.evidence,
      },
    };
  }

  if (state.type === "executing" && event.type === "resolve") {
    return {
      ok: true,
      state: {
        type: "succeeded",
        attemptId: state.attemptId,
        result: event.result,
        access: {
          kind: "sponsor_grant",
          referenceId: state.evidence.grantId,
        },
      },
    };
  }

  if (state.type === "awaiting_payment" && event.type === "payment_succeeded") {
    return {
      ok: true,
      state: {
        type: "succeeded",
        attemptId: state.attemptId,
        result: event.result,
        access: event.access,
      },
    };
  }

  if (
    event.type === "reject" &&
    state.type !== "succeeded" &&
    state.type !== "failed" &&
    state.type !== "cancelled"
  ) {
    return {
      ok: true,
      state: {
        type: "failed",
        attemptId: state.attemptId,
        error: event.error,
      },
    };
  }

  if (
    event.type === "cancel" &&
    state.type !== "succeeded" &&
    state.type !== "failed" &&
    state.type !== "cancelled"
  ) {
    return {
      ok: true,
      state: {
        type: "cancelled",
        attemptId: state.attemptId,
        reason: event.reason,
      },
    };
  }

  return invalidTransition(state);
};
