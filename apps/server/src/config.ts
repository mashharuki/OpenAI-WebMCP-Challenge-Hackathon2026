import { validatePaymentRuntime } from "./adgate/paymentPolicy.js";

export type PaymentRuntimeEnvironment = {
  ALLOWED_ORIGINS?: string;
  EVM_ADDRESS?: string;
  FACILITATOR_URL?: string;
};

export type PaymentRuntimeOptions = {
  allowDevelopmentLoopbackHttp?: boolean;
};

export const createPaymentRuntimeConfig = (
  environment: PaymentRuntimeEnvironment,
  options: PaymentRuntimeOptions = {},
) => {
  const payTo = environment.EVM_ADDRESS;
  const facilitatorUrl = environment.FACILITATOR_URL;
  const allowedOrigins = (environment.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const validation = validatePaymentRuntime(
    { payTo, facilitatorUrl },
    {
      allowDevelopmentLoopbackHttp:
        options.allowDevelopmentLoopbackHttp ?? false,
    },
  );

  if (!validation.ok || !facilitatorUrl || allowedOrigins.length === 0) {
    throw new Error("Payment runtime configuration is invalid.");
  }

  const paymentPolicy = validation.policy;

  return {
    paymentAllowedOrigins: allowedOrigins,
    paymentFacilitatorUrl: facilitatorUrl,
    paymentPolicy,
    x402Config: {
      [paymentPolicy.route]: {
        accepts: [
          {
            scheme: paymentPolicy.scheme,
            price: paymentPolicy.price,
            network: paymentPolicy.network,
            payTo: paymentPolicy.payTo,
          },
        ],
        resource: paymentPolicy.resourceId,
        description:
          "Premium nutrition and preparation analysis for the published recipe",
        mimeType: "application/json",
      },
    },
  };
};

export type PaymentRuntimeConfig = ReturnType<
  typeof createPaymentRuntimeConfig
>;
