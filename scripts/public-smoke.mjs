import { fileURLToPath } from "node:url";

const pass = (name) => ({ name, status: "pass" });
const fail = (name, reason) => ({ name, status: "fail", reason });

const parseHttpsOrigin = (value, label) => {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.origin !== url.href.replace(/\/$/, "")
    ) {
      throw new Error();
    }
    return { ok: true, origin: url.origin };
  } catch {
    return {
      ok: false,
      check: fail(label, "Expected an exact HTTPS origin."),
    };
  }
};

const hasTokenValue = (value) =>
  typeof value === "string" &&
  value.trim().length >= 32 &&
  !value.includes("%VITE_");

const readOriginTrialMeta = (html) => {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const httpEquiv = /http-equiv\s*=\s*["']origin-trial["']/i.test(tag);
    const content = /content\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (httpEquiv && hasTokenValue(content)) return true;
  }
  return false;
};

const API_PATHS = [
  "/api/sponsor-sessions",
  "/api/sponsor-grants",
  "/api/recipe-analysis",
];
const REQUIRED_REQUEST_HEADERS = [
  "authorization",
  "content-type",
  "idempotency-key",
  "payment-signature",
  "x-payment",
];
const REQUIRED_EXPOSED_HEADERS = [
  "payment-required",
  "payment-response",
  "x-payment-response",
];

const headerValues = (response, name) =>
  (response.headers.get(name) ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

const hasEvery = (values, required) =>
  required.every((value) => values.includes(value));

const hasNoStore = (response) =>
  headerValues(response, "Cache-Control").includes("no-store");

const containsUnsafeDisclosure = (value) =>
  /(?:private[_ -]?key|seed phrase|mnemonic|sponsor[_ -]?token|payment[_ -]?(?:signature|payload))\s*[:=]/i.test(
    value,
  ) || /\bat\s+[^\n]+:\d+:\d+\)?/i.test(value);

const canonicalProbeRequest = Object.freeze({
  requestId: "public-smoke-request",
  idempotencyKey: "public-smoke-idempotency",
  resourceId: "recipe_analysis",
  input: { recipeId: "roasted-chickpea-quinoa-bowl" },
});
const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const decodePaymentRequired = (value) => {
  try {
    return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
  } catch {
    return undefined;
  }
};

const parseJson = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const isAddress = (value) =>
  typeof value === "string" &&
  /^0x[0-9a-fA-F]{40}$/.test(value) &&
  !/^0x0{40}$/i.test(value);

const isExactBaseSepoliaOffer = (challenge) => {
  if (
    challenge === null ||
    typeof challenge !== "object" ||
    challenge.x402Version !== 2 ||
    challenge.resource?.url !== "recipe_analysis" ||
    !Array.isArray(challenge.accepts) ||
    challenge.accepts.length !== 1
  ) {
    return false;
  }
  const offer = challenge.accepts[0];
  return (
    offer?.scheme === "exact" &&
    offer.network === "eip155:84532" &&
    typeof offer.asset === "string" &&
    offer.asset.toLowerCase() === BASE_SEPOLIA_USDC.toLowerCase() &&
    offer.amount === "10000" &&
    isAddress(offer.payTo) &&
    Number.isInteger(offer.maxTimeoutSeconds) &&
    offer.maxTimeoutSeconds > 0 &&
    offer.extra?.name === "USDC" &&
    offer.extra?.version === "2"
  );
};

const isOpaqueCredential = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{43,128}$/.test(value);

const responseHasProtectedPolicy = (response, origin) =>
  response.headers.get("Access-Control-Allow-Origin") === origin &&
  hasNoStore(response);

const isCanonicalAnalysis = (value, requestId, grantId) =>
  value?.ok === true &&
  value.requestId === requestId &&
  value.resourceId === "recipe_analysis" &&
  value.access?.kind === "sponsor_grant" &&
  value.access?.referenceId === grantId &&
  typeof value.data?.summary === "string" &&
  value.data.summary.length > 0 &&
  Array.isArray(value.data.nutritionalInsights) &&
  value.data.nutritionalInsights.length > 0 &&
  value.data.nutritionalInsights.every(
    (entry) => typeof entry === "string" && entry.length > 0,
  ) &&
  Array.isArray(value.data.suggestions) &&
  value.data.suggestions.length > 0 &&
  value.data.suggestions.every(
    (entry) => typeof entry === "string" && entry.length > 0,
  ) &&
  typeof value.data.disclaimer === "string" &&
  value.data.disclaimer.length > 0;

