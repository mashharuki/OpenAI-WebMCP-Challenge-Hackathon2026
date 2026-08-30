import type {
  AdGateError,
  PaymentReceipt,
  PremiumAnalysisRequest,
  PremiumAnalysisSuccess,
} from "../contracts.js";
import {
  type PaymentClient,
  PaymentClientError,
  type PremiumPaymentAttempt,
} from "./paymentClient.js";
import type { Eip1193ProviderPort, WalletAdapter } from "./walletAdapter.js";

export type PaymentFlowState =
  | { type: "idle" }
  | { type: "reviewing"; attempt: PremiumPaymentAttempt }
  | { type: "connecting_wallet"; attempt: PremiumPaymentAttempt }
  | {
      type: "awaiting_signature";
      attempt: PremiumPaymentAttempt;
      account: `0x${string}`;
    }
  | { type: "settling"; attempt: PremiumPaymentAttempt }
  | {
      type: "succeeded";
      result: PremiumAnalysisSuccess;
      receipt: PaymentReceipt;
    }
  | {
      type: "failed";
      error: AdGateError;
      outcome: "not_paid" | "uncertain";
    }
  | { type: "cancelled"; reason: PaymentCancellationReason };

export type PaymentCancellationReason = "user" | "abort" | "unmounted";

export type PaymentTerminalResult =
  | {
      type: "success";
      result: PremiumAnalysisSuccess;
      receipt: PaymentReceipt;
    }
  | { type: "error"; error: AdGateError }
  | { type: "cancelled"; reason: PaymentCancellationReason };

export interface PaymentCoordinatorPort {
  requestPaidAccess(
    request: PremiumAnalysisRequest,
    signal?: AbortSignal,
  ): Promise<PaymentTerminalResult>;
  confirm(provider?: Eip1193ProviderPort): Promise<void>;
  cancel(reason: PaymentCancellationReason): void;
  getSnapshot(): PaymentFlowState;
  subscribe(listener: (state: PaymentFlowState) => void): () => void;
}

type ActivePayment = {
  readonly id: number;
  readonly resolve: (result: PaymentTerminalResult) => void;
  readonly signal?: AbortSignal;
  abortListener?: () => void;
  attempt?: PremiumPaymentAttempt;
  completed: boolean;
  confirmPromise?: Promise<void>;
};

const internalError = (): AdGateError => ({
  code: "INTERNAL_ERROR",
  message: "The payment flow could not be completed safely.",
  retryable: false,
});

export const createPaymentCoordinator = ({
  paymentClient,
  walletAdapter,
}: {
  readonly paymentClient: PaymentClient;
  readonly walletAdapter: WalletAdapter;
}): PaymentCoordinatorPort => {
  let state: PaymentFlowState = { type: "idle" };
  let active: ActivePayment | undefined;
  let nextId = 1;
  const listeners = new Set<(state: PaymentFlowState) => void>();

  const publish = (next: PaymentFlowState) => {
    state = next;
    for (const listener of listeners) listener(state);
  };

  const isCurrent = (candidate: ActivePayment): boolean =>
    active?.id === candidate.id && !candidate.completed;

  const finish = (
    candidate: ActivePayment,
    terminal: PaymentTerminalResult,
    terminalState: PaymentFlowState,
  ) => {
    if (!isCurrent(candidate)) return;
    candidate.completed = true;
    if (candidate.signal && candidate.abortListener) {
      candidate.signal.removeEventListener("abort", candidate.abortListener);
    }
    publish(terminalState);
    active = undefined;
    candidate.resolve(terminal);
  };

  const fail = (candidate: ActivePayment, error: AdGateError) => {
    const outcome =
      error.code === "DEPENDENCY_UNAVAILABLE" ? "uncertain" : "not_paid";
    finish(
      candidate,
      { type: "error", error },
      { type: "failed", error, outcome },
    );
  };

  return {
    requestPaidAccess(request, signal) {
      if (active && !active.completed) {
        return Promise.resolve({
          type: "error",
          error: {
            code: "INVALID_TRANSITION",
            message: "Another payment attempt is already active.",
            retryable: false,
          },
        });
      }
      if (signal?.aborted) {
        const terminal = { type: "cancelled", reason: "abort" } as const;
        publish(terminal);
        return Promise.resolve(terminal);
      }

      let resolveTerminal!: (result: PaymentTerminalResult) => void;
      const terminal = new Promise<PaymentTerminalResult>((resolve) => {
        resolveTerminal = resolve;
      });
      const candidate: ActivePayment = {
        id: nextId++,
        resolve: resolveTerminal,
        signal,
        completed: false,
      };
      active = candidate;
      if (signal) {
        candidate.abortListener = () => {
          finish(
            candidate,
            { type: "cancelled", reason: "abort" },
            { type: "cancelled", reason: "abort" },
          );
        };
        signal.addEventListener("abort", candidate.abortListener, {
          once: true,
        });
      }

      void paymentClient
        .createAttempt(request, signal)
        .then((attempt) => {
          if (!isCurrent(candidate)) return;
          candidate.attempt = attempt;
          publish({ type: "reviewing", attempt });
        })
        .catch((error: unknown) => {
          if (!isCurrent(candidate)) return;
          fail(
            candidate,
            error instanceof PaymentClientError ? error.error : internalError(),
          );
        });
      return terminal;
    },

    confirm(provider) {
      const candidate = active;
      if (
        !candidate ||
        candidate.completed ||
        !candidate.attempt ||
        state.type !== "reviewing"
      ) {
        return candidate?.confirmPromise ?? Promise.resolve();
      }
      if (candidate.confirmPromise) return candidate.confirmPromise;

      const operation = (async () => {
        const attempt = candidate.attempt;
        if (!attempt) return;
        publish({ type: "connecting_wallet", attempt });
        const preparation = await walletAdapter.prepareForPayment(provider);
        if (!isCurrent(candidate)) return;
        if (!preparation.ok) {
          fail(candidate, preparation.error);
          return;
        }
        if (!provider) {
          fail(candidate, {
            code: "ACCESS_REQUIRED",
            message: "An injected wallet is required.",
            retryable: false,
          });
          return;
        }

        publish({
          type: "awaiting_signature",
          attempt,
          account: preparation.account,
        });
        const signature = await walletAdapter.signPayment({
          provider,
          account: preparation.account,
          requirement: attempt.challenge.requirements[0],
        });
        if (!isCurrent(candidate)) return;
        if ("error" in signature) {
          fail(candidate, signature.error);
          return;
        }

        publish({ type: "settling", attempt });
        const paidResult = await paymentClient.retryWithPayment(
          attempt,
          signature.signatureHeader,
          candidate.signal,
        );
        if (!isCurrent(candidate)) return;
        if ("ok" in paidResult) {
          fail(candidate, paidResult.error);
          return;
        }
        finish(
          candidate,
          { type: "success", ...paidResult },
          { type: "succeeded", ...paidResult },
        );
      })().catch((error: unknown) => {
        if (isCurrent(candidate)) {
          fail(
            candidate,
            error instanceof PaymentClientError ? error.error : internalError(),
          );
        }
      });
      candidate.confirmPromise = operation;
      return operation;
    },

    cancel(reason) {
      const candidate = active;
      if (!candidate) return;
      finish(
        candidate,
        { type: "cancelled", reason },
        { type: "cancelled", reason },
      );
    },

    getSnapshot() {
      return state;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
