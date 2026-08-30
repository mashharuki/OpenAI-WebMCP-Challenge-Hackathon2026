import { describe, expect, it } from "vitest";
import { createPaymentHttpPolicy } from "../../src/adgate/cors.js";
import { createProtectedAttemptRegistry } from "../../src/adgate/idempotency.js";
import { createPaymentProtection } from "../../src/adgate/paymentProtection.js";
import { createRecipeAnalysisApp } from "../../src/adgate/recipeAnalysisApp.js";

describe("recipe analysis route composition", () => {
  it("returns the payment challenge for a valid unauthenticated request", async () => {
    const paymentProtection = createPaymentProtection({
      registry: createProtectedAttemptRegistry({ now: () => 0 }),
      payment: {
        authorize: async () => ({
          type: "challenge",
          response: Response.json(
            {
              x402Version: 2,
              accepts: [
                {
                  scheme: "exact",
                  network: "eip155:84532",
                  amount: "10000",
                },
              ],
            },
            { status: 402 },
          ),
        }),
      },
    });
    const app = createRecipeAnalysisApp({
      httpPolicy: createPaymentHttpPolicy({
        allowedOrigins: ["https://demo.example"],
      }),
      paymentProtection,
      paymentReadiness: Promise.resolve({ type: "ready" }),
      premiumHandler: async () => {
        throw new Error("unpaid request must not execute the handler");
      },
    });

    const response = await app.request("/api/recipe-analysis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "idempotency-key-123",
        Origin: "https://demo.example",
      },
      body: JSON.stringify({
        requestId: "request-123",
        idempotencyKey: "idempotency-key-123",
        resourceId: "recipe_analysis",
        input: { recipeId: "roasted-chickpea-quinoa-bowl" },
      }),
    });

    expect(response.status).toBe(402);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://demo.example",
    );
    expect(response.headers.get("access-control-expose-headers")).toBe(
      "Payment-Required, Payment-Response, X-Payment-Response",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("vary")).toBe("Origin");
    expect(await response.json()).toMatchObject({ x402Version: 2 });
  });

  it("keeps process health available while the paid route is unavailable", async () => {
    let paymentCalls = 0;
    const app = createRecipeAnalysisApp({
      httpPolicy: createPaymentHttpPolicy({
        allowedOrigins: ["https://demo.example"],
      }),
      paymentProtection: {
        handle: async () => {
          paymentCalls += 1;
          throw new Error("unavailable payment must not be authorized");
        },
      },
      paymentReadiness: Promise.resolve({
        type: "unavailable",
        error: {
          code: "DEPENDENCY_UNAVAILABLE",
          message: "Payment verification is temporarily unavailable.",
          retryable: true,
        },
      }),
      premiumHandler: async () => {
        throw new Error("unavailable payment must not execute the handler");
      },
    });

    const healthResponse = await app.request("/health");
    expect(healthResponse.status).toBe(200);

    const paymentResponse = await app.request("/api/recipe-analysis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "idempotency-key-123",
        Origin: "https://demo.example",
      },
      body: JSON.stringify({
        requestId: "request-123",
        idempotencyKey: "idempotency-key-123",
        resourceId: "recipe_analysis",
        input: { recipeId: "roasted-chickpea-quinoa-bowl" },
      }),
    });

    expect(paymentResponse.status).toBe(503);
    expect(await paymentResponse.json()).toEqual({
      ok: false,
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "Payment verification is temporarily unavailable.",
        retryable: true,
      },
    });
    expect(paymentCalls).toBe(0);
  });
});
