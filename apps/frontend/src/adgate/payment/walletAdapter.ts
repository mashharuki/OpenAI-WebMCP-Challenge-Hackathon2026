import { encodePaymentSignatureHeader } from "@x402/core/http";
import type { PaymentRequirements } from "@x402/core/types";
import type { ClientEvmSigner } from "@x402/evm";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { type EIP1193Provider, getTypesForEIP712Domain } from "viem";
import type { AdGateError } from "../contracts.js";
import type { PaymentRequirement } from "./challenge.js";

const BASE_SEPOLIA_CHAIN_ID = 84532;
const BASE_SEPOLIA_HEX_CHAIN_ID = "0x14a34";
const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const hexPattern = /^0x[0-9a-fA-F]+$/;

export type Eip1193ProviderPort = Pick<EIP1193Provider, "request"> & {
  on?: (
    event: "accountsChanged" | "chainChanged",
    listener: (...args: unknown[]) => void,
  ) => void;
  removeListener?: (
    event: "accountsChanged" | "chainChanged",
    listener: (...args: unknown[]) => void,
  ) => void;
};

export type WalletPreparation =
  | { ok: true; account: `0x${string}`; chainId: 84532 }
  | { ok: false; error: AdGateError };

export interface WalletAdapter {
  prepareForPayment(provider?: Eip1193ProviderPort): Promise<WalletPreparation>;
  signPayment(input: {
    provider: Eip1193ProviderPort;
    account: `0x${string}`;
    requirement: PaymentRequirement;
  }): Promise<{ signatureHeader: string } | { error: AdGateError }>;
}

const safeProviderError = (error: unknown): AdGateError => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  if (code === 4001) {
    return {
      code: "CANCELLED",
      message: "The wallet request was rejected.",
      retryable: false,
    };
  }
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message).toLowerCase()
      : "";
  if (message.includes("insufficient") || message.includes("allowance")) {
    return {
      code: "ACCESS_REQUIRED",
      message: "The wallet has insufficient funds or allowance.",
      retryable: false,
    };
  }
  return {
    code: "DEPENDENCY_UNAVAILABLE",
    message: "The wallet could not complete the request.",
    retryable: true,
  };
};

const readChainId = async (provider: Eip1193ProviderPort): Promise<number> => {
  const value = await provider.request({ method: "eth_chainId" });
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new Error("Invalid chain ID");
  }
  return Number.parseInt(value, 16);
};

const createSigner = (
  provider: Eip1193ProviderPort,
  account: `0x${string}`,
): ClientEvmSigner => ({
  address: account,
  async signTypedData(message) {
    const typedData = {
      ...message,
      types: {
        EIP712Domain: getTypesForEIP712Domain({ domain: message.domain }),
        ...message.types,
      },
    };
    const signature = await provider.request({
      method: "eth_signTypedData_v4",
      params: [
        account,
        JSON.stringify(typedData, (_key, value) =>
          typeof value === "bigint" ? value.toString() : value,
        ),
      ],
    });
    if (typeof signature !== "string" || !hexPattern.test(signature)) {
      throw new Error("Invalid wallet signature");
    }
    return signature as `0x${string}`;
  },
});

export const createWalletAdapter = (): WalletAdapter => ({
  async prepareForPayment(provider) {
    if (!provider) {
      return {
        ok: false,
        error: {
          code: "ACCESS_REQUIRED",
          message: "An injected wallet is required.",
          retryable: false,
        },
      };
    }

    try {
      const accounts = await provider.request({
        method: "eth_requestAccounts",
      });
      if (
        !Array.isArray(accounts) ||
        typeof accounts[0] !== "string" ||
        !addressPattern.test(accounts[0])
      ) {
        return {
          ok: false,
          error: {
            code: "ACCESS_REQUIRED",
            message: "A wallet account must be connected.",
            retryable: false,
          },
        };
      }

      let chainId = await readChainId(provider);
      if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: BASE_SEPOLIA_HEX_CHAIN_ID }],
        });
        chainId = await readChainId(provider);
      }
      if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
        return {
          ok: false,
          error: {
            code: "INVALID_EVIDENCE",
            message: "The wallet must be connected to Base Sepolia.",
            retryable: false,
          },
        };
      }

      return {
        ok: true,
        account: accounts[0] as `0x${string}`,
        chainId: BASE_SEPOLIA_CHAIN_ID,
      };
    } catch (error) {
      return { ok: false, error: safeProviderError(error) };
    }
  },

  async signPayment({ provider, account, requirement }) {
    try {
      if ((await readChainId(provider)) !== BASE_SEPOLIA_CHAIN_ID) {
        return {
          error: {
            code: "INVALID_EVIDENCE",
            message: "The wallet must be connected to Base Sepolia.",
            retryable: false,
          },
        };
      }
      const accepted: PaymentRequirements = {
        scheme: requirement.scheme,
        network: requirement.network,
        asset: requirement.asset,
        amount: requirement.amount,
        payTo: requirement.payTo,
        maxTimeoutSeconds: requirement.maxTimeoutSeconds,
        extra: requirement.extra,
      };
      const payload = await new ExactEvmScheme(
        createSigner(provider, account),
      ).createPaymentPayload(2, accepted);
      return {
        signatureHeader: encodePaymentSignatureHeader({
          x402Version: payload.x402Version,
          accepted,
          payload: payload.payload,
          ...(payload.extensions ? { extensions: payload.extensions } : {}),
        }),
      };
    } catch (error) {
      return { error: safeProviderError(error) };
    }
  },
});
