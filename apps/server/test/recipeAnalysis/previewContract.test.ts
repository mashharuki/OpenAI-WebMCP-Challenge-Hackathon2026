import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import fixture from "../../../../test/fixtures/publisher-demo.json";
import { premiumAnalysisRequestSchema } from "../../src/adgate/contracts.js";
import { deterministicRecipeAnalyzer } from "../../src/recipeAnalysis/analyzeRecipe.js";
import { createPreviewRecipeAnalysisRouter } from "../../src/recipeAnalysis/previewRoute.js";

describe("publisher preview contract fixture", () => {
  it("accepts the shared request and emits the exact shared response", async () => {
    expect(premiumAnalysisRequestSchema.parse(fixture.request)).toEqual(
      fixture.request,
    );
    const app = new Hono();
    app.route(
      "/api/recipe-analysis/preview",
      createPreviewRecipeAnalysisRouter({
        analyzer: deterministicRecipeAnalyzer,
      }),
    );

    const response = await app.request("/api/recipe-analysis/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fixture.request),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(fixture.response);
    expect(fixture.response).not.toHaveProperty("access");
  });

  it("rejects fixture field drift before invoking the analyzer", async () => {
    let analysisCalls = 0;
    const app = new Hono();
    app.route(
      "/api/recipe-analysis/preview",
      createPreviewRecipeAnalysisRouter({
        analyzer: {
          analyze: (input) => {
            analysisCalls += 1;
            return deterministicRecipeAnalyzer.analyze(input);
          },
        },
      }),
    );

    const response = await app.request("/api/recipe-analysis/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...fixture.request, recipeText: "field drift" }),
    });

    expect(response.status).toBe(400);
    expect(analysisCalls).toBe(0);
  });
});
