import { describe, expect, it, vi } from "vitest";
import type { PremiumAnalysisRequest } from "../../src/adgate/contracts";
import { createProtectedAnalysisClient } from "../../src/adgate/protectedAnalysisClient";

const request: PremiumAnalysisRequest = {
  requestId: "123e4567-e89b-42d3-a456-426614174000",
  idempotencyKey: "attempt-12345678",
  resourceId: "recipe_analysis",
  input: { recipeId: "roasted-chickpea-quinoa-bowl" },
};

const analysis = {
  summary: "A balanced plant-forward bowl.",
  nutritionalInsights: ["Chickpeas provide fiber."],
  suggestions: ["Add pumpkin seeds for crunch."],
  disclaimer: "This is general information, not medical advice.",
};

const success = {
  ok: true as const,
  requestId: request.requestId,
  resourceId: "recipe_analysis" as const,
  access: { kind: "sponsor_grant" as const, referenceId: "grant-123" },
  data: analysis,
};

describe("createProtectedAnalysisClient", () => {
  it("sends the canonical body and sponsor token only in authorization", async () => {
    const token = "private-sponsor-token";
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(success));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = createProtectedAnalysisClient({
      baseUrl: "https://api.example/",
      fetchImpl: fetchImpl as typeof fetch,
    });

    const result = await client.executeWithSponsor({
      request,
      token,
      signal: new AbortController().signal,
    });

    expect(result).toEqual(success);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(url).toBe("https://api.example/api/recipe-analysis");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify(request));
    expect(headers.get("Authorization")).toBe(`Sponsor ${token}`);
    expect(headers.get("Idempotency-Key")).toBe(request.idempotencyKey);
    expect(url).not.toContain(token);
    expect(JSON.stringify(result)).not.toContain(token);
    expect(localStorage.length).toBe(0);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("returns a strictly validated common error", async () => {
    const failure = {
      ok: false as const,
      error: {
        code: "ACCESS_EXPIRED" as const,
        message: "Sponsor access expired.",
        retryable: true,
      },
    };
    const client = createProtectedAnalysisClient({
      baseUrl: "https://api.example",
      fetchImpl: vi.fn(async () =>
        Response.json(failure, { status: 401 }),
      ) as typeof fetch,
    });

    await expect(
      client.executeWithSponsor({
        request,
        token: "token",
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual(failure);
  });

  it("rejects malformed success and error payloads without exposing them", async () => {
    for (const response of [
      Response.json({ ...success, privateToken: "secret" }),
      Response.json(
        { ok: false, error: { code: "PRIVATE", message: "secret" } },
        { status: 500 },
      ),
    ]) {
      const client = createProtectedAnalysisClient({
        baseUrl: "https://api.example",
        fetchImpl: vi.fn(async () => response) as typeof fetch,
      });

      const result = await client.executeWithSponsor({
        request,
        token: "token",
        signal: new AbortController().signal,
      });

      expect(result).toEqual({
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "The protected analysis response could not be validated.",
          retryable: false,
        },
      });
      expect(JSON.stringify(result)).not.toContain("secret");
    }
  });

  it("normalizes network failure without exposing its cause", async () => {
    const client = createProtectedAnalysisClient({
      baseUrl: "https://api.example",
      fetchImpl: vi.fn(async () => {
        throw new Error("private network details");
      }) as typeof fetch,
    });

    await expect(
      client.executeWithSponsor({
        request,
        token: "private-token",
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "Protected analysis is temporarily unavailable. Try again.",
        retryable: true,
      },
    });
  });

  it("propagates abort and returns safe cancellation", async () => {
    const fetchImpl = vi.fn(
      (_input: URL | RequestInfo, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("private abort reason", "AbortError"));
          });
        }),
    );
    const client = createProtectedAnalysisClient({
      baseUrl: "https://api.example",
      fetchImpl: fetchImpl as typeof fetch,
    });
    const controller = new AbortController();

    const result = client.executeWithSponsor({
      request,
      token: "private-token",
      signal: controller.signal,
    });
    controller.abort("private reason");

    await expect(result).resolves.toEqual({
      ok: false,
      error: {
        code: "CANCELLED",
        message: "The protected analysis request was cancelled.",
        retryable: false,
      },
    });
    expect(fetchImpl.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });

  it("does not send an invalid request", async () => {
    const fetchImpl = vi.fn();
    const client = createProtectedAnalysisClient({
      baseUrl: "https://api.example",
      fetchImpl: fetchImpl as typeof fetch,
    });

    const result = await client.executeWithSponsor({
      request: { ...request, idempotencyKey: "short" },
      token: "private-token",
      signal: new AbortController().signal,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT" },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
