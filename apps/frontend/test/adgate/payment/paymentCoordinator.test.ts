import { describe, expect, it } from "vitest";
import type { PremiumAnalysisRequest } from "../../../src/adgate/contracts.js";
import type {
  PaidAccessSuccess,
  PremiumPaymentAttempt,
} from "../../../src/adgate/payment/paymentClient.js";
import {
  createPaymentCoordinator,
  type PaymentFlowState,
} from "../../../src/adgate/payment/paymentCoordinator.js";
import type { Eip1193ProviderPort } from "../../../src/adgate/payment/walletAdapter.js";

const request: PremiumAnalysisRequest = {
  requestId: "request-coordinator",
  idempotencyKey: "idempotency-key-coordinator",
  resourceId: "recipe_analysis",
  input: { recipeId: "roasted-chickpea-quinoa-bowl" },
};
const attempt: PremiumPaymentAttempt = {
  request: { ...request },
  canonicalBody: JSON.stringify(request),
  challenge: {
    requestId: request.requestId,
    requirements: [
      {
        scheme: "exact",
        network: "eip155:84532",
        amount: "10000",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        payTo: "0x0000000000000000000000000000000000000001",
        maxTimeoutSeconds: 60,
        resource: "recipe_analysis",
        extra: { name: "USDC", version: "2" },
      },
    ],
  },
};
const paidSuccess: PaidAccessSuccess = {
  result: {
    ok: true,
    requestId: request.requestId,
    resourceId: "recipe_analysis",
    access: {
      kind: "x402_payment",
      referenceId: `0x${"1".repeat(64)}`,
    },
    data: {
      summary: "Paid analysis.",
      nutritionalInsights: ["A paid insight."],
      suggestions: ["A paid suggestion."],
      disclaimer: "General information only.",
    },
  },
  receipt: {
    resourceId: "recipe_analysis",
    paymentRequestId: request.requestId,
    transactionHash: `0x${"1".repeat(64)}`,
    network: "eip155:84532",
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    amount: "10000",
    confirmedAt: "2026-08-30T00:00:10.000Z",
  },
};
const provider: Eip1193ProviderPort = {
  request: async () => undefined,
} as unknown as Eip1193ProviderPort;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("PaymentCoordinator", () => {
  it("holds the request through review and coalesces confirmation into one success", async () => {
    let prepareCalls = 0;
    let signCalls = 0;
    let retryCalls = 0;
    const states: PaymentFlowState[] = [];
    const coordinator = createPaymentCoordinator({
      paymentClient: {
        createAttempt: async () => attempt,
        retryWithPayment: async () => {
          retryCalls += 1;
          return paidSuccess;
        },
      },
      walletAdapter: {
        prepareForPayment: async () => {
          prepareCalls += 1;
          return {
            ok: true,
            account: "0x0000000000000000000000000000000000000001",
            chainId: 84532,
          };
        },
        signPayment: async () => {
          signCalls += 1;
          return { signatureHeader: "opaque-payment-header" };
        },
      },
    });
    coordinator.subscribe((state) => states.push(state));

    const terminal = coordinator.requestPaidAccess(request);
    await flush();
    expect(coordinator.getSnapshot().type).toBe("reviewing");

    const firstConfirm = coordinator.confirm(provider);
    const duplicateConfirm = coordinator.confirm(provider);
    await Promise.all([firstConfirm, duplicateConfirm]);

    await expect(terminal).resolves.toEqual({
      type: "success",
      ...paidSuccess,
    });
    expect(prepareCalls).toBe(1);
    expect(signCalls).toBe(1);
    expect(retryCalls).toBe(1);
    expect(states.map(({ type }) => type)).toEqual([
      "reviewing",
      "connecting_wallet",
      "awaiting_signature",
      "settling",
      "succeeded",
    ]);
  });

  it("cancels before payment without preparing a wallet or retrying", async () => {
    let walletCalls = 0;
    let retryCalls = 0;
    const coordinator = createPaymentCoordinator({
      paymentClient: {
        createAttempt: async () => attempt,
        retryWithPayment: async () => {
          retryCalls += 1;
          return paidSuccess;
        },
      },
      walletAdapter: {
        prepareForPayment: async () => {
          walletCalls += 1;
          throw new Error("must not prepare");
        },
        signPayment: async () => {
          walletCalls += 1;
          throw new Error("must not sign");
        },
      },
    });

    const terminal = coordinator.requestPaidAccess(request);
    await flush();
    coordinator.cancel("user");

    await expect(terminal).resolves.toEqual({
      type: "cancelled",
      reason: "user",
    });
    expect(coordinator.getSnapshot()).toEqual({
      type: "cancelled",
      reason: "user",
    });
    expect(walletCalls).toBe(0);
    expect(retryCalls).toBe(0);
  });

  it("returns an isolated error for a second active request", async () => {
    const coordinator = createPaymentCoordinator({
      paymentClient: {
        createAttempt: async () => attempt,
        retryWithPayment: async () => paidSuccess,
      },
      walletAdapter: {
        prepareForPayment: async () => ({
          ok: false,
          error: {
            code: "CANCELLED",
            message: "Rejected.",
            retryable: false,
          },
        }),
        signPayment: async () => ({
          error: {
            code: "CANCELLED",
            message: "Rejected.",
            retryable: false,
          },
        }),
      },
    });

    const first = coordinator.requestPaidAccess(request);
    const second = coordinator.requestPaidAccess({
      ...request,
      requestId: "request-second",
    });

    await expect(second).resolves.toMatchObject({
      type: "error",
      error: { code: "INVALID_TRANSITION" },
    });
    await flush();
    expect(coordinator.getSnapshot().type).toBe("reviewing");
    coordinator.cancel("user");
    await expect(first).resolves.toMatchObject({ type: "cancelled" });
  });

  it("terminates wallet rejection as a not-paid failure", async () => {
    const rejection = {
      code: "CANCELLED" as const,
      message: "The wallet request was rejected.",
      retryable: false,
    };
    const coordinator = createPaymentCoordinator({
      paymentClient: {
        createAttempt: async () => attempt,
        retryWithPayment: async () => paidSuccess,
      },
      walletAdapter: {
        prepareForPayment: async () => ({ ok: false, error: rejection }),
        signPayment: async () => {
          throw new Error("must not sign");
        },
      },
    });

    const terminal = coordinator.requestPaidAccess(request);
    await flush();
    await coordinator.confirm(provider);

    await expect(terminal).resolves.toEqual({
      type: "error",
      error: rejection,
    });
    expect(coordinator.getSnapshot()).toEqual({
      type: "failed",
      error: rejection,
      outcome: "not_paid",
    });
  });

  it("keeps timeout-like settlement failure uncertain", async () => {
    const timeout = {
      code: "DEPENDENCY_UNAVAILABLE" as const,
      message: "The settlement result is uncertain.",
      retryable: true,
    };
    const coordinator = createPaymentCoordinator({
      paymentClient: {
        createAttempt: async () => attempt,
        retryWithPayment: async () => ({ ok: false, error: timeout }),
      },
      walletAdapter: {
        prepareForPayment: async () => ({
          ok: true,
          account: "0x0000000000000000000000000000000000000001",
          chainId: 84532,
        }),
        signPayment: async () => ({
          signatureHeader: "opaque-payment-header",
        }),
      },
    });

    const terminal = coordinator.requestPaidAccess(request);
    await flush();
    await coordinator.confirm(provider);

    await expect(terminal).resolves.toEqual({ type: "error", error: timeout });
    expect(coordinator.getSnapshot()).toEqual({
      type: "failed",
      error: timeout,
      outcome: "uncertain",
    });
  });

  it("ignores a facilitator success that arrives after cancellation", async () => {
    let resolveSettlement: ((value: PaidAccessSuccess) => void) | undefined;
    const coordinator = createPaymentCoordinator({
      paymentClient: {
        createAttempt: async () => attempt,
        retryWithPayment: () =>
          new Promise((resolve) => {
            resolveSettlement = resolve;
          }),
      },
      walletAdapter: {
        prepareForPayment: async () => ({
          ok: true,
          account: "0x0000000000000000000000000000000000000001",
          chainId: 84532,
        }),
        signPayment: async () => ({
          signatureHeader: "opaque-payment-header",
        }),
      },
    });

    const terminal = coordinator.requestPaidAccess(request);
    await flush();
    const confirmation = coordinator.confirm(provider);
    await flush();
    expect(coordinator.getSnapshot().type).toBe("settling");
    coordinator.cancel("user");
    await expect(terminal).resolves.toEqual({
      type: "cancelled",
      reason: "user",
    });

    resolveSettlement?.(paidSuccess);
    await confirmation;
    expect(coordinator.getSnapshot()).toEqual({
      type: "cancelled",
      reason: "user",
    });
  });

  it("settles pre-abort and late callbacks exactly once", async () => {
    const preAborted = new AbortController();
    preAborted.abort();
    let resolveAttempt: ((value: PremiumPaymentAttempt) => void) | undefined;
    const coordinator = createPaymentCoordinator({
      paymentClient: {
        createAttempt: () =>
          new Promise((resolve) => {
            resolveAttempt = resolve;
          }),
        retryWithPayment: async () => paidSuccess,
      },
      walletAdapter: {
        prepareForPayment: async () => ({
          ok: true,
          account: "0x0000000000000000000000000000000000000001",
          chainId: 84532,
        }),
        signPayment: async () => ({
          signatureHeader: "opaque-payment-header",
        }),
      },
    });

    await expect(
      coordinator.requestPaidAccess(request, preAborted.signal),
    ).resolves.toEqual({ type: "cancelled", reason: "abort" });

    const controller = new AbortController();
    const terminal = coordinator.requestPaidAccess(request, controller.signal);
    controller.abort();
    await expect(terminal).resolves.toEqual({
      type: "cancelled",
      reason: "abort",
    });
    resolveAttempt?.(attempt);
    await flush();
    expect(coordinator.getSnapshot()).toEqual({
      type: "cancelled",
      reason: "abort",
    });
  });
});
