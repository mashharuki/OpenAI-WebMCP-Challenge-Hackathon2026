import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GateCoordinatorPort } from "../src/adgate/gateCoordinator";
import { useWebMCPTools } from "../src/useWebMCPTools";

const analysis = {
  summary: "A balanced plant-forward bowl.",
  nutritionalInsights: ["Chickpeas provide fiber."],
  suggestions: ["Add pumpkin seeds for crunch."],
  disclaimer: "This is general information, not medical advice.",
};

const createCoordinator = (): GateCoordinatorPort => ({
  requestAnalysis: vi.fn<GateCoordinatorPort["requestAnalysis"]>(async () => ({
    ok: true as const,
    resourceId: "recipe_analysis" as const,
    data: analysis,
  })),
  chooseSponsor: vi.fn(async () => undefined),
  choosePayment: vi.fn(async () => undefined),
  cancel: vi.fn(),
  getSnapshot: () => ({
    state: { type: "idle" },
    paymentAvailable: true,
  }),
  subscribe: () => () => undefined,
});

function HookHarness({ coordinator }: { coordinator: GateCoordinatorPort }) {
  const state = useWebMCPTools(coordinator);
  return <output>{JSON.stringify(state)}</output>;
}

describe("useWebMCPTools", () => {
  it("registers one strict analyze_recipe tool and bridges valid execution", async () => {
    const registerTool = vi.fn<WebMCPModelContext["registerTool"]>(
      async () => undefined,
    );
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: { registerTool },
    });
    const coordinator = createCoordinator();
    const { unmount } = render(<HookHarness coordinator={coordinator} />);

    await waitFor(() => expect(registerTool).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.getByText(/"registered":true/)).toBeInTheDocument(),
    );
    const [tool, registration] = registerTool.mock.calls[0];
    expect(tool).toMatchObject({
      name: "analyze_recipe",
      title: "Analyze this recipe",
      annotations: {
        readOnlyHint: false,
        untrustedContentHint: true,
      },
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["recipeId"],
      },
    });
    expect(tool.description).toMatch(/human access choice/i);
    expect(tool.description.length).toBeLessThanOrEqual(500);
    expect(registration).not.toHaveProperty("exposedTo");
    expect(registration?.signal?.aborted).toBe(false);

    const invocation = new AbortController();
    await expect(
      tool.execute(
        { recipeId: "roasted-chickpea-quinoa-bowl" },
        { signal: invocation.signal },
      ),
    ).resolves.toEqual({
      ok: true,
      resourceId: "recipe_analysis",
      data: analysis,
    });
    expect(coordinator.requestAnalysis).toHaveBeenCalledExactlyOnceWith(
      { recipeId: "roasted-chickpea-quinoa-bowl" },
      { source: "webmcp", signal: invocation.signal },
    );

    unmount();
    expect(registration?.signal?.aborted).toBe(true);
    expect(coordinator.cancel).toHaveBeenCalledExactlyOnceWith("unmounted");
  });

  it.each([
    [{ recipeId: "unknown-recipe" }],
    [{ recipeId: "roasted-chickpea-quinoa-bowl", recipeBody: "private" }],
    [{}],
  ])("rejects invalid tool input before opening the gate", async (args) => {
    let tool: WebMCPTool | undefined;
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool: async (registeredTool: WebMCPTool) => {
          tool = registeredTool;
        },
      },
    });
    const coordinator = createCoordinator();
    render(<HookHarness coordinator={coordinator} />);
    await waitFor(() => expect(tool).toBeDefined());

    await expect(
      tool?.execute(args, { signal: new AbortController().signal }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT" },
    });
    expect(coordinator.requestAnalysis).not.toHaveBeenCalled();
  });

  it("keeps a safe unavailable state when registration fails", async () => {
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool: async () => {
          throw new DOMException("private browser details", "SecurityError");
        },
      },
    });

    render(<HookHarness coordinator={createCoordinator()} />);

    await waitFor(() =>
      expect(screen.getByText(/"registered":false/)).toHaveTextContent(
        "WebMCP tool registration is unavailable.",
      ),
    );
    expect(
      screen.queryByText(/private browser details/i),
    ).not.toBeInTheDocument();
  });
});
