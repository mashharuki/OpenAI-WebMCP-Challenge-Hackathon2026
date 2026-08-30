import { encodePaymentResponseHeader } from "@x402/core/http";
import { describe, expect, it } from "vitest";
import type { PremiumAnalysisRequest } from "../../../src/adgate/contracts.js";
import type { ParsedPaymentChallenge } from "../../../src/adgate/payment/challenge.js";
import { createPaymentClient } from "../../../src/adgate/payment/paymentClient.js";

const asset = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const request: PremiumAnalysisRequest = {
  requestId: "request-paid-retry",
  idempotencyKey: "idempotency-key-paid-retry",
  resourceId: "recipe_analysis",
  input: { recipeId: "roasted-chickpea-quinoa-bowl" },
};
const parsedChallenge: ParsedPaymentChallenge = {
  requestId: request.requestId,
  requirements: [
    {
      scheme: "exact",
      network: "eip155:84532",
      amount: "10000",
      asset,
      payTo: "0x0000000000000000000000000000000000000001",
      maxTimeoutSeconds: 60,
      resource: "recipe_analysis",
      extra: { name: "USDC", version: "2" },
    },
  ],
};
const success = {
  ok: true as const,
  requestId: request.requestId,
  resourceId: "recipe_analysis" as const,
  access: {
    kind: "x402_payment" as const,
    referenceId: `0x${"1".repeat(64)}`,
  },
  data: {
    summary: "Paid analysis.",
    nutritionalInsights: ["A paid insight."],
    suggestions: ["A paid suggestion."],
    disclaimer: "General information only.",
  },
};

describe("PaymentClient", () => {
  it("coalesces concurrent retries while preserving the original identity and body", async () => {
    const calls: Array<{ body: string | null; headers: Headers }> = [];
    const client = createPaymentClient({
      challengeClient: {
        request: async () => ({ type: "challenge", value: parsedChallenge }),
      },
      endpoint: "/api/recipe-analysis",
      fetch: async (_input, init) => {
        calls.push({
          body: typeof init?.body === "string" ? init.body : null,
          headers: new Headers(init?.headers),
        });
        return Response.json(success, {
          headers: {
            "Payment-Response": encodePaymentResponseHeader({
              success: true,
              transaction: `0x${"1".repeat(64)}`,
              network: "eip155:84532",
              amount: "10000",
            }),
          },
        });
      },
      now: () => new Date("2026-08-30T00:00:10.000Z"),
    });
    const attempt = await client.createAttempt(request);

    const first = client.retryWithPayment(attempt, "opaque-payment-header");
    const second = client.retryWithPayment(attempt, "opaque-payment-header");

    await expect(first).resolves.toEqual({
      result: success,
      receipt: {
        resourceId: "recipe_analysis",
        paymentRequestId: "request-paid-retry",
        transactionHash: `0x${"1".repeat(64)}`,
        network: "eip155:84532",
        asset,
        amount: "10000",
        confirmedAt: "2026-08-30T00:00:10.000Z",
      },
    });
    await expect(second).resolves.toEqual(await first);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.body).toBe(JSON.stringify(request));
    expect(calls[0]?.headers.get("Idempotency-Key")).toBe(
      "idempotency-key-paid-retry",
    );
    expect(calls[0]?.headers.get("Payment-Signature")).toBe(
      "opaque-payment-header",
    );
  });

  it("rejects a mutated attempt without sending a paid retry", async () => {
    let fetchCalls = 0;
    const client = createPaymentClient({
      challengeClient: {
        request: async () => ({ type: "challenge", value: parsedChallenge }),
      },
      endpoint: "/api/recipe-analysis",
      fetch: async () => {
        fetchCalls += 1;
        throw new Error("must not fetch");
      },
    });
    const attempt = await client.createAttempt(request);
    attempt.request.requestId = "changed-request";

    await expect(
      client.retryWithPayment(attempt, "opaque-payment-header"),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "IDEMPOTENCY_CONFLICT", retryable: false },
    });
    expect(fetchCalls).toBe(0);
  });

  it("keeps an uncertain settlement retryable without generating another payment", async () => {
    let fetchCalls = 0;
    const client = createPaymentClient({
      challengeClient: {
        request: async () => ({ type: "challenge", value: parsedChallenge }),
      },
      endpoint: "/api/recipe-analysis",
      fetch: async () => {
        fetchCalls += 1;
        return Response.json(success);
      },
    });
    const attempt = await client.createAttempt(request);

    await expect(
      client.retryWithPayment(attempt, "one-payment-header"),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "The settlement result is uncertain.",
        retryable: true,
      },
    });
    expect(fetchCalls).toBe(1);
  });
});
