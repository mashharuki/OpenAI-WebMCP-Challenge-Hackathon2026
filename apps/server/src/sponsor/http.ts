import type { AdGateError } from "../adgate/contracts.js";

export const sponsorHttpStatusForError = (
  code: AdGateError["code"],
): number => {
  switch (code) {
    case "INVALID_INPUT":
      return 400;
    case "ACCESS_REQUIRED":
      return 403;
    case "INVALID_EVIDENCE":
    case "ACCESS_EXPIRED":
    case "ACCESS_REUSED":
      return 401;
    case "IDEMPOTENCY_CONFLICT":
      return 409;
    case "DEPENDENCY_UNAVAILABLE":
      return 503;
    default:
      return 500;
  }
};
