import { useMemo } from "react";
import { GateExperience } from "./adgate/GateExperience";
import { GateProvider, useGate } from "./adgate/GateProvider";
import { createGateCoordinator } from "./adgate/gateCoordinator";
import { createGatedAnalysisClient } from "./adgate/gatedAnalysisAdapter";
import { createChallengeClient } from "./adgate/payment/challenge";
import { createPaymentClient } from "./adgate/payment/paymentClient";
import { createPaymentCoordinator } from "./adgate/payment/paymentCoordinator";
import { createWalletAdapter } from "./adgate/payment/walletAdapter";
import { createProtectedAnalysisClient } from "./adgate/protectedAnalysisClient";
import { PublisherDemo } from "./publisher/PublisherDemo";
import {
  SponsorGateProvider,
  useSponsorGate,
} from "./sponsor/SponsorGateProvider";
import { createSponsorGrantClient } from "./sponsor/sponsorGrantClient";
import { useWebMCPTools } from "./useWebMCPTools";

const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;

const isGateActive = (
  type: ReturnType<typeof useGate>["snapshot"]["state"]["type"],
): boolean =>
  type !== "idle" &&
  type !== "succeeded" &&
  type !== "failed" &&
  type !== "cancelled";

function WebMCPStatus({
  state,
}: {
  readonly state: ReturnType<typeof useWebMCPTools>;
}) {
  const message = state.error
    ? state.error
    : !state.supported
      ? "WebMCP is not available in this browser. On-page analysis still works."
      : state.registered
        ? `WebMCP tool ready via ${state.source}.`
        : "Registering the WebMCP tool…";
  return (
    <p className="mt-5 text-sm text-[#637069]" aria-live="polite">
      {message}
    </p>
  );
}

function GatedPublisherApp() {
  const sponsorGate = useSponsorGate();
  const walletProvider = window.ethereum;
  const dependencies = useMemo(() => {
    const baseUrl = globalThis.location.origin;
    const endpoint = new URL("/api/recipe-analysis", baseUrl).toString();
    const challengeClient = createChallengeClient({
      acceptedAsset: BASE_SEPOLIA_USDC,
      endpoint,
    });
    const paymentCoordinator = createPaymentCoordinator({
      paymentClient: createPaymentClient({ challengeClient, endpoint }),
      walletAdapter: createWalletAdapter(),
    });
    const coordinator = createGateCoordinator({
      sponsorGate,
      paymentCoordinator,
      protectedClient: createProtectedAnalysisClient({ baseUrl }),
      paymentAvailable: Boolean(walletProvider),
    });
    return { coordinator, paymentCoordinator };
  }, [sponsorGate]);

  return (
    <GateProvider coordinator={dependencies.coordinator}>
      <PublisherPage
        coordinator={dependencies.coordinator}
        paymentCoordinator={dependencies.paymentCoordinator}
        walletProvider={walletProvider}
      />
    </GateProvider>
  );
}

function PublisherPage({
  coordinator,
  paymentCoordinator,
  walletProvider,
}: {
  readonly coordinator: ReturnType<typeof createGateCoordinator>;
  readonly paymentCoordinator: ReturnType<typeof createPaymentCoordinator>;
  readonly walletProvider: typeof window.ethereum;
}) {
  const { snapshot } = useGate();
  const webMCPState = useWebMCPTools(coordinator);
  const analysisClient = useMemo(
    () => createGatedAnalysisClient(coordinator),
    [coordinator],
  );
  const webMCPAttemptActive =
    snapshot.source === "webmcp" && isGateActive(snapshot.state.type);

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

          <fieldset disabled={webMCPAttemptActive} className="contents">
            <PublisherDemo analysisClient={analysisClient} />
          </fieldset>
          {webMCPAttemptActive ? (
            <p className="mt-4 text-sm font-medium text-[#637069]">
              An agent-started analysis is waiting for your access choice.
            </p>
          ) : null}
          <GateExperience
            paymentCoordinator={paymentCoordinator}
            walletProvider={walletProvider}
          />
          <WebMCPStatus state={webMCPState} />
        </div>
      </main>

      <footer className="border-t border-[#d8d0bd] px-5 py-6 text-center font-mono text-[0.65rem] uppercase tracking-[0.16em] text-[#637069]">
        An original Open Table Journal demonstration
      </footer>
    </div>
  );
}

export default function App() {
  const sponsorClient = useMemo(
    () => createSponsorGrantClient({ baseUrl: globalThis.location.origin }),
    [],
  );
  return (
    <SponsorGateProvider client={sponsorClient}>
      <GatedPublisherApp />
    </SponsorGateProvider>
  );
}
