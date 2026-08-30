import { describe, expect, it } from "vitest";
import {
  type RecipeAnalysisInput,
  recipeAnalysisResultSchema,
} from "../../src/adgate/contracts.js";
import { deterministicRecipeAnalyzer } from "../../src/recipeAnalysis/analyzeRecipe.js";

describe("deterministicRecipeAnalyzer", () => {
  it("returns the same canonical analysis for the same published recipe input", () => {
    const input = {
      recipeId: "roasted-chickpea-quinoa-bowl" as const,
      dietaryGoals: ["higher protein"],
    };

    const first = deterministicRecipeAnalyzer.analyze(input);
    const second = deterministicRecipeAnalyzer.analyze(input);

    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      throw new Error("Expected the published recipe to be supported.");
    }

    expect(recipeAnalysisResultSchema.safeParse(first.data).success).toBe(true);
    expect(first.data.summary).toContain("quinoa");
    expect(first.data.nutritionalInsights.join(" ").toLowerCase()).toContain(
      "chickpeas",
    );
    expect(first.data.suggestions.join(" ")).toContain("higher protein");
    expect(first.data.disclaimer).toContain("not medical advice");
  });

  it("defensively rejects an invalid recipe when transport validation is bypassed", () => {
    const unsupportedRecipeId = "private-test-recipe";
    const outcome = deterministicRecipeAnalyzer.analyze({
      recipeId: unsupportedRecipeId,
    } as unknown as RecipeAnalysisInput);

    expect(outcome).toEqual({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "The requested recipe is not available for analysis.",
        retryable: false,
      },
    });
    expect(JSON.stringify(outcome)).not.toContain(unsupportedRecipeId);
  });
});
