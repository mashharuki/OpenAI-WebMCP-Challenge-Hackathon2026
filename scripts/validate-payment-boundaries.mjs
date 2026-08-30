import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const appNames = ["frontend", "server", "facilitator"];

const sourceFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(target);
      return /\.(?:ts|tsx)$/.test(entry.name) ? [target] : [];
    }),
  );
  return files.flat();
};

const files = (
  await Promise.all(
    appNames.map((appName) =>
      sourceFiles(path.join(repositoryRoot, "apps", appName, "src")),
    ),
  )
).flat();
const sources = new Map(
  await Promise.all(
    files.map(async (file) => [file, await readFile(file, "utf8")]),
  ),
);

const relative = (file) => path.relative(repositoryRoot, file);
const forbiddenPaymentFallback =
  /eip155:(?:1|4801)|\bWorld Chain\b|scheme:\s*["']upto["']/i;
for (const [file, source] of sources) {
  assert.equal(
    forbiddenPaymentFallback.test(source),
    false,
    `${relative(file)} contains a forbidden payment network or scheme`,
  );
}

const crossAppRuntimeImport =
  /from\s+["'][^"']*(?:apps\/(?:frontend|server|facilitator)|\.\.\/\.\.\/(?:frontend|server|facilitator))\//;
for (const [file, source] of sources) {
  assert.equal(
    crossAppRuntimeImport.test(source),
    false,
    `${relative(file)} imports another app at runtime`,
  );
}

const getSource = (relativePath) => {
  const absolutePath = path.join(repositoryRoot, relativePath);
  const source = sources.get(absolutePath);
  assert.ok(source, `${relativePath} was not included in the source scan`);
  return source;
};

const paymentPolicy = getSource("apps/server/src/adgate/paymentPolicy.ts");
assert.match(paymentPolicy, /network:\s*["']eip155:84532["']/);
assert.match(paymentPolicy, /scheme:\s*["']exact["']/);
assert.match(paymentPolicy, /amount:\s*["']10000["']/);

const serverConfig = getSource("apps/server/src/config.ts");
assert.equal(
  serverConfig.match(/accepts:\s*\[/g)?.length,
  1,
  "server config must declare exactly one accepts list",
);

const resourceServer = getSource("apps/server/src/resourceServer.ts");
assert.equal(
  resourceServer.match(/\.register\(/g)?.length,
  1,
  "resource server must register exactly one payment scheme",
);
assert.match(
  resourceServer,
  /register\(["']eip155:84532["'],\s*new ExactEvmScheme\(\)\)/,
);

const facilitator = getSource("apps/facilitator/src/facilitator.ts");
assert.equal(
  facilitator.match(/\.register\(/g)?.length,
  1,
  "facilitator must register exactly one payment scheme",
);
assert.match(facilitator, /BASE_SEPOLIA_NETWORK\s*=\s*["']eip155:84532["']/);

const productionComposition = getSource("apps/server/src/index.ts");
assert.doesNotMatch(
  productionComposition,
  /preview\s*:/,
  "production composition must not mount a preview router",
);

const paymentProtection = getSource(
  "apps/server/src/adgate/paymentProtection.ts",
);
assert.doesNotMatch(
  paymentProtection,
  /from\s+["'][^"']*(?:premiumAnalysis|sponsor|WebMCP)/i,
);
const paymentCoordinator = getSource(
  "apps/frontend/src/adgate/payment/paymentCoordinator.ts",
);
assert.doesNotMatch(paymentCoordinator, /WebMCP|GateMachine|useWebMCPTools/);

const packageVersions = await Promise.all(
  appNames.map(async (appName) => {
    const packageJson = JSON.parse(
      await readFile(
        path.join(repositoryRoot, "apps", appName, "package.json"),
        "utf8",
      ),
    );
    return [appName, packageJson.dependencies ?? {}];
  }),
);
for (const [appName, dependencies] of packageVersions) {
  for (const dependency of ["@x402/core", "@x402/evm"]) {
    if (dependency in dependencies) {
      assert.match(
        dependencies[dependency],
        /^\^?2\.23\./,
        `${appName} ${dependency} must stay on the 2.23 line`,
      );
    }
  }
  if ("viem" in dependencies) {
    assert.match(
      dependencies.viem,
      /^\^?2\./,
      `${appName} viem must stay on major version 2`,
    );
  }
}

console.log(
  `Payment boundary validation passed for ${files.length} source files.`,
);
