import { expect, it } from "vitest";
import { createProtectedAttemptRegistry } from "../../src/adgate/idempotency.js";
import { createRecipeAnalysisApp } from "../../src/adgate/recipeAnalysisApp.js";
import { createSponsorAuthorizer } from "../../src/adgate/sponsorAuthorization.js";
import { createSponsorGrantLedger } from "../../src/sponsor/grantLedger.js";
import { createSponsorGrantService } from "../../src/sponsor/grantService.js";
import { createSponsorGrantRoutes } from "../../src/sponsor/routes.js";

it("mounts sponsor routes backed by the same service as authorization", async () => {
  const current = new Date("2026-08-30T00:00:00.000Z");
  const service = createSponsorGrantService({
    ledger: createSponsorGrantLedger(),
    now: () => current,
    createSecret: () => "s".repeat(43),
  });
  const app = createRecipeAnalysisApp({
    httpPolicy: async (_context, next) => next(),
    paymentProtection: {
      handle: async () => new Response(null, { status: 402 }),
    },
    paymentReadiness: Promise.resolve({ type: "ready" }),
    premiumHandler: async () => {
      throw new Error("Premium analysis is outside this route test.");
    },
    sponsorAuthorizer: createSponsorAuthorizer({
      registry: createProtectedAttemptRegistry(),
      service,
    }),
    sponsorRoutes: createSponsorGrantRoutes({ service, now: () => current }),
  });

  const response = await app.request("/api/sponsor-sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      attemptId: "attempt-composition-123",
      resourceId: "recipe_analysis",
      nonce: "request-composition-123",
    }),
  });

  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({
    ok: true,
    sponsor: { id: "open-table-weekly" },
  });
});
