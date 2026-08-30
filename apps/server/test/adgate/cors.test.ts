import { describe, expect, it } from "vitest";
import { createPaymentHttpPolicy } from "../../src/adgate/cors.js";
import { createRecipeAnalysisApp } from "../../src/adgate/recipeAnalysisApp.js";
import { createUnavailableSponsorAuthorizer } from "../../src/adgate/sponsorAuthorization.js";

const frontendOrigin = "https://demo.example";

describe("payment HTTP policy", () => {
  it("answers an allowed browser preflight without entering payment authorization", async () => {
    let paymentCalls = 0;
    const app = createRecipeAnalysisApp({
      httpPolicy: createPaymentHttpPolicy({
        allowedOrigins: [frontendOrigin],
      }),
      paymentProtection: {
        handle: async () => {
          paymentCalls += 1;
          throw new Error("preflight must not enter payment authorization");
        },
      },
      paymentReadiness: Promise.resolve({ type: "ready" }),
      premiumHandler: async () => {
        throw new Error("preflight must not execute premium analysis");
      },
      sponsorAuthorizer: createUnavailableSponsorAuthorizer(),
    });

    const response = await app.request("/api/recipe-analysis", {
      method: "OPTIONS",
      headers: {
        Origin: frontendOrigin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers":
          "Authorization, Content-Type, Idempotency-Key, Payment-Signature",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      frontendOrigin,
    );
    expect(response.headers.get("access-control-allow-methods")).toBe(
      "OPTIONS, POST",
    );
    expect(response.headers.get("access-control-allow-headers")).toBe(
      "Authorization, Content-Type, Idempotency-Key, Payment-Signature, X-Payment",
    );
    expect(response.headers.get("access-control-expose-headers")).toBe(
      "Payment-Required, Payment-Response, X-Payment-Response",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("vary")).toBe("Origin");
    expect(paymentCalls).toBe(0);
  });

  it("rejects empty, wildcard, and non-origin allowlist entries", () => {
    for (const allowedOrigins of [
      [],
      ["*"],
      ["https://demo.example/path"],
      ["not-an-origin"],
    ]) {
      expect(() => createPaymentHttpPolicy({ allowedOrigins })).toThrow(
        "Allowed origins must be absolute HTTP origins.",
      );
    }
  });

  it("rejects a disallowed origin before exposing a payment challenge", async () => {
    let paymentCalls = 0;
    const app = createRecipeAnalysisApp({
      httpPolicy: createPaymentHttpPolicy({
        allowedOrigins: [frontendOrigin],
      }),
      paymentProtection: {
        handle: async () => {
          paymentCalls += 1;
          return Response.json({ secretChallenge: true }, { status: 402 });
        },
      },
      paymentReadiness: Promise.resolve({ type: "ready" }),
      premiumHandler: async () => {
        throw new Error("disallowed origin must not execute premium analysis");
      },
      sponsorAuthorizer: createUnavailableSponsorAuthorizer(),
    });

    const response = await app.request("/api/recipe-analysis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "idempotency-key-123",
        Origin: "https://attacker.example",
      },
      body: JSON.stringify({
        requestId: "request-123",
        idempotencyKey: "idempotency-key-123",
        resourceId: "recipe_analysis",
        input: { recipeId: "roasted-chickpea-quinoa-bowl" },
      }),
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("vary")).toBe("Origin");
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "INVALID_EVIDENCE",
        message: "The request origin is not allowed.",
        retryable: false,
      },
    });
    expect(paymentCalls).toBe(0);
  });

  it("applies no-store and safe CORS headers to an unexpected server error", async () => {
    const app = createRecipeAnalysisApp({
      httpPolicy: createPaymentHttpPolicy({
        allowedOrigins: [frontendOrigin],
      }),
      paymentProtection: {
        handle: async () => {
          throw new Error("PAYMENT_SIGNATURE=private raw dependency response");
        },
      },
      paymentReadiness: Promise.resolve({ type: "ready" }),
      premiumHandler: async () => {
        throw new Error("unexpected premium handler call");
      },
      sponsorAuthorizer: createUnavailableSponsorAuthorizer(),
    });

    const response = await app.request("/api/recipe-analysis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "idempotency-key-123",
        Origin: frontendOrigin,
      },
      body: JSON.stringify({
        requestId: "request-123",
        idempotencyKey: "idempotency-key-123",
        resourceId: "recipe_analysis",
        input: { recipeId: "roasted-chickpea-quinoa-bowl" },
      }),
    });

    expect(response.status).toBe(500);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      frontendOrigin,
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("vary")).toBe("Origin");
    expect(await response.text()).not.toContain("PAYMENT_SIGNATURE");
  });
});
