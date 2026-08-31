import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useMemo } from "react";
import { describe, expect, it, vi } from "vitest";
import type {
  AdGateErrorEnvelope,
  PaymentReceipt,
  PremiumAnalysisSuccess,
} from "../../src/adgate/contracts";
import { GateExperience } from "../../src/adgate/GateExperience";
import { GateProvider } from "../../src/adgate/GateProvider";
import {
  createGateCoordinator,
  type GateCoordinatorPort,
} from "../../src/adgate/gateCoordinator";
import { createGatedAnalysisClient } from "../../src/adgate/gatedAnalysisAdapter";
import type {
  PaymentCoordinatorPort,
  PaymentTerminalResult,
} from "../../src/adgate/payment/paymentCoordinator";
import type { ProtectedAnalysisClientPort } from "../../src/adgate/protectedAnalysisClient";
import type { SponsorGatePort } from "../../src/sponsor/SponsorGateProvider";
import { useWebMCPTools } from "../../src/useWebMCPTools";

const input = { recipeId: "roasted-chickpea-quinoa-bowl" } as const;
const analysis = {
  summary: "A balanced plant-forward bowl.",
  nutritionalInsights: ["Chickpeas provide fiber."],
  suggestions: ["Add pumpkin seeds for crunch."],
  disclaimer: "This is general information, not medical advice.",
};
const sponsorGrant = {
  ok: true as const,
  token: "sponsor_token_private_value_1234567890",
  evidence: {
    kind: "sponsor_grant" as const,
    grantId: "grant-1",
    resourceId: "recipe_analysis" as const,
    issuedAt: "2026-08-30T00:00:00.000Z",
    expiresAt: "2026-08-30T00:01:00.000Z",
    nonce: "request-1",
  },
};
const sponsorSuccess: PremiumAnalysisSuccess = {
  ok: true,
  requestId: "request-1",
  resourceId: "recipe_analysis",
  access: { kind: "sponsor_grant", referenceId: "grant-1" },
  data: analysis,
};
const paymentReceipt: PaymentReceipt = {
  resourceId: "recipe_analysis",
  paymentRequestId: "request-1",
  transactionHash: `0x${"1".repeat(64)}`,
  network: "eip155:84532",
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  amount: "10000",
  confirmedAt: "2026-08-30T00:00:10.000Z",
};
const paymentSuccess: PremiumAnalysisSuccess = {
  ...sponsorSuccess,
  access: {
    kind: "x402_payment",
    referenceId: paymentReceipt.transactionHash,
  },
};

