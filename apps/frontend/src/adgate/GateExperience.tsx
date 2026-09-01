import { useEffect, useRef, useState } from "react";
import { useGate } from "./GateProvider";
import { ActivePaymentPanel } from "./payment/PaymentPanel";
import type { PaymentCoordinatorPort } from "./payment/paymentCoordinator";
import type { Eip1193ProviderPort } from "./payment/walletAdapter";

export interface GateExperienceProps {
  readonly paymentCoordinator: PaymentCoordinatorPort;
  readonly walletProvider?: Eip1193ProviderPort;
}

const phaseMessage = (
  state: ReturnType<typeof useGate>["snapshot"]["state"],
): string => {
  switch (state.type) {
    case "idle":
      return "Recipe analysis is ready.";
    case "awaiting_choice":
      return "Choose how to unlock recipe analysis.";
    case "viewing_sponsor":
      return "Sponsor access is open. Complete the sponsor step to continue.";
    case "access_granted":
      return "Access granted. Preparing recipe analysis.";
    case "executing":
      return "Access granted. Analyzing the recipe.";
    case "awaiting_payment":
      return "Review and confirm the Base Sepolia payment.";
    case "succeeded":
      return "Recipe analysis completed.";
    case "cancelled":
      return "Recipe analysis was cancelled.";
    case "failed":
      return state.error.message;
  }
};

export function GateExperience({
  paymentCoordinator,
  walletProvider,
}: GateExperienceProps) {
  const { coordinator, snapshot } = useGate();
  const experienceRef = useRef<HTMLElement | null>(null);
  const focusedAttempt = useRef<string | undefined>(undefined);
  const lockedAttempt = useRef<string | undefined>(undefined);
  const [selectedAttempt, setSelectedAttempt] = useState<string | undefined>(
    undefined,
  );
  const attemptId =
    "attemptId" in snapshot.state ? snapshot.state.attemptId : undefined;

  useEffect(() => {
    if (
      snapshot.source !== "webmcp" ||
      (snapshot.state.type !== "awaiting_choice" &&
        snapshot.state.type !== "awaiting_payment") ||
      !attemptId ||
      focusedAttempt.current === attemptId
    ) {
      return;
    }

    focusedAttempt.current = attemptId;
    experienceRef.current?.scrollIntoView?.({
      behavior: "smooth",
      block: "center",
    });
    experienceRef.current?.focus({ preventScroll: true });
  }, [attemptId, snapshot.source, snapshot.state.type]);

  if (lockedAttempt.current && lockedAttempt.current !== attemptId) {
    lockedAttempt.current = undefined;
  }

  if (snapshot.state.type === "idle") return null;

  const choose = (path: "sponsor" | "payment") => {
    if (!attemptId || lockedAttempt.current === attemptId) return;
    lockedAttempt.current = attemptId;
    setSelectedAttempt(attemptId);
    if (path === "sponsor") void coordinator.chooseSponsor();
    else void coordinator.choosePayment();
  };

  const choiceLocked = selectedAttempt === attemptId;

  return (
    <aside
      ref={experienceRef}
      aria-label="Recipe analysis access"
      tabIndex={-1}
      className="mx-auto mt-8 max-w-[96rem] rounded-2xl border border-[#c8bea8] bg-[#fbfaf6] p-5 shadow-lg sm:p-6"
    >
      <p
        role="status"
        aria-live="polite"
        className="font-medium text-[#29483b]"
      >
        {phaseMessage(snapshot.state)}
      </p>

      {snapshot.state.type === "awaiting_choice" ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={choiceLocked}
              onClick={() => choose("sponsor")}
              className="min-h-11 rounded-full bg-[#e2a93b] px-5 py-3 font-bold text-[#21352d] disabled:cursor-wait disabled:opacity-60"
            >
              Use sponsor access
            </button>
            <button
              type="button"
              disabled={choiceLocked || !snapshot.paymentAvailable}
              onClick={() => choose("payment")}
              className="min-h-11 rounded-full border border-[#315843] px-5 py-3 font-bold text-[#29483b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Pay with Base Sepolia
            </button>
            <button
              type="button"
              disabled={choiceLocked}
              onClick={() => {
                if (attemptId) {
                  lockedAttempt.current = attemptId;
                  setSelectedAttempt(attemptId);
                }
                coordinator.cancel("user");
              }}
              className="min-h-11 px-4 py-3 text-sm font-semibold text-[#637069] underline-offset-4 hover:underline disabled:opacity-50"
            >
              Cancel analysis
            </button>
          </div>
          {!snapshot.paymentAvailable ? (
            <p className="text-sm text-[#637069]">
              Payment is unavailable right now. Sponsor access is still
              available.
            </p>
          ) : null}
        </div>
      ) : null}

      {snapshot.state.type === "awaiting_payment" || snapshot.receipt ? (
        <div className="mt-4">
          <ActivePaymentPanel
            coordinator={paymentCoordinator}
            provider={walletProvider}
          />
        </div>
      ) : null}
    </aside>
  );
}
