import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GateExperience } from "../../src/adgate/GateExperience";
import { GateProvider } from "../../src/adgate/GateProvider";
import type {
  GateCoordinatorPort,
  GateSnapshot,
} from "../../src/adgate/gateCoordinator";
import type {
  PaymentCoordinatorPort,
  PaymentFlowState,
} from "../../src/adgate/payment/paymentCoordinator";

const awaitingChoice = (paymentAvailable = true): GateSnapshot => ({
  state: {
    type: "awaiting_choice",
    attemptId: "attempt-1",
    input: { recipeId: "roasted-chickpea-quinoa-bowl" },
  },
  source: "webmcp",
  paymentAvailable,
});

const createGate = (snapshot: GateSnapshot): GateCoordinatorPort => ({
  requestAnalysis: vi.fn<GateCoordinatorPort["requestAnalysis"]>(
    () => new Promise(() => undefined),
  ),
  chooseSponsor: vi.fn(async () => undefined),
  choosePayment: vi.fn(async () => undefined),
  cancel: vi.fn(),
  getSnapshot: () => snapshot,
  subscribe: () => () => undefined,
});

const paymentAttempt = {
  request: {
    requestId: "request-1",
    idempotencyKey: "analysis-request-1",
    resourceId: "recipe_analysis" as const,
    input: { recipeId: "roasted-chickpea-quinoa-bowl" as const },
  },
  canonicalBody: "{}",
  challenge: {
    requestId: "request-1",
    requirements: [
      {
        scheme: "exact" as const,
        network: "eip155:84532" as const,
        asset: "0x1111111111111111111111111111111111111111" as const,
        amount: "10000",
        payTo: "0x2222222222222222222222222222222222222222" as const,
        maxTimeoutSeconds: 300,
        resource: "recipe_analysis" as const,
        extra: { name: "USDC" as const, version: "2" as const },
      },
    ] as const,
  },
};

const createPayment = (
  state: PaymentFlowState = { type: "idle" },
): PaymentCoordinatorPort => ({
  requestPaidAccess: vi.fn<PaymentCoordinatorPort["requestPaidAccess"]>(
    () => new Promise(() => undefined),
  ),
  confirm: vi.fn(async () => undefined),
  cancel: vi.fn(),
  getSnapshot: () => state,
  subscribe: () => () => undefined,
});

const renderExperience = (
  gate: GateCoordinatorPort,
  payment = createPayment(),
) =>
  render(
    <GateProvider coordinator={gate}>
      <GateExperience paymentCoordinator={payment} />
    </GateProvider>,
  );

describe("GateExperience", () => {
  it("offers explicit access choices and suppresses a second selection", () => {
    const gate = createGate(awaitingChoice());
    renderExperience(gate);

    const sponsor = screen.getByRole("button", { name: "Use sponsor access" });
    const payment = screen.getByRole("button", {
      name: "Pay with Base Sepolia",
    });
    expect(sponsor).toBeEnabled();
    expect(payment).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Choose how to unlock recipe analysis.",
    );

    fireEvent.click(sponsor);
    fireEvent.click(payment);

    expect(gate.chooseSponsor).toHaveBeenCalledTimes(1);
    expect(gate.choosePayment).not.toHaveBeenCalled();
    expect(sponsor).toBeDisabled();
    expect(payment).toBeDisabled();
  });

  it("keeps sponsor access available when payment is unavailable", () => {
    const gate = createGate(awaitingChoice(false));
    renderExperience(gate);

    expect(
      screen.getByRole("button", { name: "Use sponsor access" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Pay with Base Sepolia" }),
    ).toBeDisabled();
    expect(screen.getByText(/payment is unavailable/i)).toBeVisible();
  });

  it("exposes cancellation as an explicit keyboard-accessible action", () => {
    const gate = createGate(awaitingChoice());
    renderExperience(gate);

    fireEvent.click(screen.getByRole("button", { name: "Cancel analysis" }));
    expect(gate.cancel).toHaveBeenCalledWith("user");
  });

  it("places the upstream payment panel without starting a second payment", () => {
    const gate = createGate({
      state: {
        type: "awaiting_payment",
        attemptId: "attempt-1",
        paymentRequestId: "request-1",
      },
      source: "visible_ui",
      paymentAvailable: true,
    });
    const payment = createPayment({
      type: "reviewing",
      attempt: paymentAttempt,
    });
    renderExperience(gate, payment);

    expect(
      screen.getByRole("heading", { name: "Recipe analysis" }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Review and confirm the Base Sepolia payment.",
    );
    expect(payment.requestPaidAccess).not.toHaveBeenCalled();
  });

  it.each([
    [
      { type: "viewing_sponsor", attemptId: "attempt-1", sponsorId: "sponsor" },
      "Sponsor access is open",
    ],
    [
      {
        type: "access_granted",
        attemptId: "attempt-1",
        evidence: {
          kind: "sponsor_grant",
          grantId: "grant-1",
          resourceId: "recipe_analysis",
          issuedAt: "2026-08-30T00:00:00.000Z",
          expiresAt: "2026-08-30T00:01:00.000Z",
          nonce: "request-1",
        },
      },
      "Access granted. Preparing recipe analysis.",
    ],
    [
      {
        type: "executing",
        attemptId: "attempt-1",
        evidence: {
          kind: "sponsor_grant",
          grantId: "grant-1",
          resourceId: "recipe_analysis",
          issuedAt: "2026-08-30T00:00:00.000Z",
          expiresAt: "2026-08-30T00:01:00.000Z",
          nonce: "request-1",
        },
      },
      "Access granted. Analyzing the recipe.",
    ],
    [
      { type: "cancelled", attemptId: "attempt-1", reason: "user" },
      "Recipe analysis was cancelled.",
    ],
  ] as const)(
    "announces the %s phase without relying on color",
    (state, text) => {
      renderExperience(
        createGate({ state, source: "webmcp", paymentAvailable: true }),
      );

      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-live", "polite");
      expect(status).toHaveTextContent(text);
    },
  );
});
