import type { AnalysisClientPort } from "../publisher/analysisClient";
import type { GateCoordinatorPort } from "./gateCoordinator";

export const createGatedAnalysisClient = (
  coordinator: GateCoordinatorPort,
): AnalysisClientPort => ({
  async analyze(input, signal) {
    const result = await coordinator.requestAnalysis(input, {
      source: "visible_ui",
      signal,
    });
    if (!result.ok) throw result.error;
    return result.data;
  },
});
