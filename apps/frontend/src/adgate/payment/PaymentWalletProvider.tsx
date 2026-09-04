import {
  type ConnectedWallet,
  useCreateWallet,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Eip1193ProviderPort } from "./walletAdapter";

const BASE_SEPOLIA_CHAIN_ID = 84532;

export type PaymentWalletSource = "browser" | "privy";

export interface PaymentWalletContextValue {
  readonly provider?: Eip1193ProviderPort;
  readonly source?: PaymentWalletSource;
  readonly label: string;
  readonly walletAddress?: string;
  readonly browserWalletAvailable: boolean;
  readonly privyAvailable: boolean;
  readonly privyReady: boolean;
  readonly connectBrowserWallet: () => void;
  readonly continueWithPasskey: () => Promise<void>;
}

const PaymentWalletContext = createContext<
  PaymentWalletContextValue | undefined
>(undefined);

const isPrivyEmbeddedEthereumWallet = (wallet: ConnectedWallet): boolean =>
  wallet.type === "ethereum" &&
  (wallet.walletClientType === "privy" ||
    wallet.walletClientType === "privy-v2");

function BrowserWalletProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const provider = window.ethereum as Eip1193ProviderPort | undefined;
  const value: PaymentWalletContextValue = {
    provider,
    source: provider ? "browser" : undefined,
    label: "browser wallet",
    walletAddress: undefined,
    browserWalletAvailable: Boolean(provider),
    privyAvailable: false,
    privyReady: false,
    connectBrowserWallet: () => undefined,
    continueWithPasskey: async () => undefined,
  };
  return (
    <PaymentWalletContext.Provider value={value}>
      {children}
    </PaymentWalletContext.Provider>
  );
}

export function PrivyPaymentWalletProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const browserProvider = window.ethereum as Eip1193ProviderPort | undefined;
  const { authenticated, login, ready: privyReady } = usePrivy();
  const { createWallet } = useCreateWallet();
  const { ready: walletsReady, wallets } = useWallets();
  const [source, setSource] = useState<PaymentWalletSource | undefined>(
    browserProvider ? "browser" : undefined,
  );
  const [privyProvider, setPrivyProvider] = useState<Eip1193ProviderPort>();
  const embeddedWallet = wallets.find(isPrivyEmbeddedEthereumWallet);

  useEffect(() => {
    let cancelled = false;
    const refreshProvider = async () => {
      if (!embeddedWallet) {
        if (!cancelled) setPrivyProvider(undefined);
        return;
      }
      await embeddedWallet.switchChain(BASE_SEPOLIA_CHAIN_ID);
      const provider = await embeddedWallet.getEthereumProvider();
      if (!cancelled) setPrivyProvider(provider as Eip1193ProviderPort);
    };
    void refreshProvider().catch(() => {
      if (!cancelled) setPrivyProvider(undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [embeddedWallet]);

  const continueWithPasskey = useCallback(async () => {
    setSource("privy");
    if (!privyReady) return;
    if (!authenticated) {
      login({ loginMethods: ["passkey"] });
      return;
    }
    if (!embeddedWallet) await createWallet();
  }, [authenticated, createWallet, embeddedWallet, login, privyReady]);

  const value: PaymentWalletContextValue = {
    provider: source === "privy" ? privyProvider : browserProvider,
    source,
    label: source === "privy" ? "Privy passkey wallet" : "browser wallet",
    walletAddress: source === "privy" ? embeddedWallet?.address : undefined,
    browserWalletAvailable: Boolean(browserProvider),
    privyAvailable: true,
    privyReady: privyReady && walletsReady,
    connectBrowserWallet: () => setSource("browser"),
    continueWithPasskey,
  };

  return (
    <PaymentWalletContext.Provider value={value}>
      {children}
    </PaymentWalletContext.Provider>
  );
}

export { BrowserWalletProvider };

export function usePaymentWallet(): PaymentWalletContextValue {
  const value = useContext(PaymentWalletContext);
  if (!value)
    throw new Error("usePaymentWallet must be used within a wallet provider.");
  return value;
}
