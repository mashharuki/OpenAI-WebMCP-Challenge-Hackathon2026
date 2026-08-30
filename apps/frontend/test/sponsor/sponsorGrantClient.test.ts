import { describe, expect, it, vi } from "vitest";
import fixture from "../../../../test/fixtures/sponsor-access.json";
import {
  sponsorGrantIssueRequestSchema,
  sponsorGrantIssueResponseSchema,
  sponsorSessionStartRequestSchema,
  sponsorSessionStartResponseSchema,
} from "../../src/sponsor/contracts";
import { createSponsorGrantClient } from "../../src/sponsor/sponsorGrantClient";

describe("SponsorGrantClient", () => {
  it("uses canonical session and grant payloads without putting credentials in URLs", async () => {
    const startRequest = sponsorSessionStartRequestSchema.parse(
      fixture.valid.startRequest,
    );
    const issueRequest = sponsorGrantIssueRequestSchema.parse(
      fixture.valid.issueRequest,
    );
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

    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const responses = [
      Response.json(fixture.valid.startResponse, { status: 201 }),
      Response.json(fixture.valid.issueResponse, { status: 201 }),
    ];
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ input, init });
        const response = responses.shift();
        if (!response) throw new Error("Unexpected request");
        return response;
      },
    );
    const client = createSponsorGrantClient({
      baseUrl: "https://publisher.example",
      fetchImpl,
    });
    const signal = new AbortController().signal;

    await expect(client.start(startRequest, signal)).resolves.toEqual(
      fixture.valid.startResponse,
    );
    await expect(client.issue(issueRequest, signal)).resolves.toEqual({
      ok: true,
      token: fixture.valid.issueResponse.token,
      evidence: fixture.valid.issueResponse.evidence,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(calls[0]?.input).toBe(
      "https://publisher.example/api/sponsor-sessions",
    );
    expect(calls[1]?.input).toBe(
      "https://publisher.example/api/sponsor-grants",
    );
    expect(String(calls[1]?.input)).not.toContain(
      issueRequest.sessionCredential,
    );
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual(startRequest);
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual(issueRequest);
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
