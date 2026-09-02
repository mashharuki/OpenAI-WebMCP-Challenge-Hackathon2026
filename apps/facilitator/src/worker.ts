import { env } from "cloudflare:workers";
import { createFacilitatorApp } from "./app.js";
import { createBaseSepoliaFacilitator } from "./facilitator.js";
import { createBaseSepoliaFacilitatorSigner } from "./viem.js";

const signer = createBaseSepoliaFacilitatorSigner(
  env.EVM_PRIVATE_KEY,
  env.BASE_SEPOLIA_RPC_URL,
);
const facilitator = createBaseSepoliaFacilitator(signer);
const app = createFacilitatorApp(facilitator);

export default app;
