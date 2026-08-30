import { createWalletClient, custom } from "viem";
import { describe, expect, it } from "vitest";
import { createMockEip1193Provider } from "./mockEip1193Provider";

const account = "0x0000000000000000000000000000000000000001";

describe("browser payment provider test harness", () => {
  it("records the viem wallet request sequence without a real wallet", async () => {
    const provider = createMockEip1193Provider({
      accounts: [account],
      chainId: "0x14a34",
    });
    const walletClient = createWalletClient({ transport: custom(provider) });

    await expect(walletClient.requestAddresses()).resolves.toEqual([account]);
    await expect(walletClient.getChainId()).resolves.toBe(84532);
    expect(provider.calls).toEqual([
      { method: "eth_requestAccounts", params: undefined },
      { method: "eth_chainId", params: undefined },
    ]);
  });
});
