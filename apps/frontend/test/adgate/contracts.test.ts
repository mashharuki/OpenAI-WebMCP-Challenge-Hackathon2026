import { describe, expect, it } from "vitest";
import fixtures from "../../../../test/fixtures/adgate-contracts.json";
import {
  adGateErrorEnvelopeSchema,
  normalizeContractError,
  normalizeWebMCPResult,
  paymentAccessEvidenceSchema,
  paymentReceiptSchema,
  premiumAnalysisRequestSchema,
  premiumAnalysisSuccessSchema,
  recipeAnalysisInputSchema,
  recipeAnalysisResultSchema,
  sponsorAccessEvidenceSchema,
} from "../../src/adgate/contracts";
import {
  type GateEvent,
  type GateState,
  transitionGate,
} from "../../src/adgate/gateMachine";

type FixtureCase = {
  name: string;
  contract: string;
  expect: "valid" | "invalid";
  targets: string[];
  value: unknown;
  errorCode?: string;
};

const fixtureCases = fixtures.cases as FixtureCase[];
const fixtureValue = (name: string): Record<string, unknown> => {
  const fixture = fixtureCases.find((candidate) => candidate.name === name);
  if (!fixture || typeof fixture.value !== "object" || fixture.value === null) {
    throw new Error(`Missing object fixture: ${name}`);
  }
  return fixture.value as Record<string, unknown>;
};

const frontendContractRegistry: Record<
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
  it("evaluates every frontend case against its named schema", () => {
    expect(fixtures.schemaVersion).toBe(1);
    for (const fixture of fixtureCases.filter(({ targets }) =>
      targets.includes("frontend"),
    )) {
      if (fixture.contract === "GateTransition") {
        const value = fixture.value as {
          state: GateState;
          event: GateEvent;
          expectedState?: GateState;
        };
        const result = transitionGate(value.state, value.event);
        expect(result.ok, fixture.name).toBe(fixture.expect === "valid");
        if (result.ok) {
          expect(result.state, fixture.name).toEqual(value.expectedState);
        } else {
          expect(result.state, fixture.name).toEqual(value.state);
          expect(result.error.code, fixture.name).toBe(fixture.errorCode);
        }
        continue;
      }
      const schema = frontendContractRegistry[fixture.contract];
      expect(schema, fixture.name).toBeDefined();
      if (!schema) throw new Error(`Unknown contract: ${fixture.contract}`);
      expect(schema.safeParse(fixture.value).success, fixture.name).toBe(
        fixture.expect === "valid",
      );
    }
  });
});

describe("recipeAnalysisInputSchema", () => {
  it("accepts only the published recipe id and optional dietary goals", () => {
    expect(
      recipeAnalysisInputSchema.parse({
        recipeId: "roasted-chickpea-quinoa-bowl",
        dietaryGoals: ["higher protein"],
      }),
    ).toEqual({
      recipeId: "roasted-chickpea-quinoa-bowl",
      dietaryGoals: ["higher protein"],
    });

    expect(() =>
      recipeAnalysisInputSchema.parse({
        recipeId: "roasted-chickpea-quinoa-bowl",
        recipeTitle: "Agent supplied recipe",
      }),
    ).toThrow();
  });
});

describe("paymentAccessEvidenceSchema", () => {
  it("accepts canonical payment evidence", () => {
    expect(
      paymentAccessEvidenceSchema.parse(fixtureValue("valid-payment-evidence")),
    ).toEqual(fixtureValue("valid-payment-evidence"));
  });
});

describe("paymentReceiptSchema", () => {
  it("accepts only normalized Base Sepolia base-unit receipts", () => {
    expect(
      paymentReceiptSchema.parse(fixtureValue("valid-payment-receipt")),
    ).toEqual(fixtureValue("valid-payment-receipt"));
    expect(() =>
      paymentReceiptSchema.parse(fixtureValue("invalid-payment-receipt")),
    ).toThrow();
  });
});

