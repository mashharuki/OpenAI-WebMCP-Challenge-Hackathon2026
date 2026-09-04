import type { WebMCPToolsState } from "../useWebMCPTools";
import type { GateSnapshot } from "./gateCoordinator";

export interface AccessFlowCardProps {
  readonly snapshot: GateSnapshot;
  readonly webMCP: WebMCPToolsState;
}

const isAgentRoute = (snapshot: GateSnapshot) => snapshot.source === "webmcp";

const isReaderRoute = (snapshot: GateSnapshot) =>
  snapshot.source === "visible_ui";

const agentToolLabel = (webMCP: WebMCPToolsState): string => {
  if (webMCP.registered) return "analyze_recipe · WebMCP ready";
  if (webMCP.supported) return "Registering analyze_recipe";
  return "analyze_recipe · WebMCP unavailable";
};

const agentPaymentLabel = (snapshot: GateSnapshot): string => {
  if (!snapshot.paymentAvailable) return "Compatible browser wallet required";
  return isAgentRoute(snapshot) && snapshot.state.type === "awaiting_payment"
    ? "Payment review in progress"
    : "Review 0.01 testnet USDC";
};

const readerSponsorLabel = (snapshot: GateSnapshot): string =>
  isReaderRoute(snapshot) && snapshot.state.type === "viewing_sponsor"
    ? "Sponsor message in progress"
    : "Watch an 8-second sponsor message";

const isExecuting = (snapshot: GateSnapshot): boolean =>
  snapshot.state.type === "access_granted" ||
  snapshot.state.type === "executing";

const isComplete = (snapshot: GateSnapshot): boolean =>
  snapshot.state.type === "succeeded";

function FlowStep({
  label,
  active = false,
  complete = false,
  unavailable = false,
}: {
  readonly label: string;
  readonly active?: boolean;
  readonly complete?: boolean;
  readonly unavailable?: boolean;
}) {
  return (
    <li
      aria-current={active ? "step" : undefined}
      className={`min-w-0 border-l-2 py-2 pl-3 text-sm leading-5 ${
        active
          ? "border-[#e2a93b] bg-[#e2a93b]/10 text-[#f6cd7c]"
          : complete
            ? "border-[#86a995] text-[#e3ebe5]"
            : unavailable
              ? "border-[#bd5b42] text-[#ffd8cd]"
              : "border-[#587064] text-[#c5d1c9]"
      }`}
    >
      {complete ? <span aria-hidden="true">✓ </span> : null}
      {label}
    </li>
  );
}

export function AccessFlowCard({ snapshot, webMCP }: AccessFlowCardProps) {
  const agentActive = isAgentRoute(snapshot);
  const readerActive = isReaderRoute(snapshot);
  const complete = isComplete(snapshot);
  const processing = isExecuting(snapshot);

  return (
    <section
      aria-labelledby="access-flow-title"
      className="mb-8 overflow-hidden border border-[#315843] bg-[#21352d] text-[#fbfaf6] shadow-[0_18px_45px_rgba(33,53,45,0.14)]"
    >
      <div className="grid gap-4 border-b border-[#587064] px-5 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:px-7">
        <div>
          <h2
            id="access-flow-title"
            className="font-serif text-2xl font-semibold tracking-[-0.02em] sm:text-3xl"
          >
            Your access, your choice
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#d7e1da]">
            Agents can request premium analysis. You stay in control of how it
            unlocks.
          </p>
        </div>
        <span className="w-fit border border-[#6f8d7d] bg-[#29483b] px-3 py-1 text-xs font-semibold text-[#dce9df]">
          {agentToolLabel(webMCP)}
        </span>
      </div>

      <div className="grid divide-y divide-[#587064] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(15rem,0.7fr)] lg:divide-x lg:divide-y-0">
        <div className="px-5 py-5 sm:px-7">
          <h3 className="font-semibold text-[#f1f4f1]">Agent route</h3>
          <ol className="mt-3 space-y-2" aria-label="Agent payment route">
            <FlowStep label="Agent invokes analyze_recipe" />
            <FlowStep
              label={agentPaymentLabel(snapshot)}
              active={agentActive && snapshot.state.type === "awaiting_payment"}
              complete={complete && agentActive}
              unavailable={!snapshot.paymentAvailable}
            />
          </ol>
        </div>

        <div className="px-5 py-5 sm:px-7">
          <h3 className="font-semibold text-[#f1f4f1]">Reader route</h3>
          <ol className="mt-3 space-y-2" aria-label="Reader sponsor route">
            <FlowStep
              label={readerSponsorLabel(snapshot)}
              active={readerActive && snapshot.state.type === "viewing_sponsor"}
              complete={complete && readerActive}
            />
            <FlowStep
              label="One-time sponsor grant"
              active={readerActive && processing}
              complete={complete && readerActive}
            />
          </ol>
          {!snapshot.paymentAvailable ? (
            <div className="mt-4 border-l-2 border-[#86a995] pl-3 text-sm leading-6 text-[#dce9df]">
              <p>Sponsor access works in this browser.</p>
              <a
                href="#premium-analysis-title"
                className="mt-1 inline-block font-semibold text-[#f6cd7c] underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f6cd7c]"
              >
                Go to sponsor access
              </a>
            </div>
          ) : null}
        </div>

        <div className="bg-[#29483b] px-5 py-5 sm:px-7">
          <p className="text-xs font-semibold text-[#e2a93b]">
            One protected resource
          </p>
          <p
            className={`mt-2 font-serif text-xl font-semibold ${
              processing || complete ? "text-[#f6cd7c]" : "text-[#f1f4f1]"
            }`}
          >
            {complete ? "Analysis unlocked" : "Protected recipe analysis"}
          </p>
          <p className="mt-2 text-sm leading-6 text-[#d7e1da]">
            Both paths authorize the same publisher-owned analysis.
          </p>
        </div>
      </div>
    </section>
  );
}
