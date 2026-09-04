import { useEffect, useRef } from "react";
import { useGate } from "./GateProvider";
import { ActivePaymentPanel } from "./payment/PaymentPanel";
import type { PaymentWalletContextValue } from "./payment/PaymentWalletProvider";
import type { PaymentCoordinatorPort } from "./payment/paymentCoordinator";

export interface GateExperienceProps {
  readonly paymentCoordinator: PaymentCoordinatorPort;
  readonly paymentWallet?: PaymentWalletContextValue;
}

const phaseMessage = (
  state: ReturnType<typeof useGate>["snapshot"]["state"],
): string => {
  switch (state.type) {
    case "idle":
      return "Recipe analysis is ready.";
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
  paymentWallet,
}: GateExperienceProps) {
  const { snapshot } = useGate();
  const experienceRef = useRef<HTMLElement | null>(null);
  const focusedAttempt = useRef<string | undefined>(undefined);
  const attemptId =
    "attemptId" in snapshot.state ? snapshot.state.attemptId : undefined;

  useEffect(() => {
    if (
      snapshot.source !== "webmcp" ||
      snapshot.state.type !== "awaiting_payment" ||
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

  if (snapshot.source !== "webmcp" || snapshot.state.type === "idle") {
    return null;
  }

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

      {snapshot.state.type === "awaiting_payment" || snapshot.receipt ? (
        <div className="mt-4">
          <ActivePaymentPanel
            coordinator={paymentCoordinator}
            {...paymentWallet}
          />
        </div>
      ) : null}
    </aside>
  );
}
