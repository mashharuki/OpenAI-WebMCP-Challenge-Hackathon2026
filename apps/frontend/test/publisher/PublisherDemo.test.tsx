import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RecipeAnalysisResult } from "../../src/adgate/contracts";
import type { AnalysisClientPort } from "../../src/publisher/analysisClient";
import { PublisherDemo } from "../../src/publisher/PublisherDemo";

const analysisResult: RecipeAnalysisResult = {
  summary: "A balanced plant-forward bowl with fiber-rich ingredients.",
  nutritionalInsights: ["Chickpeas and quinoa contribute fiber."],
  suggestions: ["Add pumpkin seeds for extra crunch."],
  disclaimer: "This is general information, not medical advice.",
};

const deferred = <Value,>() => {
  let resolve!: (value: Value) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

describe("PublisherDemo", () => {
  it("runs one request while pending and presents the successful analysis", async () => {
    const request = deferred<RecipeAnalysisResult>();
    const analyze = vi.fn(() => request.promise);
    const client: AnalysisClientPort = { analyze };
    render(<PublisherDemo analysisClient={client} />);

    const start = screen.getByRole("button", { name: "Analyze this recipe" });
    fireEvent.click(start);
    fireEvent.click(start);

    expect(analyze).toHaveBeenCalledOnce();
    expect(analyze).toHaveBeenCalledWith(
      { recipeId: "roasted-chickpea-quinoa-bowl" },
      expect.any(AbortSignal),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Analyzing this recipe",
    );

    await act(async () => request.resolve(analysisResult));

    expect(screen.getByRole("status")).toHaveTextContent(
      analysisResult.summary,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      analysisResult.suggestions[0],
    );
  });

  it("analyzes the unchanged recipe again and returns the same result", async () => {
    const analyze = vi
      .fn<AnalysisClientPort["analyze"]>()
      .mockResolvedValue(analysisResult);
    render(<PublisherDemo analysisClient={{ analyze }} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Analyze this recipe" }),
    );
    await screen.findByText(analysisResult.summary);
    expect(screen.getByRole("status")).toHaveTextContent(
      analysisResult.summary,
    );

    const analyzeAgain = screen.getByRole("button", {
      name: "Analyze again",
    });
    fireEvent.click(analyzeAgain);
    fireEvent.click(analyzeAgain);

    expect(analyze).toHaveBeenCalledTimes(2);
    expect(analyze).toHaveBeenLastCalledWith(
      { recipeId: "roasted-chickpea-quinoa-bowl" },
      expect.any(AbortSignal),
    );
    await screen.findByText(analysisResult.summary);
    expect(screen.getByRole("status")).toHaveTextContent(
      analysisResult.summary,
    );
  });

  it("shows only a safe error and retries the same recipe once", async () => {
    const firstRequest = deferred<RecipeAnalysisResult>();
    const secondRequest = deferred<RecipeAnalysisResult>();
    const analyze = vi
      .fn<AnalysisClientPort["analyze"]>()
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);
    render(<PublisherDemo analysisClient={{ analyze }} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Analyze this recipe" }),
    );
    await act(async () =>
      firstRequest.reject({
        code: "DEPENDENCY_UNAVAILABLE",
        message: "Analysis is temporarily unavailable. Try again.",
        retryable: true,
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Analysis is temporarily unavailable. Try again.",
    );
    const retry = screen.getByRole("button", { name: "Retry analysis" });
    fireEvent.click(retry);
    fireEvent.click(retry);
    expect(analyze).toHaveBeenCalledTimes(2);

    await act(async () => secondRequest.resolve(analysisResult));
    expect(screen.getByRole("status")).toHaveTextContent(
      analysisResult.summary,
    );
  });

  it("keeps the recipe visible and hides raw details from unknown failures", async () => {
    const analyze = vi.fn<AnalysisClientPort["analyze"]>(async () => {
      throw new Error("PRIVATE_KEY=raw-secret stack detail");
    });
    render(<PublisherDemo analysisClient={{ analyze }} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Analyze this recipe" }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "The request could not be completed safely.",
    );
    expect(alert).not.toHaveTextContent("PRIVATE_KEY");
    expect(alert).not.toHaveTextContent("raw-secret");
    expect(
      screen.getByRole("heading", { name: "Roasted Chickpea Quinoa Bowl" }),
    ).toBeInTheDocument();
  });

  it("aborts an active request when the publisher view unmounts", () => {
    const request = deferred<RecipeAnalysisResult>();
    let receivedSignal: AbortSignal | undefined;
    const analyze = vi.fn<AnalysisClientPort["analyze"]>((_input, signal) => {
      receivedSignal = signal;
      return request.promise;
    });
    const { unmount } = render(<PublisherDemo analysisClient={{ analyze }} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Analyze this recipe" }),
    );
    expect(receivedSignal?.aborted).toBe(false);

    unmount();
    expect(receivedSignal?.aborted).toBe(true);
  });
});
