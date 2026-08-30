import { serve } from "@hono/node-server";
import { x402HTTPResourceServer } from "@x402/hono";
import { createPaymentHttpPolicy } from "./adgate/cors.js";
import { createProtectedAttemptRegistry } from "./adgate/idempotency.js";
import { createPaymentProtection } from "./adgate/paymentProtection.js";
import { premiumAnalysisHandler } from "./adgate/premiumAnalysis.js";
import { evaluatePaymentReadiness } from "./adgate/readiness.js";
import { createRecipeAnalysisApp } from "./adgate/recipeAnalysisApp.js";
import { createUnavailableSponsorAuthorizer } from "./adgate/sponsorAuthorization.js";
import { createX402PaymentAuthorization } from "./adgate/x402PaymentAuthorization.js";
import {
  paymentAllowedOrigins,
  paymentFacilitatorUrl,
  paymentPolicy,
  x402Config,
} from "./config.js";
import {
  createFacilitatorCapabilityClient,
  createFacilitatorClient,
} from "./facilitator.js";
import { createResourceServer } from "./resourceServer.js";

const facilitatorClient = createFacilitatorClient(paymentFacilitatorUrl);
const resourceServer = createResourceServer(facilitatorClient);
const httpServer = new x402HTTPResourceServer(resourceServer, x402Config);
const payment = createX402PaymentAuthorization({ httpServer });
const paymentReadiness = evaluatePaymentReadiness(
  paymentPolicy,
  createFacilitatorCapabilityClient(paymentFacilitatorUrl),
);
const registry = createProtectedAttemptRegistry();
const paymentProtection = createPaymentProtection({ registry, payment });
const app = createRecipeAnalysisApp({
  httpPolicy: createPaymentHttpPolicy({
    allowedOrigins: paymentAllowedOrigins,
  }),
  paymentProtection,
  paymentReadiness,
  premiumHandler: premiumAnalysisHandler,
  sponsorAuthorizer: createUnavailableSponsorAuthorizer(),
});

serve({ fetch: app.fetch, port: 4021 });
