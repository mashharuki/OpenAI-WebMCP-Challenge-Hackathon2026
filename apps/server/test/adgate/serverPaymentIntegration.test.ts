import { describe, expect, it } from "vitest";
import type {
  PaymentAccessEvidence,
  PremiumAnalysisRequest,
} from "../../src/adgate/contracts.js";
import { createPaymentHttpPolicy } from "../../src/adgate/cors.js";
import { createProtectedAttemptRegistry } from "../../src/adgate/idempotency.js";
import type { PaymentAuthorizationPort } from "../../src/adgate/paymentProtection.js";
import { createPaymentProtection } from "../../src/adgate/paymentProtection.js";
import { createRecipeAnalysisApp } from "../../src/adgate/recipeAnalysisApp.js";
import { createUnavailableSponsorAuthorizer } from "../../src/adgate/sponsorAuthorization.js";

const origin = "https://demo.example";
const transaction = `0x${"1".repeat(64)}`;
const asset = `0x${"2".repeat(40)}`;
const canonicalRequest: PremiumAnalysisRequest = {
  requestId: "request-integration",
  idempotencyKey: "idempotency-key-integration",
  resourceId: "recipe_analysis",
  input: { recipeId: "roasted-chickpea-quinoa-bowl" },
};
const evidence: PaymentAccessEvidence = {
  kind: "x402_payment",
  resourceId: "recipe_analysis",
  paymentRequestId: canonicalRequest.requestId,
  transactionHash: transaction,
  network: "eip155:84532",
  asset,
  amount: "10000",
  confirmedAt: "2026-08-30T00:00:10.000Z",
};

const challenge = () =>
  Response.json(
    {
      x402Version: 2,
      resource: { url: "recipe_analysis" },
      accepts: [
        {
          scheme: "exact",
          network: "eip155:84532",
          asset,
          amount: "10000",
          payTo: `0x${"3".repeat(40)}`,
          maxTimeoutSeconds: 60,
          extra: { name: "USDC", version: "2" },
        },
      ],
    },
    {
      status: 402,
      headers: { "Payment-Required": "opaque-challenge" },
    },
  );

const createHarness = (payment: PaymentAuthorizationPort) => {
  let handlerCalls = 0;
  const observedEvidence: PaymentAccessEvidence[] = [];
  const app = createRecipeAnalysisApp({
    httpPolicy: createPaymentHttpPolicy({ allowedOrigins: [origin] }),
    paymentProtection: createPaymentProtection({
      registry: createProtectedAttemptRegistry({ now: () => 0 }),
      payment,
    }),
    paymentReadiness: Promise.resolve({ type: "ready" }),
    sponsorAuthorizer: createUnavailableSponsorAuthorizer(),
    premiumHandler: async (request, access) => {
      handlerCalls += 1;
      if (access.kind !== "x402_payment") {
        throw new Error("payment harness accepts payment evidence only");
      }
      observedEvidence.push(access);
      return {
        ok: true,
        requestId: request.requestId,
        resourceId: "recipe_analysis",
        access: {
          kind: "x402_payment",
          referenceId: access.transactionHash,
        },
        data: {
          summary: "A paid recipe analysis.",
          nutritionalInsights: ["A canonical integration insight."],
          suggestions: ["A canonical integration suggestion."],
          disclaimer: "General information only.",
        },
      };
    },
  });

  const post = (
    request: PremiumAnalysisRequest = canonicalRequest,
    paymentSignature?: string,
    requestOrigin = origin,
  ) =>
    app.request("/api/recipe-analysis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": request.idempotencyKey,
        Origin: requestOrigin,
        ...(paymentSignature ? { "Payment-Signature": paymentSignature } : {}),
      },
      body: JSON.stringify(request),
    });

  return {
    app,
    post,
    get handlerCalls() {
      return handlerCalls;
    },
    observedEvidence,
  };
};

