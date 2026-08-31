import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { SponsorAccessEvidence } from "../../src/adgate/contracts.js";
import { createSponsorGrantLedger } from "../../src/sponsor/grantLedger.js";

const digest = (value: string) =>
  createHash("sha256").update(value).digest("base64url");

const token = "t".repeat(43);
const evidence: SponsorAccessEvidence = {
  kind: "sponsor_grant",
  grantId: "grant-123",
  resourceId: "recipe_analysis",
  issuedAt: "2026-08-30T00:00:08.000Z",
  expiresAt: "2026-08-30T00:01:08.000Z",
  nonce: "request-123",
};

describe("SponsorGrantLedger", () => {
  it("restores an active sponsor session after a Durable Object restart", () => {
    const firstInstance = createSponsorGrantLedger();
    expect(
      firstInstance.createSession({
        credentialDigest: digest("credential-restart"),
        attemptId: "attempt-restart",
        resourceId: "recipe_analysis",
        nonce: "request-restart",
        sponsorId: "open-table-weekly",
        startedAt: "2026-08-30T00:00:00.000Z",
        expiresAt: "2026-08-30T00:01:30.000Z",
        status: "available",
      }),
    ).toMatchObject({ ok: true });

    const restartedInstance = createSponsorGrantLedger({
      initialSnapshot: firstInstance.snapshot(),
    });
    const result = restartedInstance.completeIssue({
      credentialDigest: digest("credential-restart"),
      issueDigest: digest("issue-restart"),
      now: "2026-08-30T00:00:08.000Z",
      requiredMs: 8_000,
      createGrant: (session) => ({
        grant: {
          evidence: {
            ...evidence,
            grantId: "grant-restart",
            nonce: session.nonce,
          },
          tokenDigest: digest(token),
          issueDigest: digest("issue-restart"),
          sponsorId: session.sponsorId,
          status: "available",
        },
        response: {
          ok: true,
          token,
          evidence: {
            ...evidence,
            grantId: "grant-restart",
            nonce: session.nonce,
          },
        },
      }),
    });

    expect(result).toMatchObject({ ok: true });
  });

  it("allows exactly one synchronous consume and forgets grants on restart", async () => {
    const ledger = createSponsorGrantLedger();
    expect(
      ledger.issue({
        evidence,
        tokenDigest: digest(token),
        issueDigest: digest("issue-123"),
        sponsorId: "open-table-weekly",
        status: "available",
      }),
    ).toMatchObject({ ok: true });

    const [first, second] = await Promise.all([
      ledger.consume(
        { token, resourceId: "recipe_analysis", nonce: "request-123" },
        "2026-08-30T00:00:09.000Z",
      ),
      ledger.consume(
        { token, resourceId: "recipe_analysis", nonce: "request-123" },
        "2026-08-30T00:00:09.000Z",
      ),
    ]);

    expect(first).toEqual({ ok: true, value: evidence });
    expect(second).toMatchObject({
      ok: false,
      error: { code: "ACCESS_REUSED" },
    });

    expect(
      createSponsorGrantLedger().consume(
        { token, resourceId: "recipe_analysis", nonce: "request-123" },
        "2026-08-30T00:00:09.000Z",
      ),
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_EVIDENCE" },
    });
  });

  it("bounds active issuance records and reclaims them at expiry", () => {
    const ledger = createSponsorGrantLedger({
      maxSessions: 2,
      maxGrants: 1,
      maxCachedResponses: 1,
    });
    for (const suffix of ["one", "two"]) {
      expect(
        ledger.createSession({
          credentialDigest: digest(`credential-${suffix}`),
          attemptId: `attempt-${suffix}`,
          resourceId: "recipe_analysis",
          nonce: `request-${suffix}`,
          sponsorId: "open-table-weekly",
          startedAt: "2026-08-30T00:00:00.000Z",
          expiresAt: "2026-08-30T00:01:30.000Z",
          status: "available",
        }),
      ).toMatchObject({ ok: true });
    }

    const complete = (suffix: "one" | "two", now: string) =>
      ledger.completeIssue({
        credentialDigest: digest(`credential-${suffix}`),
        issueDigest: digest(`issue-${suffix}`),
        now,
        requiredMs: 8_000,
        createGrant: () => {
          const response = {
            ok: true as const,
            token: suffix.repeat(43).slice(0, 43),
            evidence: {
              ...evidence,
              grantId: `grant-${suffix}`,
              nonce: `request-${suffix}`,
              issuedAt: now,
              expiresAt: new Date(Date.parse(now) + 60_000).toISOString(),
            },
          };
          return {
            grant: {
              evidence: response.evidence,
              tokenDigest: digest(response.token),
              issueDigest: digest(`issue-${suffix}`),
              sponsorId: "open-table-weekly",
              status: "available" as const,
            },
            response,
          };
        },
      });

    expect(complete("one", "2026-08-30T00:00:08.000Z")).toMatchObject({
      ok: true,
    });
    expect(complete("two", "2026-08-30T00:00:08.000Z")).toMatchObject({
      ok: false,
      error: { code: "DEPENDENCY_UNAVAILABLE" },
    });
    expect(complete("two", "2026-08-30T00:01:08.000Z")).toMatchObject({
      ok: true,
    });
  });
});
