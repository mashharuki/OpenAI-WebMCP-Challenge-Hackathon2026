import { serve } from "@hono/node-server";
import { x402HTTPResourceServer } from "@x402/hono";
import { createProtectedAttemptRegistry } from "./adgate/idempotency.js";
import { createPaymentProtection } from "./adgate/paymentProtection.js";
import { premiumAnalysisHandler } from "./adgate/premiumAnalysis.js";
import { createRecipeAnalysisApp } from "./adgate/recipeAnalysisApp.js";
import { createX402PaymentAuthorization } from "./adgate/x402PaymentAuthorization.js";
import { paymentFacilitatorUrl, x402Config } from "./config.js";
import { createFacilitatorClient } from "./facilitator.js";
import { createResourceServer } from "./resourceServer.js";

const facilitatorClient = createFacilitatorClient(paymentFacilitatorUrl);
const resourceServer = createResourceServer(facilitatorClient);
const httpServer = new x402HTTPResourceServer(resourceServer, x402Config);
const payment = createX402PaymentAuthorization({ httpServer });
const registry = createProtectedAttemptRegistry();
const paymentProtection = createPaymentProtection({ registry, payment });
const app = createRecipeAnalysisApp({
  paymentProtection,
  premiumHandler: premiumAnalysisHandler,
});

serve({ fetch: app.fetch, port: 4021 });
