import { randomBytes, randomUUID } from "node:crypto";
import type {
  AdGateError,
  SponsorAccessEvidence,
} from "../adgate/contracts.js";
import { normalizeContractError } from "../adgate/contracts.js";
import {
  SPONSOR_CREATIVE_KEY,
  SPONSOR_GRANT_TTL_MS,
  SPONSOR_ID,
  SPONSOR_NAME,
  SPONSOR_REQUIRED_MS,
  SPONSOR_SESSION_TTL_MS,
  type SponsorGrantIssueRequest,
  type SponsorGrantIssueResponse,
  type SponsorSessionStartRequest,
  type SponsorSessionStartResponse,
  sponsorGrantIssueRequestSchema,
  sponsorGrantIssueResponseSchema,
  sponsorSessionStartRequestSchema,
  sponsorSessionStartResponseSchema,
} from "./contracts.js";
import {
  digestSponsorSecret,
  type SponsorConsumeRequest,
  type SponsorGrantLedger,
  type SponsorResult,
} from "./grantLedger.js";

export interface SponsorGrantService {
  startSession(
    input: SponsorSessionStartRequest,
    now: string,
  ): Promise<SponsorResult<SponsorSessionStartResponse>>;
  issue(
    input: SponsorGrantIssueRequest,
  ): Promise<SponsorResult<SponsorGrantIssueResponse>>;
  consume(
    input: SponsorConsumeRequest,
  ): Promise<SponsorResult<SponsorAccessEvidence>>;
}

interface SponsorGrantServiceOptions {
  readonly ledger: SponsorGrantLedger;
  readonly now?: () => Date;
  readonly createSecret?: () => string;
  readonly createGrantId?: () => string;
}

const internalError = (): SponsorResult<never> => ({
  ok: false,
  error: {
    code: "INTERNAL_ERROR",
    message: "Sponsor access could not be completed safely.",
    retryable: false,
  },
});

const invalidInput = (error: unknown): SponsorResult<never> => ({
  ok: false,
  error: normalizeContractError(error),
});

const addMilliseconds = (value: string, milliseconds: number): string =>
  new Date(Date.parse(value) + milliseconds).toISOString();

export const createSponsorGrantService = ({
  ledger,
  now = () => new Date(),
  createSecret = () => randomBytes(32).toString("base64url"),
  createGrantId = randomUUID,
}: SponsorGrantServiceOptions): SponsorGrantService => ({
  async startSession(input, startedAt) {
    const parsedInput = sponsorSessionStartRequestSchema.safeParse(input);
    if (!parsedInput.success) return invalidInput(parsedInput.error);
    if (!Number.isFinite(Date.parse(startedAt))) {
      return invalidInput(new Error("Invalid timestamp"));
    }

    try {
      const sessionCredential = createSecret();
      const response = sponsorSessionStartResponseSchema.parse({
        ok: true,
        sessionCredential,
        sponsor: {
          id: SPONSOR_ID,
          name: SPONSOR_NAME,
          creativeKey: SPONSOR_CREATIVE_KEY,
        },
        requiredMs: SPONSOR_REQUIRED_MS,
        expiresAt: addMilliseconds(startedAt, SPONSOR_SESSION_TTL_MS),
      });
      const created = ledger.createSession({
        credentialDigest: digestSponsorSecret(sessionCredential),
        attemptId: parsedInput.data.attemptId,
        resourceId: parsedInput.data.resourceId,
        nonce: parsedInput.data.nonce,
        sponsorId: SPONSOR_ID,
        startedAt,
        expiresAt: response.expiresAt,
        status: "available",
      });
      return created.ok ? { ok: true, value: response } : created;
    } catch {
      return internalError();
    }
  },

  async issue(input) {
    const parsedInput = sponsorGrantIssueRequestSchema.safeParse(input);
    if (!parsedInput.success) return invalidInput(parsedInput.error);

    try {
      const issuedAt = now().toISOString();
      const credentialDigest = digestSponsorSecret(
        parsedInput.data.sessionCredential,
      );
      const issueDigest = digestSponsorSecret(
        `sponsor-issue:${credentialDigest}`,
      );
      const completed = ledger.completeIssue({
        credentialDigest,
        issueDigest,
        now: issuedAt,
        requiredMs: SPONSOR_REQUIRED_MS,
        createGrant: (session) => {
          const token = createSecret();
          const response = sponsorGrantIssueResponseSchema.parse({
            ok: true,
            token,
            evidence: {
              kind: "sponsor_grant",
              grantId: createGrantId(),
              resourceId: session.resourceId,
              issuedAt,
              expiresAt: addMilliseconds(issuedAt, SPONSOR_GRANT_TTL_MS),
              nonce: session.nonce,
            },
          });
          return {
            grant: {
              evidence: response.evidence,
              tokenDigest: digestSponsorSecret(token),
              issueDigest,
              sponsorId: session.sponsorId,
              status: "available",
            },
            response,
          };
        },
      });
      return completed.ok
        ? { ok: true, value: completed.value.response }
        : completed;
    } catch {
      return internalError();
    }
  },

  async consume(input) {
    try {
      return ledger.consume(input, now().toISOString());
    } catch (error) {
      const safeError: AdGateError = normalizeContractError(error);
      return { ok: false, error: safeError };
    }
  },
});
