import { deterministicRecipeAnalyzer } from "../recipeAnalysis/analyzeRecipe.js";
import type { PremiumAnalysisHandler } from "./recipeAnalysisApp.js";

export const premiumAnalysisHandler: PremiumAnalysisHandler = async (
  request,
  evidence,
) => {
  const analysis = deterministicRecipeAnalyzer.analyze(request.input);
  if (!analysis.ok) {
    return analysis;
  }

  return {
    ok: true,
    requestId: request.requestId,
    resourceId: "recipe_analysis",
    access: {
      kind: evidence.kind,
      referenceId:
        evidence.kind === "sponsor_grant"
          ? evidence.grantId
          : evidence.transactionHash,
    },
    data: analysis.data,
  };
};
