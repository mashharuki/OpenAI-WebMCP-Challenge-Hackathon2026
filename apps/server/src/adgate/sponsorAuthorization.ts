import type {
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
