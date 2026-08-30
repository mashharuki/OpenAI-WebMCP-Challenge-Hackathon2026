import { describe, expect, it } from "vitest";
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
      paymentProtection,
      premiumHandler: async () => {
        throw new Error("unpaid request must not execute the handler");
      },
    });

    const response = await app.request("/api/recipe-analysis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "idempotency-key-123",
      },
      body: JSON.stringify({
        requestId: "request-123",
        idempotencyKey: "idempotency-key-123",
        resourceId: "recipe_analysis",
        input: { recipeId: "roasted-chickpea-quinoa-bowl" },
      }),
    });

    expect(response.status).toBe(402);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ x402Version: 2 });
  });
});
