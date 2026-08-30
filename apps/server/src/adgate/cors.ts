import type { MiddlewareHandler } from "hono";

const ALLOWED_HEADERS =
  "Authorization, Content-Type, Idempotency-Key, Payment-Signature, X-Payment";
const EXPOSED_HEADERS =
  "Payment-Required, Payment-Response, X-Payment-Response";

const applyResponsePolicy = (headers: Headers, origin?: string): void => {
  headers.set("Cache-Control", "no-store");
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Expose-Headers", EXPOSED_HEADERS);
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
};

export const createPaymentHttpPolicy = ({
  allowedOrigins,
}: {
  allowedOrigins: readonly string[];
}): MiddlewareHandler => {
  const validOrigins = allowedOrigins.every((value) => {
    try {
      const url = new URL(value);
      return (
        (url.protocol === "https:" || url.protocol === "http:") &&
        url.origin === value
      );
    } catch {
      return false;
    }
  });
  if (allowedOrigins.length === 0 || !validOrigins) {
    throw new Error("Allowed origins must be absolute HTTP origins.");
  }

  const originAllowlist = new Set(allowedOrigins);

  return async (context, next) => {
    const origin = context.req.header("Origin");
    const isPreflight = context.req.method === "OPTIONS";

    if (origin && !originAllowlist.has(origin)) {
      const response = context.json(
        {
          ok: false,
          error: {
            code: "INVALID_EVIDENCE",
            message: "The request origin is not allowed.",
            retryable: false,
          },
        },
        403,
      );
      applyResponsePolicy(response.headers);
      return response;
    }

    if (isPreflight) {
      if (!origin) {
        const response = context.json(
          {
            ok: false,
            error: {
              code: "INVALID_EVIDENCE",
              message: "A request origin is required.",
              retryable: false,
            },
          },
          403,
        );
        applyResponsePolicy(response.headers);
        return response;
      }

      const response = new Response(null, { status: 204 });
      applyResponsePolicy(response.headers, origin);
      response.headers.set("Access-Control-Allow-Methods", "OPTIONS, POST");
      response.headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
      return response;
    }

    await next();
    applyResponsePolicy(context.res.headers, origin);
  };
};
