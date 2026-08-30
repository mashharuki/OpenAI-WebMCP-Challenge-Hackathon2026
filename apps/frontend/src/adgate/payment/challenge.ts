import { decodePaymentRequiredHeader } from "@x402/core/http";
import { z } from "zod";
import {
  type AdGateError,
  adGateErrorEnvelopeSchema,
  type PremiumAnalysisRequest,
  premiumAnalysisSuccessSchema,
} from "../contracts.js";

const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const paymentRequirementSchema = z
  .object({
    scheme: z.literal("exact"),
    network: z.literal("eip155:84532"),
    asset: addressSchema,
    amount: z.string().regex(/^[1-9][0-9]*$/),
    payTo: addressSchema,
    maxTimeoutSeconds: z.number().int().positive(),
    extra: z
      .object({ name: z.literal("USDC"), version: z.literal("2") })
      .passthrough(),
  })
  .passthrough();

const paymentChallengeSchema = z
  .object({
    x402Version: z.literal(2),
    resource: z.object({ url: z.literal("recipe_analysis") }).passthrough(),
    accepts: z.tuple([paymentRequirementSchema]),
  })
  .passthrough();

export interface PaymentRequirement {
  readonly scheme: "exact";
  readonly network: "eip155:84532";
  readonly amount: string;
  readonly asset: `0x${string}`;
  readonly payTo: `0x${string}`;
  readonly maxTimeoutSeconds: number;
  readonly resource: "recipe_analysis";
  readonly extra: { readonly name: "USDC"; readonly version: "2" };
}

export interface ParsedPaymentChallenge {
  readonly requestId: string;
  readonly requirements: readonly [PaymentRequirement];
}

export type ChallengeResult =
  | { type: "challenge"; value: ParsedPaymentChallenge }
  | { type: "success"; value: z.infer<typeof premiumAnalysisSuccessSchema> }
  | { type: "error"; value: AdGateError };

export interface ChallengeClient {
  request(
    input: PremiumAnalysisRequest,
    signal?: AbortSignal,
  ): Promise<ChallengeResult>;
}

type ChallengeClientOptions = {
  readonly endpoint: string;
  readonly acceptedAsset: `0x${string}`;
  readonly fetch?: typeof globalThis.fetch;
};

const invalidChallenge = (): ChallengeResult => ({
  type: "error",
  value: {
    code: "INVALID_EVIDENCE",
    message: "The payment challenge is invalid.",
    retryable: false,
  },
});

const readBody = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

export const createChallengeClient = ({
  acceptedAsset,
  endpoint,
  fetch: fetchRequest = globalThis.fetch,
}: ChallengeClientOptions): ChallengeClient => ({
  async request(input, signal) {
    let response: Response;
    try {
      response = await fetchRequest(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": input.idempotencyKey,
        },
        body: JSON.stringify(input),
        signal,
      });
    } catch {
      return {
        type: "error",
        value: {
          code: signal?.aborted ? "CANCELLED" : "DEPENDENCY_UNAVAILABLE",
          message: signal?.aborted
            ? "The payment request was cancelled."
            : "The payment service is temporarily unavailable.",
          retryable: !signal?.aborted,
        },
      };
    }

    if (response.ok) {
      const parsed = premiumAnalysisSuccessSchema.safeParse(
        await readBody(response),
      );
      return parsed.success
        ? { type: "success", value: parsed.data }
        : invalidChallenge();
    }

    if (response.status !== 402) {
      const parsed = adGateErrorEnvelopeSchema.safeParse(
        await readBody(response),
      );
      return parsed.success
        ? { type: "error", value: parsed.data.error }
        : invalidChallenge();
    }

    let wireChallenge: unknown;
    const header = response.headers.get("Payment-Required");
    try {
      wireChallenge = header
        ? decodePaymentRequiredHeader(header)
        : await readBody(response);
    } catch {
      return invalidChallenge();
    }
    const parsed = paymentChallengeSchema.safeParse(wireChallenge);
    if (
      !parsed.success ||
      parsed.data.accepts[0].asset.toLowerCase() !== acceptedAsset.toLowerCase()
    ) {
      return invalidChallenge();
    }

    const requirement = parsed.data.accepts[0];
    return {
      type: "challenge",
      value: {
        requestId: input.requestId,
        requirements: [
          {
            scheme: requirement.scheme,
            network: requirement.network,
            asset: requirement.asset as `0x${string}`,
            amount: requirement.amount,
            payTo: requirement.payTo as `0x${string}`,
            maxTimeoutSeconds: requirement.maxTimeoutSeconds,
            resource: "recipe_analysis",
            extra: { name: "USDC", version: "2" },
          },
        ],
      },
    };
  },
});