export const probePublicReachability = async ({
  frontendUrl,
  serverUrl,
  fetch: fetchRequest = globalThis.fetch,
}) => {
  const frontend = parseHttpsOrigin(frontendUrl, "Frontend HTTPS");
  const server = parseHttpsOrigin(serverUrl, "Resource server HTTPS");
  const checks = [];
  let responsesAreSafe = true;

  if (!frontend.ok) checks.push(frontend.check);
  if (!server.ok) checks.push(server.check);
  if (!frontend.ok || !server.ok) return { ok: false, checks };

  try {
    const response = await fetchRequest(`${frontend.origin}/`, {
      headers: { Accept: "text/html" },
      redirect: "error",
    });
    if (!response.ok) {
      checks.push(fail("Frontend HTTPS", "Frontend did not return 2xx."));
      checks.push(fail("Origin Trial", "Frontend document was unavailable."));
    } else {
      checks.push(pass("Frontend HTTPS"));
      const tokenInHeader = hasTokenValue(response.headers.get("Origin-Trial"));
      const document = await response.text();
      responsesAreSafe &&= !containsUnsafeDisclosure(document);
      const tokenInDocument = readOriginTrialMeta(document);
      checks.push(
        tokenInHeader || tokenInDocument
          ? pass("Origin Trial")
          : fail("Origin Trial", "No configured Origin Trial token was found."),
      );
    }
  } catch {
    checks.push(fail("Frontend HTTPS", "Frontend request failed."));
    checks.push(fail("Origin Trial", "Frontend document was unavailable."));
  }

  try {
    const response = await fetchRequest(`${server.origin}/health`, {
      headers: { Accept: "application/json" },
      redirect: "error",
    });
    const body = await response.text();
    responsesAreSafe &&= !containsUnsafeDisclosure(body);
    checks.push(
      response.ok
        ? pass("Resource server HTTPS")
        : fail("Resource server HTTPS", "Health endpoint did not return 2xx."),
    );
  } catch {
    checks.push(fail("Resource server HTTPS", "Health request failed."));
  }

  checks.push(
    responsesAreSafe
      ? pass("Public response safety")
      : fail(
          "Public response safety",
          "A public response contains unsafe diagnostic data.",
        ),
  );

  return {
    ok: checks.every((check) => check.status === "pass"),
    checks,
  };
};

export const probeCorsAndPreview = async ({
  frontendUrl,
  serverUrl,
  fetch: fetchRequest = globalThis.fetch,
}) => {
  const frontend = parseHttpsOrigin(frontendUrl, "Protected CORS");
  const server = parseHttpsOrigin(serverUrl, "Protected CORS");
  if (!frontend.ok || !server.ok) {
    return {
      ok: false,
      checks: [fail("Protected CORS", "Expected exact HTTPS origins.")],
    };
  }

  const requestedHeaders = REQUIRED_REQUEST_HEADERS.join(", ");
  let corsPasses = true;
  let blockedOriginPasses = true;

  for (const path of API_PATHS) {
    try {
      const response = await fetchRequest(`${server.origin}${path}`, {
        method: "OPTIONS",
        headers: {
          Origin: frontend.origin,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": requestedHeaders,
        },
        redirect: "error",
      });
      const methods = headerValues(response, "Access-Control-Allow-Methods");
      const allowedHeaders = headerValues(
        response,
        "Access-Control-Allow-Headers",
      );
      const exposedHeaders = headerValues(
        response,
        "Access-Control-Expose-Headers",
      );
      const variesByOrigin = headerValues(response, "Vary").includes("origin");
      corsPasses &&=
        response.status === 204 &&
        response.headers.get("Access-Control-Allow-Origin") ===
          frontend.origin &&
        hasEvery(methods, ["options", "post"]) &&
        hasEvery(allowedHeaders, REQUIRED_REQUEST_HEADERS) &&
        hasEvery(exposedHeaders, REQUIRED_EXPOSED_HEADERS) &&
        variesByOrigin &&
        hasNoStore(response);
    } catch {
      corsPasses = false;
    }
  }

  for (const path of API_PATHS) {
    try {
      const response = await fetchRequest(`${server.origin}${path}`, {
        method: "OPTIONS",
        headers: {
          Origin: "https://blocked.example",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": requestedHeaders,
        },
        redirect: "error",
      });
      const body = await response.text();
      blockedOriginPasses &&=
        response.status === 403 &&
        response.headers.get("Access-Control-Allow-Origin") === null &&
        hasNoStore(response) &&
        !containsUnsafeDisclosure(body);
    } catch {
      blockedOriginPasses = false;
    }
  }

  let previewPasses = false;
  try {
    const response = await fetchRequest(
      `${server.origin}/api/recipe-analysis/preview`,
      {
        method: "POST",
        headers: {
          Origin: frontend.origin,
          "Content-Type": "application/json",
          "Idempotency-Key": canonicalProbeRequest.idempotencyKey,
        },
        body: JSON.stringify(canonicalProbeRequest),
        redirect: "error",
      },
    );
    const body = await response.text();
    previewPasses =
      response.status === 404 &&
      hasNoStore(response) &&
      !containsUnsafeDisclosure(body);
  } catch {
    previewPasses = false;
  }

  const checks = [
    corsPasses
      ? pass("Protected CORS")
      : fail("Protected CORS", "A protected preflight policy is invalid."),
    blockedOriginPasses
      ? pass("Disallowed origin")
      : fail("Disallowed origin", "A blocked origin received unsafe access."),
    previewPasses
      ? pass("Production preview")
      : fail("Production preview", "The preview POST route is reachable."),
  ];
  return {
    ok: checks.every((check) => check.status === "pass"),
    checks,
  };
};

