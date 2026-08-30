import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const fixturePath = path.join(
  repositoryRoot,
  "test/fixtures/adgate-contracts.json",
);

const readFixture = async () => JSON.parse(await readFile(fixturePath, "utf8"));

const listFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(directory, entry.name);
        return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
      }),
    )
  ).flat();
};

test("the versioned fixture publishes stable valid and invalid case counts", async () => {
  const fixture = await readFixture();
  const actual = fixture.cases.reduce(
    (counts, fixtureCase) => {
      counts[fixtureCase.expect] += 1;
      counts.total += 1;
      return counts;
    },
    { valid: 0, invalid: 0, total: 0 },
  );

  assert.equal(fixture.schemaVersion, 1);
  assert.deepEqual(actual, fixture.caseCounts);
  assert.equal(
    new Set(fixture.cases.map(({ name }) => name)).size,
    actual.total,
  );
  for (const fixtureCase of fixture.cases.filter(
    ({ expect }) => expect === "invalid",
  )) {
    assert.equal(typeof fixtureCase.errorCode, "string", fixtureCase.name);
  }
});

test("the shared fixture covers gate events without making them server contracts", async () => {
  const fixture = await readFixture();
  const gateCases = fixture.cases.filter(
    ({ contract }) => contract === "GateTransition",
  );
  const eventTypes = new Set(
    gateCases.map(({ value }) => value?.event?.type).filter(Boolean),
  );

  assert.deepEqual([...eventTypes].sort(), [
    "cancel",
    "choose_payment",
    "choose_sponsor",
    "execute",
    "payment_succeeded",
    "reject",
    "resolve",
    "sponsor_granted",
    "start",
  ]);
  assert.ok(gateCases.every(({ targets }) => targets.join() === "frontend"));
  assert.ok(
    fixture.cases
      .filter(({ contract }) => contract !== "GateTransition")
      .every(
        ({ targets }) =>
          targets.length === 2 &&
          targets.includes("frontend") &&
          targets.includes("server"),
      ),
  );
});

test("production source does not import the test-only fixture", async () => {
  for (const app of ["frontend", "server", "facilitator"]) {
    const sourceDirectory = path.join(repositoryRoot, "apps", app, "src");
    for (const file of await listFiles(sourceDirectory)) {
      const source = await readFile(file, "utf8");
      assert.doesNotMatch(source, /test\/fixtures\/adgate-contracts/);
    }
  }
});
