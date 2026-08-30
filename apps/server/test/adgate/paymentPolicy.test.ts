import { describe, expect, it } from "vitest";
import {
  BASE_SEPOLIA_USDC_ADDRESS,
  validatePaymentRuntime,
} from "../../src/adgate/paymentPolicy.js";

describe("validatePaymentRuntime", () => {
  it("builds the single Base Sepolia exact offer for 0.01 testnet USDC", () => {
    expect(
      validatePaymentRuntime({
        payTo: "0x1111111111111111111111111111111111111111",
        facilitatorUrl: "https://x402.org/facilitator",
      }),
    ).toEqual({
      ok: true,
      policy: {
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
      },
    });
  });

  it("fails closed when required payment configuration is invalid", () => {
    for (const input of [
      { payTo: "", facilitatorUrl: "https://x402.org/facilitator" },
      {
        payTo: "0x1111111111111111111111111111111111111111",
        facilitatorUrl: "file:///tmp/facilitator",
      },
    ]) {
      expect(validatePaymentRuntime(input)).toEqual({
        ok: false,
        error: {
          code: "INVALID_INPUT",
          message: "Payment runtime configuration is invalid.",
          retryable: false,
        },
      });
    }
  });

  it("allows loopback HTTP only when development explicitly opts in", () => {
    const input = {
      payTo: "0x1111111111111111111111111111111111111111",
      facilitatorUrl: "http://localhost:4022",
    };

    expect(validatePaymentRuntime(input).ok).toBe(false);
    expect(
      validatePaymentRuntime(input, { allowDevelopmentLoopbackHttp: true }).ok,
    ).toBe(true);
    expect(
      validatePaymentRuntime(
        { ...input, facilitatorUrl: "http://facilitator.example.com" },
        { allowDevelopmentLoopbackHttp: true },
      ).ok,
    ).toBe(false);
  });
});
