import { Hono, type MiddlewareHandler } from "hono";
import {
  type AccessEvidence,
  type AdGateErrorEnvelope,
  type PremiumAnalysisRequest,
  type PremiumAnalysisSuccess,
  premiumAnalysisRequestSchema,
} from "./contracts.js";
import type { PaymentProtectionService } from "./paymentProtection.js";
import type { PaymentReadinessState } from "./readiness.js";
import type { SponsorAuthorizer } from "./sponsorAuthorization.js";

export type PremiumAnalysisHandler = (
  request: PremiumAnalysisRequest,
  evidence: AccessEvidence,
) => Promise<PremiumAnalysisSuccess | AdGateErrorEnvelope>;

export interface PreviewMountPolicy {
  readonly environment: "development" | "test" | "production";
  readonly explicitlyEnabled: boolean;
}

export const shouldMountPreview = (policy: PreviewMountPolicy): boolean =>
  policy.environment !== "production" && policy.explicitlyEnabled;

type RecipeAnalysisAppDependencies = {
  httpPolicy: MiddlewareHandler;
  paymentProtection: PaymentProtectionService;
  paymentReadiness: Promise<PaymentReadinessState>;
  preview?: PreviewMountPolicy & { router: Hono };
  premiumHandler: PremiumAnalysisHandler;
  sponsorAuthorizer: SponsorAuthorizer;
};

const errorResponse = (
  status: number,
  error: AdGateErrorEnvelope["error"],
): Response =>
  Response.json(
    { ok: false, error },
    { status, headers: { "Cache-Control": "no-store" } },
  );

export const createRecipeAnalysisApp = ({
  httpPolicy,
  paymentProtection,
  paymentReadiness,
  preview,
  premiumHandler,
  sponsorAuthorizer,
}: RecipeAnalysisAppDependencies): Hono => {
  const app = new Hono();

  app.get("/health", (context) => context.json({ report: { status: "OK" } }));
  app.use("/api/*", httpPolicy);
  if (preview && shouldMountPreview(preview)) {
    app.route("/api/recipe-analysis/preview", preview.router);
  }

  app.post("/api/recipe-analysis", async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return errorResponse(400, {
        code: "INVALID_INPUT",
        message: "The request body must be valid JSON.",
        retryable: false,
      });
    }

    const parsed = premiumAnalysisRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(400, {
        code: "INVALID_INPUT",
        message: "The recipe analysis request is invalid.",
        retryable: false,
      });
    }

    const idempotencyKey = context.req.header("Idempotency-Key");
    if (!idempotencyKey) {
      return errorResponse(400, {
        code: "INVALID_INPUT",
        message: "Idempotency-Key is required.",
        retryable: false,
      });
    }
    if (idempotencyKey !== parsed.data.idempotencyKey) {
      return errorResponse(409, {
        code: "IDEMPOTENCY_CONFLICT",
        message: "Idempotency-Key does not match the request body.",
        retryable: false,
      });
    }

    if (context.req.raw.headers.has("Authorization")) {
      return sponsorAuthorizer.handle(
        { request: context.req.raw, parsedRequest: parsed.data },
        premiumHandler,
      );
    }

    let readiness: PaymentReadinessState;
    try {
      readiness = await paymentReadiness;
    } catch {
      return errorResponse(503, {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "Payment verification is temporarily unavailable.",
        retryable: true,
      });
    }
    if (readiness.type === "unavailable") {
      return errorResponse(503, readiness.error);
    }

    return paymentProtection.handle(
      { request: context.req.raw, parsedRequest: parsed.data },
      premiumHandler,
    );
  });

  return app;
};
