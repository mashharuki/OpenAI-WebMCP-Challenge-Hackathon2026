import type { SponsorGatePort } from "../sponsor/SponsorGateProvider";
import {
  type AdGateError,
  type AdGateErrorEnvelope,
  normalizeContractError,
  normalizeWebMCPResult,
  type PaymentReceipt,
  type PremiumAnalysisRequest,
  RECIPE_ANALYSIS_RESOURCE_ID,
  type RecipeAnalysisInput,
  type WebMCPToolResult,
} from "./contracts";
import { type GateEvent, type GateState, transitionGate } from "./gateMachine";
import type { PaymentCoordinatorPort } from "./payment/paymentCoordinator";
import type { ProtectedAnalysisClientPort } from "./protectedAnalysisClient";

export type InvocationSource = "webmcp" | "visible_ui";
export type GateCancellationReason = "user" | "abort" | "unmounted";

export interface GateAttemptIdentity {
  readonly attemptId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
}

export interface GateSnapshot {
  readonly state: GateState;
  readonly source?: InvocationSource;
  readonly paymentAvailable: boolean;
  readonly receipt?: PaymentReceipt;
}

export interface GateCoordinatorPort {
  requestAnalysis(
    input: RecipeAnalysisInput,
    options: {
      readonly source: InvocationSource;
      readonly signal?: AbortSignal;
    },
  ): Promise<WebMCPToolResult>;
  cancel(reason: GateCancellationReason): void;
  getSnapshot(): GateSnapshot;
  subscribe(listener: (snapshot: GateSnapshot) => void): () => void;
}

interface GateCoordinatorOptions {
  readonly sponsorId: string;
  readonly sponsorGate: SponsorGatePort;
  readonly paymentCoordinator: PaymentCoordinatorPort;
  readonly protectedClient: ProtectedAnalysisClientPort;
  readonly paymentAvailable: boolean;
  readonly createAttemptIdentity?: () => GateAttemptIdentity;
}

interface ActiveAttempt {
  readonly identity: GateAttemptIdentity;
  readonly request: PremiumAnalysisRequest;
  readonly source: InvocationSource;
  readonly controller: AbortController;
  readonly resolve: (result: WebMCPToolResult) => void;
  settled: boolean;
  removeHostAbort?: () => void;
}

const createDefaultAttemptIdentity = (): GateAttemptIdentity => {
  const attemptUuid = crypto.randomUUID();
  const requestId = crypto.randomUUID();
  return {
    attemptId: `gate-${attemptUuid}`,
    requestId,
    idempotencyKey: `analysis-${requestId}`,
  };
};

const duplicateResult = (): AdGateErrorEnvelope => ({
  ok: false,
  error: {
    code: "REQUEST_IN_PROGRESS",
    message:
      "An analysis is already in progress on the page. Complete or cancel it before starting another.",
    retryable: false,
  },
});

const cancelledResult = (): AdGateErrorEnvelope => ({
  ok: false,
  error: {
    code: "CANCELLED",
    message: "The analysis request was cancelled.",
    retryable: false,
  },
});

const dependencyUnavailable = (): AdGateErrorEnvelope => ({
  ok: false,
  error: {
    code: "DEPENDENCY_UNAVAILABLE",
    message: "The selected access path is temporarily unavailable.",
    retryable: true,
  },
});

const paymentUnavailable = (): AdGateErrorEnvelope => ({
  ok: false,
  error: {
    code: "DEPENDENCY_UNAVAILABLE",
    message:
      "This browser does not have a compatible injected wallet for Base Sepolia payment. Use sponsor access to preview the protected analysis.",
    retryable: false,
  },
});

