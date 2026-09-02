import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createBaseSepoliaFacilitatorSigner } from "../src/viem.js";

const privateKey = `0x${"11".repeat(32)}`;
const contractAddress = "0x0000000000000000000000000000000000000001";

describe("Base Sepolia facilitator signer", () => {
  const servers: ReturnType<typeof createServer>[] = [];

  afterEach(async () => {
    await Promise.all(
      servers
        .splice(0)
        .map(
          (server) =>
            new Promise<void>((resolve, reject) =>
              server.close((error) => (error ? reject(error) : resolve())),
            ),
        ),
    );
  });

  it("rejects an invalid RPC URL without exposing its value", () => {
    expect(() =>
      createBaseSepoliaFacilitatorSigner(
        privateKey,
        "not-a-url-with-provider-secret",
      ),
    ).toThrow("BASE_SEPOLIA_RPC_URL must be a valid http or https URL");
  });

  it("sends chain reads to the configured RPC URL", async () => {
    const methods: string[] = [];
    const server = createServer((request, response) => {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        methods.push(JSON.parse(body).method);
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x" }));
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected a TCP test server address");
    }

    const signer = createBaseSepoliaFacilitatorSigner(
      privateKey,
      `http://127.0.0.1:${address.port}`,
    );

    await expect(signer.getCode({ address: contractAddress })).resolves.toBe(
      undefined,
    );
    expect(methods).toEqual(["eth_getCode"]);
  });
});
