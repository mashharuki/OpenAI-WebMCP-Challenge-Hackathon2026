import { describe, expect, it } from "vitest";
import { createSponsorGrantLedger } from "../../src/sponsor/grantLedger.js";
import { createSponsorGrantService } from "../../src/sponsor/grantService.js";

const sessionCredential = "s".repeat(43);
const grantToken = "g".repeat(43);

describe("SponsorGrantService", () => {
  it("issues after the server boundary, replays once, and consumes once", async () => {
    let now = new Date("2026-08-30T00:00:00.000Z");
    const secrets = [sessionCredential, grantToken];
    const service = createSponsorGrantService({
      ledger: createSponsorGrantLedger(),
      now: () => now,
      createSecret: () => {
        const value = secrets.shift();
        if (!value) throw new Error("Unexpected secret request");
        return value;
      },
      createGrantId: () => "grant-123",
    });

    const started = await service.startSession(
      {
        attemptId: "attempt-123",
        resourceId: "recipe_analysis",
        nonce: "request-123",
      },
      now.toISOString(),
    );
    expect(started).toMatchObject({
      ok: true,
      value: {
        sessionCredential,
        requiredMs: 8_000,
        expiresAt: "2026-08-30T00:01:30.000Z",
      },
    });

    now = new Date("2026-08-30T00:00:07.999Z");
    await expect(service.issue({ sessionCredential })).resolves.toMatchObject({
      ok: false,
      error: { code: "ACCESS_REQUIRED" },
    });

    now = new Date("2026-08-30T00:00:08.000Z");
    const issued = await service.issue({ sessionCredential });
    expect(issued).toEqual({
      ok: true,
      value: {
        ok: true,
        token: grantToken,
        evidence: {
          kind: "sponsor_grant",
          grantId: "grant-123",
          resourceId: "recipe_analysis",
          issuedAt: "2026-08-30T00:00:08.000Z",
          expiresAt: "2026-08-30T00:01:08.000Z",
          nonce: "request-123",
        },
      },
    });
    if (!issued.ok) throw new Error("Expected a sponsor grant.");
    issued.value.evidence.nonce = "mutated-by-caller";
    const replayed = await service.issue({ sessionCredential });
    expect(replayed).toMatchObject({
      ok: true,
      value: { evidence: { nonce: "request-123" } },
    });

    await expect(
      service.consume({
        token: grantToken,
        resourceId: "recipe_analysis",
        nonce: "request-123",
      }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      service.consume({
        token: grantToken,
        resourceId: "recipe_analysis",
        nonce: "request-123",
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "ACCESS_REUSED" },
    });
  });

  it("does not consume a grant on binding mismatch and expires at equality", async () => {
    let now = new Date("2026-08-30T00:00:00.000Z");
    const secrets = [sessionCredential, grantToken];
    const service = createSponsorGrantService({
      ledger: createSponsorGrantLedger(),
      now: () => now,
      createSecret: () => secrets.shift() ?? "x".repeat(43),
      createGrantId: () => "grant-123",
    });
    await service.startSession(
      {
        attemptId: "attempt-123",
        resourceId: "recipe_analysis",
        nonce: "request-123",
      },
      now.toISOString(),
    );
    now = new Date("2026-08-30T00:00:08.000Z");
    await service.issue({ sessionCredential });

    await expect(
      service.consume({
        token: grantToken,
        resourceId: "recipe_analysis",
        nonce: "wrong-request",
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_EVIDENCE" },
    });
    await expect(
      service.consume({
        token: grantToken,
        resourceId: "recipe_analysis",
        nonce: "request-123",
      }),
    ).resolves.toMatchObject({ ok: true });

    const secondSecrets = ["u".repeat(43), "v".repeat(43)];
    const expiringService = createSponsorGrantService({
      ledger: createSponsorGrantLedger(),
      now: () => now,
      createSecret: () => secondSecrets.shift() ?? "w".repeat(43),
      createGrantId: () => "grant-expiring",
    });
    await expiringService.startSession(
      {
        attemptId: "attempt-expiring",
        resourceId: "recipe_analysis",
        nonce: "request-expiring",
      },
      "2026-08-30T00:00:00.000Z",
    );
    await expiringService.issue({ sessionCredential: "u".repeat(43) });
    now = new Date("2026-08-30T00:01:08.000Z");
    await expect(
      expiringService.consume({
        token: "v".repeat(43),
        resourceId: "recipe_analysis",
        nonce: "request-expiring",
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "ACCESS_EXPIRED" },
    });
  });

  it("rejects duplicate nonces and session expiry at equality", async () => {
    let now = new Date("2026-08-30T00:00:00.000Z");
    const secrets = ["a".repeat(43), "b".repeat(43)];
    const service = createSponsorGrantService({
      ledger: createSponsorGrantLedger(),
      now: () => now,
      createSecret: () => secrets.shift() ?? "c".repeat(43),
    });
    const input = {
      attemptId: "attempt-123",
      resourceId: "recipe_analysis" as const,
      nonce: "request-123",
    };
    await expect(
      service.startSession(input, now.toISOString()),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      service.startSession(
        { ...input, attemptId: "attempt-other" },
        now.toISOString(),
      ),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "IDEMPOTENCY_CONFLICT" },
    });

    now = new Date("2026-08-30T00:01:30.000Z");
    await expect(
      service.issue({ sessionCredential: "a".repeat(43) }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "ACCESS_EXPIRED" },
    });
  });

  it("replays only within grant lifetime and uses URL-safe 256-bit secrets", async () => {
    let now = new Date("2026-08-30T00:00:00.000Z");
    const service = createSponsorGrantService({
      ledger: createSponsorGrantLedger(),
      now: () => now,
      createGrantId: () => "grant-random",
    });
    const started = await service.startSession(
      {
        attemptId: "attempt-random",
        resourceId: "recipe_analysis",
        nonce: "request-random",
      },
      now.toISOString(),
    );
    if (!started.ok) throw new Error("Expected a sponsor session.");
    expect(started.value.sessionCredential).toMatch(/^[A-Za-z0-9_-]{43}$/);

    now = new Date("2026-08-30T00:00:08.000Z");
    const issued = await service.issue({
      sessionCredential: started.value.sessionCredential,
    });
    if (!issued.ok) throw new Error("Expected a sponsor grant.");
    expect(issued.value.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(issued.value.token).not.toBe(started.value.sessionCredential);

    now = new Date("2026-08-30T00:01:07.999Z");
    await expect(
      service.issue({ sessionCredential: started.value.sessionCredential }),
    ).resolves.toEqual(issued);
    now = new Date("2026-08-30T00:01:08.000Z");
    await expect(
      service.issue({ sessionCredential: started.value.sessionCredential }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "ACCESS_EXPIRED" },
    });
  });
});
