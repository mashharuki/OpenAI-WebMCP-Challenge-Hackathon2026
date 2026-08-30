import { createHash } from "node:crypto";
import type {
  AdGateErrorEnvelope,
  PremiumAnalysisRequest,
  PremiumAnalysisSuccess,
} from "./contracts.js";

export type ProtectedAttemptIdentity = {
  idempotencyKey: string;
  requestDigest: string;
  evidenceFingerprint: string;
};

const digest = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const canonicalRequestBody = (request: PremiumAnalysisRequest): string =>
  JSON.stringify({
    requestId: request.requestId,
    idempotencyKey: request.idempotencyKey,
    resourceId: request.resourceId,
    input: {
      recipeId: request.input.recipeId,
      ...(request.input.dietaryGoals
        ? { dietaryGoals: request.input.dietaryGoals }
        : {}),
    },
  });

export const createProtectedAttemptIdentity = (
  request: PremiumAnalysisRequest,
  evidence: string,
): ProtectedAttemptIdentity => ({
  idempotencyKey: request.idempotencyKey,
  requestDigest: digest(canonicalRequestBody(request)),
  evidenceFingerprint: digest(evidence),
});

export type ProtectedAttemptResult =
  | PremiumAnalysisSuccess
  | AdGateErrorEnvelope;

export interface ProtectedAttemptRegistry {
  execute(
    identity: ProtectedAttemptIdentity,
    operation: () => Promise<ProtectedAttemptResult>,
  ): Promise<ProtectedAttemptResult>;
}

type RegistryOptions = {
  now?: () => number;
  successTtlMs?: number;
  maxEntries?: number;
};

type InFlightAttempt = {
  state: "in_flight";
  identity: ProtectedAttemptIdentity;
  promise: Promise<ProtectedAttemptResult>;
};

type SucceededAttempt = {
  state: "succeeded";
  identity: ProtectedAttemptIdentity;
  result: PremiumAnalysisSuccess;
  expiresAt: number;
};

type AttemptRecord = InFlightAttempt | SucceededAttempt;

const identitiesMatch = (
  left: ProtectedAttemptIdentity,
  right: ProtectedAttemptIdentity,
): boolean =>
  left.idempotencyKey === right.idempotencyKey &&
  left.requestDigest === right.requestDigest &&
  left.evidenceFingerprint === right.evidenceFingerprint;

const idempotencyConflict = (): AdGateErrorEnvelope => ({
  ok: false,
  error: {
    code: "IDEMPOTENCY_CONFLICT",
    message: "The idempotency key is already bound to another request.",
    retryable: false,
  },
});

const attemptExpired = (): AdGateErrorEnvelope => ({
  ok: false,
  error: {
    code: "ACCESS_EXPIRED",
    message: "This attempt has expired. Start a new attempt.",
    retryable: false,
  },
});

const registryAtCapacity = (): AdGateErrorEnvelope => ({
  ok: false,
  error: {
    code: "DEPENDENCY_UNAVAILABLE",
    message: "The protected attempt registry is at capacity.",
    retryable: true,
  },
});

export const createProtectedAttemptRegistry = (
  options: RegistryOptions = {},
): ProtectedAttemptRegistry => {
  const now = options.now ?? Date.now;
  const successTtlMs = options.successTtlMs ?? 300_000;
  const maxEntries = options.maxEntries ?? 1_024;
  const attempts = new Map<string, AttemptRecord>();

  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new RangeError("maxEntries must be a positive integer");
  }
  if (!Number.isFinite(successTtlMs) || successTtlMs <= 0) {
    throw new RangeError("successTtlMs must be positive");
  }

  return {
    execute(identity, operation) {
      const existing = attempts.get(identity.idempotencyKey);
      if (existing) {
        if (!identitiesMatch(existing.identity, identity)) {
          return Promise.resolve(idempotencyConflict());
        }
        if (existing.state === "in_flight") return existing.promise;
        if (now() >= existing.expiresAt) {
          return Promise.resolve(attemptExpired());
        }
        return Promise.resolve(existing.result);
      }

      if (attempts.size >= maxEntries) {
        const currentTime = now();
        for (const [key, record] of attempts) {
          if (record.state === "succeeded" && currentTime >= record.expiresAt) {
            attempts.delete(key);
          }
        }
      }
      if (attempts.size >= maxEntries) {
        return Promise.resolve(registryAtCapacity());
      }

      let resolveAttempt!: (value: ProtectedAttemptResult) => void;
      let rejectAttempt!: (reason?: unknown) => void;
      const attempt = new Promise<ProtectedAttemptResult>((resolve, reject) => {
        resolveAttempt = resolve;
        rejectAttempt = reject;
      });

      attempts.set(identity.idempotencyKey, {
        state: "in_flight",
        identity,
        promise: attempt,
      });
      try {
        operation().then(
          (result) => {
            if (result.ok) {
              attempts.set(identity.idempotencyKey, {
                state: "succeeded",
                identity,
                result,
                expiresAt: now() + successTtlMs,
              });
            } else {
              attempts.delete(identity.idempotencyKey);
            }
            resolveAttempt(result);
          },
          (error: unknown) => {
            attempts.delete(identity.idempotencyKey);
            rejectAttempt(error);
          },
        );
      } catch (error) {
        attempts.delete(identity.idempotencyKey);
        rejectAttempt(error);
      }
      return attempt;
    },
  };
};
