import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
  deterministicRecipeAnalyzer,
  type RecipeAnalyzer,
} from "../../src/recipeAnalysis/analyzeRecipe.js";
import { createPreviewRecipeAnalysisRouter } from "../../src/recipeAnalysis/previewRoute.js";

const validRequest = {
  requestId: "preview-request-123",
  idempotencyKey: "preview-idempotency-key-123",
  resourceId: "recipe_analysis",
  input: {
    recipeId: "roasted-chickpea-quinoa-bowl",
    dietaryGoals: ["higher protein"],
  },
};

const createMountedApp = (
  analyzer: RecipeAnalyzer = deterministicRecipeAnalyzer,
) => {
  const app = new Hono();
  app.route(
    "/api/recipe-analysis/preview",
    createPreviewRecipeAnalysisRouter({ analyzer }),
  );
  return app;
};

describe("createPreviewRecipeAnalysisRouter", () => {
  it("returns a canonical preview result without access evidence", async () => {
    const response = await createMountedApp().request(
      "/api/recipe-analysis/preview",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validRequest),
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      ok: true,
      resourceId: "recipe_analysis",
      data: {
        summary: expect.stringContaining("quinoa"),
        nutritionalInsights: expect.any(Array),
        suggestions: expect.arrayContaining([
          expect.stringContaining("higher protein"),
        ]),
        disclaimer: expect.stringContaining("not medical advice"),
      },
    });
    expect(body).not.toHaveProperty("access");
  });

  it("returns a safe invalid-input response for malformed JSON", async () => {
    const response = await createMountedApp().request(
      "/api/recipe-analysis/preview",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not-json",
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "The request body must be valid JSON.",
        retryable: false,
      },
    });
  });

  it("rejects unknown request fields before analysis", async () => {
    const response = await createMountedApp().request(
      "/api/recipe-analysis/preview",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validRequest, recipeText: "do not accept" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "The recipe analysis request is invalid.",
        retryable: false,
      },
    });
  });

  it("maps an unsupported sample to a safe unprocessable response", async () => {
    const response = await createMountedApp({
      analyze: () => ({
        ok: false,
        error: {
          code: "INVALID_INPUT",
          message: "The requested recipe is not available for analysis.",
          retryable: false,
        },
      }),
    }).request("/api/recipe-analysis/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validRequest),
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "The requested recipe is not available for analysis.",
        retryable: false,
      },
    });
  });

  it("does not add the preview route when the factory is omitted", async () => {
    const app = new Hono();

    const response = await app.request("/api/recipe-analysis/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validRequest),
    });

    expect(response.status).toBe(404);
  });

  it("sanitizes unexpected analyzer failures", async () => {
    const secretFailure = "private-stack-value";
    const response = await createMountedApp({
      analyze: () => {
        throw new Error(secretFailure);
      },
    }).request("/api/recipe-analysis/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validRequest),
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed safely.",
        retryable: false,
      },
    });
    expect(JSON.stringify(body)).not.toContain(secretFailure);
    expect(JSON.stringify(body)).not.toContain("stack");
  });
});
