import { describe, expect, it, vi } from "vitest";
import type {
  AdGateErrorEnvelope,
  PaymentReceipt,
  PremiumAnalysisSuccess,
  RecipeAnalysisInput,
} from "../../src/adgate/contracts";
import {
  createGateCoordinator as createProductionGateCoordinator,
  type GateAttemptIdentity,
} from "../../src/adgate/gateCoordinator";
import type {
  PaymentCoordinatorPort,
  PaymentTerminalResult,
} from "../../src/adgate/payment/paymentCoordinator";
import type { ProtectedAnalysisClientPort } from "../../src/adgate/protectedAnalysisClient";
import type { SponsorGatePort } from "../../src/sponsor/SponsorGateProvider";

const input = { recipeId: "roasted-chickpea-quinoa-bowl" } as const;

const createGateCoordinator = (
  options: Omit<
    Parameters<typeof createProductionGateCoordinator>[0],
    "sponsorId"
  >,
) =>
  createProductionGateCoordinator({
    sponsorId: "test-sponsor",
    ...options,
  });

const identities: GateAttemptIdentity[] = [
  {
    attemptId: "attempt-1",
    requestId: "request-1",
    idempotencyKey: "idempotency-key-1",
  },
  {
    attemptId: "attempt-2",
    requestId: "request-2",
    idempotencyKey: "idempotency-key-2",
  },
];

const sponsorGrant = {
  ok: true as const,
  token: "sponsor_token_abcdefghijklmnopqrstuvwxyz_1234567890",
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
  data: {
    summary: "A balanced plant-forward bowl.",
    nutritionalInsights: ["Chickpeas provide fiber."],
    suggestions: ["Add pumpkin seeds for crunch."],
    disclaimer: "This is general information, not medical advice.",
  },
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

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
};

const neverSponsorAccess: SponsorGatePort["requestSponsorAccess"] = () =>
  new Promise(() => undefined);
const neverPaymentAccess: PaymentCoordinatorPort["requestPaidAccess"] = () =>
  new Promise(() => undefined);
const neverProtectedAnalysis: ProtectedAnalysisClientPort["executeWithSponsor"] =
  () => new Promise(() => undefined);

const createHarness = () => {
  const paymentCancel = vi.fn();
  const createAttemptIdentity = vi
    .fn<() => GateAttemptIdentity>()
    .mockImplementation(() => {
      const identity = identities[createAttemptIdentity.mock.calls.length - 1];
      if (!identity) throw new Error("No test identity available.");
      return identity;
    });
  const coordinator = createGateCoordinator({
    sponsorGate: {
      requestSponsorAccess: neverSponsorAccess,
    },
    paymentCoordinator: {
      requestPaidAccess: neverPaymentAccess,
      confirm: vi.fn(async () => undefined),
      cancel: paymentCancel,
      getSnapshot: () => ({ type: "idle" }),
      subscribe: () => () => undefined,
    },
    protectedClient: {
      executeWithSponsor: neverProtectedAnalysis,
    },
    paymentAvailable: true,
    createAttemptIdentity,
  });

  return { coordinator, createAttemptIdentity, paymentCancel };
};

