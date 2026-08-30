import {
  type AdGateError,
  type AdGateErrorEnvelope,
  adGateErrorEnvelopeSchema,
} from "../adgate/contracts";
import {
  type SponsorGrantIssueRequest,
  type SponsorGrantIssueResponse,
  type SponsorSessionStartRequest,
  type SponsorSessionStartResponse,
  sponsorGrantIssueRequestSchema,
  sponsorGrantIssueResponseSchema,
  sponsorSessionStartRequestSchema,
  sponsorSessionStartResponseSchema,
} from "./contracts";

export type SponsorFlowResult = SponsorGrantIssueResponse | AdGateErrorEnvelope;

export interface SponsorGrantClient {
  start(
    input: SponsorSessionStartRequest,
    signal?: AbortSignal,
  ): Promise<SponsorSessionStartResponse>;
  issue(
    input: SponsorGrantIssueRequest,
    signal?: AbortSignal,
  ): Promise<SponsorFlowResult>;
}

interface SponsorGrantClientOptions {
  readonly baseUrl: string;
  readonly fetchImpl?: typeof fetch;
}

const invalidResponseError = (): AdGateError => ({
  code: "INTERNAL_ERROR",
  message: "The sponsor access response could not be validated.",
  retryable: false,
});

const dependencyError = (cancelled: boolean): AdGateError => ({
  code: cancelled ? "CANCELLED" : "DEPENDENCY_UNAVAILABLE",
  message: cancelled
    ? "The sponsor access request was cancelled."
    : "Sponsor access is temporarily unavailable. Try again.",
  retryable: !cancelled,
});

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

export const createSponsorGrantClient = ({
  baseUrl,
  fetchImpl = fetch,
}: SponsorGrantClientOptions): SponsorGrantClient => {
  const sessionEndpoint = new URL("/api/sponsor-sessions", baseUrl).toString();
  const grantEndpoint = new URL("/api/sponsor-grants", baseUrl).toString();

  return {
    async start(input, signal) {
      const request = sponsorSessionStartRequestSchema.parse(input);
      let response: Response;
      try {
        response = await fetchImpl(sessionEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
          signal,
        });
      } catch {
        throw dependencyError(signal?.aborted ?? false);
      }

      const body = await readJson(response);
      if (!response.ok) {
        const error = adGateErrorEnvelopeSchema.safeParse(body);
        throw error.success ? error.data.error : invalidResponseError();
      }
      const success = sponsorSessionStartResponseSchema.safeParse(body);
      if (!success.success) throw invalidResponseError();
      return success.data;
    },

    async issue(input, signal) {
      const request = sponsorGrantIssueRequestSchema.parse(input);
      let response: Response;
      try {
        response = await fetchImpl(grantEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
          signal,
        });
      } catch {
        return { ok: false, error: dependencyError(signal?.aborted ?? false) };
      }

      const body = await readJson(response);
      if (!response.ok) {
        const error = adGateErrorEnvelopeSchema.safeParse(body);
        return error.success
          ? error.data
          : { ok: false, error: invalidResponseError() };
      }
      const success = sponsorGrantIssueResponseSchema.safeParse(body);
      return success.success
        ? success.data
        : { ok: false, error: invalidResponseError() };
    },
  };
};
