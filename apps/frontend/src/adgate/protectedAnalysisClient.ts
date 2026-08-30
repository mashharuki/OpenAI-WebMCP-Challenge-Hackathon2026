import {
  type AdGateError,
  type AdGateErrorEnvelope,
  adGateErrorEnvelopeSchema,
  type PremiumAnalysisRequest,
  type PremiumAnalysisSuccess,
  premiumAnalysisRequestSchema,
  premiumAnalysisSuccessSchema,
} from "./contracts";

export interface ProtectedAnalysisClientPort {
  executeWithSponsor(input: {
    readonly request: PremiumAnalysisRequest;
    readonly token: string;
    readonly signal: AbortSignal;
  }): Promise<PremiumAnalysisSuccess | AdGateErrorEnvelope>;
}

export interface ProtectedAnalysisClientOptions {
  readonly baseUrl: string;
  readonly fetchImpl?: typeof fetch;
}

const errorEnvelope = (
  code: AdGateError["code"],
  message: string,
  retryable: boolean,
): AdGateErrorEnvelope => ({ ok: false, error: { code, message, retryable } });

const invalidResponse = (): AdGateErrorEnvelope =>
  errorEnvelope(
    "INTERNAL_ERROR",
    "The protected analysis response could not be validated.",
    false,
  );

const isAbortError = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  "name" in value &&
  value.name === "AbortError";

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

export const createProtectedAnalysisClient = ({
  baseUrl,
  fetchImpl = fetch,
}: ProtectedAnalysisClientOptions): ProtectedAnalysisClientPort => {
  const endpoint = new URL("/api/recipe-analysis", baseUrl).toString();

  return {
    async executeWithSponsor({ request, token, signal }) {
      const canonicalRequest = premiumAnalysisRequestSchema.safeParse(request);
      if (!canonicalRequest.success) {
        return errorEnvelope(
          "INVALID_INPUT",
          "The recipe analysis request is invalid.",
          false,
        );
      }

      let response: Response;
      try {
        response = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Sponsor ${token}`,
            "Content-Type": "application/json",
            "Idempotency-Key": canonicalRequest.data.idempotencyKey,
          },
          body: JSON.stringify(canonicalRequest.data),
          signal,
        });
      } catch (error) {
        if (signal.aborted || isAbortError(error)) {
          return errorEnvelope(
            "CANCELLED",
            "The protected analysis request was cancelled.",
            false,
          );
        }
        return errorEnvelope(
          "DEPENDENCY_UNAVAILABLE",
          "Protected analysis is temporarily unavailable. Try again.",
          true,
        );
      }

      const body = await readJson(response);
      if (!response.ok) {
        const parsedError = adGateErrorEnvelopeSchema.safeParse(body);
        return parsedError.success ? parsedError.data : invalidResponse();
      }

      const parsedSuccess = premiumAnalysisSuccessSchema.safeParse(body);
      return parsedSuccess.success ? parsedSuccess.data : invalidResponse();
    },
  };
};
