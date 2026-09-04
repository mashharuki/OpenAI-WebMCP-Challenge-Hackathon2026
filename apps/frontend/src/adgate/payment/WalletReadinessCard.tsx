import { Button } from "@cloudflare/kumo";
import {
  CheckCircleIcon,
  WalletIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PaymentRequirement } from "./challenge.js";
import type { Eip1193ProviderPort } from "./walletAdapter.js";
import {
  inspectWalletReadiness,
  requestWalletConnection,
  switchWalletToBaseSepolia,
  type WalletReadiness,
  type WalletReadinessAction,
} from "./walletReadiness.js";

type WalletReadinessView = WalletReadiness | { readonly type: "checking" };

export interface WalletReadinessCardProps {
  readonly provider?: Eip1193ProviderPort;
  readonly requirement: PaymentRequirement;
  readonly onReadyChange: (ready: boolean) => void;
  readonly walletLabel?: string;
}

const shortenAddress = (value: string): string =>
  `${value.slice(0, 6)}…${value.slice(-4)}`;

const formatUsdcBalance = (baseUnits: string): string => {
  const padded = baseUnits.padStart(7, "0");
  const whole = padded.slice(0, -6);
  const fraction = padded.slice(-6).replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""} USDC`;
};

export function WalletReadinessCard({
  provider,
  requirement,
  onReadyChange,
  walletLabel = "MetaMask",
}: WalletReadinessCardProps) {
  const [readiness, setReadiness] = useState<WalletReadinessView>({
    type: "checking",
  });
  const requestSequence = useRef(0);

  const refresh = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setReadiness({ type: "checking" });
    const result = await inspectWalletReadiness(provider, requirement);
    if (sequence === requestSequence.current) setReadiness(result);
  }, [provider, requirement]);

  useEffect(() => {
    void refresh();
    if (!provider?.on) return;
    const handleProviderChange = () => void refresh();
    provider.on("accountsChanged", handleProviderChange);
    provider.on("chainChanged", handleProviderChange);
    return () => {
      requestSequence.current += 1;
      provider.removeListener?.("accountsChanged", handleProviderChange);
      provider.removeListener?.("chainChanged", handleProviderChange);
    };
  }, [provider, refresh]);

  useEffect(
    () => onReadyChange(readiness.type === "ready"),
    [onReadyChange, readiness.type],
  );

  const runAction = async (action: () => Promise<WalletReadinessAction>) => {
    setReadiness({ type: "checking" });
    const result = await action();
    if (!result.ok) {
      setReadiness({ type: "failed", error: result.error });
      return;
    }
    await refresh();
  };

  return (
    <section
      aria-label="Wallet readiness"
      className="rounded-lg border border-kumo-line bg-kumo-elevated p-3"
    >
      {readiness.type === "checking" && (
        <div className="flex items-center gap-2 text-sm text-kumo-subtle">
          <WalletIcon aria-hidden="true" />
          <span>Checking {walletLabel}…</span>
        </div>
      )}

      {readiness.type === "unavailable" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-sm font-medium text-kumo-default">
              <WarningCircleIcon
                aria-hidden="true"
                className="text-orange-500"
              />
              {walletLabel} is not available
            </p>
            <p className="text-xs text-kumo-subtle">
              Choose an available wallet to continue with this payment.
            </p>
          </div>
        </div>
      )}

      {readiness.type === "disconnected" && provider && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-kumo-default">
              Connect {walletLabel}
            </p>
            <p className="text-xs text-kumo-subtle">
              Connection does not create a payment.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              void runAction(() => requestWalletConnection(provider))
            }
          >
            Connect {walletLabel}
          </Button>
        </div>
      )}

      {readiness.type === "wrong_network" && provider && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-kumo-default">
              Switch to Base Sepolia
            </p>
            <p className="font-mono text-xs text-kumo-subtle">
              {shortenAddress(readiness.account)} · chain {readiness.chainId}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              void runAction(() => switchWalletToBaseSepolia(provider))
            }
          >
            Switch network
          </Button>
        </div>
      )}

      {readiness.type === "insufficient" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-sm font-medium text-kumo-danger">
              <WarningCircleIcon aria-hidden="true" />
              Insufficient Base Sepolia USDC
            </p>
            <p className="font-mono text-xs text-kumo-subtle">
              {shortenAddress(readiness.account)} ·{" "}
              {formatUsdcBalance(readiness.balance)} available
            </p>
          </div>
        </div>
      )}

      {readiness.type === "ready" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-kumo-success">
              <CheckCircleIcon aria-hidden="true" weight="fill" />
              Wallet ready
            </p>
            <p className="mt-1 font-mono text-xs text-kumo-subtle">
              {shortenAddress(readiness.account)} · Base Sepolia
            </p>
          </div>
          <p className="text-xs font-medium tabular-nums text-kumo-default">
            {formatUsdcBalance(readiness.balance)} available
          </p>
        </div>
      )}

      {readiness.type === "failed" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="alert" className="text-sm text-kumo-danger">
            {readiness.error.message}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void refresh()}
            >
              Check again
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
