import { HTTPFacilitatorClient } from "@x402/core/server";
import "dotenv/config";

// ファシリテータークライアントの設定
export const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL,
});
