import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PUBLISHED_RECIPE_ID,
  recipeAnalysisInputSchema,
} from "../../src/adgate/contracts";
import { sampleRecipe } from "../../src/publisher/sampleRecipe";

describe("sampleRecipe", () => {
  it("provides one canonical owned recipe for display and analysis", () => {
    expect(sampleRecipe).toMatchObject({
      publisher: {
        name: "Open Table Journal",
      },
      slug: PUBLISHED_RECIPE_ID,
      title: "Roasted Chickpea Quinoa Bowl",
      servings: 4,
      totalMinutes: 45,
      tags: ["Plant-forward", "Gluten-free", "Meal-prep friendly"],
      image: {
        src: "/roasted-chickpea-quinoa-bowl.svg",
        alt: "A bowl of quinoa, roasted chickpeas, greens, and colorful vegetables.",
      },
      analysisInput: {
        recipeId: PUBLISHED_RECIPE_ID,
      },
    });

    expect(sampleRecipe.dek).toBeTruthy();
    expect(sampleRecipe.ingredients.length).toBeGreaterThan(0);
    expect(sampleRecipe.instructions.length).toBeGreaterThan(0);
    expect(sampleRecipe.dietaryNotes.length).toBeGreaterThan(0);
    expect(recipeAnalysisInputSchema.parse(sampleRecipe.analysisInput)).toEqual(
      {
        recipeId: PUBLISHED_RECIPE_ID,
      },
    );
    expect(Object.keys(sampleRecipe.analysisInput)).toEqual(["recipeId"]);
  });

  it("cannot be mutated by display or analysis consumers", () => {
    expect(Object.isFrozen(sampleRecipe)).toBe(true);
    expect(Object.isFrozen(sampleRecipe.publisher)).toBe(true);
    expect(Object.isFrozen(sampleRecipe.ingredients)).toBe(true);
    expect(Object.isFrozen(sampleRecipe.ingredients[0])).toBe(true);
    expect(Object.isFrozen(sampleRecipe.instructions)).toBe(true);
    expect(Object.isFrozen(sampleRecipe.analysisInput)).toBe(true);
  });

  it("uses a self-contained owned hero asset", async () => {
    const asset = await readFile(
      resolve(process.cwd(), "public/roasted-chickpea-quinoa-bowl.svg"),
      "utf8",
    );

    expect(asset).toContain("<svg");
    expect(asset).not.toMatch(/(?:href|src)=["']https?:\/\//);
    expect(asset).not.toMatch(/@import\s+url\(["']?https?:\/\//);
    expect(asset).not.toContain("<script");
  });
});
