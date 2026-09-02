import type {
  HTTPAdapter,
  HTTPResponseInstructions,
  x402HTTPResourceServer,
} from "@x402/core/server";
import { paymentAccessEvidenceSchema } from "./contracts.js";
import type { PaymentAuthorizationPort } from "./paymentProtection.js";

const createRequestAdapter = (request: Request): HTTPAdapter => {
  const url = new URL(request.url);
  return {
    getHeader: (name) => request.headers.get(name) ?? undefined,
    getMethod: () => request.method,
    getPath: () => url.pathname,
    getUrl: () => request.url,
    getAcceptHeader: () => request.headers.get("accept") ?? "application/json",
    getUserAgent: () => request.headers.get("user-agent") ?? "",
  };
};

const responseFromInstructions = (
  instructions: HTTPResponseInstructions,
): Response => {
  const headers = new Headers(instructions.headers);
  const body =
    typeof instructions.body === "string"
      ? instructions.body
      : JSON.stringify(instructions.body ?? {});
  return new Response(body, { status: instructions.status, headers });
};

type X402PaymentAuthorizationDependencies = {
  httpServer: x402HTTPResourceServer;
  now?: () => Date;
  logger?: { warn(event: string): void };
};

const defaultLogger = {
  warn: (event: string) => console.warn(event),
};

const safeReasonPattern = /^[a-z][a-z0-9_]{2,80}$/;

export const settlementFailureEvent = (reason?: string): string =>
  reason && safeReasonPattern.test(reason)
    ? `resource.payment.settlement.failed.${reason}`
    : "resource.payment.settlement.failed";

export const createX402PaymentAuthorization = ({
  httpServer,
  now = () => new Date(),
  logger = defaultLogger,
}: X402PaymentAuthorizationDependencies): PaymentAuthorizationPort => {
  let initialization: Promise<void> | undefined;
  const initialize = async (): Promise<void> => {
    if (!initialization) {
      initialization = httpServer.initialize().catch((error: unknown) => {
        initialization = undefined;
        throw error;
      });
    }
    return initialization;
  };

  return {
    async authorize(request, authorizationContext) {
      await initialize();
      const adapter = createRequestAdapter(request);
      const requestContext = {
        adapter,
        path: adapter.getPath(),
        method: adapter.getMethod(),
        paymentHeader:
          adapter.getHeader("payment-signature") ??
          adapter.getHeader("x-payment"),
      };
      const result = await httpServer.processHTTPRequest(requestContext);

      if (result.type === "payment-error") {
        return {
          type: "challenge",
          response: responseFromInstructions(result.response),
        };
      }

      if (result.type === "payment-verified") {
        const settlement = await httpServer.processSettlement(
          result.paymentPayload,
          result.paymentRequirements,
          result.declaredExtensions,
          { request: requestContext },
          undefined,
          result.beforeHandlerSettlement,
          "after-handler",
        );
        if (!settlement.success) {
          logger.warn(settlementFailureEvent(settlement.errorReason));
          return {
            type: "error",
            error: {
              ok: false,
              error: {
                code: "DEPENDENCY_UNAVAILABLE",
                message: "Payment settlement is temporarily unavailable.",
                retryable: true,
              },
            },
          };
        }

        const evidence = paymentAccessEvidenceSchema.safeParse({
          kind: "x402_payment",
          resourceId: authorizationContext.resourceId,
          paymentRequestId: authorizationContext.paymentRequestId,
          transactionHash: settlement.transaction,
          network: settlement.network,
          asset: settlement.requirements.asset,
          amount: settlement.amount ?? settlement.requirements.amount,
          confirmedAt: now().toISOString(),
        });
        if (!evidence.success) {
          return {
            type: "error",
            error: {
              ok: false,
              error: {
                code: "INVALID_EVIDENCE",
                message: "Payment settlement evidence is invalid.",
                retryable: false,
              },
            },
          };
        }

        return {
          type: "authorized",
          evidence: evidence.data,
          responseHeaders: settlement.headers,
        };
      }

      return {
        type: "error",
        error: {
          ok: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "The payment response could not be processed safely.",
            retryable: false,
          },
        },
      };
    },
  };
};
