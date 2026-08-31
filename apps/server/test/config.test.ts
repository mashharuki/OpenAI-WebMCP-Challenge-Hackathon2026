import { describe, expect, it } from "vitest";
import { createPaymentRuntimeConfig } from "../src/config.js";

const environment = {
  ALLOWED_ORIGINS: "https://frontend.example.com",
  EVM_ADDRESS: "0x0000000000000000000000000000000000000001",
  FACILITATOR_URL: "https://facilitator.example.com",
};

describe("createPaymentRuntimeConfig", () => {
  it("builds the x402 configuration from injected Worker bindings", () => {
    const config = createPaymentRuntimeConfig(environment);

    expect(config.paymentAllowedOrigins).toEqual([
      "https://frontend.example.com",
    ]);
    expect(config.paymentFacilitatorUrl).toBe(
      "https://facilitator.example.com",
    );
    expect(config.x402Config["POST /api/recipe-analysis"]).toMatchObject({
      accepts: [{ payTo: environment.EVM_ADDRESS }],
      mimeType: "application/json",
    });
  });

  it("permits a loopback facilitator only for the development entry point", () => {
    const localEnvironment = {
      ...environment,
      FACILITATOR_URL: "http://127.0.0.1:4022",
    };

    expect(() => createPaymentRuntimeConfig(localEnvironment)).toThrow(
      "Payment runtime configuration is invalid.",
    );
    expect(() =>
      createPaymentRuntimeConfig(localEnvironment, {
        allowDevelopmentLoopbackHttp: true,
      }),
    ).not.toThrow();
  });
});
