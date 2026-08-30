import type { SponsorGrantService } from "../sponsor/grantService.js";
import { sponsorHttpStatusForError } from "../sponsor/http.js";
import type {
  AdGateError,
  AdGateErrorEnvelope,
  PremiumAnalysisRequest,
  PremiumAnalysisSuccess,
  SponsorAccessEvidence,
} from "./contracts.js";

export type SponsorAuthorizedHandler = (
  request: PremiumAnalysisRequest,
  evidence: SponsorAccessEvidence,
) => Promise<PremiumAnalysisSuccess | AdGateErrorEnvelope>;

export interface SponsorAuthorizer {
  handle(
    input: { request: Request; parsedRequest: PremiumAnalysisRequest },
    next: SponsorAuthorizedHandler,
  ): Promise<Response>;
}

interface SponsorAuthorizerOptions {
  readonly service: SponsorGrantService;
}

const jsonResponse = (
  body: PremiumAnalysisSuccess | AdGateErrorEnvelope,
  status: number,
): Response =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

const errorResponse = (error: AdGateError): Response =>
  jsonResponse({ ok: false, error }, sponsorHttpStatusForError(error.code));

const accessRequired = (): Response =>
  errorResponse({
    code: "ACCESS_REQUIRED",
    message: "Sponsor access is required.",
    retryable: true,
  });

const invalidEvidence = (): Response =>
  errorResponse({
    code: "INVALID_EVIDENCE",
    message: "The sponsor access evidence is invalid.",
    retryable: false,
  });

const internalError = (): Response =>
  errorResponse({
    code: "INTERNAL_ERROR",
    message: "Sponsor access could not be completed safely.",
    retryable: false,
  });

const sponsorAuthorizationPattern = /^Sponsor ([A-Za-z0-9_-]{43,128})$/;

export const createSponsorAuthorizer = ({
  service,
}: SponsorAuthorizerOptions): SponsorAuthorizer => ({
  async handle({ request, parsedRequest }, next) {
    const authorization = request.headers.get("Authorization");
    if (authorization === null) return accessRequired();
    const match = sponsorAuthorizationPattern.exec(authorization);
    if (!match) return invalidEvidence();

    try {
      const result = await service.consume({
        token: match[1],
        resourceId: parsedRequest.resourceId,
        nonce: parsedRequest.requestId,
      });
      if (!result.ok) return errorResponse(result.error);

      const downstream = await next(parsedRequest, result.value);
      return jsonResponse(
        downstream,
        downstream.ok ? 200 : sponsorHttpStatusForError(downstream.error.code),
      );
    } catch {
      return internalError();
    }
  },
});

export const createUnavailableSponsorAuthorizer = (): SponsorAuthorizer => ({
  async handle() {
    return Response.json(
      {
        ok: false,
        error: {
          code: "DEPENDENCY_UNAVAILABLE",
          message: "Sponsor access is temporarily unavailable.",
          retryable: true,
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  },
});
