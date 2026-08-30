import { Hono } from "hono";
import {
  type AdGateError,
  adGateErrorSchema,
  normalizeContractError,
  premiumAnalysisRequestSchema,
  RECIPE_ANALYSIS_RESOURCE_ID,
  recipeAnalysisResultSchema,
} from "../adgate/contracts.js";
import type { RecipeAnalyzer } from "./analyzeRecipe.js";

export interface PreviewRecipeAnalysisDependencies {
  readonly analyzer: RecipeAnalyzer;
}

const errorResponse = (status: number, error: AdGateError): Response =>
  Response.json({ ok: false, error }, { status });

export const createPreviewRecipeAnalysisRouter = ({
  analyzer,
}: PreviewRecipeAnalysisDependencies): Hono =>
  new Hono().post("/", async (context) => {
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

    const request = premiumAnalysisRequestSchema.safeParse(body);
    if (!request.success) {
      return errorResponse(400, {
        code: "INVALID_INPUT",
        message: "The recipe analysis request is invalid.",
        retryable: false,
      });
    }

    try {
      const outcome = analyzer.analyze(request.data.input);

      if (!outcome.ok) {
        return errorResponse(422, adGateErrorSchema.parse(outcome.error));
      }

      return context.json({
        ok: true,
        resourceId: RECIPE_ANALYSIS_RESOURCE_ID,
        data: recipeAnalysisResultSchema.parse(outcome.data),
      });
    } catch (error) {
      return errorResponse(500, normalizeContractError(error));
    }
  });
