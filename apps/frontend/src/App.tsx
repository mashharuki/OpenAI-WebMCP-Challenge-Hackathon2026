import { PublisherDemo } from "./publisher/PublisherDemo";

export default function App() {
  return (
    <div className="publisher-page min-h-screen min-w-0 overflow-x-clip text-[#21352d]">
      <header className="border-b border-[#315843] bg-[#21352d] text-[#fbfaf6]">
        <div className="mx-auto flex max-w-[96rem] flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-full border border-[#e2a93b] font-serif text-lg italic text-[#e2a93b]"
            >
              O
            </span>
            <div>
              <p className="text-sm font-bold tracking-[0.08em]">
                Open Table Journal
              </p>
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[#afc0b6]">
                Thoughtful food for everyday tables
              </p>
            </div>
          </div>
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-[#d7e1da]">
            Kitchen notes · Issue 08
          </p>
        </div>
      </header>

      <main className="px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
        <div className="mx-auto max-w-[96rem]">
          <section
            aria-labelledby="edition-note-title"
            className="mb-7 grid gap-4 border-l-4 border-[#e2a93b] bg-[#f2eee4]/90 px-5 py-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-7 sm:px-7"
          >
            <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#bd5b42]">
              The deeper read
            </p>
            <div className="min-w-0 sm:border-l sm:border-[#c8bea8] sm:pl-7">
              <h2
                id="edition-note-title"
                className="font-serif text-xl font-semibold sm:text-2xl"
              >
                Cook with the whole story in view.
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[#4f5e56] sm:text-base">
                Premium analysis adds practical nutrition and ingredient
                insights to a recipe you can read, cook, and evaluate in full.
              </p>
            </div>
          </section>

          <PublisherDemo />
        </div>
      </main>

      <footer className="border-t border-[#d8d0bd] px-5 py-6 text-center font-mono text-[0.65rem] uppercase tracking-[0.16em] text-[#637069]">
        An original Open Table Journal demonstration
      </footer>
    </div>
  );
}
