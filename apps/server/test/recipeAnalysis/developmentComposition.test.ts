import { describe, expect, it, vi } from "vitest";
import { createPaymentHttpPolicy } from "../../src/adgate/cors.js";
import { createRecipeAnalysisApp } from "../../src/adgate/recipeAnalysisApp.js";
import { createUnavailableSponsorAuthorizer } from "../../src/adgate/sponsorAuthorization.js";
import { createDevelopmentRecipeAnalysisApp } from "../../src/recipeAnalysis/developmentComposition.js";

const requestBody = {
  requestId: "development-preview-request",
  idempotencyKey: "development-preview-idempotency",
  resourceId: "recipe_analysis",
  input: { recipeId: "roasted-chickpea-quinoa-bowl" },
};

const createDependencies = () => {
  const paymentHandle = vi.fn(async () =>
    Response.json({ payment: "required" }, { status: 402 }),
  );
  const dependencies = {
    httpPolicy: createPaymentHttpPolicy({
      allowedOrigins: ["https://demo.example"],
    }),
    paymentProtection: { handle: paymentHandle },
    paymentReadiness: Promise.resolve({ type: "ready" as const }),
    premiumHandler: vi.fn(async () => {
      throw new Error("preview must not execute the protected handler");
    }),
    sponsorAuthorizer: createUnavailableSponsorAuthorizer(),
  };
  return { dependencies, paymentHandle };
};

describe("development recipe analysis composition", () => {
  it("mounts the header-free preview beside unchanged health and protected routes", async () => {
    const { dependencies, paymentHandle } = createDependencies();
    const app = createDevelopmentRecipeAnalysisApp(dependencies);

    const previewResponse = await app.request("/api/recipe-analysis/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    expect(previewResponse.status).toBe(200);
    expect(await previewResponse.json()).toMatchObject({
      ok: true,
      resourceId: "recipe_analysis",
      data: { summary: expect.stringContaining("quinoa") },
    });
    expect(paymentHandle).not.toHaveBeenCalled();

    const healthResponse = await app.request("/health");
    expect(healthResponse.status).toBe(200);
    expect(await healthResponse.json()).toEqual({ report: { status: "OK" } });

    const protectedResponse = await app.request("/api/recipe-analysis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": requestBody.idempotencyKey,
      },
      body: JSON.stringify(requestBody),
    });
    expect(protectedResponse.status).toBe(402);
    expect(paymentHandle).toHaveBeenCalledOnce();
  });

  it("keeps the preview path absent when the development seam is omitted", async () => {
    const { dependencies } = createDependencies();
    const app = createRecipeAnalysisApp(dependencies);

    const response = await app.request("/api/recipe-analysis/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(404);
  });
});
