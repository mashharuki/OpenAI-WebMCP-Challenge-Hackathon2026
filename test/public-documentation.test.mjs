import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

describe("public documentation", () => {
  it("explains the product, architecture, access paths, setup, and provenance", async () => {
    const readme = await read("README.md");
    for (const required of [
      "AdGate",
      "WebMCP",
      "Sponsor access",
      "Base Sepolia",
      "Architecture",
      "Local setup",
      "Deployment",
      "Hackathon provenance",
      "Known limitations",
      "Live demo",
    ]) {
      assert.match(readme, new RegExp(required, "i"));
    }
  });

  it("keeps every package aligned with the repository MIT license", async () => {
    for (const path of [
      "package.json",
      "apps/frontend/package.json",
      "apps/server/package.json",
      "apps/facilitator/package.json",
    ]) {
      const manifest = JSON.parse(await read(path));
      assert.equal(manifest.license, "MIT", `${path} must declare MIT`);
      assert.match(manifest.description, /AdGate|WebMCP|x402/i);
    }
    assert.match(await read("LICENSE"), /MIT License/);
  });

  it("ships the required hand-written judging and media packet", async () => {
    const requiredFiles = [
      "docs/architecture-and-provenance.md",
      "docs/environment.md",
      "docs/submission-checklist.md",
    ];
    await Promise.all(
      requiredFiles.map((path) =>
        access(new URL(`../${path}`, import.meta.url)),
      ),
    );
  });
});
