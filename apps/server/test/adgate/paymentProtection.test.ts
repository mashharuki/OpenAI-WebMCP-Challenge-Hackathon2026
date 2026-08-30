import { describe, expect, it } from "vitest";
import type { PremiumAnalysisRequest } from "../../src/adgate/contracts.js";
import { createProtectedAttemptRegistry } from "../../src/adgate/idempotency.js";
import { createPaymentProtection } from "../../src/adgate/paymentProtection.js";

const parsedRequest: PremiumAnalysisRequest = {
  requestId: "request-123",
  idempotencyKey: "idempotency-key-123",
  resourceId: "recipe_analysis",
  input: { recipeId: "roasted-chickpea-quinoa-bowl" },
};

describe("PaymentProtectionService", () => {
  it("returns one payment challenge without invoking the premium handler", async () => {
    let handlerCalled = false;
    const protection = createPaymentProtection({
      registry: createProtectedAttemptRegistry({ now: () => 0 }),
      payment: {
        authorize: async () => ({
          type: "challenge",
          response: new Response(
            JSON.stringify({
              x402Version: 2,
              accepts: [
                {
                  scheme: "exact",
                  network: "eip155:84532",
                  amount: "10000",
                },
              ],
            }),
            { status: 402 },
          ),
        }),
      },
    });

    const response = await protection.handle(
      {
        request: new Request("https://api.example/api/recipe-analysis", {
          method: "POST",
        }),
        parsedRequest,
      },
      async () => {
        handlerCalled = true;
        throw new Error("must not execute without payment");
      },
    );

    expect(response.status).toBe(402);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(handlerCalled).toBe(false);
    expect(await response.json()).toMatchObject({
      x402Version: 2,
      accepts: [{ scheme: "exact", network: "eip155:84532" }],
    });
  });

  it("authorizes a paid request inside the registry before running the handler", async () => {
    const evidence = {
      kind: "x402_payment" as const,
      resourceId: "recipe_analysis" as const,
      paymentRequestId: "payment-request-123",
      transactionHash:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      network: "eip155:84532" as const,
      asset: "0x2222222222222222222222222222222222222222",
      amount: "10000",
      confirmedAt: "2026-08-30T00:00:10.000Z",
    };
    let authorizations = 0;
    let handlerCalls = 0;
    const protection = createPaymentProtection({
      registry: createProtectedAttemptRegistry({ now: () => 0 }),
      payment: {
        authorize: async () => {
          authorizations += 1;
          return {
            type: "authorized",
            evidence,
            responseHeaders: { "payment-response": "opaque-settlement" },
          };
        },
      },
    });

    const paidRequest = () =>
      new Request("https://api.example/api/recipe-analysis", {
        method: "POST",
        headers: { "payment-signature": "opaque-signed-payment" },
      });
    const handler = async (
      request: PremiumAnalysisRequest,
      paidEvidence: typeof evidence,
    ) => {
      handlerCalls += 1;
      expect(request).toEqual(parsedRequest);
      expect(paidEvidence).toEqual(evidence);
      return {
        ok: true,
        requestId: request.requestId,
        resourceId: "recipe_analysis",
        access: {
          kind: "x402_payment",
          referenceId: paidEvidence.transactionHash,
        },
        data: {
          summary: "A balanced plant-forward bowl.",
          nutritionalInsights: ["Chickpeas and quinoa provide protein."],
          suggestions: ["Add citrus for brightness."],
          disclaimer: "General information only; not medical advice.",
        },
      };
    };
    const response = await protection.handle(
      { request: paidRequest(), parsedRequest },
      handler,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("payment-response")).toBe("opaque-settlement");
    expect(await response.json()).toMatchObject({
      ok: true,
      requestId: "request-123",
      access: { kind: "x402_payment" },
    });
    expect(authorizations).toBe(1);
    expect(handlerCalls).toBe(1);

    const replay = await protection.handle(
      { request: paidRequest(), parsedRequest },
      async () => {
        throw new Error("cached retry must not execute the handler");
      },
    );
    expect(replay.status).toBe(200);
    expect(authorizations).toBe(1);
    expect(handlerCalls).toBe(1);
  });

  it("rejects changed paid retries before authorizing another payment", async () => {
    let authorizations = 0;
    const evidence = {
      kind: "x402_payment" as const,
      resourceId: "recipe_analysis" as const,
      paymentRequestId: "payment-request-123",
      transactionHash:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      network: "eip155:84532" as const,
      asset: "0x2222222222222222222222222222222222222222",
      amount: "10000",
      confirmedAt: "2026-08-30T00:00:10.000Z",
    };
    const protection = createPaymentProtection({
      registry: createProtectedAttemptRegistry({ now: () => 0 }),
      payment: {
        authorize: async () => {
          authorizations += 1;
          return { type: "authorized", evidence };
        },
      },
    });
    const request = (signature: string) =>
      new Request("https://api.example/api/recipe-analysis", {
        method: "POST",
        headers: { "payment-signature": signature },
      });
    const handler = async (value: PremiumAnalysisRequest) => ({
      ok: true as const,
      requestId: value.requestId,
      resourceId: "recipe_analysis" as const,
      access: { kind: "x402_payment" as const, referenceId: "0xreceipt" },
      data: {
        summary: "A balanced plant-forward bowl.",
        nutritionalInsights: ["Plant protein."],
        suggestions: ["Add citrus."],
        disclaimer: "General information only.",
      },
    });

    expect(
      (
        await protection.handle(
          { request: request("signature-one"), parsedRequest },
          handler,
        )
      ).status,
    ).toBe(200);
    const changedBody = await protection.handle(
      {
        request: request("signature-one"),
        parsedRequest: {
          ...parsedRequest,
          input: {
            ...parsedRequest.input,
            dietaryGoals: ["lower sodium"],
          },
        },
      },
      handler,
    );
    const changedEvidence = await protection.handle(
      { request: request("signature-two"), parsedRequest },
      handler,
    );

    expect(changedBody.status).toBe(409);
    expect(changedEvidence.status).toBe(409);
    expect(authorizations).toBe(1);
  });

  it("sanitizes payment dependency failures without running the handler", async () => {
    const protection = createPaymentProtection({
      registry: createProtectedAttemptRegistry({ now: () => 0 }),
      payment: {
        authorize: async () => {
          throw new Error("PAYMENT_SIGNATURE=secret raw facilitator response");
        },
      },
    });
    let handlerCalled = false;

    const response = await protection.handle(
      {
        request: new Request("https://api.example/api/recipe-analysis", {
          method: "POST",
        }),
        parsedRequest,
      },
      async () => {
        handlerCalled = true;
        throw new Error("must not run");
      },
    );

    expect(response.status).toBe(503);
    expect(handlerCalled).toBe(false);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "Payment verification is temporarily unavailable.",
        retryable: true,
      },
    });
  });
});
