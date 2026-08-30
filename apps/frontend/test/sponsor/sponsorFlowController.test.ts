import { describe, expect, it, vi } from "vitest";
import fixture from "../../../../test/fixtures/sponsor-access.json";
import {
  sponsorGrantIssueResponseSchema,
  sponsorSessionStartResponseSchema,
} from "../../src/sponsor/contracts";
import { createSponsorFlowController } from "../../src/sponsor/sponsorFlowController";
import type { SponsorFlowResult } from "../../src/sponsor/sponsorGrantClient";

const session = sponsorSessionStartResponseSchema.parse(
  fixture.valid.startResponse,
);
const issueResponse = sponsorGrantIssueResponseSchema.parse(
  fixture.valid.issueResponse,
);

describe("SponsorFlowController", () => {
  it("counts only visible monotonic time and issues once at the exact boundary", async () => {
    let now = 1_000;
    let visible = true;
    const issue = vi.fn(async () => issueResponse);
    const controller = createSponsorFlowController({
      attemptId: "attempt-123",
      nonce: "request-123",
      session,
      clock: { monotonicNow: () => now },
      isVisible: () => visible,
      issue,
    });

    controller.start("attempt-123");
    now += 3_000;
    controller.tick("attempt-123");
    visible = false;
    controller.visibilityChanged("attempt-123");
    now += 10_000;
    controller.tick("attempt-123");

    expect(controller.getSnapshot()).toMatchObject({
      type: "viewing",
      visibleElapsedMs: 3_000,
    });

    visible = true;
    controller.visibilityChanged("attempt-123");
    now += 5_000;
    controller.tick("attempt-123");

    await expect(controller.continue("attempt-123")).resolves.toEqual(
      issueResponse,
    );
    expect(issue).toHaveBeenCalledOnce();
    expect(issue).toHaveBeenCalledWith(
      { sessionCredential: session.sessionCredential },
      undefined,
    );
    expect(controller.getSnapshot()).toEqual({
      type: "completed",
      attemptId: "attempt-123",
      evidence: issueResponse.evidence,
      token: issueResponse.token,
    });
  });

  it("does not count a backwards clock or events from another attempt", () => {
    let now = 1_000;
    const controller = createSponsorFlowController({
      attemptId: "attempt-123",
      nonce: "request-123",
      session,
      clock: { monotonicNow: () => now },
      isVisible: () => true,
      issue: vi.fn(async () => issueResponse),
    });

    controller.start("other-attempt");
    expect(controller.getSnapshot().type).toBe("ready");
    controller.start("attempt-123");
    now = 900;
    controller.tick("attempt-123");
    controller.tick("other-attempt");

    expect(controller.getSnapshot()).toMatchObject({
      type: "viewing",
      visibleElapsedMs: 0,
    });
  });

  it("settles once when cancellation wins a race with grant issuance", async () => {
    let now = 1_000;
    let resolveIssue: ((result: SponsorFlowResult) => void) | undefined;
    const onTerminal = vi.fn();
    const controller = createSponsorFlowController({
      attemptId: "attempt-123",
      nonce: "request-123",
      session,
      clock: { monotonicNow: () => now },
      isVisible: () => true,
      issue: () =>
        new Promise((resolve) => {
          resolveIssue = resolve;
        }),
      onTerminal,
    });

    controller.start("attempt-123");
    now = 9_000;
    controller.tick("attempt-123");
    const issuance = controller.continue("attempt-123");
    controller.cancel("attempt-123");
    resolveIssue?.(issueResponse);

    await expect(issuance).resolves.toMatchObject({
      ok: false,
      error: { code: "CANCELLED" },
    });
    expect(controller.getSnapshot()).toEqual({
      type: "cancelled",
      attemptId: "attempt-123",
    });
    expect(onTerminal).toHaveBeenCalledOnce();
  });

  it("treats abort and unmount disposal as one cancellation", () => {
    const onTerminal = vi.fn();
    const controller = createSponsorFlowController({
      attemptId: "attempt-123",
      nonce: "request-123",
      session,
      clock: { monotonicNow: () => 1_000 },
      isVisible: () => true,
      issue: vi.fn(async () => issueResponse),
      onTerminal,
    });

    controller.abort("attempt-123");
    controller.dispose();

    expect(controller.getSnapshot()).toEqual({
      type: "cancelled",
      attemptId: "attempt-123",
    });
    expect(onTerminal).toHaveBeenCalledOnce();
  });
});