const deferred = <Value,>() => {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const createPaymentPort = (
  requestPaidAccess: PaymentCoordinatorPort["requestPaidAccess"] = () =>
    new Promise(() => undefined),
): PaymentCoordinatorPort => {
  const idle = { type: "idle" } as const;
  return {
    requestPaidAccess,
    confirm: vi.fn(async () => undefined),
    cancel: vi.fn(),
    getSnapshot: () => idle,
    subscribe: () => () => undefined,
  };
};

const createCoordinator = ({
  sponsor,
  protectedAnalysis,
  payment,
}: {
  sponsor: SponsorGatePort["requestSponsorAccess"];
  protectedAnalysis: ProtectedAnalysisClientPort["executeWithSponsor"];
  payment: PaymentCoordinatorPort;
}) =>
  createGateCoordinator({
    sponsorId: "test-sponsor",
    sponsorGate: { requestSponsorAccess: sponsor },
    protectedClient: { executeWithSponsor: protectedAnalysis },
    paymentCoordinator: payment,
    paymentAvailable: true,
    createAttemptIdentity: () => ({
      attemptId: "attempt-1",
      requestId: "request-1",
      idempotencyKey: "idempotency-key-1",
    }),
  });

function IntegrationHarness({
  coordinator,
  payment,
  onVisibleResult,
}: {
  readonly coordinator: GateCoordinatorPort;
  readonly payment: PaymentCoordinatorPort;
  readonly onVisibleResult: (value: unknown) => void;
}) {
  useWebMCPTools(coordinator);
  const analysisClient = useMemo(
    () => createGatedAnalysisClient(coordinator),
    [coordinator],
  );
  return (
    <>
      <button
        type="button"
        onClick={() => {
          void analysisClient
            .analyze(input)
            .then(onVisibleResult, onVisibleResult);
        }}
      >
        Analyze visibly
      </button>
      <GateExperience paymentCoordinator={payment} />
    </>
  );
}

const renderIntegration = (
  coordinator: GateCoordinatorPort,
  payment: PaymentCoordinatorPort,
  onVisibleResult = vi.fn(),
) => {
  let tool: WebMCPTool | undefined;
  Object.defineProperty(document, "modelContext", {
    configurable: true,
    value: {
      registerTool: vi.fn(async (registeredTool: WebMCPTool) => {
        tool = registeredTool;
      }),
    },
  });
  const view = render(
    <GateProvider coordinator={coordinator}>
      <IntegrationHarness
        coordinator={coordinator}
        payment={payment}
        onVisibleResult={onVisibleResult}
      />
    </GateProvider>,
  );
  return {
    ...view,
    getTool: async () => {
      await waitFor(() => expect(tool).toBeDefined());
      if (!tool) throw new Error("WebMCP tool was not registered.");
      return tool;
    },
  };
};

describe("WebMCP gate integration", () => {
  it("keeps one tool invocation pending through sponsor access and rejects both duplicate entry points", async () => {
    const sponsor = deferred<typeof sponsorGrant | AdGateErrorEnvelope>();
    const protectedResult = deferred<
      PremiumAnalysisSuccess | AdGateErrorEnvelope
    >();
    const requestSponsorAccess = vi.fn<SponsorGatePort["requestSponsorAccess"]>(
      () => sponsor.promise,
    );
    const executeWithSponsor = vi.fn<
      ProtectedAnalysisClientPort["executeWithSponsor"]
    >(() => protectedResult.promise);
    const payment = createPaymentPort();
    const coordinator = createCoordinator({
      sponsor: requestSponsorAccess,
      protectedAnalysis: executeWithSponsor,
      payment,
    });
    const onVisibleResult = vi.fn();
    const { getTool } = renderIntegration(
      coordinator,
      payment,
      onVisibleResult,
    );
    const tool = await getTool();

    let settled = false;
    const invocation = tool
      .execute(input, { signal: new AbortController().signal })
      .finally(() => {
        settled = true;
      });
    await screen.findByText("Choose how to unlock recipe analysis.");
    expect(settled).toBe(false);

    await expect(
      tool.execute(input, { signal: new AbortController().signal }),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        code: "REQUEST_IN_PROGRESS",
        message: expect.stringContaining("choice on the page"),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze visibly" }));
    await waitFor(() =>
      expect(onVisibleResult).toHaveBeenCalledWith(
        expect.objectContaining({ code: "REQUEST_IN_PROGRESS" }),
      ),
    );
    expect(coordinator.getSnapshot()).toMatchObject({
      source: "webmcp",
      state: { type: "awaiting_choice", attemptId: "attempt-1" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Use sponsor access" }));
    expect(settled).toBe(false);
    expect(requestSponsorAccess).toHaveBeenCalledOnce();

    await act(async () => sponsor.resolve(sponsorGrant));
    expect(executeWithSponsor).toHaveBeenCalledOnce();
    expect(settled).toBe(false);

    await act(async () => protectedResult.resolve(sponsorSuccess));
    await expect(invocation).resolves.toEqual({
      ok: true,
      resourceId: "recipe_analysis",
      data: analysis,
    });
    expect(JSON.stringify(await invocation)).not.toContain(sponsorGrant.token);
  });

  it("uses the same request and signal once until the human payment result completes", async () => {
    const paid = deferred<PaymentTerminalResult>();
    const requestPaidAccess = vi.fn<
      PaymentCoordinatorPort["requestPaidAccess"]
    >(() => paid.promise);
    const payment = createPaymentPort(requestPaidAccess);
    const coordinator = createCoordinator({
      sponsor: () => new Promise(() => undefined),
      protectedAnalysis: () => new Promise(() => undefined),
      payment,
    });
    const { getTool } = renderIntegration(coordinator, payment);
    const tool = await getTool();
    let settled = false;
    const invocation = tool
      .execute(input, { signal: new AbortController().signal })
      .finally(() => {
        settled = true;
      });

    await screen.findByText("Choose how to unlock recipe analysis.");
    fireEvent.click(
      screen.getByRole("button", { name: "Pay with Base Sepolia" }),
    );

    expect(requestPaidAccess).toHaveBeenCalledOnce();
    const [request, attemptSignal] = requestPaidAccess.mock.calls[0];
    expect(request).toEqual({
      requestId: "request-1",
      idempotencyKey: "idempotency-key-1",
      resourceId: "recipe_analysis",
      input,
    });
    expect(attemptSignal).toBeInstanceOf(AbortSignal);
    expect(settled).toBe(false);

    await act(async () =>
      paid.resolve({
        type: "success",
        result: paymentSuccess,
        receipt: paymentReceipt,
      }),
    );
    await expect(invocation).resolves.toEqual({
      ok: true,
      resourceId: "recipe_analysis",
      data: analysis,
    });
    expect(JSON.stringify(await invocation)).not.toContain(
      paymentReceipt.transactionHash,
    );
  });

  it("strips raw dependency fields from a payment failure", async () => {
    const requestPaidAccess = vi.fn<
      PaymentCoordinatorPort["requestPaidAccess"]
    >(async () => ({
      type: "error",
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "Payment verification is temporarily unavailable.",
        retryable: true,
        stack: "private stack",
        token: "private token",
        providerData: { signature: "private signature" },
      },
    }));
    const payment = createPaymentPort(requestPaidAccess);
    const coordinator = createCoordinator({
      sponsor: () => new Promise(() => undefined),
      protectedAnalysis: () => new Promise(() => undefined),
      payment,
    });
    const { getTool } = renderIntegration(coordinator, payment);
    const tool = await getTool();
    const invocation = tool.execute(input, {
      signal: new AbortController().signal,
    });

    await screen.findByText("Choose how to unlock recipe analysis.");
    fireEvent.click(
      screen.getByRole("button", { name: "Pay with Base Sepolia" }),
    );

    await expect(invocation).resolves.toEqual({
      ok: false,
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "Payment verification is temporarily unavailable.",
        retryable: true,
      },
    });
    expect(JSON.stringify(await invocation)).not.toMatch(
      /stack|token|providerData|signature|private/i,
    );
  });

  it("settles unmount once and ignores a late payment success", async () => {
    const paid = deferred<PaymentTerminalResult>();
    const requestPaidAccess = vi.fn<
      PaymentCoordinatorPort["requestPaidAccess"]
    >(() => paid.promise);
    const payment = createPaymentPort(requestPaidAccess);
    const coordinator = createCoordinator({
      sponsor: () => new Promise(() => undefined),
      protectedAnalysis: () => new Promise(() => undefined),
      payment,
    });
    const { getTool, unmount } = renderIntegration(coordinator, payment);
    const tool = await getTool();
    const invocation = tool.execute(input, {
      signal: new AbortController().signal,
    });
    await screen.findByText("Choose how to unlock recipe analysis.");
    fireEvent.click(
      screen.getByRole("button", { name: "Pay with Base Sepolia" }),
    );

    unmount();
    await expect(invocation).resolves.toMatchObject({
      ok: false,
      error: { code: "CANCELLED" },
    });
    expect(payment.cancel).toHaveBeenCalledExactlyOnceWith("unmounted");

    await act(async () =>
      paid.resolve({
        type: "success",
        result: paymentSuccess,
        receipt: paymentReceipt,
      }),
    );
    expect(coordinator.getSnapshot()).not.toHaveProperty("receipt");
    expect(coordinator.getSnapshot().state.type).toBe("cancelled");
  });
});
