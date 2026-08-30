import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("publisher document shell", () => {
  it("identifies the publisher without legacy todo metadata", async () => {
    const documentShell = await readFile(
      resolve(process.cwd(), "index.html"),
      "utf8",
    );

    expect(documentShell).toContain(
      "<title>Open Table Journal · Premium Recipe Analysis</title>",
    );
    expect(documentShell).toContain(
      'content="Read the Roasted Chickpea Quinoa Bowl recipe and explore practical nutrition and ingredient insights."',
    );
    expect(documentShell).not.toMatch(/todo|starter/i);
  });
});