export const probePaymentReadiness = async ({
  frontendUrl,
  serverUrl,
  fetch: fetchRequest = globalThis.fetch,
}) => {
  const frontend = parseHttpsOrigin(frontendUrl, "Payment offer");
  const server = parseHttpsOrigin(serverUrl, "Payment offer");
  if (!frontend.ok || !server.ok) {
    return {
      ok: false,
      readiness: "invalid",
      checks: [fail("Payment offer", "Expected exact HTTPS origins.")],
    };
  }

  try {
    const response = await fetchRequest(
      `${server.origin}/api/recipe-analysis`,
      {
        method: "POST",
        headers: {
          Origin: frontend.origin,
          "Content-Type": "application/json",
          "Idempotency-Key": canonicalProbeRequest.idempotencyKey,
        },
        body: JSON.stringify(canonicalProbeRequest),
        redirect: "error",
      },
    );
    const responseBody = await response.text();
    const header = response.headers.get("Payment-Required");
    const exposed = headerValues(response, "Access-Control-Expose-Headers");
    const responsePolicyIsSafe =
      response.headers.get("Access-Control-Allow-Origin") === frontend.origin &&
      exposed.includes("payment-required") &&
      hasNoStore(response) &&
      !containsUnsafeDisclosure(responseBody);
    const challenge = header ? decodePaymentRequired(header) : undefined;

    const disabled = parseJson(responseBody);
    if (
      response.status === 503 &&
      header === null &&
      responsePolicyIsSafe &&
      disabled?.ok === false &&
      disabled.error?.code === "DEPENDENCY_UNAVAILABLE" &&
      disabled.error?.message ===
        "Payment verification is temporarily unavailable." &&
      disabled.error?.retryable === true
    ) {
      return {
        ok: true,
        readiness: "unavailable",
        checks: [pass("Payment disabled")],
      };
    }

    if (
      response.status === 402 &&
      responsePolicyIsSafe &&
      isExactBaseSepoliaOffer(challenge)
    ) {
      return {
        ok: true,
        readiness: "ready",
        checks: [pass("Payment offer")],
      };
    }

    return {
      ok: false,
      readiness: "invalid",
      checks: [
        fail(
          "Payment offer",
          "Expected one safe Base Sepolia exact 0.01-USDC offer.",
        ),
      ],
    };
  } catch {
    return {
      ok: false,
      readiness: "invalid",
      checks: [fail("Payment offer", "Payment readiness request failed.")],
    };
  }
};

