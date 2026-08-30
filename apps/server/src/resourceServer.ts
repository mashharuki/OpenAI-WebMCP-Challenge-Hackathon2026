import type { FacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { x402ResourceServer } from "@x402/hono";

export const createResourceServer = (
  facilitatorClient: FacilitatorClient,
): x402ResourceServer => {
  const resourceServer = new x402ResourceServer(facilitatorClient);
  resourceServer.register("eip155:84532", new ExactEvmScheme());
  return resourceServer;
};
