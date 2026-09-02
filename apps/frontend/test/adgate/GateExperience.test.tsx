import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

const scrollIntoView = vi.fn();
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: scrollIntoView,
});

const createGate = (snapshot: GateSnapshot): GateCoordinatorPort => ({
  requestAnalysis: vi.fn<GateCoordinatorPort["requestAnalysis"]>(
    () => new Promise(() => undefined),
  ),
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
  beforeEach(() => {
    scrollIntoView.mockClear();
  });

  it("brings an agent-started payment review into view and focuses it", () => {
    renderExperience(
      createGate({
        state: {
          type: "awaiting_payment",
          attemptId: "attempt-1",
          paymentRequestId: "request-1",
        },
        source: "webmcp",
        paymentAvailable: true,
      }),
    );

    const experience = screen.getByRole("complementary", {
      name: "Recipe analysis access",
    });
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({
      behavior: "smooth",
      block: "center",
    });
    expect(experience).toHaveFocus();
  });

  it("does not render an access choice for a visible sponsor attempt", () => {
    renderExperience(
      createGate({
        state: {
          type: "viewing_sponsor",
          attemptId: "attempt-1",
          sponsorId: "open-table-weekly",
        },
        source: "visible_ui",
        paymentAvailable: true,
      }),
    );

    expect(
      screen.queryByRole("complementary", { name: "Recipe analysis access" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Pay with Base Sepolia" }),
    ).not.toBeInTheDocument();
  });

  it("places the upstream payment panel without starting a second payment", () => {
    const gate = createGate({
      state: {
        type: "awaiting_payment",
        attemptId: "attempt-1",
        paymentRequestId: "request-1",
      },
      source: "webmcp",
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
