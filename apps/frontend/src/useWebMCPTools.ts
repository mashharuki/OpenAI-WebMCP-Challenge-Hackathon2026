import { useEffect, useState } from "react";
import { z } from "zod";
import {
  normalizeContractError,
  recipeAnalysisInputSchema,
} from "./adgate/contracts";
import type { GateCoordinatorPort } from "./adgate/gateCoordinator";
import { selectModelContext } from "./webmcp/modelContext";

export type WebMCPToolsState = {
  readonly supported: boolean;
  readonly registered: boolean;
  readonly source?: "document" | "navigator";
  readonly error: string | null;
};

const inputSchema = z.toJSONSchema(recipeAnalysisInputSchema, {
  target: "draft-07",
  io: "input",
});

const registrationUnavailableMessage =
  "WebMCP tool registration is unavailable.";

const createAnalyzeRecipeTool = (
  coordinator: GateCoordinatorPort,
): WebMCPTool => ({
  name: "analyze_recipe",
  title: "Analyze this recipe",
  description:
    "Request premium analysis for the published recipe. A human access choice is required before completion. Returns a summary, nutritional insights, practical suggestions, and a general-information disclaimer.",
  inputSchema,
  annotations: {
    readOnlyHint: false,
    untrustedContentHint: true,
  },
  async execute(input, options) {
    const parsed = recipeAnalysisInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: normalizeContractError(parsed.error),
      };
    }
    return coordinator.requestAnalysis(parsed.data, {
      source: "webmcp",
      signal: options?.signal,
    });
  },
});

export function useWebMCPTools(
  coordinator: GateCoordinatorPort,
): WebMCPToolsState {
  const [state, setState] = useState<WebMCPToolsState>({
    supported: false,
    registered: false,
    error: null,
  });

  useEffect(() => {
    const selection = selectModelContext(document, navigator);
    if (!selection.supported) {
      setState({ supported: false, registered: false, error: null });
      return;
    }

    const controller = new AbortController();
    const source = selection.source;
    setState({ supported: true, registered: false, source, error: null });

    void selection.context
      .registerTool(createAnalyzeRecipeTool(coordinator), {
        signal: controller.signal,
      })
      .then(() => {
        if (!controller.signal.aborted) {
          setState({ supported: true, registered: true, source, error: null });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({
            supported: true,
            registered: false,
            source,
            error: registrationUnavailableMessage,
          });
        }
      });

    return () => {
      controller.abort();
      coordinator.cancel("unmounted");
    };
  }, [coordinator]);

  return state;
}
