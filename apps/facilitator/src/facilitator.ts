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
    .onVerifyFailure(async () => {
      logger.warn("facilitator.verify.failed");
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
