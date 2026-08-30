import { HTTPFacilitatorClient } from "@x402/core/server";
import { z } from "zod";
import type { FacilitatorCapabilityPort } from "./adgate/readiness.js";

const healthResponseSchema = z
  .object({ status: z.literal("ok") })
  .passthrough();
const supportedResponseSchema = z
  .object({
    kinds: z.array(
      z
        .object({
          x402Version: z.number().int(),
          scheme: z.string().min(1),
          network: z.string().min(1),
        })
        .passthrough(),
    ),
  })
  .passthrough();

const endpoint = (baseUrl: string, path: string): string =>
  `${baseUrl.replace(/\/$/, "")}/${path}`;

export const createFacilitatorClient = (url: string): HTTPFacilitatorClient =>
  new HTTPFacilitatorClient({ url });

export const createFacilitatorCapabilityClient = (
  url: string,
  fetchImplementation: typeof fetch = fetch,
): FacilitatorCapabilityPort => ({
  async health(signal) {
    const response = await fetchImplementation(endpoint(url, "health"), {
      headers: { Accept: "application/json" },
      signal,
    });
    if (!response.ok) return false;

    const parsed = healthResponseSchema.safeParse(await response.json());
    return parsed.success;
  },

  async supported(signal) {
    const response = await fetchImplementation(endpoint(url, "supported"), {
      headers: { Accept: "application/json" },
      signal,
    });
    if (!response.ok) {
      throw new Error("Facilitator capability check failed.");
    }

    const parsed = supportedResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new Error("Facilitator capability response is invalid.");
    }

    return parsed.data.kinds
      .filter(({ x402Version }) => x402Version === 2)
      .map(({ scheme, network }) => ({ scheme, network }));
  },
});
