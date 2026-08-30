import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl } from "../src/runtimeConfig";

describe("resolveApiBaseUrl", () => {
  it("uses an explicitly configured HTTPS API origin", () => {
    expect(
      resolveApiBaseUrl(
        "https://api.example.com/base/",
        "https://frontend.example.com",
      ),
    ).toBe("https://api.example.com/base/");
  });

  it("falls back to the page origin for a same-origin deployment", () => {
    expect(resolveApiBaseUrl(undefined, "http://localhost:5173")).toBe(
      "http://localhost:5173/",
    );
  });

  it.each(["javascript:alert(1)", "ftp://api.example.com"])(
    "rejects an unsafe API base URL: %s",
    (configured) => {
      expect(() =>
        resolveApiBaseUrl(configured, "https://frontend.example.com"),
      ).toThrow("VITE_API_BASE_URL must use HTTP or HTTPS.");
    },
  );
});
