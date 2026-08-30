import { describe, expect, it } from "vitest";
import type { PremiumAnalysisSuccess } from "./contracts.js";
import { createProtectedAttemptRegistry } from "./idempotency.js";

const identity = {
  idempotencyKey: "idempotency-key-123",
  requestDigest: "request-digest-123",
  evidenceFingerprint: "evidence-fingerprint-123",
};

const success: PremiumAnalysisSuccess = {
  ok: true,
  requestId: "request-123",
  resourceId: "recipe_analysis",
  access: { kind: "sponsor_grant", referenceId: "grant-123" },
  data: {
    summary: "A balanced plant-forward bowl.",
    nutritionalInsights: ["Chickpeas and quinoa provide plant protein."],
    suggestions: ["Add lemon juice for brightness."],
    disclaimer: "General information only; not medical advice.",
  },
};

describe("ProtectedAttemptRegistry", () => {
  it("coalesces concurrent requests with the same identity", async () => {
    const registry = createProtectedAttemptRegistry({ now: () => 0 });
    let completeOperation:
      | ((value: PremiumAnalysisSuccess) => void)
      | undefined;
    let executions = 0;
    const operation = () => {
      executions += 1;
      return new Promise<PremiumAnalysisSuccess>((resolve) => {
        completeOperation = resolve;
      });
    };

    const first = registry.execute(identity, operation);
    const second = registry.execute(identity, operation);

    expect(executions).toBe(1);
    expect(second).toBe(first);
    completeOperation?.(success);
    await expect(first).resolves.toEqual(success);
    await expect(second).resolves.toEqual(success);
  });

  it("rejects a reused idempotency key with a different identity", async () => {
    const registry = createProtectedAttemptRegistry({ now: () => 0 });
    let completeOperation:
      | ((value: PremiumAnalysisSuccess) => void)
      | undefined;
    const first = registry.execute(
      identity,
      () =>
        new Promise<PremiumAnalysisSuccess>((resolve) => {
          completeOperation = resolve;
        }),
    );

    await expect(
      registry.execute(
        { ...identity, requestDigest: "different-request-digest" },
        async () => success,
      ),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "IDEMPOTENCY_CONFLICT",
        message: "The idempotency key is already bound to another request.",
        retryable: false,
      },
    });
    await expect(
      registry.execute(
        { ...identity, evidenceFingerprint: "different-fingerprint" },
        async () => success,
      ),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "IDEMPOTENCY_CONFLICT",
        message: "The idempotency key is already bound to another request.",
        retryable: false,
      },
    });

    completeOperation?.(success);
    await first;
  });

  it("replays a success for five minutes and then requires a new attempt", async () => {
    let now = 0;
    let executions = 0;
    const registry = createProtectedAttemptRegistry({ now: () => now });
    const operation = async () => {
      executions += 1;
      return success;
    };

    await expect(registry.execute(identity, operation)).resolves.toEqual(
      success,
    );
    now = 299_999;
    await expect(registry.execute(identity, operation)).resolves.toEqual(
      success,
    );
    expect(executions).toBe(1);

    now = 300_000;
    await expect(registry.execute(identity, operation)).resolves.toEqual({
      ok: false,
      error: {
        code: "ACCESS_EXPIRED",
        message: "This attempt has expired. Start a new attempt.",
        retryable: false,
      },
    });
    expect(executions).toBe(1);
  });

  it("does not cache an unsuccessful operation", async () => {
    const registry = createProtectedAttemptRegistry({ now: () => 0 });
    let executions = 0;
    const failure = {
      ok: false as const,
      error: {
        code: "DEPENDENCY_UNAVAILABLE" as const,
        message: "Payment verification is temporarily unavailable.",
        retryable: true,
      },
    };

    await expect(
      registry.execute(identity, async () => {
        executions += 1;
        return failure;
      }),
    ).resolves.toEqual(failure);
    await expect(
      registry.execute(identity, async () => {
        executions += 1;
        return success;
      }),
    ).resolves.toEqual(success);
    expect(executions).toBe(2);
  });

  it("releases the identity when an operation throws", async () => {
    const registry = createProtectedAttemptRegistry({ now: () => 0 });
    await expect(
      registry.execute(identity, async () => {
        throw new Error("temporary internal failure");
      }),
    ).rejects.toThrow("temporary internal failure");

    await expect(
      registry.execute(identity, async () => success),
    ).resolves.toEqual(success);
  });

  it("rejects new identities while all bounded slots are active", async () => {
    const registry = createProtectedAttemptRegistry({
      now: () => 0,
      maxEntries: 1,
    });
    let completeOperation:
      | ((value: PremiumAnalysisSuccess) => void)
      | undefined;
    let secondExecuted = false;
    const first = registry.execute(
      identity,
      () =>
        new Promise<PremiumAnalysisSuccess>((resolve) => {
          completeOperation = resolve;
        }),
    );

    await expect(
      registry.execute(
        {
          idempotencyKey: "idempotency-key-456",
          requestDigest: "request-digest-456",
          evidenceFingerprint: "evidence-fingerprint-456",
        },
        async () => {
          secondExecuted = true;
          return success;
        },
      ),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "The protected attempt registry is at capacity.",
        retryable: true,
      },
    });
    expect(secondExecuted).toBe(false);

    completeOperation?.(success);
    await first;
  });

  it("reclaims expired success slots for a new attempt", async () => {
    let now = 0;
    const registry = createProtectedAttemptRegistry({
      now: () => now,
      successTtlMs: 10,
      maxEntries: 1,
    });
    await registry.execute(identity, async () => success);

    now = 10;
    const newIdentity = {
      idempotencyKey: "idempotency-key-456",
      requestDigest: "request-digest-456",
      evidenceFingerprint: "evidence-fingerprint-456",
    };
    await expect(
      registry.execute(newIdentity, async () => ({
        ...success,
        requestId: "request-456",
      })),
    ).resolves.toMatchObject({ ok: true, requestId: "request-456" });
  });
});
