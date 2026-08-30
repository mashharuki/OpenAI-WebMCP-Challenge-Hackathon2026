import { z } from "zod";
import {
  type AdGateError,
  adGateErrorEnvelopeSchema,
  type PremiumAnalysisRequest,
  premiumAnalysisRequestSchema,
  RECIPE_ANALYSIS_RESOURCE_ID,
  type RecipeAnalysisInput,
  type RecipeAnalysisResult,
  recipeAnalysisResultSchema,
} from "../adgate/contracts";

const previewAnalysisSuccessSchema = z
  .object({
    ok: z.literal(true),
    resourceId: z.literal(RECIPE_ANALYSIS_RESOURCE_ID),
    data: recipeAnalysisResultSchema,
  })
  .strict();

const invalidResponseError = (): AdGateError => ({
  code: "INTERNAL_ERROR",
  message: "The analysis response could not be validated.",
  retryable: false,
});

const dependencyUnavailableError = (): AdGateError => ({
  code: "DEPENDENCY_UNAVAILABLE",
  message: "Analysis is temporarily unavailable. Try again.",
  retryable: true,
});

const isAbortError = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  "name" in value &&
  value.name === "AbortError";

export interface AnalysisClientPort {
  analyze(
    input: RecipeAnalysisInput,
    signal?: AbortSignal,
  ): Promise<RecipeAnalysisResult>;
}

export interface AnalysisClientOptions {
  readonly baseUrl: string;
  readonly fetchImpl?: typeof fetch;
}

export const createAnalysisClient = ({
  baseUrl,
  fetchImpl = fetch,
}: AnalysisClientOptions): AnalysisClientPort => {
  const endpoint = new URL("/api/recipe-analysis/preview", baseUrl).toString();

  return {
    async analyze(input, signal) {
      const request: PremiumAnalysisRequest =
        premiumAnalysisRequestSchema.parse({
          requestId: crypto.randomUUID(),
          idempotencyKey: `preview-${crypto.randomUUID()}`,
          resourceId: RECIPE_ANALYSIS_RESOURCE_ID,
          input,
        });
      let response: Response;
      try {
        response = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": request.idempotencyKey,
          },
          body: JSON.stringify(request),
          signal,
        });
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }
        throw dependencyUnavailableError();
      }
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw invalidResponseError();
      }
      if (!response.ok) {
        const error = adGateErrorEnvelopeSchema.safeParse(body);
        if (error.success) {
          throw error.data.error;
        }
        throw invalidResponseError();
      }

      const success = previewAnalysisSuccessSchema.safeParse(body);
      if (!success.success) {
        throw invalidResponseError();
      }

      return success.data.data;
    },
  };
};
