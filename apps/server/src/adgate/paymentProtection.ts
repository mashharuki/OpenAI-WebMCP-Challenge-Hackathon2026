import { createHash } from "node:crypto";
import type {
  AdGateErrorEnvelope,
  PaymentAccessEvidence,
  PremiumAnalysisRequest,
  PremiumAnalysisSuccess,
} from "./contracts.js";
import type { ProtectedAttemptRegistry } from "./idempotency.js";

export type PaymentAuthorizationResult =
  | { type: "challenge"; response: Response }
  | {
      type: "authorized";
      evidence: PaymentAccessEvidence;
      responseHeaders?: Record<string, string>;
    }
  | { type: "error"; error: AdGateErrorEnvelope };

export interface PaymentAuthorizationPort {
  authorize(
    request: Request,
    context: {
      paymentRequestId: string;
      resourceId: "recipe_analysis";
    },
  ): Promise<PaymentAuthorizationResult>;
}

export type PaymentAuthorizedHandler = (
  request: PremiumAnalysisRequest,
  evidence: PaymentAccessEvidence,
) => Promise<PremiumAnalysisSuccess | AdGateErrorEnvelope>;

export interface PaymentProtectionService {
  handle(
    input: { request: Request; parsedRequest: PremiumAnalysisRequest },
    next: PaymentAuthorizedHandler,
  ): Promise<Response>;
}

type PaymentProtectionDependencies = {
  registry: ProtectedAttemptRegistry;
  payment: PaymentAuthorizationPort;
};

const digest = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const canonicalRequestBody = (request: PremiumAnalysisRequest): string =>
  JSON.stringify({
    requestId: request.requestId,
    idempotencyKey: request.idempotencyKey,
    resourceId: request.resourceId,
    input: {
      recipeId: request.input.recipeId,
      ...(request.input.dietaryGoals
        ? { dietaryGoals: request.input.dietaryGoals }
        : {}),
    },
  });

const statusForResult = (
  result: PremiumAnalysisSuccess | AdGateErrorEnvelope,
): number => {
  if (result.ok) return 200;
  switch (result.error.code) {
    case "INVALID_INPUT":
      return 400;
    case "INVALID_EVIDENCE":
      return 401;
    case "ACCESS_REQUIRED":
      return 402;
    case "IDEMPOTENCY_CONFLICT":
    case "ACCESS_REUSED":
      return 409;
    case "ACCESS_EXPIRED":
      return 410;
    case "DEPENDENCY_UNAVAILABLE":
      return 503;
    default:
      return 500;
  }
};

const dependencyUnavailable = (): AdGateErrorEnvelope => ({
  ok: false,
  error: {
    code: "DEPENDENCY_UNAVAILABLE",
    message: "Payment verification is temporarily unavailable.",
    retryable: true,
  },
});

const resultResponse = (
  result: PremiumAnalysisSuccess | AdGateErrorEnvelope,
  headers?: Record<string, string>,
): Response => {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "no-store");
  return Response.json(result, {
    status: statusForResult(result),
    headers: responseHeaders,
  });
};

const withNoStore = (response: Response): Response => {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export const createPaymentProtection = ({
  registry,
  payment,
}: PaymentProtectionDependencies): PaymentProtectionService => ({
  async handle({ request, parsedRequest }, next) {
    const paymentHeader =
      request.headers.get("payment-signature") ??
      request.headers.get("x-payment");
    if (!paymentHeader) {
      let authorization: PaymentAuthorizationResult;
      try {
        authorization = await payment.authorize(request, {
          paymentRequestId: parsedRequest.requestId,
          resourceId: parsedRequest.resourceId,
        });
      } catch {
        return resultResponse(dependencyUnavailable());
      }
      if (authorization.type === "challenge") {
        return withNoStore(authorization.response);
      }
      if (authorization.type === "error") {
        return resultResponse(authorization.error);
      }
      return resultResponse({
        ok: false,
        error: {
          code: "INVALID_EVIDENCE",
          message: "Payment evidence is missing.",
          retryable: false,
        },
      });
    }

    let result: PremiumAnalysisSuccess | AdGateErrorEnvelope;
    let responseHeaders: Record<string, string> | undefined;
    try {
      result = await registry.execute(
        {
          idempotencyKey: parsedRequest.idempotencyKey,
          requestDigest: digest(canonicalRequestBody(parsedRequest)),
          evidenceFingerprint: digest(paymentHeader),
        },
        async () => {
          const authorization = await payment.authorize(request, {
            paymentRequestId: parsedRequest.requestId,
            resourceId: parsedRequest.resourceId,
          });
          if (authorization.type === "authorized") {
            responseHeaders = authorization.responseHeaders;
            return next(parsedRequest, authorization.evidence);
          }
          if (authorization.type === "error") return authorization.error;
          return {
            ok: false,
            error: {
              code: "ACCESS_REQUIRED",
              message: "A valid payment is required.",
              retryable: true,
            },
          };
        },
      );
    } catch {
      result = dependencyUnavailable();
    }

    return resultResponse(result, responseHeaders);
  },
});
