import { serve } from "@hono/node-server";
import { createDevelopmentRecipeAnalysisApp } from "./recipeAnalysis/developmentComposition.js";

process.env.NODE_ENV ??= "development";

const start = async () => {
  const { createRuntimeRecipeAnalysisDependencies } = await import(
    "./runtimeComposition.js"
  );
  const app = createDevelopmentRecipeAnalysisApp(
    createRuntimeRecipeAnalysisDependencies(),
  );

  serve({ fetch: app.fetch, port: 4021 });
};

void start();
