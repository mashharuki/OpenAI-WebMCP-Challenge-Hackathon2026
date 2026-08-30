import { describe, expect, it } from "vitest";
import fixture from "../../../../test/fixtures/sponsor-access.json";
import {
  sponsorGrantIssueRequestSchema,
  sponsorGrantIssueResponseSchema,
  sponsorSessionStartRequestSchema,
  sponsorSessionStartResponseSchema,
} from "../../src/sponsor/contracts.js";

describe("server sponsor access contracts", () => {
  it("accepts canonical payloads and rejects client-owned fields or fixed-policy drift", () => {
    expect(
      sponsorSessionStartRequestSchema.parse(fixture.valid.startRequest),
    ).toEqual(fixture.valid.startRequest);
    expect(
      sponsorSessionStartResponseSchema.parse(fixture.valid.startResponse),
    ).toEqual(fixture.valid.startResponse);
    expect(
      sponsorGrantIssueRequestSchema.parse(fixture.valid.issueRequest),
    ).toEqual(fixture.valid.issueRequest);
    expect(
      sponsorGrantIssueResponseSchema.parse(fixture.valid.issueResponse),
    ).toEqual(fixture.valid.issueResponse);

    expect(
      sponsorSessionStartRequestSchema.safeParse(
        fixture.invalid.startRequestWithSponsor,
      ).success,
    ).toBe(false);
    expect(
      sponsorSessionStartResponseSchema.safeParse(
        fixture.invalid.startResponseWrongDuration,
      ).success,
    ).toBe(false);
    expect(
      sponsorGrantIssueRequestSchema.safeParse(
        fixture.invalid.issueRequestWithCompletion,
      ).success,
    ).toBe(false);

    expect(
      sponsorSessionStartRequestSchema.safeParse({
        ...fixture.valid.startRequest,
        attemptId: "a".repeat(129),
      }).success,
    ).toBe(false);
    expect(
      sponsorGrantIssueRequestSchema.safeParse({
        sessionCredential: "a".repeat(42),
      }).success,
    ).toBe(false);
  });
});
