import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const runValidator = (apiBaseUrl: string) =>
  spawnSync(process.execPath, ["scripts/validate-deploy-env.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      VITE_API_BASE_URL: apiBaseUrl,
    },
  });

describe("frontend deploy environment", () => {
  it("rejects a deployment when VITE_API_BASE_URL is missing", () => {
    const result = runValidator("");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "VITE_API_BASE_URL is required for a production deployment.",
    );
  });

  it("rejects an API URL containing a path", () => {
    const result = runValidator("https://api.example.com/api");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "VITE_API_BASE_URL must be an HTTPS origin without a path or trailing slash.",
    );
  });
});
