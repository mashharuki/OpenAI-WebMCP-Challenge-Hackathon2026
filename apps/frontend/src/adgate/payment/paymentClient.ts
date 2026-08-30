import { decodePaymentResponseHeader } from "@x402/core/http";
import { z } from "zod";
import {
  type AdGateError,
  type AdGateErrorEnvelope,
  adGateErrorEnvelopeSchema,
  type PaymentReceipt,
  type PremiumAnalysisRequest,
  type PremiumAnalysisSuccess,
  paymentReceiptSchema,
  premiumAnalysisSuccessSchema,
} from "../contracts.js";
import type { ChallengeClient, ParsedPaymentChallenge } from "./challenge.js";

const settlementSchema = z
  .object({
    success: z.literal(true),
    transaction: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
    network: z.literal("eip155:84532"),
    amount: z
      .string()
      .regex(/^[1-9][0-9]*$/)
      .optional(),
  })
  .passthrough();

export interface PremiumPaymentAttempt {
  request: PremiumAnalysisRequest;
  readonly canonicalBody: string;
  readonly challenge: ParsedPaymentChallenge;
}

export type PaidAccessSuccess = {
  readonly result: PremiumAnalysisSuccess;
  readonly receipt: PaymentReceipt;
};

export interface PaymentClient {
  createAttempt(
    request: PremiumAnalysisRequest,
    signal?: AbortSignal,
  ): Promise<PremiumPaymentAttempt>;
  retryWithPayment(
    attempt: PremiumPaymentAttempt,
    signatureHeader: string,
    signal?: AbortSignal,
  ): Promise<PaidAccessSuccess | AdGateErrorEnvelope>;
}

export class PaymentClientError extends Error {
  readonly error: AdGateError;

  constructor(error: AdGateError) {
    super(error.message);
    this.name = "PaymentClientError";
    this.error = error;
  }
}

type PaymentClientOptions = {
  readonly challengeClient: ChallengeClient;
  readonly endpoint: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => Date;
};

const errorEnvelope = (
  code: AdGateError["code"],
  message: string,
  retryable: boolean,
): AdGateErrorEnvelope => ({ ok: false, error: { code, message, retryable } });

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

export const createPaymentClient = ({
  challengeClient,
  endpoint,
  fetch: fetchRequest = globalThis.fetch,
  now = () => new Date(),
}: PaymentClientOptions): PaymentClient => {
  const inFlight = new WeakMap<
    PremiumPaymentAttempt,
    Promise<PaidAccessSuccess | AdGateErrorEnvelope>
  >();

  return {
    async createAttempt(request, signal) {
      const challengeResult = await challengeClient.request(request, signal);
      if (challengeResult.type !== "challenge") {
        throw new PaymentClientError(
          challengeResult.type === "error"
            ? challengeResult.value
            : {
                code: "INVALID_TRANSITION",
                message: "Paid access is not required for this request.",
                retryable: false,
              },
        );
      }
      if (challengeResult.value.requestId !== request.requestId) {
        throw new PaymentClientError({
          code: "IDEMPOTENCY_CONFLICT",
          message: "The payment challenge identity does not match the request.",
          retryable: false,
        });
      }

      const canonicalBody = JSON.stringify(request);
      return {
        request: JSON.parse(canonicalBody) as PremiumAnalysisRequest,
        canonicalBody,
        challenge: challengeResult.value,
      };
    },

    retryWithPayment(attempt, signatureHeader, signal) {
      const existing = inFlight.get(attempt);
      if (existing) return existing;

      const operation = (async (): Promise<
        PaidAccessSuccess | AdGateErrorEnvelope
      > => {
        if (
          JSON.stringify(attempt.request) !== attempt.canonicalBody ||
          attempt.challenge.requestId !== attempt.request.requestId ||
          signatureHeader.trim().length === 0
        ) {
          return errorEnvelope(
            "IDEMPOTENCY_CONFLICT",
            "The paid retry identity changed.",
            false,
          );
        }

        let response: Response;
        try {
          response = await fetchRequest(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": attempt.request.idempotencyKey,
              "Payment-Signature": signatureHeader,
            },
            body: attempt.canonicalBody,
            signal,
          });
        } catch {
          return errorEnvelope(
            signal?.aborted ? "CANCELLED" : "DEPENDENCY_UNAVAILABLE",
            signal?.aborted
              ? "The paid retry was cancelled."
              : "The settlement result is uncertain.",
            !signal?.aborted,
          );
        }

        const body = await readJson(response);
        if (!response.ok) {
          const parsedError = adGateErrorEnvelopeSchema.safeParse(body);
          return parsedError.success
            ? parsedError.data
            : errorEnvelope(
                "INVALID_EVIDENCE",
                "The paid retry was not accepted.",
                false,
              );
        }

        const parsedResult = premiumAnalysisSuccessSchema.safeParse(body);
        const settlementHeader =
          response.headers.get("Payment-Response") ??
          response.headers.get("X-Payment-Response");
        if (!parsedResult.success || !settlementHeader) {
          return errorEnvelope(
            "DEPENDENCY_UNAVAILABLE",
            "The settlement result is uncertain.",
            true,
          );
        }

        let settlement: unknown;
        try {
          settlement = decodePaymentResponseHeader(settlementHeader);
        } catch {
          return errorEnvelope(
            "DEPENDENCY_UNAVAILABLE",
            "The settlement result is uncertain.",
            true,
          );
        }
        const parsedSettlement = settlementSchema.safeParse(settlement);
        const requirement = attempt.challenge.requirements[0];
        if (
          !parsedSettlement.success ||
          (parsedSettlement.data.amount !== undefined &&
            parsedSettlement.data.amount !== requirement.amount)
        ) {
          return errorEnvelope(
            "DEPENDENCY_UNAVAILABLE",
            "The settlement result is uncertain.",
            true,
          );
        }

        const receipt = paymentReceiptSchema.parse({
          resourceId: "recipe_analysis",
          paymentRequestId: attempt.request.requestId,
          transactionHash: parsedSettlement.data.transaction,
          network: parsedSettlement.data.network,
          asset: requirement.asset,
          amount: parsedSettlement.data.amount ?? requirement.amount,
          confirmedAt: now().toISOString(),
        });
        return { result: parsedResult.data, receipt };
      })();
      inFlight.set(attempt, operation);
      return operation;
    },
  };
};
