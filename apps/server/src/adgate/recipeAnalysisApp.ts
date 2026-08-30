import { Hono } from "hono";
import {
  type AdGateErrorEnvelope,
  premiumAnalysisRequestSchema,
} from "./contracts.js";
import type {
  PaymentAuthorizedHandler,
  PaymentProtectionService,
} from "./paymentProtection.js";

type RecipeAnalysisAppDependencies = {
  paymentProtection: PaymentProtectionService;
  premiumHandler: PaymentAuthorizedHandler;
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
  paymentProtection,
  premiumHandler,
}: RecipeAnalysisAppDependencies): Hono => {
  const app = new Hono();

  app.get("/health", (context) => context.json({ report: { status: "OK" } }));

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

    if (context.req.header("Authorization")) {
      return errorResponse(503, {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "Sponsor access is not available yet.",
        retryable: true,
      });
    }

    return paymentProtection.handle(
      { request: context.req.raw, parsedRequest: parsed.data },
      premiumHandler,
    );
  });

  return app;
};
