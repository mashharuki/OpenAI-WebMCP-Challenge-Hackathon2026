import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnalysisPanel } from "../../src/publisher/AnalysisPanel";

describe("AnalysisPanel", () => {
  it("offers one clearly named sponsor access action while idle", () => {
    const onStart = vi.fn();
    render(<AnalysisPanel state={{ type: "idle" }} onStart={onStart} />);

    const action = screen.getByRole("button", {
      name: "Use sponsor access",
    });
    expect(action).toBeEnabled();
    expect(screen.getByText(/sponsor message/i)).toBeVisible();
    fireEvent.click(action);
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("announces loading and prevents a duplicate analysis action", () => {
    render(<AnalysisPanel state={{ type: "loading" }} onStart={vi.fn()} />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("Analyzing this recipe");
    expect(
      screen.getByRole("button", { name: "Analyzing this recipe" }),
    ).toBeDisabled();
  });

  it("announces a successful analysis in four semantic result areas", () => {
    render(
      <AnalysisPanel
        state={{
          type: "success",
          result: {
            summary: "A balanced plant-forward bowl.",
            nutritionalInsights: ["Chickpeas provide fiber."],
            suggestions: ["Add pumpkin seeds for crunch."],
            disclaimer: "This is general information, not medical advice.",
          },
        }}
        onStart={vi.fn()}
      />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(
      screen.getByRole("heading", { name: "Summary" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Nutritional insights" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Suggestions" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Important note" }),
    ).toBeInTheDocument();
    expect(status).toHaveTextContent("A balanced plant-forward bowl.");
    expect(status).toHaveTextContent("Chickpeas provide fiber.");
    expect(status).toHaveTextContent("Add pumpkin seeds for crunch.");
    expect(status).toHaveTextContent(
      "This is general information, not medical advice.",
    );
  });

  it("announces a safe retryable error and offers one retry action", () => {
    const onRetry = vi.fn();
    render(
      <AnalysisPanel
        state={{
          type: "error",
          error: {
            code: "DEPENDENCY_UNAVAILABLE",
            message: "Analysis is temporarily unavailable.",
            retryable: true,
          },
        }}
        onStart={vi.fn()}
        onRetry={onRetry}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Analysis is temporarily unavailable.");
    const retry = screen.getByRole("button", {
      name: "Retry sponsor access",
    });
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("does not offer retry for a non-retryable error", () => {
    render(
      <AnalysisPanel
        state={{
          type: "error",
          error: {
            code: "INVALID_INPUT",
            message: "The recipe analysis request is invalid.",
            retryable: false,
          },
        }}
        onStart={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The recipe analysis request is invalid.",
    );
    expect(
      screen.queryByRole("button", { name: "Retry sponsor access" }),
    ).not.toBeInTheDocument();
  });
});
