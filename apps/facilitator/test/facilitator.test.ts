import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import type { FacilitatorEvmSigner } from "@x402/evm";
import { describe, expect, it } from "vitest";
import { createFacilitatorApp } from "../src/app.js";
import {
  BASE_SEPOLIA_NETWORK,
  createBaseSepoliaFacilitator,
} from "../src/facilitator.js";

const facilitatorAddress = "0x0000000000000000000000000000000000000001";

const createTestSigner = (): FacilitatorEvmSigner => ({
  getAddresses: () => [facilitatorAddress],
  getCode: async () => undefined,
  readContract: async () => undefined,
  sendTransaction: async () => "0x01",
  verifyTypedData: async () => true,
  waitForTransactionReceipt: async () => ({ status: "success" }),
  writeContract: async () => "0x01",
});

describe("local facilitator HTTP contract", () => {
  it("publishes Base Sepolia exact as its only payment capability", async () => {
    const facilitator = createBaseSepoliaFacilitator(createTestSigner());
    const app = createFacilitatorApp(facilitator);

    const response = await app.request("/supported");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      extensions: [],
      kinds: [
        {
          network: BASE_SEPOLIA_NETWORK,
          scheme: "exact",
          x402Version: 2,
        },
      ],
      signers: {
        "eip155:*": [facilitatorAddress],
      },
    });
  });

  it("logs lifecycle events without payment payloads or signatures", async () => {
    const events: string[] = [];
    const facilitator = createBaseSepoliaFacilitator(createTestSigner(), {
      info: (event) => events.push(event),
      warn: (event) => events.push(event),
    });
    const sensitiveSignature = "0xprivate-payment-signature";

    await expect(
      facilitator.verify(
        {
          payload: { signature: sensitiveSignature },
          x402Version: 999,
        } as unknown as PaymentPayload,
        {
          network: BASE_SEPOLIA_NETWORK,
          scheme: "exact",
        } as PaymentRequirements,
      ),
    ).rejects.toThrow("No facilitator registered");

    expect(events).toEqual([
      "facilitator.verify.started",
      "facilitator.verify.failed",
    ]);
    expect(JSON.stringify(events)).not.toContain(sensitiveSignature);
  });
});
