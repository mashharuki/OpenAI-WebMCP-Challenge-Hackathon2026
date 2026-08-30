import { createHash } from "node:crypto";
import type {
  AdGateError,
  SponsorAccessEvidence,
} from "../adgate/contracts.js";
import type { SponsorGrantIssueResponse } from "./contracts.js";

export type SponsorResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AdGateError };

export interface SponsorConsumeRequest {
  readonly token: string;
  readonly resourceId: "recipe_analysis";
  readonly nonce: string;
}

export interface SponsorGrantRecord {
  readonly evidence: SponsorAccessEvidence;
  readonly tokenDigest: string;
  readonly issueDigest: string;
  readonly sponsorId: string;
  readonly status: "available" | "consumed";
  readonly consumedAt?: string;
}

export interface SponsorSessionRecord {
  readonly credentialDigest: string;
  readonly attemptId: string;
  readonly resourceId: "recipe_analysis";
  readonly nonce: string;
  readonly sponsorId: "open-table-weekly";
  readonly startedAt: string;
  readonly expiresAt: string;
  readonly status: "available" | "consumed";
  readonly issueDigest?: string;
}

export interface SponsorGrantLedger {
  createSession(
    input: SponsorSessionRecord,
  ): SponsorResult<SponsorSessionRecord>;
  consumeSession(input: {
    readonly credentialDigest: string;
    readonly issueDigest: string;
    readonly now: string;
  }): SponsorResult<SponsorSessionRecord>;
  findIssuedResponse(input: {
    readonly credentialDigest: string;
    readonly issueDigest: string;
    readonly now: string;
  }): SponsorGrantIssueResponse | undefined;
  cacheIssuedResponse(input: {
    readonly credentialDigest: string;
    readonly issueDigest: string;
    readonly response: SponsorGrantIssueResponse;
    readonly expiresAt: string;
  }): void;
  issue(input: SponsorGrantRecord): SponsorResult<SponsorGrantRecord>;
  findByIssueDigest(issueDigest: string): SponsorGrantRecord | undefined;
  completeIssue(input: {
    readonly credentialDigest: string;
    readonly issueDigest: string;
    readonly now: string;
    readonly requiredMs: number;
    readonly createGrant: (session: SponsorSessionRecord) => {
      readonly grant: SponsorGrantRecord;
      readonly response: SponsorGrantIssueResponse;
    };
  }): SponsorResult<{
    readonly response: SponsorGrantIssueResponse;
    readonly replayed: boolean;
  }>;
  consume(
    input: SponsorConsumeRequest,
    now: string,
  ): SponsorResult<SponsorAccessEvidence>;
}

interface SponsorGrantLedgerOptions {
  readonly maxSessions?: number;
  readonly maxGrants?: number;
  readonly maxCachedResponses?: number;
}

interface CachedResponse {
  readonly response: SponsorGrantIssueResponse;
  readonly expiresAt: string;
}

const invalidEvidence = (): SponsorResult<never> => ({
  ok: false,
  error: {
    code: "INVALID_EVIDENCE",
    message: "The sponsor access evidence is invalid.",
    retryable: false,
  },
});

const expired = (): SponsorResult<never> => ({
  ok: false,
  error: {
    code: "ACCESS_EXPIRED",
    message: "The sponsor access has expired. Start a new attempt.",
    retryable: false,
  },
});

const reused = (): SponsorResult<never> => ({
  ok: false,
  error: {
    code: "ACCESS_REUSED",
    message: "The sponsor access has already been used.",
    retryable: false,
  },
});

const conflict = (): SponsorResult<never> => ({
  ok: false,
  error: {
    code: "IDEMPOTENCY_CONFLICT",
    message: "The sponsor attempt identity conflicts with an existing record.",
    retryable: false,
  },
});

const atCapacity = (): SponsorResult<never> => ({
  ok: false,
  error: {
    code: "DEPENDENCY_UNAVAILABLE",
    message: "Sponsor access is temporarily at capacity.",
    retryable: true,
  },
});

