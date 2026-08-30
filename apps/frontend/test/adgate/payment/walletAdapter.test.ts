import { describe, expect, it } from "vitest";
import { createWalletAdapter } from "../../../src/adgate/payment/walletAdapter.js";
import { createMockEip1193Provider } from "../../payment/mockEip1193Provider.js";

const account = "0x0000000000000000000000000000000000000001";
const requirement = {
  scheme: "exact" as const,
  network: "eip155:84532" as const,
  amount: "10000",
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const,
  payTo: "0x0000000000000000000000000000000000000002" as const,
  maxTimeoutSeconds: 60,
  resource: "recipe_analysis" as const,
  extra: { name: "USDC" as const, version: "2" as const },
};

describe("WalletAdapter", () => {
  it("touches the provider only after approval and signs only on Base Sepolia", async () => {
    const provider = createMockEip1193Provider({
      accounts: [account],
      chainId: "0x1",
      switchChainId: "0x14a34",
      signature: `0x${"3".repeat(130)}`,
    });
    const adapter = createWalletAdapter();

    expect(provider.calls).toEqual([]);
    await expect(adapter.prepareForPayment(provider)).resolves.toEqual({
      ok: true,
      account,
      chainId: 84532,
    });
    expect(provider.calls.map(({ method }) => method)).toEqual([
      "eth_requestAccounts",
      "eth_chainId",
      "wallet_switchEthereumChain",
      "eth_chainId",
    ]);

    const signed = await adapter.signPayment({
      provider,
      account,
      requirement,
    });

    expect(signed).toEqual({ signatureHeader: expect.any(String) });
    expect(provider.calls.map(({ method }) => method)).toEqual([
      "eth_requestAccounts",
      "eth_chainId",
      "wallet_switchEthereumChain",
      "eth_chainId",
      "eth_chainId",
      "eth_signTypedData_v4",
    ]);
    const signCall = provider.calls.find(
      ({ method }) => method === "eth_signTypedData_v4",
    );
    const serializedTypedData = JSON.parse(
      (signCall?.params as [string, string] | undefined)?.[1] ?? "null",
    );
    expect(serializedTypedData.types.EIP712Domain).toEqual([
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
    ]);
  });

  it("returns a safe error when no injected provider exists", async () => {
    const adapter = createWalletAdapter();

    await expect(adapter.prepareForPayment(undefined)).resolves.toEqual({
      ok: false,
      error: {
        code: "ACCESS_REQUIRED",
        message: "An injected wallet is required.",
        retryable: false,
      },
    });
  });

  it("normalizes wallet rejection without exposing provider details", async () => {
    const provider = {
      request: async () => {
        throw Object.assign(new Error("secret provider response"), {
          code: 4001,
        });
      },
    } as unknown as Parameters<
      ReturnType<typeof createWalletAdapter>["prepareForPayment"]
    >[0];

    await expect(
      createWalletAdapter().prepareForPayment(provider),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "CANCELLED",
        message: "The wallet request was rejected.",
        retryable: false,
      },
    });
  });
});
