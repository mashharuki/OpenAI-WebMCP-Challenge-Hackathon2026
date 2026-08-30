import { describe, expect, it } from "vitest";
import { createSponsorGrantLedger } from "../../src/sponsor/grantLedger.js";
import { createSponsorGrantService } from "../../src/sponsor/grantService.js";
import { createSponsorGrantRoutes } from "../../src/sponsor/routes.js";

describe("SponsorGrantRoutes", () => {
  it("starts a session and issues the same grant for a retry", async () => {
    let current = new Date("2026-08-30T00:00:00.000Z");
    const app = createSponsorGrantRoutes({
      service: createSponsorGrantService({
        ledger: createSponsorGrantLedger(),
        now: () => current,
        createSecret: (() => {
          const values = ["s".repeat(43), "g".repeat(43)];
          return () => values.shift() ?? "x".repeat(43);
        })(),
        createGrantId: () => "grant-route-123",
      }),
      now: () => current,
    });

    const sessionResponse = await app.request("/api/sponsor-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attemptId: "attempt-route-123",
        resourceId: "recipe_analysis",
        nonce: "nonce-route-123",
      }),
    });
    expect(sessionResponse.status).toBe(201);
    expect(await sessionResponse.json()).toEqual({
      ok: true,
      sessionCredential: "s".repeat(43),
      sponsor: {
        id: "open-table-weekly",
        name: "Open Table Weekly",
        creativeKey: "weekly-static-v1",
      },
      requiredMs: 8000,
      expiresAt: "2026-08-30T00:01:30.000Z",
    });

    current = new Date("2026-08-30T00:00:08.000Z");
    const issue = () =>
      app.request("/api/sponsor-grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionCredential: "s".repeat(43) }),
      });
    const issuedResponse = await issue();
    expect(issuedResponse.status).toBe(201);
    const issuedBody = await issuedResponse.json();
    expect(issuedBody).toEqual({
      ok: true,
      token: "g".repeat(43),
      evidence: {
        kind: "sponsor_grant",
        grantId: "grant-route-123",
        resourceId: "recipe_analysis",
        issuedAt: "2026-08-30T00:00:08.000Z",
        expiresAt: "2026-08-30T00:01:08.000Z",
        nonce: "nonce-route-123",
      },
    });

    const retryResponse = await issue();
    expect(retryResponse.status).toBe(200);
    expect(await retryResponse.json()).toEqual(issuedBody);
  });

  it("rejects invalid input and premature issuance with canonical safe errors", async () => {
    let current = new Date("2026-08-30T00:00:00.000Z");
    const app = createSponsorGrantRoutes({
      service: createSponsorGrantService({
        ledger: createSponsorGrantLedger(),
        now: () => current,
        createSecret: () => "s".repeat(43),
      }),
      now: () => current,
    });

    const invalid = await app.request("/api/sponsor-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attemptId: "attempt-route-123",
        resourceId: "recipe_analysis",
        nonce: "nonce-route-123",
        unexpected: "must be rejected",
      }),
    });
    expect(invalid.status).toBe(400);
    expect(invalid.headers.get("Cache-Control")).toBe("no-store");
    expect(await invalid.json()).toEqual({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "The sponsor request is invalid.",
        retryable: false,
      },
    });

    const started = await app.request("/api/sponsor-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attemptId: "attempt-route-123",
        resourceId: "recipe_analysis",
        nonce: "nonce-route-123",
      }),
    });
    expect(started.status).toBe(201);
    current = new Date("2026-08-30T00:00:07.999Z");
    const premature = await app.request("/api/sponsor-grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionCredential: "s".repeat(43) }),
    });
    expect(premature.status).toBe(403);
    expect(await premature.json()).toMatchObject({
      ok: false,
      error: { code: "ACCESS_REQUIRED", retryable: true },
    });
  });

  it("maps conflict, capacity, and internal failures without exposing secrets", async () => {
    const current = new Date("2026-08-30T00:00:00.000Z");
    const ledger = createSponsorGrantLedger({ maxSessions: 1 });
    const app = createSponsorGrantRoutes({
      service: createSponsorGrantService({
        ledger,
        now: () => current,
        createSecret: (() => {
          let sequence = 0;
          return () => `${"s".repeat(42)}${++sequence}`;
        })(),
      }),
      now: () => current,
    });
    const start = (attemptId: string, nonce: string) =>
      app.request("/api/sponsor-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          resourceId: "recipe_analysis",
          nonce,
        }),
      });

    expect((await start("attempt-one", "nonce-one")).status).toBe(201);
    const conflict = await start("attempt-conflict", "nonce-one");
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({
      ok: false,
      error: { code: "IDEMPOTENCY_CONFLICT" },
    });
    const capacity = await start("attempt-two", "nonce-two");
    expect(capacity.status).toBe(503);
    expect(await capacity.json()).toMatchObject({
      ok: false,
      error: { code: "DEPENDENCY_UNAVAILABLE", retryable: true },
    });

    const failingApp = createSponsorGrantRoutes({
      service: createSponsorGrantService({
        ledger: createSponsorGrantLedger(),
        createSecret: () => {
          throw new Error("raw-secret-failure");
        },
      }),
      now: () => current,
    });
    const internal = await failingApp.request("/api/sponsor-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attemptId: "attempt-internal",
        resourceId: "recipe_analysis",
        nonce: "nonce-internal",
      }),
    });
    expect(internal.status).toBe(500);
    expect(JSON.stringify(await internal.json())).not.toContain(
      "raw-secret-failure",
    );
  });
});
