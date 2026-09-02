import { serve } from "@hono/node-server";
import dotenv from "dotenv";
import { createFacilitatorApp } from "./app.js";
import { createBaseSepoliaFacilitator } from "./facilitator.js";
import { createBaseSepoliaFacilitatorSigner } from "./viem.js";

dotenv.config();

const privateKey = process.env.EVM_PRIVATE_KEY;
if (!privateKey) {
  throw new Error("EVM_PRIVATE_KEY environment variable is required");
}
const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL;
if (!rpcUrl) {
  throw new Error("BASE_SEPOLIA_RPC_URL environment variable is required");
}

const port = Number(process.env.PORT ?? 4022);
const signer = createBaseSepoliaFacilitatorSigner(privateKey, rpcUrl);
const facilitator = createBaseSepoliaFacilitator(signer);
const app = createFacilitatorApp(facilitator);

serve({ fetch: app.fetch, port }, (info) => {
  console.info(`Facilitator listening on http://localhost:${info.port}`);
});
