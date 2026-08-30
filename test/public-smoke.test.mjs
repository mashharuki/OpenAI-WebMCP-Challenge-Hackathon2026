import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import {
  probeCorsAndPreview,
  probeFacilitator,
  probePaymentReadiness,
  probePublicReachability,
  probeSponsorPath,
} from "../scripts/public-smoke.mjs";

const originTrialToken = "A".repeat(96);
const baseSepoliaUsdc = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const payTo = "0x0000000000000000000000000000000000000001";
const sessionCredential = "s".repeat(43);
const sponsorToken = "t".repeat(43);

describe("public smoke probe", () => {
  it("accepts reachable HTTPS origins with an Origin Trial token without exposing it", async () => {
    const requests = [];
    const result = await probePublicReachability({
      frontendUrl: "https://journal.example",
      serverUrl: "https://api.example",
      fetch: async (input, init) => {
        requests.push([String(input), init?.method ?? "GET"]);
        if (String(input) === "https://journal.example/") {
          return new Response(
            `<html><head><meta http-equiv="origin-trial" content="${originTrialToken}"></head></html>`,
            { status: 200, headers: { "Content-Type": "text/html" } },
          );
        }
        return Response.json({ report: { status: "OK" } });
      },
    });

    assert.deepEqual(requests, [
      ["https://journal.example/", "GET"],
      ["https://api.example/health", "GET"],
    ]);
    assert.equal(result.ok, true);
    assert.deepEqual(result.checks, [
      { name: "Frontend HTTPS", status: "pass" },
      { name: "Origin Trial", status: "pass" },
      { name: "Resource server HTTPS", status: "pass" },
      { name: "Public response safety", status: "pass" },
    ]);
    assert.doesNotMatch(JSON.stringify(result), new RegExp(originTrialToken));
  });

  it("rejects secret-like data in reachable public responses without echoing it", async () => {
    const leakedValue = "PRIVATE_KEY=0xdeadbeef";
    const result = await probePublicReachability({
      frontendUrl: "https://journal.example",
      serverUrl: "https://api.example",
      fetch: async (input) =>
        String(input).endsWith("/health")
          ? Response.json({ report: { status: "OK" } })
          : new Response(
              `<meta http-equiv="origin-trial" content="${originTrialToken}"><!-- ${leakedValue} -->`,
            ),
    });

    assert.equal(result.ok, false);
    assert.deepEqual(result.checks.at(-1), {
      name: "Public response safety",
      status: "fail",
      reason: "A public response contains unsafe diagnostic data.",
    });
    assert.doesNotMatch(JSON.stringify(result), new RegExp(leakedValue));
  });

  it("enforces the protected CORS contract and keeps production preview closed", async () => {
    const requests = [];
    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://journal.example",
      "Access-Control-Allow-Methods": "OPTIONS, POST",
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, Idempotency-Key, Payment-Signature, X-Payment",
      "Access-Control-Expose-Headers":
        "Payment-Required, Payment-Response, X-Payment-Response",
      "Cache-Control": "no-store",
      Vary: "Origin",
    };
    const result = await probeCorsAndPreview({
      frontendUrl: "https://journal.example",
      serverUrl: "https://api.example",
      fetch: async (input, init) => {
        requests.push([String(input), init]);
        if (init?.headers?.Origin === "https://blocked.example") {
          return Response.json(
            {
              ok: false,
              error: {
                code: "INVALID_EVIDENCE",
                message: "The request origin is not allowed.",
                retryable: false,
              },
            },
            { status: 403, headers: { "Cache-Control": "no-store" } },
          );
        }
        if (String(input).endsWith("/api/recipe-analysis/preview")) {
          return new Response("404 Not Found", {
            status: 404,
            headers: corsHeaders,
          });
        }
        return new Response(null, { status: 204, headers: corsHeaders });
      },
    });

    assert.equal(requests.length, 7);
    assert.equal(result.ok, true);
    assert.deepEqual(result.checks, [
      { name: "Protected CORS", status: "pass" },
      { name: "Disallowed origin", status: "pass" },
      { name: "Production preview", status: "pass" },
    ]);
    for (const [, init] of requests.slice(0, 3)) {
      assert.equal(init.method, "OPTIONS");
      assert.equal(init.headers.Origin, "https://journal.example");
      assert.match(
        init.headers["Access-Control-Request-Headers"],
        /authorization/i,
      );
      assert.match(
        init.headers["Access-Control-Request-Headers"],
        /payment-signature/i,
      );
    }
  });

  it("accepts exactly one safe Base Sepolia 0.01-USDC payment offer", async () => {
    const challenge = {
      x402Version: 2,
      resource: { url: "recipe_analysis" },
      accepts: [
        {
          scheme: "exact",
          network: "eip155:84532",
          asset: baseSepoliaUsdc,
          amount: "10000",
          payTo,
          maxTimeoutSeconds: 60,
          extra: { name: "USDC", version: "2" },
        },
      ],
    };
    const encoded = Buffer.from(JSON.stringify(challenge)).toString("base64");
    const result = await probePaymentReadiness({
      frontendUrl: "https://journal.example",
      serverUrl: "https://api.example",
      fetch: async (_input, init) => {
        assert.equal(init.method, "POST");
        assert.equal(init.headers.Origin, "https://journal.example");
        assert.equal(init.headers.Authorization, undefined);
        assert.equal(init.headers["Payment-Signature"], undefined);
        return new Response(null, {
          status: 402,
          headers: {
            "Access-Control-Allow-Origin": "https://journal.example",
            "Access-Control-Expose-Headers":
              "Payment-Required, Payment-Response, X-Payment-Response",
            "Cache-Control": "no-store",
            "Payment-Required": encoded,
          },
        });
      },
    });

    assert.deepEqual(result, {
      ok: true,
      readiness: "ready",
      checks: [{ name: "Payment offer", status: "pass" }],
    });
    assert.doesNotMatch(JSON.stringify(result), new RegExp(encoded));
    assert.doesNotMatch(JSON.stringify(result), new RegExp(payTo));
  });

  it("accepts a safe payment-disabled response without treating it as sponsor failure", async () => {
    const result = await probePaymentReadiness({
      frontendUrl: "https://journal.example",
      serverUrl: "https://api.example",
      fetch: async () =>
        Response.json(
          {
            ok: false,
            error: {
              code: "DEPENDENCY_UNAVAILABLE",
              message: "Payment verification is temporarily unavailable.",
              retryable: true,
            },
          },
          {
            status: 503,
            headers: {
              "Access-Control-Allow-Origin": "https://journal.example",
              "Access-Control-Expose-Headers":
                "Payment-Required, Payment-Response, X-Payment-Response",
              "Cache-Control": "no-store",
            },
          },
        ),
    });

    assert.deepEqual(result, {
      ok: true,
      readiness: "unavailable",
      checks: [{ name: "Payment disabled", status: "pass" }],
    });
  });

  it("completes the sponsor session and returns one canonical analysis without leaking credentials", async () => {
    const waits = [];
    const requests = [];
    const commonHeaders = {
      "Access-Control-Allow-Origin": "https://journal.example",
      "Access-Control-Expose-Headers":
        "Payment-Required, Payment-Response, X-Payment-Response",
      "Cache-Control": "no-store",
    };
    const result = await probeSponsorPath({
      frontendUrl: "https://journal.example",
      serverUrl: "https://api.example",
      createId: () => "probe-123",
      sleep: async (milliseconds) => waits.push(milliseconds),
      fetch: async (input, init) => {
        requests.push([String(input), init]);
        if (String(input).endsWith("/api/sponsor-sessions")) {
          return Response.json(
            {
              ok: true,
              sessionCredential,
              sponsor: {
                id: "open-table-weekly",
                name: "Open Table Weekly",
                creativeKey: "weekly-static-v1",
              },
              requiredMs: 8000,
              expiresAt: "2026-08-30T12:01:30.000Z",
            },
            { status: 201, headers: commonHeaders },
          );
        }
        if (String(input).endsWith("/api/sponsor-grants")) {
          assert.deepEqual(JSON.parse(init.body), { sessionCredential });
          return Response.json(
            {
              ok: true,
              token: sponsorToken,
              evidence: {
                kind: "sponsor_grant",
                grantId: "grant-123",
                resourceId: "recipe_analysis",
                issuedAt: "2026-08-30T12:00:08.000Z",
                expiresAt: "2026-08-30T12:01:08.000Z",
                nonce: "public-smoke-request-probe-123",
              },
            },
            { status: 201, headers: commonHeaders },
          );
        }
        assert.equal(init.headers.Authorization, `Sponsor ${sponsorToken}`);
        return Response.json(
          {
            ok: true,
            requestId: "public-smoke-request-probe-123",
            resourceId: "recipe_analysis",
            access: { kind: "sponsor_grant", referenceId: "grant-123" },
            data: {
              summary: "A safe canonical analysis.",
              nutritionalInsights: ["A practical insight."],
              suggestions: ["A practical suggestion."],
              disclaimer: "General information only.",
            },
          },
          { status: 200, headers: commonHeaders },
        );
      },
    });

    assert.deepEqual(waits, [8000]);
    assert.equal(requests.length, 3);
    assert.deepEqual(result, {
      ok: true,
      checks: [{ name: "Sponsor path", status: "pass" }],
    });
    assert.doesNotMatch(JSON.stringify(result), new RegExp(sessionCredential));
    assert.doesNotMatch(JSON.stringify(result), new RegExp(sponsorToken));
  });

  it("reports facilitator capability as best-effort payment readiness", async () => {
    const requests = [];
    const ready = await probeFacilitator({
      facilitatorUrl: "https://facilitator.example",
      fetch: async (input) => {
        requests.push(String(input));
        return String(input).endsWith("/health")
          ? Response.json({ status: "ok" })
          : Response.json({
              kinds: [
                {
                  x402Version: 2,
                  scheme: "exact",
                  network: "eip155:84532",
                },
              ],
            });
      },
    });
    const unavailable = await probeFacilitator({
      facilitatorUrl: "https://facilitator.example",
      fetch: async () => {
        throw new Error("PRIVATE_KEY=must-never-be-reported");
      },
    });

    assert.deepEqual(requests, [
      "https://facilitator.example/health",
      "https://facilitator.example/supported",
    ]);
    assert.deepEqual(ready, {
      available: true,
      checks: [{ name: "Hosted facilitator", status: "pass" }],
    });
    assert.deepEqual(unavailable, {
      available: false,
      checks: [
        {
          name: "Hosted facilitator",
          status: "warn",
          reason: "Paid path requires a same-release local recording.",
        },
      ],
    });
    assert.doesNotMatch(JSON.stringify(unavailable), /PRIVATE_KEY/);
  });

  it("fails before network access when required CLI origins are missing", () => {
    const result = spawnSync(process.execPath, ["scripts/public-smoke.mjs"], {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
    });

    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /--frontend-url/);
    assert.match(result.stderr, /--server-url/);
    assert.doesNotMatch(result.stderr, /token|private.key/i);
  });
});
