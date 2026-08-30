import { describe, expect, it } from "vitest";
import {
  BASE_SEPOLIA_USDC_ADDRESS,
  type PaymentPolicy,
} from "../../src/adgate/paymentPolicy.js";
import { evaluatePaymentReadiness } from "../../src/adgate/readiness.js";

const policy: PaymentPolicy = {
  resourceId: "recipe_analysis",
  route: "POST /api/recipe-analysis",
  scheme: "exact",
  network: "eip155:84532",
  price: {
    amount: "10000",
    asset: BASE_SEPOLIA_USDC_ADDRESS,
    extra: { name: "USDC", version: "2" },
  },
  payTo: "0x1111111111111111111111111111111111111111",
};

describe("payment readiness", () => {
  it("is ready when the facilitator is healthy and supports Base Sepolia exact", async () => {
    await expect(
      evaluatePaymentReadiness(policy, {
        health: async () => true,
        supported: async () => [{ scheme: "exact", network: "eip155:84532" }],
      }),
    ).resolves.toEqual({ type: "ready" });
  });

  it("fails closed for an unhealthy or incompatible facilitator", async () => {
    const unavailable = {
      type: "unavailable",
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "Payment verification is temporarily unavailable.",
        retryable: true,
      },
    };

    await expect(
      evaluatePaymentReadiness(policy, {
        health: async () => false,
        supported: async () => {
          throw new Error("supported must not run after failed health");
        },
      }),
    ).resolves.toEqual(unavailable);

    await expect(
      evaluatePaymentReadiness(policy, {
        health: async () => true,
        supported: async () => [
          { scheme: "upto", network: "eip155:84532" },
          { scheme: "exact", network: "eip155:4801" },
        ],
      }),
    ).resolves.toEqual(unavailable);
  });

  it("times out a hanging probe without exposing dependency details", async () => {
    const result = await evaluatePaymentReadiness(
      policy,
      {
        health: async () => new Promise<boolean>(() => undefined),
        supported: async () => [],
      },
      undefined,
      5,
    );

    expect(result).toEqual({
      type: "unavailable",
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "Payment verification is temporarily unavailable.",
        retryable: true,
      },
    });
    expect(JSON.stringify(result)).not.toContain("facilitator");
  });
});
