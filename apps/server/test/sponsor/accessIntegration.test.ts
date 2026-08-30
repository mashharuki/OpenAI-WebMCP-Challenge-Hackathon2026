import { afterEach, describe, expect, it, vi } from "vitest";
import { createSponsorFlowController } from "../../../frontend/src/sponsor/sponsorFlowController";
import { createSponsorGrantClient } from "../../../frontend/src/sponsor/sponsorGrantClient";
import type { PremiumAnalysisRequest } from "../../src/adgate/contracts.js";
import { createRecipeAnalysisApp } from "../../src/adgate/recipeAnalysisApp.js";
import { createSponsorAuthorizer } from "../../src/adgate/sponsorAuthorization.js";
import { createSponsorGrantLedger } from "../../src/sponsor/grantLedger.js";
import { createSponsorGrantService } from "../../src/sponsor/grantService.js";
import { createSponsorGrantRoutes } from "../../src/sponsor/routes.js";

const premiumRequest: PremiumAnalysisRequest = {
  requestId: "request-browser-integration",
  idempotencyKey: "idempotency-browser-integration",
  resourceId: "recipe_analysis",
  input: { recipeId: "roasted-chickpea-quinoa-bowl" },
};

const originalLocalStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  "localStorage",
);
const originalSessionStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  "sessionStorage",
);

const restoreStorage = (
  name: "localStorage" | "sessionStorage",
  descriptor: PropertyDescriptor | undefined,
) => {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else Reflect.deleteProperty(globalThis, name);
};

afterEach(() => {
  vi.restoreAllMocks();
  restoreStorage("localStorage", originalLocalStorage);
  restoreStorage("sessionStorage", originalSessionStorage);
});

