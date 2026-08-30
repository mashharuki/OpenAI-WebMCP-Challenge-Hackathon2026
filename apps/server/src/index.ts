import { serve } from "@hono/node-server";
import { createRecipeAnalysisApp } from "./adgate/recipeAnalysisApp.js";
import { createRuntimeRecipeAnalysisDependencies } from "./runtimeComposition.js";

const app = createRecipeAnalysisApp(createRuntimeRecipeAnalysisDependencies());
const port = Number.parseInt(process.env.PORT ?? "4021", 10);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

serve({ fetch: app.fetch, port });
