import { describe, expect, it } from "vitest";
import type { PremiumAnalysisRequest } from "../../src/adgate/contracts.js";
import { createProtectedAttemptRegistry } from "../../src/adgate/idempotency.js";
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
  it("consumes once and replays the same successful identity for five minutes", async () => {
    let current = new Date("2026-08-30T00:00:00.000Z");
    let registryNow = 0;
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

    const authorizer = createSponsorAuthorizer({
      registry: createProtectedAttemptRegistry({ now: () => registryNow }),
      service,
    });
    let handlerCalls = 0;
    const authorize = (
      parsedRequest = premiumRequest,
      token = grant.value.token,
    ) =>
      authorizer.handle(
        {
          request: new Request("https://server.example/api/recipe-analysis", {
            headers: { Authorization: `Sponsor ${token}` },
          }),
          parsedRequest,
        },
        async (_request, evidence) => {
          handlerCalls += 1;
          return {
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
          };
        },
      );

    const [first, concurrent] = await Promise.all([authorize(), authorize()]);
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody).toMatchObject({
      ok: true,
      access: {
        kind: "sponsor_grant",
        referenceId: "grant-authorization-123",
      },
    });
    expect(concurrent.status).toBe(200);
    expect(await concurrent.json()).toEqual(firstBody);
    expect(handlerCalls).toBe(1);

    const replay = await authorize();
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(firstBody);
    expect(handlerCalls).toBe(1);

    const changedRequest = await authorize({
      ...premiumRequest,
      input: {
        ...premiumRequest.input,
        dietaryGoals: ["higher protein"],
      },
    });
    expect(changedRequest.status).toBe(409);
    expect(await changedRequest.json()).toMatchObject({
      error: { code: "IDEMPOTENCY_CONFLICT" },
    });

    const changedEvidence = await authorize(premiumRequest, "z".repeat(43));
    expect(changedEvidence.status).toBe(409);
    expect(await changedEvidence.json()).toMatchObject({
      error: { code: "IDEMPOTENCY_CONFLICT" },
    });

    const reusedByAnotherIdentity = await authorize({
      ...premiumRequest,
      idempotencyKey: "another-idempotency-authorization-123",
    });
    expect(reusedByAnotherIdentity.status).toBe(401);
    expect(await reusedByAnotherIdentity.json()).toMatchObject({
      error: { code: "ACCESS_REUSED" },
    });

    registryNow = 300_000;
    const expiredReplay = await authorize();
    expect(expiredReplay.status).toBe(401);
    expect(await expiredReplay.json()).toMatchObject({
      error: { code: "ACCESS_EXPIRED" },
    });
    expect(handlerCalls).toBe(1);
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
      const authorizer = createSponsorAuthorizer({
        registry: createProtectedAttemptRegistry(),
        service,
      });
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
    const authorizer = createSponsorAuthorizer({
      registry: createProtectedAttemptRegistry(),
      service,
    });
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
