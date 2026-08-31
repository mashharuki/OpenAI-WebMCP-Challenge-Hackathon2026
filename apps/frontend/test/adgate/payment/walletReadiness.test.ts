import { describe, expect, it } from "vitest";
import type { PaymentRequirement } from "../../../src/adgate/payment/challenge";
import {
  inspectWalletReadiness,
  requestWalletConnection,
  switchWalletToBaseSepolia,
} from "../../../src/adgate/payment/walletReadiness";

const account = "0x0000000000000000000000000000000000000002";
const requirement = {
  scheme: "exact",
  network: "eip155:84532",
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  amount: "10000",
  payTo: "0x0000000000000000000000000000000000000001",
  maxTimeoutSeconds: 60,
  resource: "recipe_analysis",
  extra: { name: "USDC", version: "2" },
} satisfies PaymentRequirement;

describe("inspectWalletReadiness", () => {
  it("reports a connected Base Sepolia wallet with enough USDC as ready", async () => {
    const calls: string[] = [];
    const provider = {
      request: async ({ method }: { method: string }) => {
        calls.push(method);
        if (method === "eth_accounts") return [account];
        if (method === "eth_chainId") return "0x14a34";
        if (method === "eth_call") return "0x2710";
        throw new Error(`Unexpected method: ${method}`);
      },
    } as never;

    await expect(
      inspectWalletReadiness(provider, requirement),
    ).resolves.toEqual({
      type: "ready",
      account,
      chainId: 84532,
      balance: "10000",
    });
    expect(calls).toEqual(["eth_accounts", "eth_chainId", "eth_call"]);
  });

  it.each([
    [undefined, { type: "unavailable" }],
    [
      {
        request: async ({ method }: { method: string }) => {
          if (method === "eth_accounts") return [];
          throw new Error("Unexpected method");
        },
      },
      { type: "disconnected" },
    ],
    [
      {
        request: async ({ method }: { method: string }) => {
          if (method === "eth_accounts") return [account];
          if (method === "eth_chainId") return "0x1";
          throw new Error("Unexpected method");
        },
      },
      { type: "wrong_network", account, chainId: 1 },
    ],
    [
      {
        request: async ({ method }: { method: string }) => {
          if (method === "eth_accounts") return [account];
          if (method === "eth_chainId") return "0x14a34";
          if (method === "eth_call") return "0x270f";
          throw new Error("Unexpected method");
        },
      },
      { type: "insufficient", account, chainId: 84532, balance: "9999" },
    ],
  ])("reports a safe non-ready wallet state", async (provider, expected) => {
    await expect(
      inspectWalletReadiness(provider as never, requirement),
    ).resolves.toEqual(expected);
  });

  it("keeps connection and chain switching explicit and sanitizes rejection", async () => {
    const calls: string[] = [];
    const provider = {
      request: async ({ method }: { method: string }) => {
        calls.push(method);
        if (method === "eth_requestAccounts") return [account];
        throw Object.assign(new Error("private provider details"), {
          code: 4001,
        });
      },
    } as never;

    await expect(requestWalletConnection(provider)).resolves.toEqual({
      ok: true,
    });
    await expect(switchWalletToBaseSepolia(provider)).resolves.toMatchObject({
      ok: false,
      error: {
        code: "CANCELLED",
        message: "The wallet request was rejected.",
      },
    });
    expect(calls).toEqual([
      "eth_requestAccounts",
      "wallet_switchEthereumChain",
    ]);
  });
});
