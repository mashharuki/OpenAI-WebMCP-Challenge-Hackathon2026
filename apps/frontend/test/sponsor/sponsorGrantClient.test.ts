import { describe, expect, it, vi } from "vitest";
import fixture from "../../../../test/fixtures/sponsor-access.json";
import {
  sponsorGrantIssueResponseSchema,
  sponsorSessionStartResponseSchema,
} from "../../src/sponsor/contracts";
import { createSponsorGrantClient } from "../../src/sponsor/sponsorGrantClient";

describe("SponsorGrantClient", () => {
  it("uses canonical session and grant payloads without putting credentials in URLs", async () => {
    expect(
      sponsorSessionStartResponseSchema.parse(fixture.valid.startResponse),
    ).toEqual(fixture.valid.startResponse);
    expect(
      sponsorGrantIssueResponseSchema.parse(fixture.valid.issueResponse),
    ).toEqual(fixture.valid.issueResponse);
    expect(
      sponsorSessionStartResponseSchema.safeParse(
        fixture.invalid.startResponseWrongDuration,
      ).success,
    ).toBe(false);

    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(fixture.valid.startResponse, { status: 201 }),
      )
      .mockResolvedValueOnce(
        Response.json(fixture.valid.issueResponse, { status: 201 }),
      );
    const client = createSponsorGrantClient({
      baseUrl: "https://publisher.example",
      fetchImpl,
    });
    const signal = new AbortController().signal;

    await expect(
      client.start(fixture.valid.startRequest, signal),
    ).resolves.toEqual(fixture.valid.startResponse);
    await expect(
      client.issue(fixture.valid.issueRequest, signal),
    ).resolves.toEqual({
      ok: true,
      token: fixture.valid.issueResponse.token,
      evidence: fixture.valid.issueResponse.evidence,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "https://publisher.example/api/sponsor-sessions",
    );
    expect(fetchImpl.mock.calls[1]?.[0]).toBe(
      "https://publisher.example/api/sponsor-grants",
    );
    expect(String(fetchImpl.mock.calls[1]?.[0])).not.toContain(
      fixture.valid.issueRequest.sessionCredential,
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual(
      fixture.valid.startRequest,
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))).toEqual(
      fixture.valid.issueRequest,
    );
  });

  it("returns a validated common error without echoing the session credential", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        {
          ok: false,
          error: {
            code: "ACCESS_EXPIRED",
            message: "The sponsor session has expired.",
            retryable: true,
          },
        },
        { status: 409 },
      ),
    ) as typeof fetch;
    const client = createSponsorGrantClient({
      baseUrl: "https://publisher.example",
      fetchImpl,
    });

    const result = await client.issue(fixture.valid.issueRequest);

    expect(result).toEqual({
      ok: false,
      error: {
        code: "ACCESS_EXPIRED",
        message: "The sponsor session has expired.",
        retryable: true,
      },
    });
    expect(JSON.stringify(result)).not.toContain(
      fixture.valid.issueRequest.sessionCredential,
    );
  });

  it("normalizes an invalid grant response without exposing token-like data", async () => {
    const client = createSponsorGrantClient({
      baseUrl: "https://publisher.example",
      fetchImpl: vi.fn(async () =>
        Response.json({
          ok: true,
          token: "private-short-token",
          evidence: { internal: "private diagnostic" },
        }),
      ) as typeof fetch,
    });

    const result = await client.issue(fixture.valid.issueRequest);

    expect(result).toEqual({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "The sponsor access response could not be validated.",
        retryable: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain("private-short-token");
    expect(JSON.stringify(result)).not.toContain("private diagnostic");
  });
});
