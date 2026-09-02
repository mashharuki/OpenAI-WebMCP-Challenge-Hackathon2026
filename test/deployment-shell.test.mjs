import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

describe("deployable public shell", () => {
  it("publishes AdGate metadata and explicit frontend release placeholders", async () => {
    const packageJson = await readJson("apps/frontend/package.json");
    const wrangler = await readJson("apps/frontend/wrangler.jsonc");
    const deployConfig = await readJson(
      "apps/frontend/.wrangler/deploy/config.json",
    );
    const html = await read("apps/frontend/index.html");
    const envExample = await read("apps/frontend/.env.example");

    assert.equal(packageJson.name, "frontend");
    assert.match(packageJson.description, /human-in-the-loop/i);
    assert.doesNotMatch(
      JSON.stringify(packageJson),
      /webmcp starter|todo app/i,
    );
    assert.equal(wrangler.name, "adgate-frontend");
    assert.match(deployConfig.configPath, /adgate_frontend/);
    assert.doesNotMatch(deployConfig.configPath, /starter/i);
    assert.equal(wrangler.compatibility_date, "2026-08-31");
    assert.match(html, /%VITE_ORIGIN_TRIAL_TOKEN%/);
    assert.match(html, /%VITE_RELEASE_SHA%/);
    assert.match(envExample, /^VITE_API_BASE_URL=https:\/\//m);
    assert.match(envExample, /^VITE_ORIGIN_TRIAL_TOKEN=/m);
    assert.match(envExample, /^VITE_RELEASE_SHA=/m);
  });

  it("defines a deterministic single-instance resource-server deployment", async () => {
    const packageJson = await readJson("apps/server/package.json");
    const entrypoint = await read("apps/server/src/index.ts");
    const blueprint = await read("render.yaml");
    const envExample = await read("apps/server/.env.example");

    assert.equal(
      packageJson.scripts.typecheck,
      "tsc -p tsconfig.json --noEmit",
    );
    assert.equal(packageJson.scripts.build, "tsc -p tsconfig.json");
    assert.equal(packageJson.scripts.start, "node dist/index.js");
    assert.match(entrypoint, /process\.env\.PORT/);
    assert.match(blueprint, /^\s+numInstances: 1$/m);
    assert.doesNotMatch(blueprint, /^\s+scaling:/m);
    assert.match(blueprint, /^\s+autoDeployTrigger: off$/m);
    assert.match(blueprint, /^\s+healthCheckPath: \/health$/m);
    assert.match(
      blueprint,
      /pnpm --filter x402server run typecheck && pnpm --filter x402server run build/,
    );
    assert.match(blueprint, /pnpm --filter x402server run start/);
    assert.match(
      envExample,
      /^FACILITATOR_URL=https:\/\/facilitator\.example\.com$/m,
    );
    assert.match(envExample, /^EVM_ADDRESS=0x[0-9a-fA-F]{40}$/m);
    assert.match(
      envExample,
      /^ALLOWED_ORIGINS=https:\/\/frontend\.example\.com$/m,
    );
    assert.match(envExample, /^RELEASE_SHA=$/m);
    assert.match(envExample, /eip155:84532/);
    assert.match(envExample, /10000 base units/);
  });

  it("provides a secret-safe hosted facilitator environment example", async () => {
    const envExample = await read("apps/facilitator/.env.example");

    assert.match(envExample, /^EVM_PRIVATE_KEY=$/m);
    assert.match(envExample, /^PORT=4022$/m);
    assert.doesNotMatch(envExample, /^EVM_PRIVATE_KEY=0x[0-9a-fA-F]+$/m);
    assert.match(envExample, /Base Sepolia/);
  });

  it("documents the public-origin and Durable Object deployment invariants", async () => {
    const runbook = await read("docs/deployment.md");

    assert.match(runbook, /ALLOWED_ORIGINS/);
    assert.match(runbook, /exact.*origin/i);
    assert.match(runbook, /VITE_ORIGIN_TRIAL_TOKEN/);
    assert.match(runbook, /VITE_RELEASE_SHA/);
    assert.match(runbook, /EVM_ADDRESS.*payTo/is);
    assert.match(runbook, /FACILITATOR_URL/);
    assert.match(runbook, /eip155:84532/);
    assert.match(runbook, /10,000 base units/);
    assert.match(runbook, /same named Durable\s+Object/i);
    assert.match(runbook, /single-coordinator invariant/i);
    assert.match(runbook, /freeze deployments.*demo recording/is);
    assert.match(runbook, /final response.*lost.*new access\s+attempt/is);
  });
});
