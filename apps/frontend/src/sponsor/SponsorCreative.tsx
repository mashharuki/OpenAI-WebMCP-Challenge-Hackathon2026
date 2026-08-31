export interface SponsorCreativeProps {
  readonly remainingSeconds: number;
  readonly requiredSeconds: number;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

export function SponsorCreative({
  remainingSeconds,
  requiredSeconds,
}: SponsorCreativeProps) {
  const safeRequired = Math.max(1, requiredSeconds);
  const safeRemaining = clamp(remainingSeconds, 0, safeRequired);
  const progress = Math.round(
    ((safeRequired - safeRemaining) / safeRequired) * 100,
  );
  const remainingLabel =
    safeRemaining <= 0
      ? "Sponsor view complete"
      : `${Math.ceil(safeRemaining)} seconds remaining`;

  return (
    <section
      aria-labelledby="sponsor-creative-title"
      className="overflow-hidden rounded-2xl border border-[#bd8a2e] bg-[#182d24] text-white shadow-[0_18px_50px_rgba(20,35,29,0.22)]"
    >
      <div className="relative aspect-video overflow-hidden bg-[#284238]">
        <img
          src="/sponsor/open-table-weekly-poster.webp"
          alt="Seasonal Pantry Box filled with fresh produce, recipe notes, and pantry spices"
          className="sponsor-creative-image size-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,24,18,0.04)_30%,rgba(10,24,18,0.9)_100%)]"
        />
        <p className="absolute top-3 left-3 rounded-full border border-white/45 bg-[#14231d]/80 px-3 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em] backdrop-blur-sm">
          Sponsored message
        </p>
        <div className="absolute right-4 bottom-4 left-4">
          <p className="text-xs font-semibold tracking-[0.08em] text-[#f3d58f]">
            Open Table Weekly
          </p>
          <h3
            id="sponsor-creative-title"
            className="mt-0.5 font-serif text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            Seasonal Pantry Box
          </h3>
          <p className="mt-1 max-w-sm text-xs leading-5 text-white/85 sm:text-sm">
            A calmer week of seasonal cooking, delivered.
          </p>
        </div>
      </div>

      <div className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div
          role="progressbar"
          aria-label="Sponsor viewing progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="h-1.5 overflow-hidden rounded-full bg-white/20"
        >
          <div
            className="h-full rounded-full bg-[#e2a93b] transition-[width] duration-200 motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#f3d58f]">
          {remainingLabel}
        </p>
      </div>
    </section>
  );
}
