import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  type AdGateErrorEnvelope,
  adGateErrorSchema,
  type RECIPE_ANALYSIS_RESOURCE_ID,
} from "../adgate/contracts";
import { SponsorModal } from "./SponsorModal";
import {
  createSponsorFlowController,
  type SponsorClock,
  type SponsorFlowController,
} from "./sponsorFlowController";
import type {
  SponsorFlowResult,
  SponsorGrantClient,
} from "./sponsorGrantClient";

export interface SponsorGateRequest {
  readonly attemptId: string;
  readonly resourceId: typeof RECIPE_ANALYSIS_RESOURCE_ID;
  readonly nonce: string;
  readonly signal: AbortSignal;
}

export interface SponsorGatePort {
  requestSponsorAccess(input: SponsorGateRequest): Promise<SponsorFlowResult>;
}

export interface SponsorVisibility {
  isVisible(): boolean;
  subscribe(listener: () => void): () => void;
}

interface SponsorGateProviderProps {
  readonly children: ReactNode;
  readonly client: SponsorGrantClient;
  readonly clock?: SponsorClock;
  readonly visibility?: SponsorVisibility;
}

interface ActiveAttempt {
  readonly input: SponsorGateRequest;
  readonly childController: AbortController;
  readonly resolve: (result: SponsorFlowResult) => void;
  controller?: SponsorFlowController;
  settled: boolean;
  removeAbortListener?: () => void;
}

interface ActiveView {
  readonly attemptId: string;
  readonly signal: AbortSignal;
  readonly controller: SponsorFlowController;
}

const SponsorGateContext = createContext<SponsorGatePort | undefined>(
  undefined,
);

const defaultClock: SponsorClock = {
  monotonicNow: () =>
    typeof performance === "undefined" ? Date.now() : performance.now(),
};

const defaultVisibility: SponsorVisibility = {
  isVisible: () =>
    typeof document === "undefined" || document.visibilityState === "visible",
  subscribe(listener) {
    if (typeof document === "undefined") return () => {};
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  },
};

const cancelledResult = (): AdGateErrorEnvelope => ({
  ok: false,
  error: {
    code: "CANCELLED",
    message: "Sponsor access was cancelled.",
    retryable: true,
  },
});

const duplicateResult = (): AdGateErrorEnvelope => ({
  ok: false,
  error: {
    code: "INVALID_TRANSITION",
    message: "Another sponsor access attempt is already active.",
    retryable: true,
  },
});

const startFailureResult = (
  error: unknown,
  aborted: boolean,
): AdGateErrorEnvelope => {
  if (aborted) return cancelledResult();
  const parsed = adGateErrorSchema.safeParse(error);
  return parsed.success
    ? { ok: false, error: parsed.data }
    : {
        ok: false,
        error: {
          code: "DEPENDENCY_UNAVAILABLE",
          message: "Sponsor access is temporarily unavailable. Try again.",
          retryable: true,
        },
      };
};

function ActiveSponsorView({
  active,
  visibility,
}: {
  readonly active: ActiveView;
  readonly visibility: SponsorVisibility;
}) {
  const state = useSyncExternalStore(
    active.controller.subscribe,
    active.controller.getSnapshot,
    active.controller.getSnapshot,
  );

  useEffect(
    () =>
      visibility.subscribe(() =>
        active.controller.visibilityChanged(active.attemptId),
      ),
    [active, visibility],
  );

  useEffect(() => {
    if (state.type !== "viewing") return;
    const timer = setInterval(
      () => active.controller.tick(active.attemptId),
      250,
    );
    return () => clearInterval(timer);
  }, [active, state.type]);

  const remainingSeconds =
    state.type === "viewing"
      ? Math.max(0, state.requiredMs - state.visibleElapsedMs) / 1_000
      : state.type === "ready"
        ? state.session.requiredMs / 1_000
        : 0;

  return (
    <SponsorModal
      state={state}
      remainingSeconds={remainingSeconds}
      onStart={() => active.controller.start(active.attemptId)}
      onContinue={() =>
        void active.controller.continue(active.attemptId, active.signal)
      }
      onCancel={() => active.controller.cancel(active.attemptId)}
    />
  );
}

export function SponsorGateProvider({
  children,
  client,
  clock = defaultClock,
  visibility = defaultVisibility,
}: SponsorGateProviderProps) {
  const activeAttempt = useRef<ActiveAttempt | undefined>(undefined);
  const mounted = useRef(true);
  const [activeView, setActiveView] = useState<ActiveView | undefined>(
    undefined,
  );

  const finish = useCallback(
    (attempt: ActiveAttempt, result: SponsorFlowResult) => {
      if (attempt.settled) return;
      attempt.settled = true;
      attempt.childController.abort();
      attempt.removeAbortListener?.();
      if (activeAttempt.current === attempt) activeAttempt.current = undefined;
      if (mounted.current) setActiveView(undefined);
      attempt.resolve(result);
    },
    [],
  );

  const requestSponsorAccess = useCallback(
    (input: SponsorGateRequest): Promise<SponsorFlowResult> => {
      if (activeAttempt.current) return Promise.resolve(duplicateResult());

      return new Promise((resolve) => {
        const childController = new AbortController();
        const attempt: ActiveAttempt = {
          input,
          childController,
          resolve,
          settled: false,
        };
        activeAttempt.current = attempt;

        const abort = () => {
          childController.abort();
          if (attempt.controller) {
            attempt.controller.abort(input.attemptId);
          } else {
            finish(attempt, cancelledResult());
          }
        };
        input.signal.addEventListener("abort", abort, { once: true });
        attempt.removeAbortListener = () =>
          input.signal.removeEventListener("abort", abort);
        if (input.signal.aborted) {
          abort();
          return;
        }

        void client
          .start(
            {
              attemptId: input.attemptId,
              resourceId: input.resourceId,
              nonce: input.nonce,
            },
            childController.signal,
          )
          .then((session) => {
            if (attempt.settled) return;
            const controller = createSponsorFlowController({
              attemptId: input.attemptId,
              nonce: input.nonce,
              session,
              clock,
              isVisible: visibility.isVisible,
              issue: client.issue.bind(client),
              onTerminal: (result) => finish(attempt, result),
            });
            attempt.controller = controller;
            if (mounted.current) {
              setActiveView({
                attemptId: input.attemptId,
                signal: childController.signal,
                controller,
              });
            }
          })
          .catch((error: unknown) =>
            finish(
              attempt,
              startFailureResult(error, childController.signal.aborted),
            ),
          );
      });
    },
    [client, clock, finish, visibility],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const attempt = activeAttempt.current;
      if (!attempt || attempt.settled) return;
      attempt.childController.abort();
      if (attempt.controller) {
        attempt.controller.dispose();
      } else {
        finish(attempt, cancelledResult());
      }
    };
  }, [finish]);

  const port = useMemo<SponsorGatePort>(
    () => ({ requestSponsorAccess }),
    [requestSponsorAccess],
  );

  return (
    <SponsorGateContext.Provider value={port}>
      {children}
      {activeView ? (
        <ActiveSponsorView active={activeView} visibility={visibility} />
      ) : null}
    </SponsorGateContext.Provider>
  );
}

export const useSponsorGate = (): SponsorGatePort => {
  const port = useContext(SponsorGateContext);
  if (!port) {
    throw new Error("useSponsorGate must be used within SponsorGateProvider.");
  }
  return port;
};
