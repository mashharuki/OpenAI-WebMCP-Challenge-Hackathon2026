import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

  it("keeps visible gated analysis available without a WebMCP host", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: "Analyze this recipe" }),
    );

    expect(
      screen.getByText("Choose how to unlock recipe analysis."),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Use sponsor access" }),
    ).toBeEnabled();
    expect(screen.getByText(/WebMCP is not available/i)).toBeVisible();
  });

  it("routes a WebMCP invocation and the publisher through one gate", async () => {
    let tool: WebMCPTool | undefined;
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool: vi.fn(async (definition: WebMCPTool) => {
          tool = definition;
        }),
      },
    });
    render(<App />);

    await waitFor(() => expect(tool?.name).toBe("analyze_recipe"));
    let result: unknown;
    await act(async () => {
      const invocation = tool?.execute(
        { recipeId: "roasted-chickpea-quinoa-bowl" },
        { signal: new AbortController().signal },
      );
      expect(invocation).toBeDefined();
      void invocation?.then((value) => {
        result = value;
      });
    });

    expect(
      screen.getByText("Choose how to unlock recipe analysis."),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Analyze this recipe" }),
    ).toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel analysis" }));
    });
    await waitFor(() =>
      expect(result).toMatchObject({ ok: false, error: { code: "CANCELLED" } }),
    );
  });

  it("registers exactly one analyze tool on the legacy navigator host", async () => {
    const registerTool = vi.fn<WebMCPModelContext["registerTool"]>(
      async () => undefined,
    );
    Object.defineProperty(navigator, "modelContext", {
      configurable: true,
      value: { registerTool },
    });

    render(<App />);

    await waitFor(() => expect(registerTool).toHaveBeenCalledOnce());
    const registeredNames = registerTool.mock.calls.map(([tool]) => tool.name);
    expect(registeredNames).toEqual(["analyze_recipe"]);
    expect(registeredNames).not.toEqual(
      expect.arrayContaining([
        "list_todos",
        "rename_todo",
        "set_todo_completed",
        "delete_todo",
      ]),
    );
    expect(screen.getByText(/ready via navigator/i)).toBeVisible();
  });

  it("keeps the visible gate usable after registration failure", async () => {
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool: vi.fn(async () => {
          throw new DOMException("private browser failure", "SecurityError");
        }),
      },
    });
    render(<App />);

    expect(
      await screen.findByText("WebMCP tool registration is unavailable."),
    ).toBeVisible();
    expect(
      screen.queryByText(/private browser failure/i),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Analyze this recipe" }),
    );
    expect(
      screen.getByText("Choose how to unlock recipe analysis."),
    ).toBeVisible();
  });
});
