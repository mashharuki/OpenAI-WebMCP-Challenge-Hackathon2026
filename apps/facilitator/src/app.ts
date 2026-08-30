import type { x402Facilitator } from "@x402/core/facilitator";
import type {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
} from "@x402/core/types";
import { Hono } from "hono";

type FacilitatorApi = Pick<
  x402Facilitator,
  "getSupported" | "settle" | "verify"
>;

export type FacilitatorRequestLogger = {
  error(event: string): void;
};

const defaultRequestLogger: FacilitatorRequestLogger = {
  error: (event) => console.error(event),
};

export const createFacilitatorApp = (
  facilitator: FacilitatorApi,
  logger: FacilitatorRequestLogger = defaultRequestLogger,
): Hono => {
  const app = new Hono();

  app.post("/verify", async (c) => {
    try {
      const body = await c.req.json<{
        paymentPayload?: PaymentPayload;
        paymentRequirements?: PaymentRequirements;
      }>();

      if (!body.paymentPayload || !body.paymentRequirements) {
        return c.json(
          { error: "Missing paymentPayload or paymentRequirements" },
          400,
        );
      }

      const response: VerifyResponse = await facilitator.verify(
        body.paymentPayload,
        body.paymentRequirements,
      );
      return c.json(response);
    } catch {
      logger.error("facilitator.verify.request_failed");
      return c.json({ error: "Unable to verify payment" }, 500);
    }
  });

  app.post("/settle", async (c) => {
    try {
      const body = await c.req.json<{
        paymentPayload?: PaymentPayload;
        paymentRequirements?: PaymentRequirements;
      }>();

      if (!body.paymentPayload || !body.paymentRequirements) {
        return c.json(
          { error: "Missing paymentPayload or paymentRequirements" },
          400,
        );
      }

      const response: SettleResponse = await facilitator.settle(
        body.paymentPayload,
        body.paymentRequirements,
      );
      return c.json(response);
    } catch {
      logger.error("facilitator.settle.request_failed");
      return c.json({ error: "Unable to settle payment" }, 500);
    }
  });

  app.get("/supported", (c) => c.json(facilitator.getSupported()));
  app.get("/health", (c) => c.json({ status: "ok" }));

  return app;
};
