import type { PremiumAnalysisHandler } from "./recipeAnalysisApp.js";

export const premiumAnalysisHandler: PremiumAnalysisHandler = async (
  request,
  evidence,
) => {
  const dietaryGoalSuggestion = request.input.dietaryGoals?.length
    ? `For ${request.input.dietaryGoals.join(", ")}, adjust portions and toppings while keeping the chickpea and quinoa base.`
    : "Adjust portions and toppings to suit your dietary goals while keeping the chickpea and quinoa base.";

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
    data: {
      summary:
        "This plant-forward bowl combines quinoa, roasted chickpeas, vegetables, and a bright dressing for a balanced meal.",
      nutritionalInsights: [
        "Chickpeas and quinoa provide complementary plant protein and dietary fiber.",
        "Vegetables and herbs add micronutrients and flavor without relying on heavy sauces.",
      ],
      suggestions: [
        dietaryGoalSuggestion,
        "Check packaged ingredients and substitutions for allergens before serving.",
      ],
      disclaimer:
        "This analysis provides general nutrition information and is not medical or dietary advice.",
    },
  };
};
