import { describe, expect, it } from "vitest";
import { createFacilitatorCapabilityClient } from "../src/facilitator.js";

describe("facilitator capability HTTP client", () => {
  it("reads healthy version 2 capabilities without returning raw responses", async () => {
    const requestedUrls: string[] = [];
    const client = createFacilitatorCapabilityClient(
      "https://payments.example/facilitator",
      async (input) => {
        const url = input.toString();
        requestedUrls.push(url);
        if (url.endsWith("/health")) {
          return Response.json({ status: "ok" });
        }
        return Response.json({
          kinds: [
            {
              x402Version: 1,
              scheme: "exact",
              network: "eip155:4801",
            },
            {
              x402Version: 2,
              scheme: "exact",
              network: "eip155:84532",
            },
          ],
        });
      },
    );

    await expect(client.health()).resolves.toBe(true);
    await expect(client.supported()).resolves.toEqual([
      { scheme: "exact", network: "eip155:84532" },
    ]);
    expect(requestedUrls).toEqual([
      "https://payments.example/facilitator/health",
      "https://payments.example/facilitator/supported",
    ]);
  });

  it("rejects a malformed supported response without exposing its body", async () => {
    const client = createFacilitatorCapabilityClient(
      "https://payments.example/facilitator",
      async () =>
        Response.json({
          secret: "PAYMENT_SIGNATURE=private raw facilitator response",
        }),
    );

    await expect(client.supported()).rejects.toThrow(
      "Facilitator capability response is invalid.",
    );
    await expect(client.supported()).rejects.not.toThrow("PAYMENT_SIGNATURE");
  });
});
