import { z } from "zod";

export const RECIPE_ANALYSIS_RESOURCE_ID = "recipe_analysis" as const;
export const PUBLISHED_RECIPE_ID = "roasted-chickpea-quinoa-bowl" as const;

const hasNoExplicitUndefined = (value: Record<string, unknown>) =>
  Object.values(value).every((field) => field !== undefined);

export const recipeAnalysisInputSchema = z
  .object({
    recipeId: z.literal(PUBLISHED_RECIPE_ID),
    dietaryGoals: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
  })
  .strict()
  .refine(hasNoExplicitUndefined, {
    message: "explicit undefined values are not JSON-safe",
  });

export type RecipeAnalysisInput = z.infer<typeof recipeAnalysisInputSchema>;

export const recipeAnalysisResultSchema = z
  .object({
    summary: z.string().trim().min(1).max(1000),
    nutritionalInsights: z
      .array(z.string().trim().min(1).max(300))
      .min(1)
      .max(10),
    suggestions: z.array(z.string().trim().min(1).max(300)).min(1).max(10),
    disclaimer: z.string().trim().min(1).max(500),
  })
  .strict();

export type RecipeAnalysisResult = z.infer<typeof recipeAnalysisResultSchema>;

const requestIdSchema = z.string().trim().min(1).max(128);
const idempotencyKeySchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[\x21-\x7E]+$/);
const timestampSchema = z.string().datetime({ offset: false });

export const sponsorAccessEvidenceSchema = z
  .object({
    kind: z.literal("sponsor_grant"),
    grantId: z.string().trim().min(1).max(128),
    resourceId: z.literal(RECIPE_ANALYSIS_RESOURCE_ID),
    issuedAt: timestampSchema,
    expiresAt: timestampSchema,
    nonce: z.string().trim().min(1).max(128),
  })
  .strict()
  .refine((value) => value.issuedAt < value.expiresAt, {
    message: "expiresAt must be later than issuedAt",
    path: ["expiresAt"],
  });

export type SponsorAccessEvidence = z.infer<typeof sponsorAccessEvidenceSchema>;

const transactionHashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const evmAddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const baseUnitAmountSchema = z.string().regex(/^[1-9][0-9]*$/);

export const paymentReceiptSchema = z
  .object({
    resourceId: z.literal(RECIPE_ANALYSIS_RESOURCE_ID),
    paymentRequestId: z.string().trim().min(1).max(128),
    transactionHash: transactionHashSchema,
    network: z.literal("eip155:84532"),
    asset: evmAddressSchema,
    amount: baseUnitAmountSchema,
    confirmedAt: timestampSchema,
  })
  .strict();

export const paymentAccessEvidenceSchema = z
  .object({
    kind: z.literal("x402_payment"),
    resourceId: z.literal(RECIPE_ANALYSIS_RESOURCE_ID),
    paymentRequestId: z.string().trim().min(1).max(128),
    transactionHash: transactionHashSchema,
    network: z.literal("eip155:84532"),
    asset: evmAddressSchema,
    amount: baseUnitAmountSchema,
    confirmedAt: timestampSchema,
  })
  .strict();

export type PaymentReceipt = z.infer<typeof paymentReceiptSchema>;
export type PaymentAccessEvidence = z.infer<typeof paymentAccessEvidenceSchema>;

export const accessEvidenceSchema = z.discriminatedUnion("kind", [
  sponsorAccessEvidenceSchema,
  paymentAccessEvidenceSchema,
]);

export type AccessEvidence = z.infer<typeof accessEvidenceSchema>;

export const premiumAnalysisRequestSchema = z
  .object({
    requestId: requestIdSchema,
    idempotencyKey: idempotencyKeySchema,
    resourceId: z.literal(RECIPE_ANALYSIS_RESOURCE_ID),
    input: recipeAnalysisInputSchema,
  })
  .strict();

export type PremiumAnalysisRequest = z.infer<
  typeof premiumAnalysisRequestSchema
>;

const accessReferenceSchema = z
  .object({
    kind: z.enum(["sponsor_grant", "x402_payment"]),
    referenceId: z.string().trim().min(1).max(128),
  })
  .strict();

export const premiumAnalysisSuccessSchema = z
  .object({
    ok: z.literal(true),
    requestId: requestIdSchema,
    resourceId: z.literal(RECIPE_ANALYSIS_RESOURCE_ID),
    access: accessReferenceSchema,
    data: recipeAnalysisResultSchema,
  })
  .strict();

export type PremiumAnalysisSuccess = z.infer<
  typeof premiumAnalysisSuccessSchema
>;

export const adGateErrorCodeSchema = z.enum([
  "INVALID_INPUT",
  "INVALID_TRANSITION",
  "ACCESS_REQUIRED",
  "INVALID_EVIDENCE",
  "ACCESS_EXPIRED",
  "ACCESS_REUSED",
  "IDEMPOTENCY_CONFLICT",
  "CANCELLED",
  "DEPENDENCY_UNAVAILABLE",
  "INTERNAL_ERROR",
]);

export const adGateErrorSchema = z
  .object({
    code: adGateErrorCodeSchema,
    message: z.string().trim().min(1).max(300),
    retryable: z.boolean(),
    correlationId: z.string().trim().min(1).max(128).optional(),
    issues: z
      .array(
        z
          .object({
            path: z.string().trim().min(1).max(200),
            message: z.string().trim().min(1).max(300),
          })
          .strict(),
      )
      .max(20)
      .optional(),
  })
  .strict()
  .refine(hasNoExplicitUndefined, {
    message: "explicit undefined values are not JSON-safe",
  });

export type AdGateError = z.infer<typeof adGateErrorSchema>;

export const adGateErrorEnvelopeSchema = z
  .object({
    ok: z.literal(false),
    error: adGateErrorSchema,
  })
  .strict();

export type AdGateErrorEnvelope = z.infer<typeof adGateErrorEnvelopeSchema>;

export const webMCPToolResultSchema = z.discriminatedUnion("ok", [
  z
    .object({
      ok: z.literal(true),
      resourceId: z.literal(RECIPE_ANALYSIS_RESOURCE_ID),
      data: recipeAnalysisResultSchema,
    })
    .strict(),
  adGateErrorEnvelopeSchema,
]);

export type WebMCPToolResult = z.infer<typeof webMCPToolResultSchema>;

export const normalizeWebMCPResult = (
  value: PremiumAnalysisSuccess | AdGateErrorEnvelope,
): WebMCPToolResult => {
  if (!value.ok) {
    return { ok: false, error: normalizeContractError(value.error) };
  }

  return {
    ok: true,
    resourceId: value.resourceId,
    data: value.data,
  };
};

export const normalizeContractError = (
  value: unknown,
  correlationId?: string,
): AdGateError => {
  const parsed = adGateErrorSchema.strip().safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  if (value instanceof z.ZodError) {
    const safeCorrelationId = z
      .string()
      .trim()
      .min(1)
      .max(128)
      .safeParse(correlationId);
    return {
      code: "INVALID_INPUT",
      message: "The request input is invalid.",
      retryable: false,
      ...(safeCorrelationId.success
        ? { correlationId: safeCorrelationId.data }
        : {}),
      issues: value.issues.slice(0, 20).map((issue) => ({
        path: issue.path.length > 0 ? issue.path.join(".") : "$",
        message: "Invalid input",
      })),
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "The request could not be completed safely.",
    retryable: false,
  };
};
