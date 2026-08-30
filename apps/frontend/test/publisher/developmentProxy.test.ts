import { describe, expect, it } from "vitest";
import { developmentProxy } from "../../developmentProxy";

describe("publisher development proxy", () => {
  it("forwards same-origin API requests to the resource server", () => {
    expect(developmentProxy["/api"]).toEqual({
      target: "http://127.0.0.1:4021",
      changeOrigin: true,
    });
  });
});
