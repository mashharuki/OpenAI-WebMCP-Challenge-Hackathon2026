import { serve } from "@hono/node-server";
import { createDevelopmentRecipeAnalysisApp } from "./recipeAnalysis/developmentComposition.js";
import { createRuntimeRecipeAnalysisDependencies } from "./runtimeComposition.js";

const app = createDevelopmentRecipeAnalysisApp(
  createRuntimeRecipeAnalysisDependencies(),
);

serve({ fetch: app.fetch, port: 4021 });
