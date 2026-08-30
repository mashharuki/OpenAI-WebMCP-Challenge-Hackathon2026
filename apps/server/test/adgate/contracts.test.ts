import { describe, expect, it } from "vitest";
import fixtures from "../../../../test/fixtures/adgate-contracts.json";
import {
  adGateErrorEnvelopeSchema,
  normalizeContractError,
  paymentAccessEvidenceSchema,
  paymentReceiptSchema,
  premiumAnalysisRequestSchema,
  premiumAnalysisSuccessSchema,
  recipeAnalysisInputSchema,
  recipeAnalysisResultSchema,
  sponsorAccessEvidenceSchema,
} from "../../src/adgate/contracts.js";

type FixtureCase = {
  name: string;
  contract: string;
  expect: "valid" | "invalid";
  targets: string[];
  value: unknown;
};

const fixtureCases = fixtures.cases as FixtureCase[];
const fixtureValue = (name: string): Record<string, unknown> => {
  const fixture = fixtureCases.find((candidate) => candidate.name === name);
  if (!fixture || typeof fixture.value !== "object" || fixture.value === null) {
    throw new Error(`Missing object fixture: ${name}`);
  }
  return fixture.value as Record<string, unknown>;
};

const serverContractRegistry: Record<
  string,
  { safeParse(value: unknown): { success: boolean } }
> = {
  AdGateErrorEnvelope: adGateErrorEnvelopeSchema,
  PaymentAccessEvidence: paymentAccessEvidenceSchema,
  PaymentReceipt: paymentReceiptSchema,
  PremiumAnalysisRequest: premiumAnalysisRequestSchema,
  PremiumAnalysisSuccess: premiumAnalysisSuccessSchema,
  RecipeAnalysisInput: recipeAnalysisInputSchema,
  RecipeAnalysisResult: recipeAnalysisResultSchema,
  SponsorAccessEvidence: sponsorAccessEvidenceSchema,
};

describe("versioned cross-app conformance fixtures", () => {
  it("evaluates every server case against its named schema", () => {
    expect(fixtures.schemaVersion).toBe(1);
    for (const fixture of fixtureCases.filter(({ targets }) =>
      targets.includes("server"),
    )) {
      const schema = serverContractRegistry[fixture.contract];
      expect(schema, fixture.name).toBeDefined();
      if (!schema) throw new Error(`Unknown contract: ${fixture.contract}`);
      expect(schema.safeParse(fixture.value).success, fixture.name).toBe(
        fixture.expect === "valid",
      );
    }
  });
});

describe("premiumAnalysisRequestSchema", () => {
  it("accepts one canonical recipe request and rejects unknown input fields", () => {
    const request = {
      requestId: "request-123",
      idempotencyKey: "idempotency-key-123",
      resourceId: "recipe_analysis",
      input: {
        recipeId: "roasted-chickpea-quinoa-bowl",
        dietaryGoals: ["higher protein"],
      },
    };

    expect(premiumAnalysisRequestSchema.parse(request)).toEqual(request);
    expect(() =>
      premiumAnalysisRequestSchema.parse({
        ...request,
        input: { ...request.input, ingredients: ["agent supplied"] },
      }),
    ).toThrow();
  });
});

describe("paymentAccessEvidenceSchema", () => {
  it("agrees with the browser payment evidence fixture", () => {
    expect(
      paymentAccessEvidenceSchema.parse(fixtureValue("valid-payment-evidence")),
    ).toEqual(fixtureValue("valid-payment-evidence"));
  });
});

describe("paymentReceiptSchema", () => {
  it("agrees with the browser payment receipt fixtures", () => {
    expect(
      paymentReceiptSchema.parse(fixtureValue("valid-payment-receipt")),
    ).toEqual(fixtureValue("valid-payment-receipt"));
    expect(() =>
      paymentReceiptSchema.parse(fixtureValue("invalid-payment-receipt")),
    ).toThrow();
  });
});

describe("normalizeContractError", () => {
  it("does not expose unknown server failures", () => {
    const error = normalizeContractError(
      new Error("PAYMENT_SIGNATURE=secret facilitator response"),
    );

    expect(error).toEqual({
      code: "INTERNAL_ERROR",
      message: "The request could not be completed safely.",
      retryable: false,
    });
    expect(JSON.stringify(error)).not.toContain("secret");
  });

  it("normalizes validation failures without echoing rejected values", () => {
    const parsed = premiumAnalysisRequestSchema.safeParse({
      requestId: "request-123",
      idempotencyKey: "too-short",
      resourceId: "recipe_analysis",
      input: { recipeId: "private-agent-value" },
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const error = normalizeContractError(parsed.error, "correlation-123");
    expect(error.code).toBe("INVALID_INPUT");
    expect(error.retryable).toBe(false);
    expect(error.correlationId).toBe("correlation-123");
    expect(JSON.stringify(error)).not.toContain("private-agent-value");
  });
});

describe("sponsorAccessEvidenceSchema", () => {
  it("agrees with the browser evidence fixtures", () => {
    expect(
      sponsorAccessEvidenceSchema.parse(fixtureValue("valid-sponsor-evidence")),
    ).toEqual(fixtureValue("valid-sponsor-evidence"));
    expect(() =>
      sponsorAccessEvidenceSchema.parse(
        fixtureValue("invalid-sponsor-evidence-secret"),
      ),
    ).toThrow();
    expect(() =>
      sponsorAccessEvidenceSchema.parse(
        fixtureValue("invalid-sponsor-expiry-equality"),
      ),
    ).toThrow();
  });
});

describe("HTTP response envelopes", () => {
  it("strictly validates premium success and public error responses", () => {
    const success = {
      ok: true,
      requestId: "request-123",
      resourceId: "recipe_analysis",
      access: { kind: "sponsor_grant", referenceId: "grant-123" },
      data: fixtureValue("valid-analysis-result"),
    };
    expect(premiumAnalysisSuccessSchema.parse(success)).toEqual(success);

    const failure = {
      ok: false,
      error: {
        code: "ACCESS_REQUIRED",
        message: "Choose an access method.",
        retryable: true,
      },
    };
    expect(adGateErrorEnvelopeSchema.parse(failure)).toEqual(failure);
    expect(() =>
      adGateErrorEnvelopeSchema.parse({ ...failure, stack: "secret" }),
    ).toThrow();
  });
});

describe("recipeAnalysisResultSchema", () => {
  it("agrees with the browser contract fixtures", () => {
    expect(
      recipeAnalysisResultSchema.parse(fixtureValue("valid-analysis-result")),
    ).toEqual(fixtureValue("valid-analysis-result"));
    expect(() =>
      recipeAnalysisResultSchema.parse(
        fixtureValue("invalid-analysis-result-secret"),
      ),
    ).toThrow();
  });
});
