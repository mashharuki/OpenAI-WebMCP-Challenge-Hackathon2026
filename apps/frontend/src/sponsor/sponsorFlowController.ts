import type {
  AdGateError,
  AdGateErrorEnvelope,
  SponsorAccessEvidence,
} from "../adgate/contracts";
import type { SponsorSessionStartResponse } from "./contracts";
import type {
  SponsorFlowResult,
  SponsorGrantClient,
} from "./sponsorGrantClient";

export interface SponsorClock {
  monotonicNow(): number;
}

export type SponsorViewState =
  | {
      readonly type: "ready";
      readonly attemptId: string;
      readonly nonce: string;
      readonly session: SponsorSessionStartResponse;
    }
  | {
      readonly type: "viewing";
      readonly attemptId: string;
      readonly nonce: string;
      readonly visibleElapsedMs: number;
      readonly visibleSince: number | null;
      readonly requiredMs: number;
    }
  | {
      readonly type: "issuing";
      readonly attemptId: string;
      readonly nonce: string;
    }
  | {
      readonly type: "completed";
      readonly attemptId: string;
      readonly evidence: SponsorAccessEvidence;
      readonly token: string;
    }
  | { readonly type: "cancelled"; readonly attemptId: string }
  | {
      readonly type: "failed";
      readonly attemptId: string;
      readonly error: AdGateError;
    };

export interface SponsorFlowController {
  readonly getSnapshot: () => SponsorViewState;
  readonly subscribe: (listener: () => void) => () => void;
  start(attemptId: string): void;
  tick(attemptId: string): void;
  visibilityChanged(attemptId: string): void;
  continue(attemptId: string, signal?: AbortSignal): Promise<SponsorFlowResult>;
  cancel(attemptId: string): void;
  abort(attemptId: string): void;
  dispose(): void;
}

interface SponsorFlowControllerOptions {
  readonly attemptId: string;
  readonly nonce: string;
  readonly session: SponsorSessionStartResponse;
  readonly clock: SponsorClock;
  readonly isVisible: () => boolean;
  readonly issue: SponsorGrantClient["issue"];
  readonly onTerminal?: (result: SponsorFlowResult) => void;
}

const cancelledResult = (): AdGateErrorEnvelope => ({
  ok: false,
  error: {
    code: "CANCELLED",
    message: "Sponsor access was cancelled.",
    retryable: true,
  },
});

const tooEarlyResult = (): AdGateErrorEnvelope => ({
  ok: false,
  error: {
    code: "INVALID_TRANSITION",
    message: "The sponsor view is not complete yet.",
    retryable: true,
  },
});

export const createSponsorFlowController = ({
  attemptId,
  nonce,
  session,
  clock,
  isVisible,
  issue,
  onTerminal,
}: SponsorFlowControllerOptions): SponsorFlowController => {
  let state: SponsorViewState = {
    type: "ready",
    attemptId,
    nonce,
    session,
  };
  let lastNow = clock.monotonicNow();
  let terminalResult: SponsorFlowResult | undefined;
  const listeners = new Set<() => void>();

  const publish = (next: SponsorViewState) => {
    state = next;
    for (const listener of listeners) listener();
  };

  const finish = (next: SponsorViewState, result: SponsorFlowResult) => {
    if (terminalResult) return;
    terminalResult = result;
    publish(next);
    onTerminal?.(result);
  };

  const updateElapsed = () => {
    if (state.type !== "viewing") return;
    const current = Math.max(lastNow, clock.monotonicNow());
    const elapsed =
      state.visibleSince === null ? 0 : Math.max(0, current - lastNow);
    lastNow = current;
    if (elapsed === 0) return;
    publish({
      ...state,
      visibleElapsedMs: Math.min(
        state.requiredMs,
        state.visibleElapsedMs + elapsed,
      ),
      visibleSince: current,
    });
  };

  const cancelAttempt = (eventAttemptId: string) => {
    if (eventAttemptId !== attemptId || terminalResult) return;
    const result = cancelledResult();
    finish({ type: "cancelled", attemptId }, result);
  };

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start(eventAttemptId) {
      if (eventAttemptId !== attemptId || state.type !== "ready") return;
      lastNow = Math.max(lastNow, clock.monotonicNow());
      publish({
        type: "viewing",
        attemptId,
        nonce,
        visibleElapsedMs: 0,
        visibleSince: isVisible() ? lastNow : null,
        requiredMs: session.requiredMs,
      });
    },
    tick(eventAttemptId) {
      if (eventAttemptId !== attemptId || terminalResult) return;
      updateElapsed();
    },
    visibilityChanged(eventAttemptId) {
      if (
        eventAttemptId !== attemptId ||
        terminalResult ||
        state.type !== "viewing"
      ) {
        return;
      }
      updateElapsed();
      if (state.type !== "viewing") return;
      const current = Math.max(lastNow, clock.monotonicNow());
      lastNow = current;
      publish({
        ...state,
        visibleSince: isVisible() ? current : null,
      });
    },
    async continue(eventAttemptId, signal) {
      if (eventAttemptId !== attemptId) return tooEarlyResult();
      if (terminalResult) return terminalResult;
      updateElapsed();
      if (
        state.type !== "viewing" ||
        state.visibleElapsedMs < state.requiredMs
      ) {
        return tooEarlyResult();
      }

      publish({ type: "issuing", attemptId, nonce });
      const result = await issue(
        { sessionCredential: session.sessionCredential },
        signal,
      );
      if (terminalResult) return terminalResult;
      if (result.ok) {
        finish(
          {
            type: "completed",
            attemptId,
            evidence: result.evidence,
            token: result.token,
          },
          result,
        );
      } else {
        finish({ type: "failed", attemptId, error: result.error }, result);
      }
      return result;
    },
    cancel: cancelAttempt,
    abort: cancelAttempt,
    dispose() {
      if (!terminalResult) {
        const result = cancelledResult();
        finish({ type: "cancelled", attemptId }, result);
      }
      listeners.clear();
    },
  };
};
