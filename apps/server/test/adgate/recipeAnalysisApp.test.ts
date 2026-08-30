import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createPaymentHttpPolicy } from "../../src/adgate/cors.js";
import { createProtectedAttemptRegistry } from "../../src/adgate/idempotency.js";
import { createPaymentProtection } from "../../src/adgate/paymentProtection.js";
import {
  createRecipeAnalysisApp,
  type PremiumAnalysisHandler,
} from "../../src/adgate/recipeAnalysisApp.js";
import { createUnavailableSponsorAuthorizer } from "../../src/adgate/sponsorAuthorization.js";

describe("recipe analysis route composition", () => {
  it("uses only sponsor authorization when Authorization is present", async () => {
    let paymentCalls = 0;
    const observedEvidenceKinds: string[] = [];
    const app = createRecipeAnalysisApp({
      httpPolicy: createPaymentHttpPolicy({
        allowedOrigins: ["https://demo.example"],
      }),
      paymentProtection: {
        handle: async () => {
          paymentCalls += 1;
          throw new Error(
            "sponsor access must not enter payment authorization",
          );
        },
      },
      paymentReadiness: Promise.resolve({
        type: "unavailable",
        error: {
          code: "DEPENDENCY_UNAVAILABLE",
          message: "Payment verification is temporarily unavailable.",
          retryable: true,
        },
      }),
      sponsorAuthorizer: {
        handle: async ({ parsedRequest }, next) =>
          Response.json(
            await next(parsedRequest, {
              kind: "sponsor_grant",
              grantId: "grant-123",
              resourceId: "recipe_analysis",
              issuedAt: "2026-08-30T00:00:00.000Z",
              expiresAt: "2026-08-30T00:05:00.000Z",
              nonce: "nonce-123",
            }),
          ),
      },
      premiumHandler: async (request, evidence) => {
        observedEvidenceKinds.push(evidence.kind);
        return {
          ok: true,
          requestId: request.requestId,
          resourceId: "recipe_analysis",
          access: { kind: "sponsor_grant", referenceId: "grant-123" },
          data: {
            summary: "Sponsor-authorized analysis.",
            nutritionalInsights: ["A sponsor insight."],
            suggestions: ["A sponsor suggestion."],
            disclaimer: "General information only.",
          },
        };
      },
    });

    const response = await app.request("/api/recipe-analysis", {
      method: "POST",
      headers: {
        Authorization: "Sponsor opaque-token",
        "Content-Type": "application/json",
        "Idempotency-Key": "idempotency-key-123",
        Origin: "https://demo.example",
      },
      body: JSON.stringify({
        requestId: "request-123",
        idempotencyKey: "idempotency-key-123",
        resourceId: "recipe_analysis",
        input: { recipeId: "roasted-chickpea-quinoa-bowl" },
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      access: { kind: "sponsor_grant", referenceId: "grant-123" },
    });
    expect(observedEvidenceKinds).toEqual(["sponsor_grant"]);
    expect(paymentCalls).toBe(0);
  });

  it("passes the same premium handler instance to both access branches", async () => {
    const receivedHandlers: PremiumAnalysisHandler[] = [];
    const receivedEvidenceKinds: string[] = [];
    const premiumHandler: PremiumAnalysisHandler = async (
      request,
      evidence,
    ) => {
      receivedEvidenceKinds.push(evidence.kind);
      return {
        ok: true,
        requestId: request.requestId,
        resourceId: "recipe_analysis",
        access: {
          kind: evidence.kind,
          referenceId:
            evidence.kind === "sponsor_grant"
              ? evidence.grantId
              : evidence.transactionHash,
        },
        data: {
          summary: "Shared premium analysis.",
          nutritionalInsights: ["A shared insight."],
          suggestions: ["A shared suggestion."],
          disclaimer: "General information only.",
        },
      };
    };
    const app = createRecipeAnalysisApp({
      httpPolicy: createPaymentHttpPolicy({
        allowedOrigins: ["https://demo.example"],
      }),
      paymentProtection: {
        handle: async ({ parsedRequest }, next) => {
          receivedHandlers.push(next);
          return Response.json(
            await next(parsedRequest, {
              kind: "x402_payment",
              resourceId: "recipe_analysis",
              paymentRequestId: parsedRequest.requestId,
              transactionHash: `0x${"1".repeat(64)}`,
              network: "eip155:84532",
              asset: `0x${"2".repeat(40)}`,
              amount: "10000",
              confirmedAt: "2026-08-30T00:00:10.000Z",
            }),
          );
        },
      },
      paymentReadiness: Promise.resolve({ type: "ready" }),
      premiumHandler,
      sponsorAuthorizer: {
        handle: async ({ parsedRequest }, next) => {
          receivedHandlers.push(next);
          return Response.json(
            await next(parsedRequest, {
              kind: "sponsor_grant",
              grantId: "grant-shared-handler",
              resourceId: "recipe_analysis",
              issuedAt: "2026-08-30T00:00:00.000Z",
              expiresAt: "2026-08-30T00:05:00.000Z",
              nonce: "nonce-shared-handler",
            }),
          );
        },
      },
    });
    const request = async (
      requestId: string,
      idempotencyKey: string,
      authorization?: string,
    ) =>
      app.request("/api/recipe-analysis", {
        method: "POST",
        headers: {
          ...(authorization === undefined
            ? {}
            : { Authorization: authorization }),
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
          Origin: "https://demo.example",
        },
        body: JSON.stringify({
          requestId,
          idempotencyKey,
          resourceId: "recipe_analysis",
          input: { recipeId: "roasted-chickpea-quinoa-bowl" },
        }),
      });

    const sponsorResponse = await request(
      "request-sponsor",
      "idempotency-key-sponsor",
      "Sponsor opaque-token",
    );
    const paymentResponse = await request(
      "request-payment",
      "idempotency-key-payment",
    );

    expect(sponsorResponse.status).toBe(200);
    expect(paymentResponse.status).toBe(200);
    expect(receivedHandlers).toHaveLength(2);
    expect(receivedHandlers[0]).toBe(premiumHandler);
    expect(receivedHandlers[1]).toBe(premiumHandler);
    expect(receivedEvidenceKinds).toEqual(["sponsor_grant", "x402_payment"]);
  });

  it("returns the payment challenge for a valid unauthenticated request", async () => {
    let sponsorCalls = 0;
    const paymentProtection = createPaymentProtection({
      registry: createProtectedAttemptRegistry({ now: () => 0 }),
      payment: {
        authorize: async () => ({
          type: "challenge",
          response: Response.json(
            {
              x402Version: 2,
              accepts: [
                {
                  scheme: "exact",
                  network: "eip155:84532",
                  amount: "10000",
                },
              ],
            },
            { status: 402 },
          ),
        }),
      },
    });
    const app = createRecipeAnalysisApp({
      httpPolicy: createPaymentHttpPolicy({
        allowedOrigins: ["https://demo.example"],
      }),
      paymentProtection,
      paymentReadiness: Promise.resolve({ type: "ready" }),
      premiumHandler: async () => {
        throw new Error("unpaid request must not execute the handler");
      },
      sponsorAuthorizer: {
        handle: async () => {
          sponsorCalls += 1;
          throw new Error(
            "payment access must not enter sponsor authorization",
          );
        },
      },
    });

    const response = await app.request("/api/recipe-analysis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "idempotency-key-123",
        Origin: "https://demo.example",
      },
      body: JSON.stringify({
        requestId: "request-123",
        idempotencyKey: "idempotency-key-123",
        resourceId: "recipe_analysis",
        input: { recipeId: "roasted-chickpea-quinoa-bowl" },
      }),
    });

    expect(response.status).toBe(402);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://demo.example",
    );
    expect(response.headers.get("access-control-expose-headers")).toBe(
      "Payment-Required, Payment-Response, X-Payment-Response",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("vary")).toBe("Origin");
    expect(await response.json()).toMatchObject({ x402Version: 2 });
    expect(sponsorCalls).toBe(0);
  });

  it("does not fall through to payment when sponsor authorization fails", async () => {
    let paymentCalls = 0;
    let handlerCalls = 0;
    const app = createRecipeAnalysisApp({
      httpPolicy: createPaymentHttpPolicy({
        allowedOrigins: ["https://demo.example"],
      }),
      paymentProtection: {
        handle: async () => {
          paymentCalls += 1;
          throw new Error("invalid sponsor must not fall through to payment");
        },
      },
      paymentReadiness: Promise.resolve({ type: "ready" }),
      premiumHandler: async () => {
        handlerCalls += 1;
        throw new Error("invalid sponsor must not execute premium analysis");
      },
      sponsorAuthorizer: {
        handle: async () =>
          Response.json(
            {
              ok: false,
              error: {
                code: "INVALID_EVIDENCE",
                message: "Sponsor authorization is invalid.",
                retryable: false,
              },
            },
            { status: 401 },
          ),
      },
    });

    const response = await app.request("/api/recipe-analysis", {
      method: "POST",
      headers: {
        Authorization: "",
        "Content-Type": "application/json",
        "Idempotency-Key": "idempotency-key-123",
        Origin: "https://demo.example",
      },
      body: JSON.stringify({
        requestId: "request-123",
        idempotencyKey: "idempotency-key-123",
        resourceId: "recipe_analysis",
        input: { recipeId: "roasted-chickpea-quinoa-bowl" },
      }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "INVALID_EVIDENCE" },
    });
    expect(paymentCalls).toBe(0);
    expect(handlerCalls).toBe(0);
  });

  it("keeps process health available while the paid route is unavailable", async () => {
    let paymentCalls = 0;
    const app = createRecipeAnalysisApp({
      httpPolicy: createPaymentHttpPolicy({
        allowedOrigins: ["https://demo.example"],
      }),
      paymentProtection: {
        handle: async () => {
          paymentCalls += 1;
          throw new Error("unavailable payment must not be authorized");
        },
      },
      paymentReadiness: Promise.resolve({
        type: "unavailable",
        error: {
          code: "DEPENDENCY_UNAVAILABLE",
          message: "Payment verification is temporarily unavailable.",
          retryable: true,
        },
      }),
      premiumHandler: async () => {
        throw new Error("unavailable payment must not execute the handler");
      },
      sponsorAuthorizer: createUnavailableSponsorAuthorizer(),
    });

    const healthResponse = await app.request("/health");
    expect(healthResponse.status).toBe(200);

    const paymentResponse = await app.request("/api/recipe-analysis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "idempotency-key-123",
        Origin: "https://demo.example",
      },
      body: JSON.stringify({
        requestId: "request-123",
        idempotencyKey: "idempotency-key-123",
        resourceId: "recipe_analysis",
        input: { recipeId: "roasted-chickpea-quinoa-bowl" },
      }),
    });

    expect(paymentResponse.status).toBe(503);
    expect(await paymentResponse.json()).toEqual({
      ok: false,
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "Payment verification is temporarily unavailable.",
        retryable: true,
      },
    });
    expect(paymentCalls).toBe(0);
  });

  it("mounts the injected preview router only for an explicit non-production opt-in", async () => {
    const previewRouter = new Hono().get("/", (context) =>
      context.json({ preview: true }),
    );
    const createApp = (
      environment: "development" | "test" | "production",
      explicitlyEnabled: boolean,
    ) =>
      createRecipeAnalysisApp({
        httpPolicy: createPaymentHttpPolicy({
          allowedOrigins: ["https://demo.example"],
        }),
        paymentProtection: {
          handle: async () => {
            throw new Error("preview must not enter payment authorization");
          },
        },
        paymentReadiness: Promise.resolve({ type: "ready" }),
        preview: { environment, explicitlyEnabled, router: previewRouter },
        premiumHandler: async () => {
          throw new Error("preview must not execute premium analysis");
        },
        sponsorAuthorizer: createUnavailableSponsorAuthorizer(),
      });

    expect(
      (
        await createApp("production", true).request(
          "/api/recipe-analysis/preview",
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await createApp("development", false).request(
          "/api/recipe-analysis/preview",
        )
      ).status,
    ).toBe(404);

    const developmentResponse = await createApp("development", true).request(
      "/api/recipe-analysis/preview",
    );
    expect(developmentResponse.status).toBe(200);
    expect(await developmentResponse.json()).toEqual({ preview: true });
  });
});
