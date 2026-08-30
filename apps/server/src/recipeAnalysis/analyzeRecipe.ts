import {
  type AdGateError,
  PUBLISHED_RECIPE_ID,
  type RecipeAnalysisInput,
  type RecipeAnalysisResult,
} from "../adgate/contracts.js";

export type AnalysisOutcome =
  | { readonly ok: true; readonly data: RecipeAnalysisResult }
  | { readonly ok: false; readonly error: AdGateError };

export interface RecipeAnalyzer {
  analyze(input: RecipeAnalysisInput): AnalysisOutcome;
}

const analyzeRecipe = (input: RecipeAnalysisInput): AnalysisOutcome => {
  if (input.recipeId !== PUBLISHED_RECIPE_ID) {
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "The requested recipe is not available for analysis.",
        retryable: false,
      },
    };
  }

  const dietaryGoalSuggestion = input.dietaryGoals?.length
    ? `For ${input.dietaryGoals.join(", ")}, adjust portions and toppings while keeping the chickpea and quinoa base.`
    : "Adjust portions and toppings to suit your dietary goals while keeping the chickpea and quinoa base.";

  return {
    ok: true,
    data: {
      summary:
        "This plant-forward bowl combines quinoa, roasted chickpeas, spinach, tomatoes, cucumber, and lemon-tahini dressing for a balanced meal.",
      nutritionalInsights: [
        "Chickpeas and quinoa provide complementary plant protein and dietary fiber.",
        "Spinach, tomatoes, and cucumber add micronutrients and freshness without relying on a heavy sauce.",
      ],
      suggestions: [
        dietaryGoalSuggestion,
        "Check the tahini and any packaged substitutions for allergens before serving.",
      ],
      disclaimer:
        "This analysis provides general nutrition information and is not medical advice or a substitute for individualized care.",
    },
  };
};

export const deterministicRecipeAnalyzer: RecipeAnalyzer = {
  analyze: analyzeRecipe,
};
