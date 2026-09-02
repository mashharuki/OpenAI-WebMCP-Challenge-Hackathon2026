import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeContractError } from "../adgate/contracts";
import { AnalysisPanel, type AnalysisViewState } from "./AnalysisPanel";
import {
  type AnalysisClientPort,
  createAnalysisClient,
} from "./analysisClient";
import { RecipeArticle } from "./RecipeArticle";
import { sampleRecipe } from "./sampleRecipe";

export interface PublisherDemoProps {
  readonly analysisClient?: AnalysisClientPort;
  readonly analysisState?: AnalysisViewState;
}

const createDefaultClient = (): AnalysisClientPort =>
  createAnalysisClient({ baseUrl: globalThis.location.origin });

export function PublisherDemo({
  analysisClient,
  analysisState: externalAnalysisState,
}: PublisherDemoProps) {
  const client = useMemo(
    () => analysisClient ?? createDefaultClient(),
    [analysisClient],
  );
  const [analysisState, setAnalysisState] = useState<AnalysisViewState>({
    type: "idle",
  });
  const activeRequest = useRef<AbortController | null>(null);
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, []);

  const startAnalysis = useCallback(async () => {
    if (activeRequest.current) {
      return;
    }

    const controller = new AbortController();
    activeRequest.current = controller;
    setAnalysisState({ type: "loading" });

    try {
      const result = await client.analyze(
        sampleRecipe.analysisInput,
        controller.signal,
      );
      if (isMounted.current && !controller.signal.aborted) {
        setAnalysisState({ type: "success", result });
      }
    } catch (error) {
      if (isMounted.current && !controller.signal.aborted) {
        setAnalysisState({
          type: "error",
          error: normalizeContractError(error),
        });
      }
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
      }
    }
  }, [client]);

  return (
    <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1.55fr)_minmax(21rem,0.8fr)] xl:items-start xl:gap-10">
      <RecipeArticle recipe={sampleRecipe} />
      <div className="min-w-0 xl:sticky xl:top-6">
        <AnalysisPanel
          state={externalAnalysisState ?? analysisState}
          onStart={startAnalysis}
          onRetry={startAnalysis}
        />
      </div>
    </div>
  );
}
