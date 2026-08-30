import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../../test/fixtures/sponsor-access.json";
import {
  sponsorGrantIssueResponseSchema,
  sponsorSessionStartResponseSchema,
} from "../../src/sponsor/contracts";
import {
  type SponsorGatePort,
  SponsorGateProvider,
  useSponsorGate,
} from "../../src/sponsor/SponsorGateProvider";
import type {
  SponsorFlowResult,
  SponsorGrantClient,
} from "../../src/sponsor/sponsorGrantClient";

const session = sponsorSessionStartResponseSchema.parse(
  fixture.valid.startResponse,
);
const issueResponse = sponsorGrantIssueResponseSchema.parse(
  fixture.valid.issueResponse,
);

let capturedPort: SponsorGatePort | undefined;

function CapturePort() {
  capturedPort = useSponsorGate();
  return null;
}

afterEach(() => {
  capturedPort = undefined;
  vi.useRealTimers();
});

describe("SponsorGateProvider", () => {
  it("resolves the original attempt once after an explicit visible sponsor view", async () => {
    vi.useFakeTimers();
    let now = 1_000;
    const client: SponsorGrantClient = {
      start: vi.fn(async () => session),
      issue: vi.fn(async () => issueResponse),
    };
    render(
      <SponsorGateProvider
        client={client}
        clock={{ monotonicNow: () => now }}
        visibility={{ isVisible: () => true, subscribe: () => () => {} }}
      >
        <CapturePort />
      </SponsorGateProvider>,
    );
    const abortController = new AbortController();
    let resultPromise!: ReturnType<SponsorGatePort["requestSponsorAccess"]>;

    act(() => {
      resultPromise = capturedPort?.requestSponsorAccess({
        attemptId: "attempt-123",
        resourceId: "recipe_analysis",
        nonce: "request-123",
        signal: abortController.signal,
      }) as ReturnType<SponsorGatePort["requestSponsorAccess"]>;
    });
    await act(async () => Promise.resolve());

    expect(screen.queryByText("Open Table Weekly")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start sponsor view" }));
    expect(screen.getByText("Open Table Weekly")).toBeVisible();
    now += 8_000;
    act(() => vi.advanceTimersByTime(250));
    fireEvent.click(
      screen.getByRole("button", { name: "Continue to recipe analysis" }),
    );

    await expect(resultPromise).resolves.toEqual(issueResponse);
    expect(client.start).toHaveBeenCalledOnce();
    expect(client.issue).toHaveBeenCalledOnce();
    expect(localStorage).toHaveLength(0);
    expect(window.location.href).not.toContain(issueResponse.token);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("rejects a second attempt without replacing the active sponsor view", async () => {
    const client: SponsorGrantClient = {
      start: vi.fn(async () => session),
      issue: vi.fn(async () => issueResponse),
    };
    render(
      <SponsorGateProvider client={client}>
        <CapturePort />
      </SponsorGateProvider>,
    );
    const firstSignal = new AbortController().signal;
    const secondSignal = new AbortController().signal;
    let first!: ReturnType<SponsorGatePort["requestSponsorAccess"]>;

    act(() => {
      first = capturedPort?.requestSponsorAccess({
        attemptId: "attempt-first",
        resourceId: "recipe_analysis",
        nonce: "nonce-first",
        signal: firstSignal,
      }) as ReturnType<SponsorGatePort["requestSponsorAccess"]>;
    });
    await act(async () => Promise.resolve());
    const second = capturedPort?.requestSponsorAccess({
      attemptId: "attempt-second",
      resourceId: "recipe_analysis",
      nonce: "nonce-second",
      signal: secondSignal,
    });

    await expect(second).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_TRANSITION" },
    });
    expect(client.start).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: "Start sponsor view" }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Cancel sponsor view" }),
    );
    await expect(first).resolves.toMatchObject({
      ok: false,
      error: { code: "CANCELLED" },
    });
  });

  it("normalizes a session dependency failure without exposing its cause", async () => {
    const client: SponsorGrantClient = {
      start: vi.fn(async () => {
        throw new Error("private sponsor service details");
      }),
      issue: vi.fn(async () => issueResponse),
    };
    render(
      <SponsorGateProvider client={client}>
        <CapturePort />
      </SponsorGateProvider>,
    );
    const result = capturedPort?.requestSponsorAccess({
      attemptId: "attempt-123",
      resourceId: "recipe_analysis",
      nonce: "request-123",
      signal: new AbortController().signal,
    });

    await expect(result).resolves.toEqual({
      ok: false,
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "Sponsor access is temporarily unavailable. Try again.",
        retryable: true,
      },
    });
    expect(JSON.stringify(await result)).not.toContain(
      "private sponsor service details",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps cancellation terminal when a late grant success arrives", async () => {
    vi.useFakeTimers();
    let now = 1_000;
    let resolveIssue: ((result: SponsorFlowResult) => void) | undefined;
    const client: SponsorGrantClient = {
      start: vi.fn(async () => session),
      issue: vi.fn(
        () =>
          new Promise<SponsorFlowResult>((resolve) => {
            resolveIssue = resolve;
          }),
      ),
    };
    render(
      <SponsorGateProvider
        client={client}
        clock={{ monotonicNow: () => now }}
        visibility={{ isVisible: () => true, subscribe: () => () => {} }}
      >
        <CapturePort />
      </SponsorGateProvider>,
    );
    const abortController = new AbortController();
    const result = capturedPort?.requestSponsorAccess({
      attemptId: "attempt-123",
      resourceId: "recipe_analysis",
      nonce: "request-123",
      signal: abortController.signal,
    });
    await act(async () => Promise.resolve());
    fireEvent.click(screen.getByRole("button", { name: "Start sponsor view" }));
    now += 8_000;
    act(() => vi.advanceTimersByTime(250));
    fireEvent.click(
      screen.getByRole("button", { name: "Continue to recipe analysis" }),
    );
    act(() => abortController.abort());

    await expect(result).resolves.toMatchObject({
      ok: false,
      error: { code: "CANCELLED" },
    });
    await act(async () => resolveIssue?.(issueResponse));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cancels the active attempt when the provider unmounts", async () => {
    let startSignal: AbortSignal | undefined;
    const client: SponsorGrantClient = {
      start: vi.fn(async (_input, signal) => {
        startSignal = signal;
        return session;
      }),
      issue: vi.fn(async () => issueResponse),
    };
    const { unmount } = render(
      <SponsorGateProvider client={client}>
        <CapturePort />
      </SponsorGateProvider>,
    );
    const result = capturedPort?.requestSponsorAccess({
      attemptId: "attempt-123",
      resourceId: "recipe_analysis",
      nonce: "request-123",
      signal: new AbortController().signal,
    });
    await act(async () => Promise.resolve());

    unmount();

    await expect(result).resolves.toMatchObject({
      ok: false,
      error: { code: "CANCELLED" },
    });
    expect(startSignal?.aborted).toBe(true);
  });
});
