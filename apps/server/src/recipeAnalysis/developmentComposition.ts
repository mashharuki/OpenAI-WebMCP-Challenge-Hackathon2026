import type { Hono } from "hono";
import { createRecipeAnalysisApp } from "../adgate/recipeAnalysisApp.js";
import { deterministicRecipeAnalyzer } from "./analyzeRecipe.js";
import { createPreviewRecipeAnalysisRouter } from "./previewRoute.js";

export type DevelopmentRecipeAnalysisDependencies = Omit<
  Parameters<typeof createRecipeAnalysisApp>[0],
  "preview"
>;

export const createDevelopmentRecipeAnalysisApp = (
  dependencies: DevelopmentRecipeAnalysisDependencies,
): Hono =>
  createRecipeAnalysisApp({
    ...dependencies,
    preview: {
      environment: "development",
      explicitlyEnabled: true,
      router: createPreviewRecipeAnalysisRouter({
        analyzer: deterministicRecipeAnalyzer,
      }),
    },
  });