describe("GateCoordinator", () => {
  it("publishes canonical snapshots until the subscriber unsubscribes", async () => {
    const { coordinator } = createHarness();
    const stateTypes: string[] = [];
    const unsubscribe = coordinator.subscribe((snapshot) => {
      stateTypes.push(snapshot.state.type);
    });

    const first = coordinator.requestAnalysis(input, { source: "webmcp" });
    coordinator.cancel("user");
    await first;
    expect(stateTypes).toEqual(["awaiting_payment", "cancelled"]);

    unsubscribe();
    const second = coordinator.requestAnalysis(input, { source: "webmcp" });
    coordinator.cancel("user");
    await second;
    expect(stateTypes).toEqual(["awaiting_payment", "cancelled"]);
  });

  it("keeps one request pending, rejects a duplicate, and reopens after cancel", async () => {
    const { coordinator, createAttemptIdentity, paymentCancel } =
      createHarness();
    let firstSettled = false;

    const first = coordinator
      .requestAnalysis(input, { source: "webmcp" })
      .finally(() => {
        firstSettled = true;
      });
    await Promise.resolve();

    expect(firstSettled).toBe(false);
    expect(coordinator.getSnapshot()).toMatchObject({
      state: {
        type: "awaiting_payment",
        attemptId: "attempt-1",
        paymentRequestId: "request-1",
      },
      source: "webmcp",
      paymentAvailable: true,
    });

    await expect(
      coordinator.requestAnalysis(input, { source: "visible_ui" }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "REQUEST_IN_PROGRESS",
        message:
          "An analysis is already in progress on the page. Complete or cancel it before starting another.",
        retryable: false,
      },
    });
    expect(createAttemptIdentity).toHaveBeenCalledOnce();
    expect(coordinator.getSnapshot().source).toBe("webmcp");

    coordinator.cancel("user");
    await expect(first).resolves.toMatchObject({
      ok: false,
      error: { code: "CANCELLED" },
    });
    expect(paymentCancel).toHaveBeenCalledExactlyOnceWith("user");

    const second = coordinator.requestAnalysis(input, {
      source: "visible_ui",
    });
    expect(coordinator.getSnapshot()).toMatchObject({
      state: { type: "viewing_sponsor", attemptId: "attempt-2" },
      source: "visible_ui",
    });
    coordinator.cancel("unmounted");
    await expect(second).resolves.toMatchObject({
      ok: false,
      error: { code: "CANCELLED" },
    });
  });

  it("resumes the same pending request after sponsor access succeeds", async () => {
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
    const coordinator = createGateCoordinator({
      sponsorGate: { requestSponsorAccess },
      paymentCoordinator: {
        requestPaidAccess: neverPaymentAccess,
        confirm: vi.fn(async () => undefined),
        cancel: vi.fn(),
        getSnapshot: () => ({ type: "idle" }),
        subscribe: () => () => undefined,
      },
      protectedClient: { executeWithSponsor },
      paymentAvailable: true,
      createAttemptIdentity: () => identities[0],
    });
    const callerInput: RecipeAnalysisInput = {
      ...input,
      dietaryGoals: ["more protein"],
    };
    let invocationSettled = false;
    const invocation = coordinator
      .requestAnalysis(callerInput, { source: "visible_ui" })
      .finally(() => {
        invocationSettled = true;
      });
    callerInput.dietaryGoals?.push("caller mutation");

    expect(coordinator.getSnapshot().state.type).toBe("viewing_sponsor");
    expect(requestSponsorAccess).toHaveBeenCalledOnce();
    const sponsorRequest = requestSponsorAccess.mock.calls[0]?.[0];
    expect(sponsorRequest).toMatchObject({
      attemptId: "attempt-1",
      resourceId: "recipe_analysis",
      nonce: "request-1",
    });
    expect(invocationSettled).toBe(false);

    sponsor.resolve(sponsorGrant);
    await Promise.resolve();
    await Promise.resolve();
    expect(coordinator.getSnapshot().state.type).toBe("executing");
    expect(executeWithSponsor).toHaveBeenCalledOnce();
    const protectedRequest = executeWithSponsor.mock.calls[0]?.[0];
    expect(protectedRequest).toMatchObject({
      request: {
        requestId: "request-1",
        idempotencyKey: "idempotency-key-1",
        resourceId: "recipe_analysis",
        input: {
          recipeId: "roasted-chickpea-quinoa-bowl",
          dietaryGoals: ["more protein"],
        },
      },
      token: sponsorGrant.token,
    });
    expect(protectedRequest?.signal).toBe(sponsorRequest?.signal);
    expect(invocationSettled).toBe(false);

    protectedResult.resolve(sponsorSuccess);
    await expect(invocation).resolves.toEqual({
      ok: true,
      resourceId: "recipe_analysis",
      data: sponsorSuccess.data,
    });
    expect(coordinator.getSnapshot().state).toMatchObject({
      type: "succeeded",
      attemptId: "attempt-1",
      access: { kind: "sponsor_grant", referenceId: "grant-1" },
    });
  });

  it("uses the payment terminal result once without automatically confirming", async () => {
    const payment = deferred<PaymentTerminalResult>();
    const requestPaidAccess = vi.fn<
      PaymentCoordinatorPort["requestPaidAccess"]
    >(() => payment.promise);
    const confirm = vi.fn(async () => undefined);
    const coordinator = createGateCoordinator({
      sponsorGate: {
        requestSponsorAccess: neverSponsorAccess,
      },
      paymentCoordinator: {
        requestPaidAccess,
        confirm,
        cancel: vi.fn(),
        getSnapshot: () => ({ type: "idle" }),
        subscribe: () => () => undefined,
      },
      protectedClient: {
        executeWithSponsor: neverProtectedAnalysis,
      },
      paymentAvailable: true,
      createAttemptIdentity: () => identities[0],
    });
    let invocationSettled = false;
    const invocation = coordinator
      .requestAnalysis(input, { source: "webmcp" })
      .finally(() => {
        invocationSettled = true;
      });

    expect(coordinator.getSnapshot().state).toEqual({
      type: "awaiting_payment",
      attemptId: "attempt-1",
      paymentRequestId: "request-1",
    });
    expect(requestPaidAccess).toHaveBeenCalledOnce();
    const [paidRequest, paidSignal] = requestPaidAccess.mock.calls[0];
    expect(paidRequest).toEqual({
      requestId: "request-1",
      idempotencyKey: "idempotency-key-1",
      resourceId: "recipe_analysis",
      input,
    });
    expect(paidSignal).toBeInstanceOf(AbortSignal);
    expect(confirm).not.toHaveBeenCalled();
    expect(invocationSettled).toBe(false);

    payment.resolve({
      type: "success",
      result: paymentSuccess,
      receipt: paymentReceipt,
    });

    const result = await invocation;
    expect(result).toEqual({
      ok: true,
      resourceId: "recipe_analysis",
      data: paymentSuccess.data,
    });
    expect(JSON.stringify(result)).not.toContain(
      paymentReceipt.transactionHash,
    );
    expect(coordinator.getSnapshot()).toMatchObject({
      state: {
        type: "succeeded",
        attemptId: "attempt-1",
        access: {
          kind: "x402_payment",
          referenceId: paymentReceipt.transactionHash,
        },
      },
      receipt: paymentReceipt,
    });
  });

  it.each([
    {
      terminal: {
        type: "error" as const,
        error: {
          code: "DEPENDENCY_UNAVAILABLE" as const,
          message: "Payment verification is temporarily unavailable.",
          retryable: true,
        },
      },
      expectedState: "failed",
      expectedCode: "DEPENDENCY_UNAVAILABLE",
    },
    {
      terminal: { type: "cancelled" as const, reason: "user" as const },
      expectedState: "cancelled",
      expectedCode: "CANCELLED",
    },
  ])(
    "maps payment $terminal.type to one safe terminal result",
    async ({ terminal, expectedState, expectedCode }) => {
      const coordinator = createGateCoordinator({
        sponsorGate: {
          requestSponsorAccess: neverSponsorAccess,
        },
        paymentCoordinator: {
          requestPaidAccess: vi.fn(async () => terminal),
          confirm: vi.fn(async () => undefined),
          cancel: vi.fn(),
          getSnapshot: () => ({ type: "idle" }),
          subscribe: () => () => undefined,
        },
        protectedClient: {
          executeWithSponsor: neverProtectedAnalysis,
        },
        paymentAvailable: true,
        createAttemptIdentity: () => identities[0],
      });
      const invocation = coordinator.requestAnalysis(input, {
        source: "webmcp",
      });

      await expect(invocation).resolves.toMatchObject({
        ok: false,
        error: { code: expectedCode },
      });
      expect(coordinator.getSnapshot().state.type).toBe(expectedState);
      expect(JSON.stringify(await invocation)).not.toMatch(
        /signature|provider|stack|token/i,
      );
    },
  );

  it("starts sponsor access when payment is unavailable", async () => {
    const sponsor = deferred<typeof sponsorGrant | AdGateErrorEnvelope>();
    const requestSponsorAccess = vi.fn<SponsorGatePort["requestSponsorAccess"]>(
      () => sponsor.promise,
    );
    const requestPaidAccess =
      vi.fn<PaymentCoordinatorPort["requestPaidAccess"]>(neverPaymentAccess);
    const coordinator = createGateCoordinator({
      sponsorGate: { requestSponsorAccess },
      paymentCoordinator: {
        requestPaidAccess,
        confirm: vi.fn(async () => undefined),
        cancel: vi.fn(),
        getSnapshot: () => ({ type: "idle" }),
        subscribe: () => () => undefined,
      },
      protectedClient: {
        executeWithSponsor: neverProtectedAnalysis,
      },
      paymentAvailable: false,
      createAttemptIdentity: () => identities[0],
    });
    const invocation = coordinator.requestAnalysis(input, {
      source: "visible_ui",
    });

    expect(requestPaidAccess).not.toHaveBeenCalled();
    expect(requestSponsorAccess).toHaveBeenCalledOnce();
    expect(coordinator.getSnapshot()).toMatchObject({
      state: { type: "viewing_sponsor" },
      paymentAvailable: false,
    });

    sponsor.resolve({
      ok: false,
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "Sponsor access is temporarily unavailable.",
        retryable: true,
      },
    });
    await expect(invocation).resolves.toMatchObject({
      ok: false,
      error: { code: "DEPENDENCY_UNAVAILABLE" },
    });
  });

  it("stops an agent request when payment is unavailable without using sponsor access", async () => {
    const requestSponsorAccess =
      vi.fn<SponsorGatePort["requestSponsorAccess"]>(neverSponsorAccess);
    const requestPaidAccess =
      vi.fn<PaymentCoordinatorPort["requestPaidAccess"]>(neverPaymentAccess);
    const coordinator = createGateCoordinator({
      sponsorGate: { requestSponsorAccess },
      paymentCoordinator: {
        requestPaidAccess,
        confirm: vi.fn(async () => undefined),
        cancel: vi.fn(),
        getSnapshot: () => ({ type: "idle" }),
        subscribe: () => () => undefined,
      },
      protectedClient: { executeWithSponsor: neverProtectedAnalysis },
      paymentAvailable: false,
      createAttemptIdentity: () => identities[0],
    });

    await expect(
      coordinator.requestAnalysis(input, { source: "webmcp" }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message:
          "Base Sepolia payment is unavailable in this browser. No alternative access path was selected.",
        retryable: false,
      },
    });
    expect(requestPaidAccess).not.toHaveBeenCalled();
    expect(requestSponsorAccess).not.toHaveBeenCalled();
    expect(coordinator.getSnapshot()).toMatchObject({
      source: "webmcp",
      state: {
        type: "failed",
        error: { code: "DEPENDENCY_UNAVAILABLE" },
      },
    });
  });

  it("settles host abort once and ignores a late payment success", async () => {
    const payment = deferred<PaymentTerminalResult>();
    const cancel = vi.fn();
    const requestPaidAccess = vi.fn<
      PaymentCoordinatorPort["requestPaidAccess"]
    >(() => payment.promise);
    const coordinator = createGateCoordinator({
      sponsorGate: {
        requestSponsorAccess: neverSponsorAccess,
      },
      paymentCoordinator: {
        requestPaidAccess,
        confirm: vi.fn(async () => undefined),
        cancel,
        getSnapshot: () => ({ type: "idle" }),
        subscribe: () => () => undefined,
      },
      protectedClient: {
        executeWithSponsor: neverProtectedAnalysis,
      },
      paymentAvailable: true,
      createAttemptIdentity: () => identities[0],
    });
    const host = new AbortController();
    const invocation = coordinator.requestAnalysis(input, {
      source: "webmcp",
      signal: host.signal,
    });
    const attemptSignal = requestPaidAccess.mock.calls[0]?.[1];

    host.abort("private host reason");
    await expect(invocation).resolves.toEqual({
      ok: false,
      error: {
        code: "CANCELLED",
        message: "The analysis request was cancelled.",
        retryable: false,
      },
    });
    expect(attemptSignal?.aborted).toBe(true);
    expect(cancel).toHaveBeenCalledExactlyOnceWith("abort");
    expect(coordinator.getSnapshot().state.type).toBe("cancelled");

    payment.resolve({
      type: "success",
      result: paymentSuccess,
      receipt: paymentReceipt,
    });
    await Promise.resolve();
    expect(coordinator.getSnapshot()).not.toHaveProperty("receipt");
    expect(coordinator.getSnapshot().state.type).toBe("cancelled");
  });

  it("ignores sponsor completion after cancellation", async () => {
    const sponsor = deferred<typeof sponsorGrant | AdGateErrorEnvelope>();
    const executeWithSponsor = vi.fn<
      ProtectedAnalysisClientPort["executeWithSponsor"]
    >(() => Promise.resolve(sponsorSuccess));
    const coordinator = createGateCoordinator({
      sponsorGate: {
        requestSponsorAccess: vi.fn<SponsorGatePort["requestSponsorAccess"]>(
          () => sponsor.promise,
        ),
      },
      paymentCoordinator: {
        requestPaidAccess: neverPaymentAccess,
        confirm: vi.fn(async () => undefined),
        cancel: vi.fn(),
        getSnapshot: () => ({ type: "idle" }),
        subscribe: () => () => undefined,
      },
      protectedClient: { executeWithSponsor },
      paymentAvailable: true,
      createAttemptIdentity: () => identities[0],
    });
    const invocation = coordinator.requestAnalysis(input, {
      source: "visible_ui",
    });

    coordinator.cancel("user");
    await expect(invocation).resolves.toMatchObject({
      ok: false,
      error: { code: "CANCELLED" },
    });
    sponsor.resolve(sponsorGrant);
    await Promise.resolve();

    expect(executeWithSponsor).not.toHaveBeenCalled();
    expect(coordinator.getSnapshot().state.type).toBe("cancelled");
  });

  it("routes sponsor cancellation through the shared cancellation path once", async () => {
    const paymentCancel = vi.fn();
    const coordinator = createGateCoordinator({
      sponsorGate: {
        requestSponsorAccess: vi.fn(async () => ({
          ok: false as const,
          error: {
            code: "CANCELLED" as const,
            message: "Sponsor access was cancelled.",
            retryable: false,
          },
        })),
      },
      paymentCoordinator: {
        requestPaidAccess: neverPaymentAccess,
        confirm: vi.fn(async () => undefined),
        cancel: paymentCancel,
        getSnapshot: () => ({ type: "idle" }),
        subscribe: () => () => undefined,
      },
      protectedClient: { executeWithSponsor: neverProtectedAnalysis },
      paymentAvailable: true,
      createAttemptIdentity: () => identities[0],
    });
    const invocation = coordinator.requestAnalysis(input, {
      source: "visible_ui",
    });

    await expect(invocation).resolves.toMatchObject({
      ok: false,
      error: { code: "CANCELLED" },
    });
    expect(paymentCancel).toHaveBeenCalledExactlyOnceWith("user");
  });

  it.each([
    { kind: "x402_payment" as const, referenceId: "grant-1" },
    { kind: "sponsor_grant" as const, referenceId: "different-grant" },
  ])(
    "rejects protected sponsor access that does not match its grant: $kind",
    async (access) => {
      const coordinator = createGateCoordinator({
        sponsorGate: { requestSponsorAccess: vi.fn(async () => sponsorGrant) },
        paymentCoordinator: {
          requestPaidAccess: neverPaymentAccess,
          confirm: vi.fn(async () => undefined),
          cancel: vi.fn(),
          getSnapshot: () => ({ type: "idle" }),
          subscribe: () => () => undefined,
        },
        protectedClient: {
          executeWithSponsor: vi.fn(async () => ({
            ...sponsorSuccess,
            access,
          })),
        },
        paymentAvailable: true,
        createAttemptIdentity: () => identities[0],
      });
      const invocation = coordinator.requestAnalysis(input, {
        source: "visible_ui",
      });

      await expect(invocation).resolves.toMatchObject({
        ok: false,
        error: { code: "INVALID_EVIDENCE" },
      });
    },
  );
});
