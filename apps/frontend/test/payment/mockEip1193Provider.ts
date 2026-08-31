import {
  type Address,
  type EIP1193Provider,
  EIP1193ProviderRpcError,
  type EIP1193RequestFn,
  type Hex,
} from "viem";

export type RecordedProviderCall = {
  method: string;
  params: unknown;
};

export type MockEip1193Provider = EIP1193Provider & {
  readonly calls: readonly RecordedProviderCall[];
};

export const createMockEip1193Provider = (options: {
  accounts: readonly Address[];
  chainId: Hex;
  signature?: Hex;
  switchChainId?: Hex;
  tokenBalance?: Hex;
}): MockEip1193Provider => {
  const calls: RecordedProviderCall[] = [];
  let chainId = options.chainId;
  const request = (async ({ method, params }) => {
    calls.push({ method, params });

    if (method === "eth_requestAccounts") return [...options.accounts];
    if (method === "eth_accounts") return [...options.accounts];
    if (method === "eth_chainId") return chainId;
    if (method === "eth_call") return options.tokenBalance ?? "0x2710";
    if (method === "wallet_switchEthereumChain" && options.switchChainId) {
      chainId = options.switchChainId;
      return null;
    }
    if (method === "eth_signTypedData_v4" && options.signature) {
      return options.signature;
    }

    throw new EIP1193ProviderRpcError(
      4200,
      `Unsupported mock provider method: ${method}`,
    );
  }) as EIP1193RequestFn;

  return {
    calls,
    on: () => undefined,
    removeListener: () => undefined,
    request,
  };
};
