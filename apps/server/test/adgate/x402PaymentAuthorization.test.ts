import type { x402HTTPResourceServer } from "@x402/core/server";
import { describe, expect, it } from "vitest";
import { createX402PaymentAuthorization } from "../../src/adgate/x402PaymentAuthorization.js";

describe("x402 payment authorization adapter", () => {
  it("preserves the SDK payment challenge response", async () => {
    const calls: string[] = [];
    const httpServer = {
      initialize: async () => {
        calls.push("initialize");
      },
      processHTTPRequest: async () => {
        calls.push("process");
        return {
          type: "payment-error" as const,
          response: {
            status: 402,
            headers: {
              "Content-Type": "application/json",
              "payment-required": "opaque-challenge",
            },
            body: { x402Version: 2, error: "Payment required" },
          },
        };
      },
    } as unknown as x402HTTPResourceServer;
    const authorization = createX402PaymentAuthorization({
      httpServer,
      now: () => new Date("2026-08-30T00:00:00.000Z"),
    });

    const result = await authorization.authorize(
      new Request("https://api.example/api/recipe-analysis", {
        method: "POST",
      }),
      { paymentRequestId: "request-123", resourceId: "recipe_analysis" },
    );

    expect(result.type).toBe("challenge");
    expect(calls).toEqual(["initialize", "process"]);
    if (result.type !== "challenge") return;
    expect(result.response.status).toBe(402);
    expect(result.response.headers.get("payment-required")).toBe(
      "opaque-challenge",
    );
    expect(await result.response.json()).toEqual({
      x402Version: 2,
      error: "Payment required",
    });
  });

  it("settles a verified payment and returns canonical evidence", async () => {
    const requirements = {
      scheme: "exact",
      network: "eip155:84532" as const,
      asset: "0x2222222222222222222222222222222222222222",
      amount: "10000",
      payTo: "0x3333333333333333333333333333333333333333",
      maxTimeoutSeconds: 60,
      extra: { name: "USDC", version: "2" },
    };
    const httpServer = {
      initialize: async () => undefined,
      processHTTPRequest: async () => ({
        type: "payment-verified" as const,
        cancellationDispatcher: { cancel: async () => undefined },
        paymentPayload: {
          x402Version: 2,
          accepted: requirements,
          payload: { authorization: "opaque" },
        },
        paymentRequirements: requirements,
      }),
      processSettlement: async () => ({
        success: true as const,
        transaction:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        network: "eip155:84532" as const,
        amount: "10000",
        headers: { "payment-response": "opaque-settlement" },
        requirements,
      }),
    } as unknown as x402HTTPResourceServer;
    const authorization = createX402PaymentAuthorization({
      httpServer,
      now: () => new Date("2026-08-30T00:00:10.000Z"),
    });

    await expect(
      authorization.authorize(
        new Request("https://api.example/api/recipe-analysis", {
          method: "POST",
          headers: { "payment-signature": "opaque-signed-payment" },
        }),
        { paymentRequestId: "request-123", resourceId: "recipe_analysis" },
      ),
    ).resolves.toEqual({
      type: "authorized",
      evidence: {
        kind: "x402_payment",
        resourceId: "recipe_analysis",
        paymentRequestId: "request-123",
        transactionHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        network: "eip155:84532",
        asset: "0x2222222222222222222222222222222222222222",
        amount: "10000",
        confirmedAt: "2026-08-30T00:00:10.000Z",
      },
      responseHeaders: { "payment-response": "opaque-settlement" },
    });
  });

  it("logs a bounded settlement reason before returning dependency unavailable", async () => {
    const warnings: string[] = [];
    const requirements = {
      scheme: "exact",
      network: "eip155:84532" as const,
      asset: "0x2222222222222222222222222222222222222222",
      amount: "10000",
      payTo: "0x3333333333333333333333333333333333333333",
      maxTimeoutSeconds: 60,
      extra: { name: "USDC", version: "2" },
    };
    const httpServer = {
      initialize: async () => undefined,
      processHTTPRequest: async () => ({
        type: "payment-verified" as const,
        paymentPayload: {
          x402Version: 2,
          accepted: requirements,
          payload: { authorization: "opaque" },
        },
        paymentRequirements: requirements,
      }),
      processSettlement: async () => ({
        success: false as const,
        errorReason: "settlement_pending",
        transaction:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        network: "eip155:84532" as const,
      }),
    } as unknown as x402HTTPResourceServer;
    const authorization = createX402PaymentAuthorization({
      httpServer,
      logger: { warn: (event) => warnings.push(event) },
    });

    const result = await authorization.authorize(
      new Request("https://api.example/api/recipe-analysis", {
        method: "POST",
        headers: { "payment-signature": "opaque-signed-payment" },
      }),
      { paymentRequestId: "request-123", resourceId: "recipe_analysis" },
    );

    expect(result).toEqual({
      type: "error",
      error: {
        ok: false,
        error: {
          code: "DEPENDENCY_UNAVAILABLE",
          message: "Payment settlement is temporarily unavailable.",
          retryable: true,
        },
      },
    });
    expect(warnings).toEqual([
      "resource.payment.settlement.failed.settlement_pending",
    ]);
  });
});
