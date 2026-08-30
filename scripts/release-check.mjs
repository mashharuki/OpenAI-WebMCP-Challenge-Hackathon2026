import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const releaseChecks = Object.freeze([
  {
    name: "Frozen install",
    command: "pnpm",
    args: ["install", "--frozen-lockfile"],
  },
  { name: "Biome", command: "pnpm", args: ["exec", "biome", "check", "."] },
  {
    name: "Frontend tests",
    command: "pnpm",
    args: ["--filter", "frontend", "run", "test"],
  },
  {
    name: "Frontend browser E2E",
    command: "pnpm",
    args: ["--filter", "frontend", "run", "test:e2e"],
  },
  {
    name: "Frontend typecheck",
    command: "pnpm",
    args: ["--filter", "frontend", "run", "typecheck"],
  },
  {
    name: "Frontend build",
    command: "pnpm",
    args: ["--filter", "frontend", "run", "build"],
  },
  {
    name: "Server typecheck",
    command: "pnpm",
    args: ["--filter", "x402server", "run", "typecheck"],
  },
  {
    name: "Server build",
    command: "pnpm",
    args: ["--filter", "x402server", "run", "build"],
  },
  {
    name: "Server tests",
    command: "pnpm",
    args: ["--filter", "x402server", "run", "test"],
  },
  {
    name: "Facilitator typecheck",
    command: "pnpm",
    args: ["--filter", "facilitator", "exec", "tsc", "--noEmit"],
  },
  {
    name: "Facilitator build",
    command: "pnpm",
    args: ["--filter", "facilitator", "run", "build"],
  },
  {
    name: "Facilitator tests",
    command: "pnpm",
    args: ["--filter", "facilitator", "run", "test"],
  },
  {
    name: "Release gate tests",
    command: "pnpm",
    args: ["run", "test:release-check"],
  },
  {
    name: "Deployment shell",
    command: "pnpm",
    args: ["run", "test:deployment-shell"],
  },
  {
    name: "Public smoke tests",
    command: "pnpm",
    args: ["run", "test:public-smoke"],
  },
  {
    name: "Cross-app contracts",
    command: "pnpm",
    args: ["run", "test:contracts"],
  },
  {
    name: "Payment boundaries",
    command: "pnpm",
    args: ["run", "validate:payment"],
  },
]);

export const formatCommand = ({ command, args }) =>
  [command, ...args].join(" ");

const readCommit = () => {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : "unknown";
};

const runCommand = (command, args) =>
  spawnSync(command, args, { stdio: "inherit" });

export const runReleaseCheck = ({
  checks = releaseChecks,
  commit = readCommit(),
  now = () => new Date(),
  run = runCommand,
  write = console.log,
  writeError = console.error,
} = {}) => {
  write(`[release-check] commit: ${commit}`);

  for (const check of checks) {
    const command = formatCommand(check);
    write(`[release-check] START ${check.name}: ${command}`);
    const result = run(check.command, check.args);
    if (result.status !== 0) {
      const status = result.status ?? 1;
      writeError(`[release-check] NO-GO ${check.name} (exit ${status})`);
      writeError(`[release-check] Failed command: ${command}`);
      writeError(`[release-check] Retry: ${command}`);
      return status;
    }
    write(`[release-check] PASS ${check.name}`);
  }

  write(`[release-check] completed: ${now().toISOString()}`);
  write(`[release-check] GO commit: ${commit}`);
  return 0;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = runReleaseCheck();
}
