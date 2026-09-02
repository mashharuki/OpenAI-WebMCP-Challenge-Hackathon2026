import { type FacilitatorEvmSigner, toFacilitatorEvmSigner } from "@x402/evm";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

export const createBaseSepoliaFacilitatorSigner = (
  privateKey: string,
  rpcUrl: string,
): FacilitatorEvmSigner => {
  let parsedRpcUrl: URL;
  try {
    parsedRpcUrl = new URL(rpcUrl);
  } catch {
    throw new Error("BASE_SEPOLIA_RPC_URL must be a valid http or https URL");
  }
  if (!["http:", "https:"].includes(parsedRpcUrl.protocol)) {
    throw new Error("BASE_SEPOLIA_RPC_URL must be a valid http or https URL");
  }
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const client = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(parsedRpcUrl.toString()),
  }).extend(publicActions);

  return toFacilitatorEvmSigner({
    address: account.address,
    getCode: (args) => client.getCode(args),
    readContract: (args) =>
      client.readContract(args as Parameters<typeof client.readContract>[0]),
    sendTransaction: (args) =>
      client.sendTransaction(
        args as Parameters<typeof client.sendTransaction>[0],
      ),
    verifyTypedData: (args) =>
      client.verifyTypedData(
        args as Parameters<typeof client.verifyTypedData>[0],
      ),
    waitForTransactionReceipt: (args) => client.waitForTransactionReceipt(args),
    writeContract: (args) =>
      client.writeContract(args as Parameters<typeof client.writeContract>[0]),
  });
};