export const probeSponsorPath = async ({
  frontendUrl,
  serverUrl,
  fetch: fetchRequest = globalThis.fetch,
  sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
  createId = () => crypto.randomUUID(),
}) => {
  const frontend = parseHttpsOrigin(frontendUrl, "Sponsor path");
  const server = parseHttpsOrigin(serverUrl, "Sponsor path");
  if (!frontend.ok || !server.ok) {
    return {
      ok: false,
      checks: [fail("Sponsor path", "Expected exact HTTPS origins.")],
    };
  }

  const suffix = createId();
  if (!/^[A-Za-z0-9-]{1,64}$/.test(suffix)) {
    return {
      ok: false,
      checks: [fail("Sponsor path", "Could not create a safe probe ID.")],
    };
  }
  const attemptId = `public-smoke-attempt-${suffix}`;
  const requestId = `public-smoke-request-${suffix}`;
  const idempotencyKey = `public-smoke-idempotency-${suffix}`;
  const request = {
    requestId,
    idempotencyKey,
    resourceId: "recipe_analysis",
    input: { recipeId: "roasted-chickpea-quinoa-bowl" },
  };
  const protectedHeaders = {
    Origin: frontend.origin,
    "Content-Type": "application/json",
  };

  try {
    const sessionResponse = await fetchRequest(
      `${server.origin}/api/sponsor-sessions`,
      {
        method: "POST",
        headers: protectedHeaders,
        body: JSON.stringify({
          attemptId,
          resourceId: "recipe_analysis",
          nonce: requestId,
        }),
        redirect: "error",
      },
    );
    const sessionText = await sessionResponse.text();
    const session = parseJson(sessionText);
    if (
      sessionResponse.status !== 201 ||
      !responseHasProtectedPolicy(sessionResponse, frontend.origin) ||
      session?.ok !== true ||
      !isOpaqueCredential(session.sessionCredential) ||
      session.sponsor?.id !== "open-table-weekly" ||
      session.sponsor?.name !== "Open Table Weekly" ||
      session.sponsor?.creativeKey !== "weekly-static-v1" ||
      session.requiredMs !== 8_000 ||
      !Number.isFinite(Date.parse(session.expiresAt))
    ) {
      throw new Error("invalid session");
    }

    await sleep(session.requiredMs);

    const grantResponse = await fetchRequest(
      `${server.origin}/api/sponsor-grants`,
      {
        method: "POST",
        headers: protectedHeaders,
        body: JSON.stringify({
          sessionCredential: session.sessionCredential,
        }),
        redirect: "error",
      },
    );
    const grantText = await grantResponse.text();
    const grant = parseJson(grantText);
    if (
      ![200, 201].includes(grantResponse.status) ||
      !responseHasProtectedPolicy(grantResponse, frontend.origin) ||
      grant?.ok !== true ||
      !isOpaqueCredential(grant.token) ||
      grant.evidence?.kind !== "sponsor_grant" ||
      typeof grant.evidence?.grantId !== "string" ||
      grant.evidence.grantId.length === 0 ||
      grant.evidence.resourceId !== "recipe_analysis" ||
      grant.evidence.nonce !== requestId ||
      !Number.isFinite(Date.parse(grant.evidence.issuedAt)) ||
      !Number.isFinite(Date.parse(grant.evidence.expiresAt)) ||
      grant.evidence.issuedAt >= grant.evidence.expiresAt
    ) {
      throw new Error("invalid grant");
    }

    const analysisResponse = await fetchRequest(
      `${server.origin}/api/recipe-analysis`,
      {
        method: "POST",
        headers: {
          ...protectedHeaders,
          Authorization: `Sponsor ${grant.token}`,
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(request),
        redirect: "error",
      },
    );
    const analysisText = await analysisResponse.text();
    const analysis = parseJson(analysisText);
    if (
      analysisResponse.status !== 200 ||
      !responseHasProtectedPolicy(analysisResponse, frontend.origin) ||
      !isCanonicalAnalysis(analysis, requestId, grant.evidence.grantId) ||
      analysisText.includes(session.sessionCredential) ||
      analysisText.includes(grant.token) ||
      containsUnsafeDisclosure(analysisText)
    ) {
      throw new Error("invalid analysis");
    }

    return { ok: true, checks: [pass("Sponsor path")] };
  } catch {
    return {
      ok: false,
      checks: [
        fail(
          "Sponsor path",
          "The public sponsor flow did not complete safely.",
        ),
      ],
    };
  }
};

const facilitatorWarning = () => ({
  available: false,
  checks: [
    {
      name: "Hosted facilitator",
      status: "warn",
      reason: "Paid path requires a same-release local recording.",
    },
  ],
});

export const probeFacilitator = async ({
  facilitatorUrl,
  fetch: fetchRequest = globalThis.fetch,
}) => {
  if (!facilitatorUrl) return facilitatorWarning();
  const facilitator = parseHttpsOrigin(facilitatorUrl, "Hosted facilitator");
  if (!facilitator.ok) return facilitatorWarning();

  try {
    const signal = AbortSignal.timeout(5_000);
    const healthResponse = await fetchRequest(`${facilitator.origin}/health`, {
      headers: { Accept: "application/json" },
      redirect: "error",
      signal,
    });
    const health = parseJson(await healthResponse.text());
    if (!healthResponse.ok || health?.status !== "ok") {
      return facilitatorWarning();
    }

    const supportedResponse = await fetchRequest(
      `${facilitator.origin}/supported`,
      {
        headers: { Accept: "application/json" },
        redirect: "error",
        signal,
      },
    );
    const supported = parseJson(await supportedResponse.text());
    const compatible =
      supportedResponse.ok &&
      Array.isArray(supported?.kinds) &&
      supported.kinds.some(
        (kind) =>
          kind?.x402Version === 2 &&
          kind.scheme === "exact" &&
          kind.network === "eip155:84532",
      );
    return compatible
      ? {
          available: true,
          checks: [pass("Hosted facilitator")],
        }
      : facilitatorWarning();
  } catch {
    return facilitatorWarning();
  }
};

export const runPublicSmoke = async ({
  frontendUrl,
  serverUrl,
  facilitatorUrl,
  fetch: fetchRequest = globalThis.fetch,
  sleep,
  createId,
}) => {
  const reachability = await probePublicReachability({
    frontendUrl,
    serverUrl,
    fetch: fetchRequest,
  });
  const cors = await probeCorsAndPreview({
    frontendUrl,
    serverUrl,
    fetch: fetchRequest,
  });
  const facilitator = await probeFacilitator({
    facilitatorUrl,
    fetch: fetchRequest,
  });
  const foundationIsSafe = reachability.ok && cors.ok;
  if (!foundationIsSafe) {
    return {
      ok: false,
      paymentReadiness: "not-checked",
      facilitatorAvailable: facilitator.available,
      checks: [...reachability.checks, ...cors.checks, ...facilitator.checks],
    };
  }

  const payment = await probePaymentReadiness({
    frontendUrl,
    serverUrl,
    fetch: fetchRequest,
  });
  const sponsor = await probeSponsorPath({
    frontendUrl,
    serverUrl,
    fetch: fetchRequest,
    ...(sleep ? { sleep } : {}),
    ...(createId ? { createId } : {}),
  });
  return {
    ok: payment.ok && sponsor.ok,
    paymentReadiness: payment.readiness,
    facilitatorAvailable: facilitator.available,
    checks: [
      ...reachability.checks,
      ...cors.checks,
      ...payment.checks,
      ...sponsor.checks,
      ...facilitator.checks,
    ],
  };
};

const parseCliArgs = (args) => {
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!value || !flag?.startsWith("--")) return undefined;
    if (flag === "--frontend-url") values.frontendUrl = value;
    else if (flag === "--server-url") values.serverUrl = value;
    else if (flag === "--facilitator-url") values.facilitatorUrl = value;
    else return undefined;
  }
  return values.frontendUrl && values.serverUrl ? values : undefined;
};