const accessRequired = (): SponsorResult<never> => ({
  ok: false,
  error: {
    code: "ACCESS_REQUIRED",
    message: "The sponsor view is not complete yet.",
    retryable: true,
  },
});

const timestamp = (value: string): number => Date.parse(value);

const cloneEvidence = (
  evidence: SponsorAccessEvidence,
): SponsorAccessEvidence => ({ ...evidence });

const cloneResponse = (
  response: SponsorGrantIssueResponse,
): SponsorGrantIssueResponse => ({
  ...response,
  evidence: cloneEvidence(response.evidence),
});

const cloneGrant = (record: SponsorGrantRecord): SponsorGrantRecord => ({
  ...record,
  evidence: cloneEvidence(record.evidence),
});

const cloneSession = (record: SponsorSessionRecord): SponsorSessionRecord => ({
  ...record,
});

export const digestSponsorSecret = (value: string): string =>
  createHash("sha256").update(value).digest("base64url");

const assertPositiveInteger = (value: number, name: string) => {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer`);
  }
};

export const createSponsorGrantLedger = (
  options: SponsorGrantLedgerOptions = {},
): SponsorGrantLedger => {
  const maxSessions = options.maxSessions ?? 1_024;
  const maxGrants = options.maxGrants ?? 1_024;
  const maxCachedResponses = options.maxCachedResponses ?? 1_024;
  assertPositiveInteger(maxSessions, "maxSessions");
  assertPositiveInteger(maxGrants, "maxGrants");
  assertPositiveInteger(maxCachedResponses, "maxCachedResponses");

  const sessions = new Map<string, SponsorSessionRecord>();
  const sessionByNonce = new Map<string, string>();
  const grants = new Map<string, SponsorGrantRecord>();
  const grantByIssue = new Map<string, string>();
  const responses = new Map<string, CachedResponse>();
  const responseKey = (credentialDigest: string, issueDigest: string) =>
    `${credentialDigest}:${issueDigest}`;

  const cleanupSessions = (now: string) => {
    const current = timestamp(now);
    for (const [key, record] of sessions) {
      if (current >= timestamp(record.expiresAt)) {
        sessions.delete(key);
        if (sessionByNonce.get(record.nonce) === key) {
          sessionByNonce.delete(record.nonce);
        }
      }
    }
  };

  const cleanupGrants = (now: string) => {
    const current = timestamp(now);
    for (const [key, record] of grants) {
      if (current >= timestamp(record.evidence.expiresAt)) {
        grants.delete(key);
        if (grantByIssue.get(record.issueDigest) === key) {
          grantByIssue.delete(record.issueDigest);
        }
      }
    }
  };

  const cleanupResponses = (now: string) => {
    const current = timestamp(now);
    for (const [key, cached] of responses) {
      if (current >= timestamp(cached.expiresAt)) responses.delete(key);
    }
  };

  return {
    createSession(input) {
      const existingCredential = sessions.get(input.credentialDigest);
      const existingNonce = sessionByNonce.get(input.nonce);
      if (existingCredential || existingNonce) return conflict();
      if (sessions.size >= maxSessions) cleanupSessions(input.startedAt);
      if (sessions.size >= maxSessions) return atCapacity();
      const record = cloneSession(input);
      sessions.set(input.credentialDigest, record);
      sessionByNonce.set(input.nonce, input.credentialDigest);
      return { ok: true, value: cloneSession(record) };
    },

    consumeSession(input) {
      const record = sessions.get(input.credentialDigest);
      if (!record) return invalidEvidence();
      if (timestamp(input.now) >= timestamp(record.expiresAt)) return expired();
      if (record.status === "consumed") {
        return record.issueDigest === input.issueDigest ? reused() : conflict();
      }
      const consumedRecord: SponsorSessionRecord = {
        ...record,
        status: "consumed",
        issueDigest: input.issueDigest,
      };
      sessions.set(input.credentialDigest, consumedRecord);
      return { ok: true, value: cloneSession(consumedRecord) };
    },

    findIssuedResponse(input) {
      cleanupResponses(input.now);
      const response = responses.get(
        responseKey(input.credentialDigest, input.issueDigest),
      )?.response;
      return response ? cloneResponse(response) : undefined;
    },

    cacheIssuedResponse(input) {
      cleanupResponses(input.response.evidence.issuedAt);
      const key = responseKey(input.credentialDigest, input.issueDigest);
      if (!responses.has(key) && responses.size >= maxCachedResponses) {
        const oldest = responses.keys().next().value;
        if (oldest !== undefined) responses.delete(oldest);
      }
      responses.set(key, {
        response: cloneResponse(input.response),
        expiresAt: input.expiresAt,
      });
    },

    issue(input) {
      if (
        grants.has(input.tokenDigest) ||
        grantByIssue.has(input.issueDigest)
      ) {
        return conflict();
      }
      if (grants.size >= maxGrants) cleanupGrants(input.evidence.issuedAt);
      if (grants.size >= maxGrants) return atCapacity();
      const record = cloneGrant(input);
      grants.set(input.tokenDigest, record);
      grantByIssue.set(input.issueDigest, input.tokenDigest);
      return { ok: true, value: cloneGrant(record) };
    },

    findByIssueDigest(issueDigest) {
      const tokenDigest = grantByIssue.get(issueDigest);
      const record = tokenDigest ? grants.get(tokenDigest) : undefined;
      return record ? cloneGrant(record) : undefined;
    },

    completeIssue(input) {
      cleanupResponses(input.now);
      const key = responseKey(input.credentialDigest, input.issueDigest);
      const cached = responses.get(key);
      if (cached) {
        return {
          ok: true,
          value: { response: cloneResponse(cached.response), replayed: true },
        };
      }

      const session = sessions.get(input.credentialDigest);
      if (!session) return invalidEvidence();
      const current = timestamp(input.now);
      if (current >= timestamp(session.expiresAt)) return expired();
      if (session.status === "consumed") {
        if (session.issueDigest !== input.issueDigest) return conflict();
        const tokenDigest = grantByIssue.get(input.issueDigest);
        const grant = tokenDigest ? grants.get(tokenDigest) : undefined;
        return grant && current >= timestamp(grant.evidence.expiresAt)
          ? expired()
          : reused();
      }
      if (current < timestamp(session.startedAt) + input.requiredMs) {
        return accessRequired();
      }

      cleanupGrants(input.now);
      if (grants.size >= maxGrants) return atCapacity();
      if (responses.size >= maxCachedResponses) return atCapacity();
      const created = input.createGrant(session);
      if (
        grants.has(created.grant.tokenDigest) ||
        grantByIssue.has(created.grant.issueDigest) ||
        created.grant.issueDigest !== input.issueDigest
      ) {
        return conflict();
      }

      const consumedSession: SponsorSessionRecord = {
        ...session,
        status: "consumed",
        issueDigest: input.issueDigest,
      };
      sessions.set(input.credentialDigest, consumedSession);
      grants.set(created.grant.tokenDigest, cloneGrant(created.grant));
      grantByIssue.set(input.issueDigest, created.grant.tokenDigest);
      responses.set(key, {
        response: cloneResponse(created.response),
        expiresAt: created.response.evidence.expiresAt,
      });
      return {
        ok: true,
        value: { response: cloneResponse(created.response), replayed: false },
      };
    },

    consume(input, now) {
      const tokenDigest = digestSponsorSecret(input.token);
      const record = grants.get(tokenDigest);
      if (!record) return invalidEvidence();
      if (timestamp(now) >= timestamp(record.evidence.expiresAt)) {
        return expired();
      }
      if (
        record.evidence.resourceId !== input.resourceId ||
        record.evidence.nonce !== input.nonce
      ) {
        return invalidEvidence();
      }
      if (record.status === "consumed") return reused();
      const consumedRecord: SponsorGrantRecord = {
        ...record,
        status: "consumed",
        consumedAt: now,
      };
      grants.set(tokenDigest, consumedRecord);
      return { ok: true, value: cloneEvidence(record.evidence) };
    },
  };
};
