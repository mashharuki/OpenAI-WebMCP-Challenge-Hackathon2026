import { describe, expect, it, vi } from "vitest";
import {
  type ModelContextNamespace,
  selectModelContext,
} from "../../src/webmcp/modelContext";

function createModelContext(): WebMCPModelContext {
  return {
    registerTool: vi.fn(async () => undefined),
  };
}

describe("selectModelContext", () => {
  it("prefers document when both namespaces expose WebMCP", () => {
    const documentContext = createModelContext();
    const navigatorContext = createModelContext();

    const selection = selectModelContext(
      { modelContext: documentContext },
      { modelContext: navigatorContext },
    );

    expect(selection).toEqual({
      supported: true,
      source: "document",
      context: documentContext,
    });
  });

  it("selects document when it is the only supported namespace", () => {
    const documentContext = createModelContext();

    const selection = selectModelContext({ modelContext: documentContext }, {});

    expect(selection).toEqual({
      supported: true,
      source: "document",
      context: documentContext,
    });
  });

  it("falls back to the legacy navigator namespace", () => {
    const navigatorContext = createModelContext();

    const selection = selectModelContext(
      {},
      { modelContext: navigatorContext },
    );

    expect(selection).toEqual({
      supported: true,
      source: "navigator",
      context: navigatorContext,
    });
  });

  it("reports unsupported when neither namespace exposes WebMCP", () => {
    const unsupportedNamespace: ModelContextNamespace = {};

    expect(selectModelContext(unsupportedNamespace, {})).toEqual({
      supported: false,
    });
  });
});
