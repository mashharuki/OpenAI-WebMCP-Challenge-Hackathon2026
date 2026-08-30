import { x402Facilitator } from "@x402/core/facilitator";
import type { FacilitatorEvmSigner } from "@x402/evm";
import { ExactEvmScheme } from "@x402/evm/exact/facilitator";

export const BASE_SEPOLIA_NETWORK = "eip155:84532" as const;

export type FacilitatorLifecycleLogger = {
  info(event: string): void;
  warn(event: string): void;
};

const defaultLifecycleLogger: FacilitatorLifecycleLogger = {
  info: (event) => console.info(event),
  warn: (event) => console.warn(event),
};

const safeReasonPattern = /^[a-z][a-z0-9_]{2,80}$/;

export const safeVerificationFailureEvent = (error: unknown): string => {
  if (!(error instanceof Error)) return "facilitator.verify.failed";

  const [reason] = error.message.split(":", 1);
  return reason && safeReasonPattern.test(reason)
    ? `facilitator.verify.failed.${reason}`
    : "facilitator.verify.failed";
};

export const createBaseSepoliaFacilitator = (
  signer: FacilitatorEvmSigner,
  logger: FacilitatorLifecycleLogger = defaultLifecycleLogger,
): x402Facilitator =>
  new x402Facilitator()
    .onBeforeVerify(async () => {
      logger.info("facilitator.verify.started");
    })
    .onAfterVerify(async () => {
      logger.info("facilitator.verify.succeeded");
    })
    .onVerifyFailure(async ({ error }) => {
      logger.warn(safeVerificationFailureEvent(error));
    })
    .onBeforeSettle(async () => {
      logger.info("facilitator.settle.started");
    })
    .onAfterSettle(async () => {
      logger.info("facilitator.settle.succeeded");
    })
    .onSettleFailure(async () => {
      logger.warn("facilitator.settle.failed");
    })
    .register(
      BASE_SEPOLIA_NETWORK,
      new ExactEvmScheme(signer, { eip6492AllowedFactories: [] }),
    );
