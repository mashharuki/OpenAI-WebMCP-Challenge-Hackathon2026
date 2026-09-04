import { Badge, Button, Surface, Text } from "@cloudflare/kumo";
import {
  ArrowSquareOutIcon,
  CheckCircleIcon,
  CopyIcon,
  LockKeyIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { PremiumAnalysisRequest } from "../contracts.js";
import type { PaymentRequirement } from "./challenge.js";
import type {
  PaymentCoordinatorPort,
  PaymentFlowState,
} from "./paymentCoordinator.js";
import { WalletReadinessCard } from "./WalletReadinessCard.js";
import type { Eip1193ProviderPort } from "./walletAdapter.js";

export type PaymentPanelProps = {
  readonly coordinator: PaymentCoordinatorPort;
  readonly provider?: Eip1193ProviderPort;
  readonly walletLabel?: string;
  readonly walletAddress?: string;
  readonly browserWalletAvailable?: boolean;
  readonly privyAvailable?: boolean;
  readonly privyReady?: boolean;
  readonly connectBrowserWallet?: () => void;
  readonly continueWithPasskey?: () => Promise<void>;
  readonly request: PremiumAnalysisRequest;
};

export type ActivePaymentPanelProps = Omit<PaymentPanelProps, "request">;

type PaymentPanelViewProps = ActivePaymentPanelProps & {
  readonly request?: PremiumAnalysisRequest;
};

const shortenHex = (value: string): string =>
  `${value.slice(0, 6)}…${value.slice(-4)}`;

const formatUsdc = (baseUnits: string): string => {
  const padded = baseUnits.padStart(7, "0");
  const whole = padded.slice(0, -6);
  const fraction = padded.slice(-6).replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""} USDC`;
};

const attemptFrom = (state: PaymentFlowState) =>
  "attempt" in state ? state.attempt : undefined;

const progressLabel = (state: PaymentFlowState): string => {
  switch (state.type) {
    case "idle":
      return "Loading payment terms…";
    case "reviewing":
      return "Review payment";
    case "connecting_wallet":
      return "Connecting wallet…";
    case "awaiting_signature":
      return "Waiting for signature…";
    case "settling":
      return "Confirming on Base Sepolia…";
    case "succeeded":
      return "Payment confirmed";
    case "failed":
      return state.outcome === "uncertain"
        ? "Settlement needs attention"
        : "Payment not completed";
    case "cancelled":
      return "Payment cancelled";
  }
};

function RecoveryActions({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="primary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function PaymentTerms({ requirement }: { requirement: PaymentRequirement }) {
  return (
    <div className="border-l-2 border-orange-500 bg-orange-500/5 px-4 py-3">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-kumo-subtle">
            Testnet charge
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-kumo-default">
            {formatUsdc(requirement.amount)}
          </p>
          <p className="mt-1 text-xs text-kumo-subtle">
            One-time access to premium recipe analysis
          </p>
        </div>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
          <dt className="text-kumo-subtle">Network</dt>
          <dd className="font-medium text-kumo-default">Base Sepolia</dd>
          <dt className="text-kumo-subtle">Send to</dt>
          <dd className="font-mono text-kumo-default">
            {shortenHex(requirement.payTo)}
          </dd>
        </dl>
      </div>
      <div className="mt-3 border-t border-orange-500/20 pt-3">
        <p className="text-[10px] uppercase tracking-wider text-kumo-subtle">
          Asset contract
        </p>
        <p className="mt-1 break-all font-mono text-[11px] text-kumo-default">
          {requirement.asset}
        </p>
      </div>
    </div>
  );
}

function PrivyFundingCard({ address }: { readonly address: string }) {
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section
      aria-label="Fund Privy wallet"
      className="border-l-2 border-orange-500 bg-orange-500/5 px-4 py-3"
    >
      <p className="text-sm font-medium text-kumo-default">
        Fund your Privy wallet with testnet USDC
      </p>
      <p className="mt-1 text-xs leading-5 text-kumo-subtle">
        Copy this Base Sepolia wallet address, then request testnet USDC from
        Circle Faucet before confirming the payment.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="max-w-full break-all rounded bg-kumo-base px-2 py-1 font-mono text-xs text-kumo-default ring ring-kumo-line">
          {address}
        </code>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void copyAddress()}
        >
          <CopyIcon aria-hidden="true" />
          {copied ? "Address copied" : "Copy wallet address"}
        </Button>
      </div>
      <a
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-kumo-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-accent"
        href="https://faucet.circle.com/"
        target="_blank"
        rel="noreferrer"
      >
        Open Circle Faucet for testnet USDC
        <ArrowSquareOutIcon aria-hidden="true" />
      </a>
    </section>
  );
}

function PaymentPanelView({
  coordinator,
  provider,
  walletLabel = "MetaMask",
  walletAddress,
  browserWalletAvailable = false,
  privyAvailable = false,
  privyReady = false,
  connectBrowserWallet,
  continueWithPasskey,
  request,
}: PaymentPanelViewProps) {
  const state = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getSnapshot,
    coordinator.getSnapshot,
  );
  const lastRequirement = useRef<PaymentRequirement | undefined>(undefined);
  const [walletReady, setWalletReady] = useState(false);
  const attempt = attemptFrom(state);
  if (attempt) lastRequirement.current = attempt.challenge.requirements[0];
  const requirement = lastRequirement.current;

  const startAttempt = useCallback(() => {
    if (request) void coordinator.requestPaidAccess(request);
  }, [coordinator, request]);

  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    void coordinator.requestPaidAccess(request, controller.signal);
    return () => {
      controller.abort();
      coordinator.cancel("unmounted");
    };
  }, [coordinator, request]);

  const busy =
    state.type === "connecting_wallet" ||
    state.type === "awaiting_signature" ||
    state.type === "settling";

  return (
    <Surface
      className="w-full max-w-xl overflow-hidden rounded-xl ring ring-kumo-line"
      aria-labelledby="payment-panel-title"
    >
      <div className="flex items-start justify-between gap-4 border-b border-kumo-line px-4 py-3 sm:px-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-kumo-subtle">
            Premium access · payment review
          </p>
          <Text variant="heading" size="lg" as="h2" id="payment-panel-title">
            Recipe analysis
          </Text>
        </div>
        <Badge variant="orange">Testnet</Badge>
      </div>

      <div className="space-y-4 p-4 sm:p-5" aria-live="polite">
        {requirement ? (
          <PaymentTerms requirement={requirement} />
        ) : (
          <div className="h-32 animate-pulse rounded-lg bg-kumo-elevated motion-reduce:animate-none" />
        )}

        {state.type === "reviewing" && requirement ? (
          <WalletReadinessCard
            provider={provider}
            requirement={requirement}
            onReadyChange={setWalletReady}
            walletLabel={walletLabel}
          />
        ) : null}

        {state.type === "reviewing" && walletAddress ? (
          <PrivyFundingCard address={walletAddress} />
        ) : null}

        <div className="flex items-center gap-2 text-sm text-kumo-default">
          {state.type === "succeeded" ? (
            <CheckCircleIcon className="text-kumo-success" weight="fill" />
          ) : state.type === "failed" ? (
            <WarningCircleIcon className="text-kumo-danger" weight="fill" />
          ) : (
            <LockKeyIcon className="text-orange-500" weight="bold" />
          )}
          <span className="font-medium">{progressLabel(state)}</span>
        </div>

        {state.type === "reviewing" && requirement && (
          <div className="space-y-3">
            {(browserWalletAvailable || privyAvailable) && (
              <div className="rounded-lg border border-kumo-line bg-kumo-elevated p-3">
                <p className="text-sm font-medium text-kumo-default">
                  Choose a payment wallet
                </p>
                <p className="mt-1 text-xs text-kumo-subtle">
                  A passkey creates or restores a Privy embedded wallet. It does
                  not authorize payment by itself.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {browserWalletAvailable ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={connectBrowserWallet}
                    >
                      Use browser wallet
                    </Button>
                  ) : null}
                  {privyAvailable ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={!privyReady}
                      onClick={() => void continueWithPasskey?.()}
                    >
                      Continue with passkey
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
            <ol className="grid gap-2 text-xs text-kumo-subtle sm:grid-cols-3">
              <li>1. Connect wallet</li>
              <li>2. Review signature</li>
              <li>3. Confirm settlement</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="primary"
                disabled={!walletReady}
                onClick={() => void coordinator.confirm(provider)}
              >
                Pay with Base Sepolia
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => coordinator.cancel("user")}
              >
                Cancel
              </Button>
            </div>
            <p className="text-xs text-kumo-subtle">
              Your wallet opens only after you confirm. No private key is
              shared.
            </p>
          </div>
        )}

        {busy && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" disabled>
              {progressLabel(state)}
            </Button>
            {state.type !== "settling" && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => coordinator.cancel("user")}
              >
                Cancel
              </Button>
            )}
          </div>
        )}

        {state.type === "failed" && request && (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-kumo-danger">
              {state.error.message}
            </p>
            {state.outcome === "uncertain" && (
              <p className="text-xs text-kumo-subtle">
                Keep this request open while you retry. A new signature will not
                be created automatically.
              </p>
            )}
            <RecoveryActions onRetry={startAttempt} />
          </div>
        )}

        {state.type === "cancelled" && request && (
          <RecoveryActions onRetry={startAttempt} />
        )}

        {state.type === "succeeded" && (
          <div className="rounded-lg border border-kumo-line bg-kumo-elevated p-3">
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
              <dt className="text-kumo-subtle">Transaction</dt>
              <dd className="font-mono text-kumo-default">
                {shortenHex(state.receipt.transactionHash)}
              </dd>
              <dt className="text-kumo-subtle">Network</dt>
              <dd className="text-kumo-default">Base Sepolia</dd>
              <dt className="text-kumo-subtle">Amount</dt>
              <dd className="tabular-nums text-kumo-default">
                {formatUsdc(state.receipt.amount)}
              </dd>
              <dt className="text-kumo-subtle">Asset</dt>
              <dd className="font-mono text-kumo-default">
                {shortenHex(state.receipt.asset)}
              </dd>
              <dt className="text-kumo-subtle">Confirmed</dt>
              <dd className="text-kumo-default">{state.receipt.confirmedAt}</dd>
            </dl>
            <a
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-kumo-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-accent"
              href={`https://sepolia.basescan.org/tx/${state.receipt.transactionHash}`}
              target="_blank"
              rel="noreferrer"
            >
              View Base Sepolia receipt
              <ArrowSquareOutIcon aria-hidden="true" />
            </a>
          </div>
        )}
      </div>
    </Surface>
  );
}

export function PaymentPanel(props: PaymentPanelProps) {
  return <PaymentPanelView {...props} />;
}

export function ActivePaymentPanel(props: ActivePaymentPanelProps) {
  return <PaymentPanelView {...props} />;
}
