import { describe, expect, it } from "vitest";
import { recipeAnalysisResultSchema } from "../../src/adgate/contracts.js";
import { premiumAnalysisHandler } from "../../src/adgate/premiumAnalysis.js";

describe("premiumAnalysisHandler", () => {
  it("returns a deterministic canonical result bound to payment evidence", async () => {
    const request = {
      requestId: "request-123",
      idempotencyKey: "idempotency-key-123",
      resourceId: "recipe_analysis" as const,
      input: {
        recipeId: "roasted-chickpea-quinoa-bowl" as const,
        dietaryGoals: ["higher protein"],
      },
    };
    const evidence = {
      kind: "x402_payment" as const,
      resourceId: "recipe_analysis" as const,
      paymentRequestId: "request-123",
      transactionHash:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      network: "eip155:84532" as const,
      asset: "0x2222222222222222222222222222222222222222",
      amount: "10000",
      confirmedAt: "2026-08-30T00:00:10.000Z",
    };

    const first = await premiumAnalysisHandler(request, evidence);
    const second = await premiumAnalysisHandler(request, evidence);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      requestId: "request-123",
      access: {
        kind: "x402_payment",
        referenceId: evidence.transactionHash,
      },
    });
    if (first.ok) {
      expect(recipeAnalysisResultSchema.safeParse(first.data).success).toBe(
        true,
      );
      expect(first.data.suggestions.join(" ")).toContain("higher protein");
    }
  });
});
