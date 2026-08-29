import { declareAgentkitExtension } from "@worldcoin/agentkit";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import "dotenv/config";

// x402に関する設定
export const x402Config = {
  "GET /weather": {
    accepts: [
      {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:84532" as `${string}:${string}`, // Base Sepolia
        payTo: process.env.EVM_ADDRESS as `0x${string}`,
      },
      {
        scheme: "exact",
        price: {
          amount: "10000",
          asset: "0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88" as `0x${string}`,
          extra: {
            name: "USDC",
            version: "2",
          },
        },
        network: "eip155:4801" as `${string}:${string}`, // Worldchain Sepolia
        payTo: process.env.EVM_ADDRESS as `0x${string}`,
      },
    ],
    description:
      "Get real-time weather data including temperature, conditions, and humidity",
    mimeType: "application/json",
    extensions: {
      ...declareDiscoveryExtension({
        input: { city: "San Francisco" },
        inputSchema: {
          properties: { city: { type: "string", description: "City name" } },
          required: ["city"],
        },
      }),
      ...declareAgentkitExtension({
        network: ["eip155:84532", "eip155:4801"],
        statement: "Verify your agent is backed by a real human",
        mode: { type: "free-trial", uses: 3 },
      }),
    },
  },
};
