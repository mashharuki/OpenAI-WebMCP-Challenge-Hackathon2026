import { describe, expect, it, vi } from "vitest";
import type { GateCoordinatorPort } from "../../src/adgate/gateCoordinator";
import { createGatedAnalysisClient } from "../../src/adgate/gatedAnalysisAdapter";

const input = { recipeId: "roasted-chickpea-quinoa-bowl" } as const;
const analysis = {
  summary: "A balanced plant-forward bowl.",
  nutritionalInsights: ["Chickpeas provide fiber."],
  suggestions: ["Add pumpkin seeds for crunch."],
  disclaimer: "This is general information, not medical advice.",
};

const coordinatorWith = (
  result: Awaited<ReturnType<GateCoordinatorPort["requestAnalysis"]>>,
): GateCoordinatorPort => ({
  requestAnalysis: vi.fn(async () => result),
  cancel: vi.fn(),
  getSnapshot: () => ({ state: { type: "idle" }, paymentAvailable: true }),
  subscribe: () => () => undefined,
});

describe("createGatedAnalysisClient", () => {
  it("returns canonical analysis through the visible UI source", async () => {
    const coordinator = coordinatorWith({
      ok: true,
      resourceId: "recipe_analysis",
      data: analysis,
    });
    const signal = new AbortController().signal;

    await expect(
      createGatedAnalysisClient(coordinator).analyze(input, signal),
    ).resolves.toEqual(analysis);
    expect(coordinator.requestAnalysis).toHaveBeenCalledExactlyOnceWith(input, {
      source: "visible_ui",
      signal,
    });
  });

  it("throws only the common safe error for the publisher error flow", async () => {
    const error = {
      code: "DEPENDENCY_UNAVAILABLE" as const,
      message: "Sponsor access is temporarily unavailable.",
      retryable: true,
    };
    const coordinator = coordinatorWith({ ok: false, error });

    await expect(
      createGatedAnalysisClient(coordinator).analyze(input),
    ).rejects.toEqual(error);
  });
});
