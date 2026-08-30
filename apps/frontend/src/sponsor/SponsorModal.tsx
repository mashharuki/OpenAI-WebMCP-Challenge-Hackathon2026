import { type KeyboardEvent, useEffect, useRef } from "react";
import type { SponsorViewState } from "./sponsorFlowController";

export interface SponsorModalProps {
  readonly state: SponsorViewState;
  readonly remainingSeconds: number;
  readonly onStart: () => void;
  readonly onContinue: () => void;
  readonly onCancel: () => void;
}

const statusText = (
  state: SponsorViewState,
  remainingSeconds: number,
): string => {
  switch (state.type) {
    case "ready":
      return "Ready to begin";
    case "viewing":
      return remainingSeconds <= 0
        ? "Sponsor view complete"
        : `${Math.ceil(remainingSeconds)} seconds remaining`;
    case "issuing":
      return "Preparing sponsor access…";
    case "completed":
      return "Sponsor access granted";
    case "cancelled":
      return "Sponsor view cancelled";
    case "failed":
      return state.error.message;
  }
};

const focusableSelector =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function SponsorModal({
  state,
  remainingSeconds,
  onStart,
  onContinue,
  onCancel,
}: SponsorModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined;
    initialFocusRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
    );
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    event.preventDefault();
    const activeElement = document.activeElement;
    const activeIndex =
      activeElement instanceof HTMLElement
        ? focusable.indexOf(activeElement)
        : -1;
    const direction = event.shiftKey ? -1 : 1;
    const nextIndex =
      activeIndex < 0
        ? 0
        : (activeIndex + direction + focusable.length) % focusable.length;
    focusable[nextIndex]?.focus();
  };

  const active =
    state.type !== "completed" &&
    state.type !== "cancelled" &&
    state.type !== "failed";
  const canContinue = state.type === "viewing" && remainingSeconds <= 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#14231dcc] p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sponsor-modal-title"
        aria-describedby="sponsor-modal-description"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-[#fbfaf6] text-[#21352d] shadow-2xl"
      >
        <header className="border-b border-[#d7ded8] px-6 py-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6f7e75]">
            Wallet-free premium access
          </p>
          <h2 id="sponsor-modal-title" className="mt-1 text-2xl font-bold">
            Sponsor access
          </h2>
          <p
            id="sponsor-modal-description"
            className="mt-2 text-sm leading-6 text-[#53645a]"
          >
            This free access path asks you to view an owned sponsor message for
            8 seconds. You can cancel at any time or press Escape.
          </p>
        </header>

        <div className="space-y-5 p-6">
          <section
            aria-labelledby="sponsor-creative-title"
            className="rounded-xl border border-[#d2a142] bg-[#fff6df] p-5"
          >
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#87651f]">
              A message from
            </p>
            <h3 id="sponsor-creative-title" className="mt-1 text-xl font-bold">
              Open Table Weekly
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#5d5138]">
              Plan a calmer week of seasonal meals with one concise kitchen note
              delivered every Sunday.
            </p>
          </section>

          <p
            role="status"
            aria-live="polite"
            className="font-mono text-sm font-bold tabular-nums text-[#315843]"
          >
            {statusText(state, remainingSeconds)}
          </p>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {active ? (
              <button
                type="button"
                ref={state.type === "ready" ? undefined : initialFocusRef}
                onClick={onCancel}
                className="min-h-11 rounded-full border border-[#87978d] px-5 py-3 text-sm font-bold hover:bg-[#edf0ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315843]"
              >
                Cancel sponsor view
              </button>
            ) : null}
            {state.type === "ready" ? (
              <button
                type="button"
                ref={initialFocusRef}
                onClick={onStart}
                className="min-h-11 rounded-full bg-[#315843] px-5 py-3 text-sm font-bold text-white hover:bg-[#213d32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315843]"
              >
                Start sponsor view
              </button>
            ) : null}
            {state.type === "viewing" ? (
              <button
                type="button"
                disabled={!canContinue}
                onClick={onContinue}
                className="min-h-11 rounded-full bg-[#315843] px-5 py-3 text-sm font-bold text-white hover:bg-[#213d32] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315843]"
              >
                Continue to recipe analysis
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