const printResult = (result) => {
  for (const check of result.checks) {
    const suffix = check.reason ? `: ${check.reason}` : "";
    const label = check.status.toUpperCase();
    const output = `[public-smoke] ${label} ${check.name}${suffix}`;
    if (check.status === "fail") console.error(output);
    else console.log(output);
  }
  const payment = result.paymentReadiness;
  const facilitator = result.facilitatorAvailable ? "ready" : "fallback";
  if (result.ok) {
    console.log(
      `[public-smoke] GO sponsor-live; payment=${payment}; facilitator=${facilitator}`,
    );
  } else {
    console.error(
      `[public-smoke] NO-GO sponsor-live; payment=${payment}; facilitator=${facilitator}`,
    );
  }
};

const main = async () => {
  const options = parseCliArgs(process.argv.slice(2));
  if (!options) {
    console.error(
      "Usage: node scripts/public-smoke.mjs --frontend-url <https-origin> --server-url <https-origin> [--facilitator-url <https-origin>]",
    );
    return 2;
  }
  const result = await runPublicSmoke(options);
  printResult(result);
  return result.ok ? 0 : 1;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .then((status) => {
      process.exitCode = status;
    })
    .catch(() => {
      console.error("[public-smoke] NO-GO: unexpected probe failure.");
      process.exitCode = 1;
    });
}