describe("Sponsor Access integration", () => {
  it("crosses the browser countdown and server boundary for one premium request", async () => {
    const storageWrite = vi.fn();
    const storage = { setItem: storageWrite };
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storage,
    });
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: storage,
    });
    const logSpies = [
      vi.spyOn(console, "log").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
    ];
    let serverNow = new Date("2026-08-30T00:00:00.000Z");
    let browserNow = 1_000;
    let visible = true;
    const observedUrls: string[] = [];
    const observedEvidence: unknown[] = [];
    const service = createSponsorGrantService({
      ledger: createSponsorGrantLedger(),
      now: () => serverNow,
      createSecret: (() => {
        const values = ["s".repeat(43), "g".repeat(43)];
        return () => values.shift() ?? "x".repeat(43);
      })(),
      createGrantId: () => "grant-browser-integration",
    });
    const app = createRecipeAnalysisApp({
      httpPolicy: async (_context, next) => next(),
      paymentProtection: {
        handle: async () => {
          throw new Error("Sponsor access must not invoke payment protection.");
        },
      },
      paymentReadiness: Promise.resolve({ type: "ready" }),
      sponsorAuthorizer: createSponsorAuthorizer({ service }),
      sponsorRoutes: createSponsorGrantRoutes({
        service,
        now: () => serverNow,
      }),
      premiumHandler: async (request, evidence) => {
        observedEvidence.push(evidence);
        return {
          ok: true,
          requestId: request.requestId,
          resourceId: request.resourceId,
          access: {
            kind: evidence.kind,
            referenceId:
              evidence.kind === "sponsor_grant"
                ? evidence.grantId
                : evidence.transactionHash,
          },
          data: {
            summary: "A sponsor-authorized recipe analysis.",
            nutritionalInsights: ["Balanced protein and fiber."],
            suggestions: ["Add seasonal vegetables."],
            disclaimer: "General information only.",
          },
        };
      },
    });
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input.toString());
      observedUrls.push(url.toString());
      return app.request(url.pathname, init);
    };
    const client = createSponsorGrantClient({
      baseUrl: "https://publisher.example",
      fetchImpl,
    });
    const session = await client.start({
      attemptId: "attempt-browser-integration",
      resourceId: "recipe_analysis",
      nonce: premiumRequest.requestId,
    });
    const controller = createSponsorFlowController({
      attemptId: "attempt-browser-integration",
      nonce: premiumRequest.requestId,
      session,
      clock: { monotonicNow: () => browserNow },
      isVisible: () => visible,
      issue: client.issue.bind(client),
    });

    controller.start("attempt-browser-integration");
    browserNow += 3_000;
    controller.tick("attempt-browser-integration");
    visible = false;
    controller.visibilityChanged("attempt-browser-integration");
    browserNow += 10_000;
    serverNow = new Date("2026-08-30T00:00:13.000Z");
    controller.tick("attempt-browser-integration");
    expect(controller.getSnapshot()).toMatchObject({
      type: "viewing",
      visibleElapsedMs: 3_000,
    });

    visible = true;
    controller.visibilityChanged("attempt-browser-integration");
    browserNow += 5_000;
    controller.tick("attempt-browser-integration");
    const result = await controller.continue("attempt-browser-integration");
    expect(result).toMatchObject({
      ok: true,
      evidence: {
        grantId: "grant-browser-integration",
        nonce: premiumRequest.requestId,
      },
    });
    if (!result.ok) throw new Error("Expected sponsor access.");

    const analyze = () =>
      app.request("/api/recipe-analysis", {
        method: "POST",
        headers: {
          Authorization: `Sponsor ${result.token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": premiumRequest.idempotencyKey,
        },
        body: JSON.stringify(premiumRequest),
      });
    const authorized = await analyze();
    expect(authorized.status).toBe(200);
    expect(await authorized.json()).toMatchObject({
      ok: true,
      access: {
        kind: "sponsor_grant",
        referenceId: "grant-browser-integration",
      },
    });
    expect(observedEvidence).toEqual([result.evidence]);

    const replay = await analyze();
    expect(replay.status).toBe(401);
    expect(await replay.json()).toMatchObject({
      ok: false,
      error: { code: "ACCESS_REUSED" },
    });
    expect(observedEvidence).toHaveLength(1);
    expect(observedUrls).toEqual([
      "https://publisher.example/api/sponsor-sessions",
      "https://publisher.example/api/sponsor-grants",
    ]);
    expect(observedUrls.join(" ")).not.toContain(result.token);
    expect(observedUrls.join(" ")).not.toContain("open-table-weekly");
    expect(storageWrite).not.toHaveBeenCalled();
    expect(logSpies.every((spy) => spy.mock.calls.length === 0)).toBe(true);
  });

  it("enforces server elapsed time, nonce binding, and expiry equality", async () => {
    let serverNow = new Date("2026-08-30T00:00:00.000Z");
    const service = createSponsorGrantService({
      ledger: createSponsorGrantLedger(),
      now: () => serverNow,
      createSecret: (() => {
        const values = ["s".repeat(43), "g".repeat(43)];
        return () => values.shift() ?? "x".repeat(43);
      })(),
      createGrantId: () => "grant-boundary-integration",
    });
    const app = createRecipeAnalysisApp({
      httpPolicy: async (_context, next) => next(),
      paymentProtection: {
        handle: async () => {
          throw new Error("Sponsor access must not invoke payment protection.");
        },
      },
      paymentReadiness: Promise.resolve({ type: "ready" }),
      sponsorAuthorizer: createSponsorAuthorizer({ service }),
      sponsorRoutes: createSponsorGrantRoutes({
        service,
        now: () => serverNow,
      }),
      premiumHandler: async (request, evidence) => ({
        ok: true,
        requestId: request.requestId,
        resourceId: request.resourceId,
        access: {
          kind: evidence.kind,
          referenceId:
            evidence.kind === "sponsor_grant"
              ? evidence.grantId
              : evidence.transactionHash,
        },
        data: {
          summary: "A sponsor-authorized recipe analysis.",
          nutritionalInsights: ["Balanced protein and fiber."],
          suggestions: ["Add seasonal vegetables."],
          disclaimer: "General information only.",
        },
      }),
    });
    const client = createSponsorGrantClient({
      baseUrl: "https://publisher.example",
      fetchImpl: (async (input, init) => {
        const url = new URL(
          typeof input === "string" ? input : input.toString(),
        );
        return app.request(url.pathname, init);
      }) as typeof fetch,
    });
    const session = await client.start({
      attemptId: "attempt-boundary-integration",
      resourceId: "recipe_analysis",
      nonce: premiumRequest.requestId,
    });

    serverNow = new Date("2026-08-30T00:00:07.999Z");
    await expect(
      client.issue({ sessionCredential: session.sessionCredential }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "ACCESS_REQUIRED" },
    });

    serverNow = new Date("2026-08-30T00:00:08.000Z");
    const grant = await client.issue({
      sessionCredential: session.sessionCredential,
    });
    if (!grant.ok) throw new Error("Expected sponsor access.");
    const analyze = (request: PremiumAnalysisRequest) =>
      app.request("/api/recipe-analysis", {
        method: "POST",
        headers: {
          Authorization: `Sponsor ${grant.token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": request.idempotencyKey,
        },
        body: JSON.stringify(request),
      });

    const resourceMismatch = await app.request("/api/recipe-analysis", {
      method: "POST",
      headers: {
        Authorization: `Sponsor ${grant.token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": premiumRequest.idempotencyKey,
      },
      body: JSON.stringify({
        ...premiumRequest,
        resourceId: "another_resource",
      }),
    });
    expect(resourceMismatch.status).toBe(400);
    const resourceMismatchBody = await resourceMismatch.json();
    expect(resourceMismatchBody).toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT" },
    });
    expect(JSON.stringify(resourceMismatchBody)).not.toContain(grant.token);

    const mismatch = await analyze({
      ...premiumRequest,
      requestId: "request-binding-mismatch",
    });
    expect(mismatch.status).toBe(401);
    const mismatchBody = await mismatch.json();
    expect(mismatchBody).toMatchObject({
      ok: false,
      error: { code: "INVALID_EVIDENCE" },
    });
    expect(JSON.stringify(mismatchBody)).not.toContain(grant.token);

    serverNow = new Date("2026-08-30T00:01:08.000Z");
    const expired = await analyze(premiumRequest);
    expect(expired.status).toBe(401);
    const expiredBody = await expired.json();
    expect(expiredBody).toMatchObject({
      ok: false,
      error: { code: "ACCESS_EXPIRED" },
    });
    expect(JSON.stringify(expiredBody)).not.toContain(grant.token);
  });

  it.each(["cancel", "abort"] as const)(
    "%s stops the browser flow before grant issuance",
    async (terminalAction) => {
      const serverNow = new Date("2026-08-30T00:00:00.000Z");
      let browserNow = 1_000;
      const observedUrls: string[] = [];
      const service = createSponsorGrantService({
        ledger: createSponsorGrantLedger(),
        now: () => serverNow,
        createSecret: () => "s".repeat(43),
      });
      const routes = createSponsorGrantRoutes({
        service,
        now: () => serverNow,
      });
      const client = createSponsorGrantClient({
        baseUrl: "https://publisher.example",
        fetchImpl: (async (input, init) => {
          const url = new URL(
            typeof input === "string" ? input : input.toString(),
          );
          observedUrls.push(url.toString());
          return routes.request(url.pathname, init);
        }) as typeof fetch,
      });
      const attemptId = `attempt-${terminalAction}-integration`;
      const session = await client.start({
        attemptId,
        resourceId: "recipe_analysis",
        nonce: `request-${terminalAction}-integration`,
      });
      const controller = createSponsorFlowController({
        attemptId,
        nonce: `request-${terminalAction}-integration`,
        session,
        clock: { monotonicNow: () => browserNow },
        isVisible: () => true,
        issue: client.issue.bind(client),
      });
      controller.start(attemptId);
      browserNow += 8_000;
      controller.tick(attemptId);

      controller[terminalAction](attemptId);

      await expect(controller.continue(attemptId)).resolves.toMatchObject({
        ok: false,
        error: { code: "CANCELLED" },
      });
      expect(observedUrls).toEqual([
        "https://publisher.example/api/sponsor-sessions",
      ]);
    },
  );
});
