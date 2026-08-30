import { Hono } from "hono";
import type { AdGateError } from "../adgate/contracts.js";
import {
  sponsorGrantIssueRequestSchema,
  sponsorSessionStartRequestSchema,
} from "./contracts.js";
import type { SponsorGrantService } from "./grantService.js";
import { sponsorHttpStatusForError } from "./http.js";

interface SponsorGrantRoutesOptions {
  readonly service: SponsorGrantService;
  readonly now?: () => Date;
}

const errorResponse = (error: AdGateError): Response =>
  Response.json(
    { ok: false, error },
    {
      status: sponsorHttpStatusForError(error.code),
      headers: { "Cache-Control": "no-store" },
    },
  );

const invalidJson = (): Response =>
  errorResponse({
    code: "INVALID_INPUT",
    message: "The request body must be valid JSON.",
    retryable: false,
  });

const invalidInput = (): Response =>
  errorResponse({
    code: "INVALID_INPUT",
    message: "The sponsor request is invalid.",
    retryable: false,
  });

const internalError = (): Response =>
  errorResponse({
    code: "INTERNAL_ERROR",
    message: "Sponsor access could not be completed safely.",
    retryable: false,
  });

const readJson = async (request: Request): Promise<unknown> => {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
};

export const createSponsorGrantRoutes = ({
  service,
  now = () => new Date(),
}: SponsorGrantRoutesOptions): Hono => {
  const app = new Hono();

  app.post("/api/sponsor-sessions", async (context) => {
    const body = await readJson(context.req.raw);
    if (body === undefined) return invalidJson();
    const parsed = sponsorSessionStartRequestSchema.safeParse(body);
    if (!parsed.success) return invalidInput();

    try {
      const result = await service.startSession(
        parsed.data,
        now().toISOString(),
      );
      return result.ok
        ? context.json(result.value, 201, { "Cache-Control": "no-store" })
        : errorResponse(result.error);
    } catch {
      return internalError();
    }
  });

  app.post("/api/sponsor-grants", async (context) => {
    const body = await readJson(context.req.raw);
    if (body === undefined) return invalidJson();
    const parsed = sponsorGrantIssueRequestSchema.safeParse(body);
    if (!parsed.success) return invalidInput();

    try {
      const result = await service.issueWithOutcome(parsed.data);
      return result.ok
        ? context.json(
            result.value.response,
            result.value.replayed ? 200 : 201,
            {
              "Cache-Control": "no-store",
            },
          )
        : errorResponse(result.error);
    } catch {
      return internalError();
    }
  });

  return app;
};
