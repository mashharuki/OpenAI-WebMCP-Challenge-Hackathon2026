import { describe, expect, it } from "vitest";
import type { PremiumAnalysisRequest } from "../../src/adgate/contracts.js";
import { createSponsorAuthorizer } from "../../src/adgate/sponsorAuthorization.js";
import { createSponsorGrantLedger } from "../../src/sponsor/grantLedger.js";
import { createSponsorGrantService } from "../../src/sponsor/grantService.js";

const premiumRequest: PremiumAnalysisRequest = {
  requestId: "request-authorization-123",
  idempotencyKey: "idempotency-authorization-123",
  resourceId: "recipe_analysis",
  input: { recipeId: "roasted-chickpea-quinoa-bowl" },
};

describe("SponsorAuthorizer", () => {
  it("authorizes an issued Sponsor token exactly once", async () => {
    let current = new Date("2026-08-30T00:00:00.000Z");
    const service = createSponsorGrantService({
      ledger: createSponsorGrantLedger(),
      now: () => current,
      createSecret: (() => {
        const values = ["s".repeat(43), "g".repeat(43)];
        return () => values.shift() ?? "x".repeat(43);
      })(),
      createGrantId: () => "grant-authorization-123",
    });
    const session = await service.startSession(
      {
        attemptId: "attempt-authorization-123",
        resourceId: "recipe_analysis",
        nonce: premiumRequest.requestId,
      },
      current.toISOString(),
    );
    if (!session.ok) throw new Error("Expected a sponsor session.");
    current = new Date("2026-08-30T00:00:08.000Z");
    const grant = await service.issue({
      sessionCredential: session.value.sessionCredential,
    });
    if (!grant.ok) throw new Error("Expected a sponsor grant.");

    const authorizer = createSponsorAuthorizer({ service });
    const authorize = () =>
      authorizer.handle(
        {
          request: new Request("https://server.example/api/recipe-analysis", {
            headers: { Authorization: `Sponsor ${grant.value.token}` },
          }),
          parsedRequest: premiumRequest,
        },
        async (_request, evidence) => ({
          ok: true,
          requestId: premiumRequest.requestId,
          resourceId: "recipe_analysis",
          access: {
            kind: evidence.kind,
            referenceId: evidence.grantId,
          },
          data: {
            summary: "Authorized sponsor analysis.",
            nutritionalInsights: ["Balanced protein and fiber."],
            suggestions: ["Add seasonal vegetables."],
            disclaimer: "General information only.",
          },
        }),
      );

    const first = await authorize();
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({
      ok: true,
      access: {
        kind: "sponsor_grant",
        referenceId: "grant-authorization-123",
      },
    });

    const replay = await authorize();
    expect(replay.status).toBe(401);
    expect(await replay.json()).toEqual({
      ok: false,
      error: {
        code: "ACCESS_REUSED",
        message: "The sponsor access has already been used.",
        retryable: false,
      },
    });
  });

  it.each([
    [undefined, "ACCESS_REQUIRED", 403],
    ["sponsor opaque-token", "INVALID_EVIDENCE", 401],
    ["Sponsor  opaque-token", "INVALID_EVIDENCE", 401],
    [`Sponsor ${"u".repeat(43)}`, "INVALID_EVIDENCE", 401],
  ])(
    "normalizes a missing, malformed, or unknown Authorization value",
    async (authorization, expectedCode, expectedStatus) => {
      const service = createSponsorGrantService({
        ledger: createSponsorGrantLedger(),
      });
      const authorizer = createSponsorAuthorizer({ service });
      const response = await authorizer.handle(
        {
          request: new Request("https://server.example/api/recipe-analysis", {
            headers:
              authorization === undefined
                ? {}
                : { Authorization: authorization },
          }),
          parsedRequest: premiumRequest,
        },
        async () => {
          throw new Error("Invalid evidence must not reach premium analysis.");
        },
      );

      expect(response.status).toBe(expectedStatus);
      expect(await response.json()).toMatchObject({
        ok: false,
        error: { code: expectedCode },
      });
    },
  );

  it("rejects binding mismatch without consuming and expires at equality", async () => {
    let current = new Date("2026-08-30T00:00:00.000Z");
    const service = createSponsorGrantService({
      ledger: createSponsorGrantLedger(),
      now: () => current,
      createSecret: (() => {
        const values = ["s".repeat(43), "g".repeat(43)];
        return () => values.shift() ?? "x".repeat(43);
      })(),
      createGrantId: () => "grant-expiry-123",
    });
    const session = await service.startSession(
      {
        attemptId: "attempt-expiry-123",
        resourceId: "recipe_analysis",
        nonce: premiumRequest.requestId,
      },
      current.toISOString(),
    );
    if (!session.ok) throw new Error("Expected a sponsor session.");
    current = new Date("2026-08-30T00:00:08.000Z");
    const grant = await service.issue({
      sessionCredential: session.value.sessionCredential,
    });
    if (!grant.ok) throw new Error("Expected a sponsor grant.");
    const authorizer = createSponsorAuthorizer({ service });
    const request = new Request("https://server.example/api/recipe-analysis", {
      headers: { Authorization: `Sponsor ${grant.value.token}` },
    });
    const rejectDownstream = async () => {
      throw new Error("Rejected evidence must not reach premium analysis.");
    };

    const mismatch = await authorizer.handle(
      {
        request,
        parsedRequest: { ...premiumRequest, requestId: "another-request" },
      },
      rejectDownstream,
    );
    expect(mismatch.status).toBe(401);
    expect(await mismatch.json()).toMatchObject({
      error: { code: "INVALID_EVIDENCE" },
    });

    current = new Date("2026-08-30T00:01:08.000Z");
    const expired = await authorizer.handle(
      { request, parsedRequest: premiumRequest },
      rejectDownstream,
    );
    expect(expired.status).toBe(401);
    expect(await expired.json()).toMatchObject({
      error: { code: "ACCESS_EXPIRED" },
    });
  });
});
