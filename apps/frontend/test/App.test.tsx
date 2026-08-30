import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../src/App";

describe("publisher root composition", () => {
  it("introduces the publisher, recipe, premium value, and analysis action", () => {
    render(<App />);

    expect(screen.getAllByText("Open Table Journal").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "Roasted Chickpea Quinoa Bowl" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/practical nutrition and ingredient insights/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Analyze this recipe" }),
    ).toBeEnabled();
  });

  it("does not expose the previous todo experience", () => {
    render(<App />);

    expect(screen.queryByText("WebMCP React")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add todo" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/todo app/i)).not.toBeInTheDocument();
  });
});
