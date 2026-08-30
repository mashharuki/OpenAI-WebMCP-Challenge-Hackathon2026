import "dotenv/config";
import { validatePaymentRuntime } from "./adgate/paymentPolicy.js";

const payTo = process.env.EVM_ADDRESS;
const facilitatorUrl = process.env.FACILITATOR_URL;
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const validation = validatePaymentRuntime(
  { payTo, facilitatorUrl },
  {
    allowDevelopmentLoopbackHttp: process.env.NODE_ENV === "development",
  },
);

if (!validation.ok || !facilitatorUrl || allowedOrigins.length === 0) {
  throw new Error("Payment runtime configuration is invalid.");
}

export const paymentPolicy = validation.policy;
export const paymentFacilitatorUrl = facilitatorUrl;
export const paymentAllowedOrigins = allowedOrigins;

export const x402Config = {
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
};
