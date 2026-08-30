import { serve } from "@hono/node-server";
import { createRecipeAnalysisApp } from "./adgate/recipeAnalysisApp.js";
import { createRuntimeRecipeAnalysisDependencies } from "./runtimeComposition.js";

const app = createRecipeAnalysisApp(createRuntimeRecipeAnalysisDependencies());

serve({ fetch: app.fetch, port: 4021 });
