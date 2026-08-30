import type { AdGateError } from "./contracts.js";
import type { PaymentPolicy } from "./paymentPolicy.js";

export interface FacilitatorCapabilityPort {
  health(signal?: AbortSignal): Promise<boolean>;
  supported(signal?: AbortSignal): Promise<
    readonly {
      scheme: string;
      network: string;
    }[]
  >;
}

export type PaymentReadinessState =
  | { type: "ready" }
  | { type: "unavailable"; error: AdGateError };

const unavailable = (): PaymentReadinessState => ({
  type: "unavailable",
  error: {
    code: "DEPENDENCY_UNAVAILABLE",
    message: "Payment verification is temporarily unavailable.",
    retryable: true,
  },
});

const runWithAbort = async <Value>(
  operation: (signal: AbortSignal) => Promise<Value>,
  signal: AbortSignal,
): Promise<Value> => {
  if (signal.aborted) throw signal.reason;

  return new Promise<Value>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    operation(signal)
      .then(resolve, reject)
      .finally(() => {
        signal.removeEventListener("abort", onAbort);
      });
  });
};

export const evaluatePaymentReadiness = async (
  policy: PaymentPolicy,
  facilitator: FacilitatorCapabilityPort,
  signal?: AbortSignal,
  timeoutMs = 2_000,
): Promise<PaymentReadinessState> => {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const probeSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  try {
    const healthy = await runWithAbort(
      (activeSignal) => facilitator.health(activeSignal),
      probeSignal,
    );
    if (!healthy) return unavailable();

    const capabilities = await runWithAbort(
      (activeSignal) => facilitator.supported(activeSignal),
      probeSignal,
    );
    const compatible = capabilities.some(
      (capability) =>
        capability.scheme === policy.scheme &&
        capability.network === policy.network,
    );
    return compatible ? { type: "ready" } : unavailable();
  } catch {
    return unavailable();
  }
};
