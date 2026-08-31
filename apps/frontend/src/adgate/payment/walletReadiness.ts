import type { AdGateError } from "../contracts.js";
import type { PaymentRequirement } from "./challenge.js";
import type { Eip1193ProviderPort } from "./walletAdapter.js";

export const BASE_SEPOLIA_CHAIN_ID = 84532 as const;
export const BASE_SEPOLIA_HEX_CHAIN_ID = "0x14a34" as const;

export type WalletReadiness =
  | { readonly type: "unavailable" }
  | { readonly type: "disconnected" }
  | {
      readonly type: "wrong_network";
      readonly account: `0x${string}`;
      readonly chainId: number;
    }
  | {
      readonly type: "insufficient";
      readonly account: `0x${string}`;
      readonly chainId: typeof BASE_SEPOLIA_CHAIN_ID;
      readonly balance: string;
    }
  | {
      readonly type: "ready";
      readonly account: `0x${string}`;
      readonly chainId: typeof BASE_SEPOLIA_CHAIN_ID;
      readonly balance: string;
    }
  | { readonly type: "failed"; readonly error: AdGateError };

export type WalletReadinessAction =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: AdGateError };

const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const hexPattern = /^0x[0-9a-fA-F]*$/;
const balanceOfSelector = "70a08231";

const dependencyError = (): WalletReadiness => ({
  type: "failed",
  error: {
    code: "DEPENDENCY_UNAVAILABLE",
    message: "Wallet status could not be checked. Try again.",
    retryable: true,
  },
});

const actionError = (error: unknown): WalletReadinessAction => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  return {
    ok: false,
    error:
      code === 4001
        ? {
            code: "CANCELLED",
            message: "The wallet request was rejected.",
            retryable: true,
          }
        : {
            code: "DEPENDENCY_UNAVAILABLE",
            message: "The wallet could not complete the request.",
            retryable: true,
          },
  };
};

const readChainId = async (provider: Eip1193ProviderPort): Promise<number> => {
  const value = await provider.request({ method: "eth_chainId" });
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new Error("Invalid chain ID");
  }
  return Number.parseInt(value, 16);
};

const readTokenBalance = async (
  provider: Eip1193ProviderPort,
  asset: `0x${string}`,
  account: `0x${string}`,
): Promise<bigint> => {
  const data =
    `0x${balanceOfSelector}${account.slice(2).padStart(64, "0")}` as `0x${string}`;
  const value = await provider.request({
    method: "eth_call",
    params: [{ to: asset, data }, "latest"],
  });
  if (typeof value !== "string" || !hexPattern.test(value)) {
    throw new Error("Invalid token balance");
  }
  return BigInt(value === "0x" ? "0x0" : value);
};

export const inspectWalletReadiness = async (
  provider: Eip1193ProviderPort | undefined,
  requirement: PaymentRequirement,
): Promise<WalletReadiness> => {
  if (!provider) return { type: "unavailable" };

  try {
    const accounts = await provider.request({ method: "eth_accounts" });
    if (!Array.isArray(accounts) || accounts.length === 0) {
      return { type: "disconnected" };
    }
    const account = accounts[0];
    if (typeof account !== "string" || !addressPattern.test(account)) {
      return dependencyError();
    }

    const chainId = await readChainId(provider);
    if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
      return {
        type: "wrong_network",
        account: account as `0x${string}`,
        chainId,
      };
    }

    const balance = await readTokenBalance(
      provider,
      requirement.asset,
      account as `0x${string}`,
    );
    const details = {
      account: account as `0x${string}`,
      chainId: BASE_SEPOLIA_CHAIN_ID,
      balance: balance.toString(),
    };
    return balance < BigInt(requirement.amount)
      ? { type: "insufficient", ...details }
      : { type: "ready", ...details };
  } catch {
    return dependencyError();
  }
};

export const requestWalletConnection = async (
  provider: Eip1193ProviderPort,
): Promise<WalletReadinessAction> => {
  try {
    await provider.request({ method: "eth_requestAccounts" });
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
};

export const switchWalletToBaseSepolia = async (
  provider: Eip1193ProviderPort,
): Promise<WalletReadinessAction> => {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BASE_SEPOLIA_HEX_CHAIN_ID }],
    });
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
};