export const createGateCoordinator = ({
  sponsorId,
  sponsorGate,
  paymentCoordinator,
  protectedClient,
  paymentAvailable,
  createAttemptIdentity = createDefaultAttemptIdentity,
}: GateCoordinatorOptions): GateCoordinatorPort => {
  let state: GateState = { type: "idle" };
  let source: InvocationSource | undefined;
  let receipt: PaymentReceipt | undefined;
  let active: ActiveAttempt | undefined;
  const listeners = new Set<(snapshot: GateSnapshot) => void>();

  const createSnapshot = (): GateSnapshot => ({
    state,
    source,
    paymentAvailable,
    ...(receipt ? { receipt } : {}),
  });
  let snapshot = createSnapshot();

  const getSnapshot = (): GateSnapshot => snapshot;

  const notify = () => {
    for (const listener of listeners) listener(snapshot);
  };

  const transition = (event: GateEvent): boolean => {
    const next = transitionGate(state, event);
    if (!next.ok) return false;
    state = next.state;
    snapshot = createSnapshot();
    notify();
    return true;
  };

  const isCurrent = (candidate: ActiveAttempt): boolean =>
    active === candidate && !candidate.settled;

  const settle = (candidate: ActiveAttempt, result: WebMCPToolResult) => {
    if (!isCurrent(candidate)) return;
    candidate.settled = true;
    candidate.removeHostAbort?.();
    candidate.controller.abort();
    active = undefined;
    candidate.resolve(result);
  };

  const rejectAttempt = (candidate: ActiveAttempt, error: AdGateError) => {
    if (!isCurrent(candidate)) return;
    const safeError = normalizeContractError(error);
    transition({
      type: "reject",
      attemptId: candidate.identity.attemptId,
      error: safeError,
    });
    settle(candidate, { ok: false, error: safeError });
  };

  const cancelAttempt = (
    candidate: ActiveAttempt,
    reason: GateCancellationReason,
  ) => {
    if (!isCurrent(candidate)) return;
    candidate.controller.abort();
    paymentCoordinator.cancel(reason);
    transition({
      type: "cancel",
      attemptId: candidate.identity.attemptId,
      reason,
    });
    settle(candidate, cancelledResult());
  };

  const runSponsor = async (candidate: ActiveAttempt): Promise<void> => {
    try {
      const sponsorResult = await sponsorGate.requestSponsorAccess({
        attemptId: candidate.identity.attemptId,
        resourceId: RECIPE_ANALYSIS_RESOURCE_ID,
        nonce: candidate.request.requestId,
        signal: candidate.controller.signal,
      });
      if (!isCurrent(candidate)) return;
      if (!sponsorResult.ok) {
        if (sponsorResult.error.code === "CANCELLED") {
          cancelAttempt(candidate, "user");
        } else {
          rejectAttempt(candidate, sponsorResult.error);
        }
        return;
      }
      if (
        sponsorResult.evidence.nonce !== candidate.request.requestId ||
        sponsorResult.evidence.resourceId !== candidate.request.resourceId
      ) {
        rejectAttempt(candidate, {
          code: "INVALID_EVIDENCE",
          message: "Sponsor access does not match this analysis request.",
          retryable: false,
        });
        return;
      }

      transition({
        type: "sponsor_granted",
        attemptId: candidate.identity.attemptId,
        evidence: sponsorResult.evidence,
      });
      transition({
        type: "execute",
        attemptId: candidate.identity.attemptId,
      });
      const protectedResult = await protectedClient.executeWithSponsor({
        request: candidate.request,
        token: sponsorResult.token,
        signal: candidate.controller.signal,
      });
      if (!isCurrent(candidate)) return;
      if (!protectedResult.ok) {
        rejectAttempt(candidate, protectedResult.error);
        return;
      }
      if (
        protectedResult.requestId !== candidate.request.requestId ||
        protectedResult.access.kind !== "sponsor_grant" ||
        protectedResult.access.referenceId !== sponsorResult.evidence.grantId
      ) {
        rejectAttempt(candidate, {
          code: "INVALID_EVIDENCE",
          message: "The analysis result does not match this sponsor grant.",
          retryable: false,
        });
        return;
      }

      transition({
        type: "resolve",
        attemptId: candidate.identity.attemptId,
        result: protectedResult.data,
      });
      settle(candidate, normalizeWebMCPResult(protectedResult));
    } catch {
      if (isCurrent(candidate)) {
        const failure = dependencyUnavailable();
        rejectAttempt(candidate, failure.error);
      }
    }
  };

  const runPayment = async (candidate: ActiveAttempt): Promise<void> => {
    try {
      const terminal = await paymentCoordinator.requestPaidAccess(
        candidate.request,
        candidate.controller.signal,
      );
      if (!isCurrent(candidate)) return;

      if (terminal.type === "cancelled") {
        transition({
          type: "cancel",
          attemptId: candidate.identity.attemptId,
          reason: terminal.reason,
        });
        settle(candidate, cancelledResult());
        return;
      }
      if (terminal.type === "error") {
        rejectAttempt(candidate, terminal.error);
        return;
      }
      const access = terminal.result.access;
      if (
        terminal.result.requestId !== candidate.request.requestId ||
        access.kind !== "x402_payment"
      ) {
        rejectAttempt(candidate, {
          code: "IDEMPOTENCY_CONFLICT",
          message: "The paid analysis result does not match this request.",
          retryable: false,
        });
        return;
      }

      receipt = terminal.receipt;
      transition({
        type: "payment_succeeded",
        attemptId: candidate.identity.attemptId,
        result: terminal.result.data,
        access: {
          kind: "x402_payment",
          referenceId: access.referenceId,
        },
      });
      settle(candidate, normalizeWebMCPResult(terminal.result));
    } catch {
      if (isCurrent(candidate)) {
        const failure = dependencyUnavailable();
        rejectAttempt(candidate, failure.error);
      }
    }
  };

  return {
    requestAnalysis(input, options) {
      if (active) return Promise.resolve(duplicateResult());

      const identity = createAttemptIdentity();
      const capturedInput: RecipeAnalysisInput = {
        recipeId: input.recipeId,
        ...(input.dietaryGoals
          ? { dietaryGoals: [...input.dietaryGoals] }
          : {}),
      };
      const request: PremiumAnalysisRequest = {
        requestId: identity.requestId,
        idempotencyKey: identity.idempotencyKey,
        resourceId: RECIPE_ANALYSIS_RESOURCE_ID,
        input: capturedInput,
      };
      let resolveResult!: (result: WebMCPToolResult) => void;
      const result = new Promise<WebMCPToolResult>((resolve) => {
        resolveResult = resolve;
      });
      const candidate: ActiveAttempt = {
        identity,
        request,
        source: options.source,
        controller: new AbortController(),
        resolve: resolveResult,
        settled: false,
      };
      active = candidate;
      source = candidate.source;
      receipt = undefined;
      if (candidate.source === "webmcp") {
        transition({
          type: "start_payment",
          attemptId: identity.attemptId,
          paymentRequestId: request.requestId,
        });
      } else {
        transition({
          type: "start_sponsor",
          attemptId: identity.attemptId,
          sponsorId,
        });
      }

      if (options.signal) {
        const abort = () => cancelAttempt(candidate, "abort");
        options.signal.addEventListener("abort", abort, { once: true });
        candidate.removeHostAbort = () =>
          options.signal?.removeEventListener("abort", abort);
        if (options.signal.aborted) abort();
      }

      if (isCurrent(candidate) && candidate.source === "webmcp") {
        if (paymentAvailable) void runPayment(candidate);
        else rejectAttempt(candidate, paymentUnavailable().error);
      }
      if (isCurrent(candidate) && candidate.source === "visible_ui") {
        void runSponsor(candidate);
      }

      return result;
    },

    cancel(reason) {
      const candidate = active;
      if (candidate) cancelAttempt(candidate, reason);
    },

    getSnapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
