import { encodePaymentRequiredHeader } from "@x402/core/http";
import type { PaymentRequired } from "@x402/core/types";
import { describe, expect, it } from "vitest";
import type { PremiumAnalysisRequest } from "../../../src/adgate/contracts.js";
import { createChallengeClient } from "../../../src/adgate/payment/challenge.js";

const asset = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const payTo = "0x0000000000000000000000000000000000000001";
const request: PremiumAnalysisRequest = {
  requestId: "request-402",
  idempotencyKey: "idempotency-key-402",
  resourceId: "recipe_analysis",
  input: { recipeId: "roasted-chickpea-quinoa-bowl" },
};

const challenge = {
  x402Version: 2,
  resource: { url: "recipe_analysis" },
  accepts: [
    {
      scheme: "exact",
      network: "eip155:84532",
      asset,
      amount: "10000",
      payTo,
      maxTimeoutSeconds: 60,
      extra: { name: "USDC", version: "2" },
    },
  ],
} satisfies PaymentRequired;

describe("ChallengeClient", () => {
  it("returns the one safe server-derived Base Sepolia offer", async () => {
    const client = createChallengeClient({
      acceptedAsset: asset,
      endpoint: "/api/recipe-analysis",
      fetch: async () =>
        new Response(null, {
          status: 402,
          headers: {
            "Payment-Required": encodePaymentRequiredHeader(challenge),
          },
        }),
    });

    await expect(client.request(request)).resolves.toEqual({
      type: "challenge",
      value: {
        requestId: "request-402",
        requirements: [
          {
            scheme: "exact",
            network: "eip155:84532",
            asset,
            amount: "10000",
            payTo,
            maxTimeoutSeconds: 60,
            resource: "recipe_analysis",
            extra: { name: "USDC", version: "2" },
          },
        ],
      },
    });
  });

  it.each([
    ["missing offer", { ...challenge, accepts: [] }],
    [
      "multiple offers",
      { ...challenge, accepts: [...challenge.accepts, ...challenge.accepts] },
    ],
    ["wrong resource", { ...challenge, resource: { url: "another_resource" } }],
    [
      "wrong scheme",
      { ...challenge, accepts: [{ ...challenge.accepts[0], scheme: "upto" }] },
    ],
    [
      "wrong network",
      {
        ...challenge,
        accepts: [{ ...challenge.accepts[0], network: "eip155:8453" }],
      },
    ],
    [
      "wrong asset",
      {
        ...challenge,
        accepts: [
          {
            ...challenge.accepts[0],
            asset: "0x0000000000000000000000000000000000000002",
          },
        ],
      },
    ],
    [
      "invalid amount",
      { ...challenge, accepts: [{ ...challenge.accepts[0], amount: "0" }] },
    ],
    [
      "invalid address",
      { ...challenge, accepts: [{ ...challenge.accepts[0], payTo: "0x1234" }] },
    ],
  ])("rejects a %s before payment", async (_name, unsafeChallenge) => {
    const client = createChallengeClient({
      acceptedAsset: asset,
      endpoint: "/api/recipe-analysis",
      fetch: async () => Response.json(unsafeChallenge, { status: 402 }),
    });

    await expect(client.request(request)).resolves.toMatchObject({
      type: "error",
      value: { code: "INVALID_EVIDENCE", retryable: false },
    });
  });
});
