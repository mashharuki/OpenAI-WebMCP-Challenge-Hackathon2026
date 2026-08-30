import { describe, expect, it, vi } from "vitest";
import { createAnalysisClient } from "../../src/publisher/analysisClient";
import { sampleRecipe } from "../../src/publisher/sampleRecipe";

const canonicalResult = {
  summary: "A balanced plant-forward bowl.",
  nutritionalInsights: ["Chickpeas provide fiber."],
  suggestions: ["Add pumpkin seeds for crunch."],
  disclaimer: "This is general information, not medical advice.",
};

describe("createAnalysisClient", () => {
  it("sends one canonical preview request and returns validated analysis", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        ok: true,
        resourceId: "recipe_analysis",
        data: canonicalResult,
      }),
    );
    const client = createAnalysisClient({
      baseUrl: "https://api.example/",
      fetchImpl: fetchImpl as typeof fetch,
    });
    const abortController = new AbortController();

    await expect(
      client.analyze(sampleRecipe.analysisInput, abortController.signal),
    ).resolves.toEqual(canonicalResult);

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.example/api/recipe-analysis/preview");
    expect(init?.method).toBe("POST");
    expect(init?.signal).toBe(abortController.signal);
    const request = JSON.parse(String(init?.body));
    expect(request).toMatchObject({
      resourceId: "recipe_analysis",
      input: { recipeId: "roasted-chickpea-quinoa-bowl" },
    });
    expect(Object.keys(request.input)).toEqual(["recipeId"]);
    expect(request.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(request.idempotencyKey).toMatch(/^preview-[0-9a-f-]{36}$/);
    const headers = new Headers(init?.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Idempotency-Key")).toBe(request.idempotencyKey);
  });

  it("rejects with a validated safe server error", async () => {
    const client = createAnalysisClient({
      baseUrl: "https://api.example",
      fetchImpl: vi.fn(async () =>
        Response.json(
          {
            ok: false,
            error: {
              code: "INVALID_INPUT",
              message: "The recipe analysis request is invalid.",
              retryable: false,
            },
          },
          { status: 400 },
        ),
      ) as typeof fetch,
    });

    await expect(client.analyze(sampleRecipe.analysisInput)).rejects.toEqual({
      code: "INVALID_INPUT",
      message: "The recipe analysis request is invalid.",
      retryable: false,
    });
  });

  it("normalizes invalid JSON without exposing the raw response", async () => {
    const client = createAnalysisClient({
      baseUrl: "https://api.example",
      fetchImpl: vi.fn(
        async () =>
          new Response("private invalid response", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ) as typeof fetch,
    });

    await expect(client.analyze(sampleRecipe.analysisInput)).rejects.toEqual({
      code: "INTERNAL_ERROR",
      message: "The analysis response could not be validated.",
      retryable: false,
    });
  });

  it("rejects a success payload for the wrong resource", async () => {
    const client = createAnalysisClient({
      baseUrl: "https://api.example",
      fetchImpl: vi.fn(async () =>
        Response.json({
          ok: true,
          resourceId: "private_other_resource",
          data: canonicalResult,
        }),
      ) as typeof fetch,
    });

    await expect(client.analyze(sampleRecipe.analysisInput)).rejects.toEqual({
      code: "INTERNAL_ERROR",
      message: "The analysis response could not be validated.",
      retryable: false,
    });
  });

  it("normalizes a network failure without exposing its cause", async () => {
    const client = createAnalysisClient({
      baseUrl: "https://api.example",
      fetchImpl: vi.fn(async () => {
        throw new Error("private network details");
      }) as typeof fetch,
    });

    await expect(client.analyze(sampleRecipe.analysisInput)).rejects.toEqual({
      code: "DEPENDENCY_UNAVAILABLE",
      message: "Analysis is temporarily unavailable. Try again.",
      retryable: true,
    });
  });

  it("propagates the caller signal and preserves AbortError", async () => {
    const fetchImpl = vi.fn(
      (_input: URL | RequestInfo, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(
              new DOMException("The operation was aborted.", "AbortError"),
            );
          });
        }),
    );
    const client = createAnalysisClient({
      baseUrl: "https://api.example",
      fetchImpl: fetchImpl as typeof fetch,
    });
    const abortController = new AbortController();

    const analysis = client.analyze(
      sampleRecipe.analysisInput,
      abortController.signal,
    );
    abortController.abort();

    await expect(analysis).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchImpl.mock.calls[0]?.[1]?.signal).toBe(abortController.signal);
  });

  it("rejects a success body returned with an error status", async () => {
    const client = createAnalysisClient({
      baseUrl: "https://api.example",
      fetchImpl: vi.fn(async () =>
        Response.json(
          {
            ok: true,
            resourceId: "recipe_analysis",
            data: canonicalResult,
          },
          { status: 500 },
        ),
      ) as typeof fetch,
    });

    await expect(client.analyze(sampleRecipe.analysisInput)).rejects.toEqual({
      code: "INTERNAL_ERROR",
      message: "The analysis response could not be validated.",
      retryable: false,
    });
  });
});
