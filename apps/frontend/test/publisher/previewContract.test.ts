import { describe, expect, it, vi } from "vitest";
import fixture from "../../../../test/fixtures/publisher-demo.json";
import { premiumAnalysisRequestSchema } from "../../src/adgate/contracts";
import { createAnalysisClient } from "../../src/publisher/analysisClient";

describe("publisher preview contract fixture", () => {
  it("accepts the shared request and returns all four validated result regions", async () => {
    expect(premiumAnalysisRequestSchema.parse(fixture.request)).toEqual(
      fixture.request,
    );

    const fetchImpl = vi.fn(async () => Response.json(fixture.response));
    const client = createAnalysisClient({
      baseUrl: "https://preview.example",
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(client.analyze(fixture.request.input)).resolves.toEqual(
      fixture.response.data,
    );
    expect(Object.keys(fixture.response.data).sort()).toEqual([
      "disclaimer",
      "nutritionalInsights",
      "suggestions",
      "summary",
    ]);

    const sentRequest = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(sentRequest).toMatchObject({
      resourceId: fixture.request.resourceId,
      input: fixture.request.input,
    });
  });

  it("rejects fixture field drift at the browser boundary", async () => {
    const driftedResponse = {
      ...fixture.response,
      data: { ...fixture.response.data, internalPrompt: "must not cross" },
    };
    const client = createAnalysisClient({
      baseUrl: "https://preview.example",
      fetchImpl: vi.fn(async () =>
        Response.json(driftedResponse),
      ) as typeof fetch,
    });

    await expect(client.analyze(fixture.request.input)).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      retryable: false,
    });
  });
});