describe("normalizeContractError", () => {
  it("replaces unknown failures with a stable secretless error", () => {
    const error = normalizeContractError(
      new Error("PRIVATE_KEY=0xsecret stack and provider response"),
    );

    expect(error).toEqual({
      code: "INTERNAL_ERROR",
      message: "The request could not be completed safely.",
      retryable: false,
    });
    expect(JSON.stringify(error)).not.toContain("secret");
  });

  it("normalizes validation failures without echoing rejected values", () => {
    const parsed = recipeAnalysisInputSchema.safeParse({
      recipeId: "private-agent-value",
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    expect(normalizeContractError(parsed.error, "correlation-123")).toEqual({
      code: "INVALID_INPUT",
      message: "The request input is invalid.",
      retryable: false,
      correlationId: "correlation-123",
      issues: [{ path: "recipeId", message: "Invalid input" }],
    });
  });
});

describe("sponsorAccessEvidenceSchema", () => {
  it("accepts bounded public evidence and rejects reusable secrets", () => {
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

describe("normalizeWebMCPResult", () => {
  it("returns a strict JSON-safe host result without payment or grant secrets", () => {
    const success = premiumAnalysisSuccessSchema.parse({
      ok: true,
      requestId: "request-123",
      resourceId: "recipe_analysis",
      access: { kind: "x402_payment", referenceId: "0xreceipt" },
      data: fixtureValue("valid-analysis-result"),
    });

    expect(normalizeWebMCPResult(success)).toEqual({
      ok: true,
      resourceId: "recipe_analysis",
      data: fixtureValue("valid-analysis-result"),
    });

    const failure = adGateErrorEnvelopeSchema.parse({
      ok: false,
      error: {
        code: "ACCESS_REQUIRED",
        message: "Choose an access method.",
        retryable: true,
      },
    });
    expect(normalizeWebMCPResult(failure)).toEqual(failure);
  });

  it("round-trips through JSON without undefined, Date, or bigint values", () => {
    const normalized = normalizeWebMCPResult(
      premiumAnalysisSuccessSchema.parse({
        ok: true,
        requestId: "request-123",
        resourceId: "recipe_analysis",
        access: { kind: "sponsor_grant", referenceId: "grant-123" },
        data: fixtureValue("valid-analysis-result"),
      }),
    );
    const json = JSON.stringify(normalized, (_key, value) => {
      expect(value).not.toBeInstanceOf(Date);
      expect(typeof value).not.toBe("undefined");
      expect(typeof value).not.toBe("bigint");
      return value;
    });

    expect(JSON.parse(json)).toEqual(normalized);
    expect(
      recipeAnalysisInputSchema.safeParse({
        recipeId: "roasted-chickpea-quinoa-bowl",
        dietaryGoals: undefined,
      }).success,
    ).toBe(false);
    expect(
      recipeAnalysisResultSchema.safeParse({
        ...fixtureValue("valid-analysis-result"),
        summary: new Date(),
      }).success,
    ).toBe(false);
    expect(
      paymentAccessEvidenceSchema.safeParse({
        ...fixtureValue("valid-payment-evidence"),
        amount: 10n,
      }).success,
    ).toBe(false);
  });
});

describe("bounded contract fields", () => {
  it.each([
    [
      "dietary goal length",
      recipeAnalysisInputSchema,
      {
        recipeId: "roasted-chickpea-quinoa-bowl",
        dietaryGoals: ["x".repeat(81)],
      },
    ],
    [
      "dietary goal count",
      recipeAnalysisInputSchema,
      {
        recipeId: "roasted-chickpea-quinoa-bowl",
        dietaryGoals: Array.from({ length: 11 }, () => "goal"),
      },
    ],
    [
      "summary length",
      recipeAnalysisResultSchema,
      {
        ...fixtureValue("valid-analysis-result"),
        summary: "x".repeat(1001),
      },
    ],
    [
      "insight length",
      recipeAnalysisResultSchema,
      {
        ...fixtureValue("valid-analysis-result"),
        nutritionalInsights: ["x".repeat(301)],
      },
    ],
    [
      "insight count",
      recipeAnalysisResultSchema,
      {
        ...fixtureValue("valid-analysis-result"),
        nutritionalInsights: Array.from({ length: 11 }, () => "insight"),
      },
    ],
    [
      "suggestion length",
      recipeAnalysisResultSchema,
      {
        ...fixtureValue("valid-analysis-result"),
        suggestions: ["x".repeat(301)],
      },
    ],
    [
      "suggestion count",
      recipeAnalysisResultSchema,
      {
        ...fixtureValue("valid-analysis-result"),
        suggestions: Array.from({ length: 11 }, () => "suggestion"),
      },
    ],
    [
      "disclaimer length",
      recipeAnalysisResultSchema,
      {
        ...fixtureValue("valid-analysis-result"),
        disclaimer: "x".repeat(501),
      },
    ],
  ])("rejects a value exceeding the %s limit", (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });
});

describe("recipeAnalysisResultSchema", () => {
  it("accepts the shared result fixture and rejects unsafe extra data", () => {
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