const expectPrivateResponsePolicy = (response: Response) => {
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("vary")).toBe("Origin");
  expect(response.headers.get("access-control-allow-origin")).toBe(origin);
  expect(response.headers.get("access-control-expose-headers")).toBe(
    "Payment-Required, Payment-Response, X-Payment-Response",
  );
};

describe("ServerPaymentTestHarness", () => {
  it("completes 402 to paid retry once with canonical evidence and settlement", async () => {
    let authorizationCalls = 0;
    let settlements = 0;
    const harness = createHarness({
      authorize: async (request) => {
        authorizationCalls += 1;
        if (!request.headers.has("Payment-Signature")) {
          return { type: "challenge", response: challenge() };
        }
        settlements += 1;
        return {
          type: "authorized",
          evidence,
          responseHeaders: { "Payment-Response": "opaque-settlement" },
        };
      },
    });

    const unpaid = await harness.post();
    expect(unpaid.status).toBe(402);
    expect(unpaid.headers.get("payment-required")).toBe("opaque-challenge");
    expectPrivateResponsePolicy(unpaid);
    expect(harness.handlerCalls).toBe(0);

    const paid = await harness.post(canonicalRequest, "signed-payment");
    expect(paid.status).toBe(200);
    expect(paid.headers.get("payment-response")).toBe("opaque-settlement");
    expectPrivateResponsePolicy(paid);
    expect(await paid.json()).toMatchObject({
      ok: true,
      access: { kind: "x402_payment", referenceId: transaction },
    });
    expect(harness.observedEvidence).toEqual([evidence]);

    const replay = await harness.post(canonicalRequest, "signed-payment");
    expect(replay.status).toBe(200);
    expect(harness.handlerCalls).toBe(1);
    expect(settlements).toBe(1);
    expect(authorizationCalls).toBe(2);

    const conflict = await harness.post(
      {
        ...canonicalRequest,
        input: {
          ...canonicalRequest.input,
          dietaryGoals: ["lower sodium"],
        },
      },
      "signed-payment",
    );
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({
      ok: false,
      error: { code: "IDEMPOTENCY_CONFLICT" },
    });
    expect(settlements).toBe(1);
  });

  it.each([
    [
      "verify failure",
      {
        ok: false as const,
        error: {
          code: "INVALID_EVIDENCE" as const,
          message: "Payment verification failed.",
          retryable: false,
        },
      },
      401,
    ],
    [
      "wrong network",
      {
        ok: false as const,
        error: {
          code: "INVALID_EVIDENCE" as const,
          message: "Payment network is invalid.",
          retryable: false,
        },
      },
      401,
    ],
  ])("fails closed on %s", async (_name, error, expectedStatus) => {
    const harness = createHarness({
      authorize: async () => ({ type: "error", error }),
    });

    const response = await harness.post(canonicalRequest, "bad-payment");

    expect(response.status).toBe(expectedStatus);
    expectPrivateResponsePolicy(response);
    expect(harness.handlerCalls).toBe(0);
  });

  it("sanitizes facilitator timeout and rejects disallowed origin before payment", async () => {
    let paymentCalls = 0;
    const harness = createHarness({
      authorize: async () => {
        paymentCalls += 1;
        throw new Error("raw facilitator timeout with secret payload");
      },
    });

    const timeout = await harness.post(canonicalRequest, "timed-out-payment");
    expect(timeout.status).toBe(503);
    expectPrivateResponsePolicy(timeout);
    expect(JSON.stringify(await timeout.json())).not.toContain("secret");
    expect(harness.handlerCalls).toBe(0);

    const blocked = await harness.post(
      canonicalRequest,
      "another-payment",
      "https://attacker.example",
    );
    expect(blocked.status).toBe(403);
    expect(blocked.headers.get("cache-control")).toBe("no-store");
    expect(blocked.headers.get("access-control-allow-origin")).toBeNull();
    expect(paymentCalls).toBe(1);
  });
});
