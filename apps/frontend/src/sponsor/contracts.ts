import { z } from "zod";
import {
  RECIPE_ANALYSIS_RESOURCE_ID,
  sponsorAccessEvidenceSchema,
} from "../adgate/contracts";

export const SPONSOR_ID = "open-table-weekly" as const;
export const SPONSOR_NAME = "Open Table Weekly" as const;
export const SPONSOR_CREATIVE_KEY = "weekly-static-v1" as const;
export const SPONSOR_REQUIRED_MS = 8_000 as const;

const boundedIdSchema = z.string().trim().min(1).max(128);
const opaqueCredentialSchema = z
  .string()
  .min(43)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const timestampSchema = z.string().datetime({ offset: false });

export const sponsorSessionStartRequestSchema = z
  .object({
    attemptId: boundedIdSchema,
    resourceId: z.literal(RECIPE_ANALYSIS_RESOURCE_ID),
    nonce: boundedIdSchema,
  })
  .strict();

export const sponsorSessionStartResponseSchema = z
  .object({
    ok: z.literal(true),
    sessionCredential: opaqueCredentialSchema,
    sponsor: z
      .object({
        id: z.literal(SPONSOR_ID),
        name: z.literal(SPONSOR_NAME),
        creativeKey: z.literal(SPONSOR_CREATIVE_KEY),
      })
      .strict(),
    requiredMs: z.literal(SPONSOR_REQUIRED_MS),
    expiresAt: timestampSchema,
  })
  .strict();

export const sponsorGrantIssueRequestSchema = z
  .object({ sessionCredential: opaqueCredentialSchema })
  .strict();

export const sponsorGrantIssueResponseSchema = z
  .object({
    ok: z.literal(true),
    token: opaqueCredentialSchema,
    evidence: sponsorAccessEvidenceSchema,
  })
  .strict();

export type SponsorSessionStartRequest = z.infer<
  typeof sponsorSessionStartRequestSchema
>;
export type SponsorSessionStartResponse = z.infer<
  typeof sponsorSessionStartResponseSchema
>;
export type SponsorGrantIssueRequest = z.infer<
  typeof sponsorGrantIssueRequestSchema
>;
export type SponsorGrantIssueResponse = z.infer<
  typeof sponsorGrantIssueResponseSchema
>;
