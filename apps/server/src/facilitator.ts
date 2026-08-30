import { HTTPFacilitatorClient } from "@x402/core/server";

export const createFacilitatorClient = (url: string): HTTPFacilitatorClient =>
  new HTTPFacilitatorClient({ url });
