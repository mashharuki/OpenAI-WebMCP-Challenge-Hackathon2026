import { z } from "zod";
import type { AdGateError } from "./contracts.js";

export const BASE_SEPOLIA_USDC_ADDRESS =
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;

export interface PaymentPolicy {
  readonly resourceId: "recipe_analysis";
  readonly route: "POST /api/recipe-analysis";
  readonly scheme: "exact";
  readonly network: "eip155:84532";
  readonly price: {
    readonly amount: "10000";
    readonly asset: typeof BASE_SEPOLIA_USDC_ADDRESS;
    readonly extra: {
      readonly name: "USDC";
      readonly version: "2";
    };
  };
  readonly payTo: `0x${string}`;
}

export type PaymentRuntimeValidation =
  | { ok: true; policy: PaymentPolicy }
  | { ok: false; error: AdGateError };

const paymentRuntimeInputSchema = z
  .object({
    payTo: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    facilitatorUrl: z.string().url(),
  })
  .strict();

export interface PaymentRuntimeValidationOptions {
  readonly allowDevelopmentLoopbackHttp?: boolean;
}

const isAllowedFacilitatorUrl = (
  value: string,
  options: PaymentRuntimeValidationOptions,
) => {
  const url = new URL(value);
  if (url.protocol === "https:") return true;

  return (
    options.allowDevelopmentLoopbackHttp === true &&
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
  );
};

export const validatePaymentRuntime = (
  input: unknown,
  options: PaymentRuntimeValidationOptions = {},
): PaymentRuntimeValidation => {
  const parsed = paymentRuntimeInputSchema.safeParse(input);
  if (
    !parsed.success ||
    !isAllowedFacilitatorUrl(parsed.data.facilitatorUrl, options)
  ) {
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "Payment runtime configuration is invalid.",
        retryable: false,
      },
    };
  }

  return {
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
      payTo: parsed.data.payTo as `0x${string}`,
    },
  };
};
