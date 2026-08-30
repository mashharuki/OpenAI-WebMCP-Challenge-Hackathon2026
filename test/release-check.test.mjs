import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatCommand,
  releaseChecks,
  runReleaseCheck,
} from "../scripts/release-check.mjs";

describe("release check", () => {
  it("covers the frozen install and every required workspace gate", () => {
    assert.deepEqual(releaseChecks.map(formatCommand), [
      "pnpm install --frozen-lockfile",
      "pnpm exec biome check .",
      "pnpm --filter frontend run test",
      "pnpm --filter frontend run typecheck",
      "pnpm --filter frontend run build",
      "pnpm --filter x402server run typecheck",
      "pnpm --filter x402server run build",
      "pnpm --filter x402server run test",
      "pnpm --filter facilitator exec tsc --noEmit",
      "pnpm --filter facilitator run build",
      "pnpm --filter facilitator run test",
      "pnpm run test:release-check",
      "pnpm run test:deployment-shell",
      "pnpm run test:public-smoke",
      "pnpm run test:contracts",
      "pnpm run validate:payment",
    ]);
  });

  it("prints the tested commit, timestamp, and successful checks", () => {
    const output = [];
    const status = runReleaseCheck({
      checks: releaseChecks.slice(0, 2),
      commit: "abc1234",
      now: () => new Date("2026-08-30T12:00:00.000Z"),
      run: () => ({ status: 0 }),
      write: (line) => output.push(line),
      writeError: (line) => output.push(line),
    });

    assert.equal(status, 0);
    assert.match(output.join("\n"), /commit: abc1234/);
    assert.match(output.join("\n"), /2026-08-30T12:00:00.000Z/);
    assert.equal(output.filter((line) => line.includes("PASS")).length, 2);
    assert.match(output.at(-1), /GO/);
  });

  it("stops at the first failure and prints the exact retry command", () => {
    const output = [];
    let calls = 0;
    const status = runReleaseCheck({
      checks: releaseChecks.slice(0, 3),
      commit: "abc1234",
      run: () => ({ status: ++calls === 2 ? 7 : 0 }),
      write: (line) => output.push(line),
      writeError: (line) => output.push(line),
    });

    assert.equal(status, 7);
    assert.equal(calls, 2);
    assert.match(output.join("\n"), /NO-GO/);
    assert.match(output.join("\n"), /pnpm exec biome check \./);
    assert.match(output.join("\n"), /Retry:/);
  });
});
