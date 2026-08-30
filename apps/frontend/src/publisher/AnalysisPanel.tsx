import type { AdGateError, RecipeAnalysisResult } from "../adgate/contracts";

export type AnalysisViewState =
  | { readonly type: "idle" }
  | { readonly type: "loading" }
  | { readonly type: "success"; readonly result: RecipeAnalysisResult }
  | { readonly type: "error"; readonly error: AdGateError };

export interface AnalysisPanelProps {
  readonly state: AnalysisViewState;
  readonly onStart: () => void;
  readonly onRetry?: () => void;
}

export function AnalysisPanel({ state, onStart, onRetry }: AnalysisPanelProps) {
  return (
    <section
      aria-labelledby="premium-analysis-title"
      className="min-w-0 rounded-[2rem] border border-[#315843] bg-[#21352d] px-5 py-8 text-[#fbfaf6] shadow-[0_24px_70px_rgba(33,53,45,0.2)] sm:px-8 lg:px-12 lg:py-12"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#e2a93b]">
        Editorial intelligence
      </p>
      <h2
        id="premium-analysis-title"
        className="mt-2 max-w-2xl font-serif text-3xl leading-tight font-semibold sm:text-4xl"
      >
        A closer read of the bowl
      </h2>

      {state.type === "idle" ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <p className="max-w-2xl text-sm leading-6 text-[#d7e1da] sm:text-base">
            Explore the recipe’s nutritional shape, ingredient strengths, and
            practical ways to adapt it to your table.
          </p>
          <button
            type="button"
            onClick={onStart}
            className="min-h-11 rounded-full bg-[#e2a93b] px-5 py-3 text-sm font-bold text-[#21352d] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#fbfaf6]"
          >
            Analyze this recipe
          </button>
        </div>
      ) : null}

      {state.type === "loading" ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="mt-6 grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
        >
          <div className="flex items-center gap-3 text-sm text-[#d7e1da] sm:text-base">
            <span
              aria-hidden="true"
              className="size-3 rounded-full bg-[#e2a93b] motion-safe:animate-pulse"
            />
            <span>Analyzing this recipe…</span>
          </div>
          <button
            type="button"
            disabled
            className="min-h-11 cursor-wait rounded-full bg-[#708078] px-5 py-3 text-sm font-bold text-[#eef2ef]"
          >
            Analyzing this recipe
          </button>
        </div>
      ) : null}

      {state.type === "success" ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-8 grid min-w-0 gap-px overflow-hidden rounded-2xl bg-[#587064] sm:grid-cols-2"
        >
          <section className="min-w-0 bg-[#29483b] p-5 sm:p-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e2a93b]">
              Summary
            </h3>
            <p className="mt-3 leading-7 text-[#f1f4f1]">
              {state.result.summary}
            </p>
          </section>

          <section className="min-w-0 bg-[#29483b] p-5 sm:p-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e2a93b]">
              Nutritional insights
            </h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-[#e3ebe5]">
              {state.result.nutritionalInsights.map((insight) => (
                <li key={insight} className="flex gap-3">
                  <span aria-hidden="true" className="text-[#e2a93b]">
                    ●
                  </span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="min-w-0 bg-[#29483b] p-5 sm:p-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e2a93b]">
              Suggestions
            </h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-[#e3ebe5]">
              {state.result.suggestions.map((suggestion) => (
                <li key={suggestion} className="flex gap-3">
                  <span aria-hidden="true" className="text-[#e2a93b]">
                    →
                  </span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="min-w-0 bg-[#29483b] p-5 sm:p-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e2a93b]">
              Important note
            </h3>
            <p className="mt-3 text-sm leading-6 text-[#d7e1da]">
              {state.result.disclaimer}
            </p>
          </section>
        </div>
      ) : null}

      {state.type === "error" ? (
        <div
          role="alert"
          className="mt-6 grid gap-5 rounded-2xl border border-[#d88a74] bg-[#402c27] p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6"
        >
          <div>
            <h3 className="font-semibold text-[#ffd8cd]">
              Analysis could not be completed
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#f4ded8]">
              {state.error.message}
            </p>
          </div>
          {state.error.retryable && onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="min-h-11 rounded-full border border-[#ffd8cd] px-5 py-3 text-sm font-bold text-[#fff7f4] hover:bg-[#593b34] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#fbfaf6]"
            >
              Retry analysis
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
