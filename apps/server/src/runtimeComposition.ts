import { x402HTTPResourceServer } from "@x402/hono";
import { createPaymentHttpPolicy } from "./adgate/cors.js";
import { createProtectedAttemptRegistry } from "./adgate/idempotency.js";
import { createPaymentProtection } from "./adgate/paymentProtection.js";
import { premiumAnalysisHandler } from "./adgate/premiumAnalysis.js";
import { evaluatePaymentReadiness } from "./adgate/readiness.js";
import { createSponsorAuthorizer } from "./adgate/sponsorAuthorization.js";
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
import type { DevelopmentRecipeAnalysisDependencies } from "./recipeAnalysis/developmentComposition.js";
import { createResourceServer } from "./resourceServer.js";
import { createSponsorGrantLedger } from "./sponsor/grantLedger.js";
import { createSponsorGrantService } from "./sponsor/grantService.js";
import { createSponsorGrantRoutes } from "./sponsor/routes.js";

export const createRuntimeRecipeAnalysisDependencies =
  (): DevelopmentRecipeAnalysisDependencies => {
    const facilitatorClient = createFacilitatorClient(paymentFacilitatorUrl);
    const resourceServer = createResourceServer(facilitatorClient);
    const httpServer = new x402HTTPResourceServer(resourceServer, x402Config);
    const payment = createX402PaymentAuthorization({ httpServer });
    const paymentReadiness = evaluatePaymentReadiness(
      paymentPolicy,
      createFacilitatorCapabilityClient(paymentFacilitatorUrl),
    );
    const registry = createProtectedAttemptRegistry();
    const sponsorService = createSponsorGrantService({
      ledger: createSponsorGrantLedger(),
    });

    return {
      httpPolicy: createPaymentHttpPolicy({
        allowedOrigins: paymentAllowedOrigins,
      }),
      paymentProtection: createPaymentProtection({ registry, payment }),
      paymentReadiness,
      premiumHandler: premiumAnalysisHandler,
      sponsorAuthorizer: createSponsorAuthorizer({
        registry,
        service: sponsorService,
      }),
      sponsorRoutes: createSponsorGrantRoutes({ service: sponsorService }),
    };
  };
