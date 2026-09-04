import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
} from "@x402/core/http";
import type { PaymentRequired } from "@x402/core/types";
import { describe, expect, it, vi } from "vitest";
import type { PremiumAnalysisRequest } from "../../../src/adgate/contracts.js";
import {
  createChallengeClient,
  type PaymentRequirement,
} from "../../../src/adgate/payment/challenge.js";
import {
  ActivePaymentPanel,
  PaymentPanel,
} from "../../../src/adgate/payment/PaymentPanel.js";
import { createPaymentClient } from "../../../src/adgate/payment/paymentClient.js";
import {
  createPaymentCoordinator,
  type PaymentFlowState,
} from "../../../src/adgate/payment/paymentCoordinator.js";
import { createWalletAdapter } from "../../../src/adgate/payment/walletAdapter.js";
import { createMockEip1193Provider } from "../../payment/mockEip1193Provider.js";

const asset = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const payTo = "0x0000000000000000000000000000000000000001";
const transaction = `0x${"1".repeat(64)}`;
const request: PremiumAnalysisRequest = {
  requestId: "request-payment-panel",
  idempotencyKey: "idempotency-key-payment-panel",
  resourceId: "recipe_analysis",
  input: { recipeId: "roasted-chickpea-quinoa-bowl" },
};
const challenge = {
  x402Version: 2,
  resource: { url: "recipe_analysis" },
  accepts: [
    {
      scheme: "exact",
      network: "eip155:84532",
      asset,
      amount: "10000",
      payTo,
      maxTimeoutSeconds: 60,
      extra: { name: "USDC", version: "2" },
    },
  ],
} satisfies PaymentRequired;
const success = {
  ok: true as const,
  requestId: request.requestId,
  resourceId: "recipe_analysis" as const,
  access: { kind: "x402_payment" as const, referenceId: transaction },
  data: {
    summary: "Paid analysis.",
    nutritionalInsights: ["A paid insight."],
    suggestions: ["A paid suggestion."],
    disclaimer: "General information only.",
  },
};

const createHarness = ({
  includeSettlementHeader = true,
}: {
  includeSettlementHeader?: boolean;
} = {}) => {
  const httpCalls: Array<{ body: string | null; headers: Headers }> = [];
  const provider = createMockEip1193Provider({
    accounts: ["0x0000000000000000000000000000000000000002"],
    chainId: "0x14a34",
    signature: `0x${"3".repeat(130)}`,
  });
  const challengeClient = createChallengeClient({
    acceptedAsset: asset,
    endpoint: "/api/recipe-analysis",
    fetch: async (_input, init) => {
      httpCalls.push({
        body: typeof init?.body === "string" ? init.body : null,
        headers: new Headers(init?.headers),
      });
      return new Response(null, {
        status: 402,
        headers: {
          "Payment-Required": encodePaymentRequiredHeader(challenge),
        },
      });
    },
  });
  const paymentClient = createPaymentClient({
    challengeClient,
    endpoint: "/api/recipe-analysis",
    fetch: async (_input, init) => {
      httpCalls.push({
        body: typeof init?.body === "string" ? init.body : null,
        headers: new Headers(init?.headers),
      });
      return Response.json(success, {
        headers: includeSettlementHeader
          ? {
              "Payment-Response": encodePaymentResponseHeader({
                success: true,
                transaction,
                network: "eip155:84532",
                amount: "10000",
              }),
            }
          : undefined,
      });
    },
    now: () => new Date("2026-08-30T00:00:10.000Z"),
  });
  return {
    coordinator: createPaymentCoordinator({
      paymentClient,
      walletAdapter: createWalletAdapter(),
    }),
    httpCalls,
    provider,
  };
};

describe("PaymentPanel", () => {
  it("offers passkey wallet setup without starting a payment", async () => {
    const { coordinator } = createHarness();
    const continueWithPasskey = vi.fn(async () => undefined);
    render(
      <PaymentPanel
        coordinator={coordinator}
        request={request}
        privyAvailable
        privyReady
        continueWithPasskey={continueWithPasskey}
      />,
    );

    const passkey = await screen.findByRole("button", {
      name: "Continue with passkey",
    });
    fireEvent.click(passkey);

    await vi.waitFor(() => expect(continueWithPasskey).toHaveBeenCalledOnce());
    expect(
      screen.getByRole("button", { name: "Pay with Base Sepolia" }),
    ).toBeDisabled();
  });

  it("shows a Privy wallet address and Circle Faucet link for testnet funding", async () => {
    const { coordinator } = createHarness();
    const walletAddress = "0x0000000000000000000000000000000000000042";
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(
      <PaymentPanel
        coordinator={coordinator}
        request={request}
        walletAddress={walletAddress}
      />,
    );

    expect(await screen.findByText(walletAddress)).toBeVisible();
    expect(
      screen.getByRole("link", {
        name: "Open Circle Faucet for testnet USDC",
      }),
    ).toHaveAttribute("href", "https://faucet.circle.com/");

    fireEvent.click(
      screen.getByRole("button", { name: "Copy wallet address" }),
    );
    await vi.waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(walletAddress),
    );
    expect(
      await screen.findByRole("button", { name: "Address copied" }),
    ).toBeVisible();
  });

  it("observes a gate-owned attempt without starting or cancelling it", () => {
    const requestPaidAccess = vi.fn(() => new Promise<never>(() => undefined));
    const cancel = vi.fn();
    const paymentState: PaymentFlowState = {
      type: "reviewing" as const,
      attempt: {
        request,
        canonicalBody: JSON.stringify(request),
        challenge: {
          requestId: request.requestId,
          requirements: [
            {
              ...challenge.accepts[0],
              scheme: "exact",
              resource: "recipe_analysis",
              asset: asset as `0x${string}`,
              payTo: payTo as `0x${string}`,
              extra: { name: "USDC", version: "2" },
            } satisfies PaymentRequirement,
          ],
        },
      },
    };
    const coordinator = {
      requestPaidAccess,
      confirm: vi.fn(async () => undefined),
      cancel,
      getSnapshot: () => paymentState,
      subscribe: () => () => undefined,
    };

    const view = render(<ActivePaymentPanel coordinator={coordinator} />);

    expect(screen.getByText("0.01 USDC")).toBeVisible();
    expect(requestPaidAccess).not.toHaveBeenCalled();
    view.unmount();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("shows server terms before touching the wallet and confirms one payment", async () => {
    const { coordinator, httpCalls, provider } = createHarness();
    render(
      <PaymentPanel
        coordinator={coordinator}
        provider={provider}
        request={request}
      />,
    );

    expect(await screen.findByText("0.01 USDC")).toBeVisible();
    expect(screen.getByText("Base Sepolia")).toBeVisible();
    expect(screen.getByText(asset)).toBeVisible();
    expect(screen.getByText("0x0000…0001")).toBeVisible();
    expect(await screen.findByText("Wallet ready")).toBeVisible();
    expect(screen.getByText(/0x0000…0002/)).toBeVisible();
    expect(screen.getByText(/0.01 USDC available/)).toBeVisible();
    expect(
      provider.calls.some(({ method }) => method === "eth_requestAccounts"),
    ).toBe(false);
    expect(
      provider.calls.some(({ method }) => method === "eth_signTypedData_v4"),
    ).toBe(false);

    const confirm = screen.getByRole("button", {
      name: "Pay with Base Sepolia",
    });
    await vi.waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);

    expect(await screen.findByText("Payment confirmed")).toBeVisible();
    expect(screen.getByText("0x1111…1111")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "View Base Sepolia receipt" }),
    ).toHaveAttribute("href", `https://sepolia.basescan.org/tx/${transaction}`);
    expect(provider.calls.map(({ method }) => method)).toEqual([
      "eth_accounts",
      "eth_chainId",
      "eth_call",
      "eth_requestAccounts",
      "eth_chainId",
      "eth_chainId",
      "eth_signTypedData_v4",
    ]);
    expect(httpCalls).toHaveLength(2);
    expect(httpCalls[0]?.body).toBe(JSON.stringify(request));
    expect(httpCalls[1]?.body).toBe(JSON.stringify(request));
    expect(httpCalls[0]?.headers.get("Idempotency-Key")).toBe(
      request.idempotencyKey,
    );
    expect(httpCalls[1]?.headers.get("Idempotency-Key")).toBe(
      request.idempotencyKey,
    );
    expect(httpCalls[0]?.headers.has("Payment-Signature")).toBe(false);
    expect(httpCalls[1]?.headers.has("Payment-Signature")).toBe(true);
  });

  it("shows safe recovery actions after wallet rejection", async () => {
    const { coordinator } = createHarness();
    const rejectingProvider = {
      request: async ({ method }: { method: string }) => {
        if (method === "eth_accounts") return [];
        throw Object.assign(new Error("private provider details"), {
          code: 4001,
        });
      },
    } as never;
    render(
      <PaymentPanel
        coordinator={coordinator}
        provider={rejectingProvider}
        request={request}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Connect MetaMask",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The wallet request was rejected.",
    );
    expect(
      screen.queryByText("private provider details"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check again" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Use sponsor access" }),
    ).not.toBeInTheDocument();
  });

  it("disables duplicate confirmation while the wallet is connecting", async () => {
    let resolveAccounts: ((accounts: readonly string[]) => void) | undefined;
    const providerCalls: string[] = [];
    const provider = {
      request: async ({ method }: { method: string }) => {
        providerCalls.push(method);
        if (method === "eth_accounts") {
          return ["0x0000000000000000000000000000000000000002"];
        }
        if (method === "eth_requestAccounts") {
          return new Promise<readonly string[]>((resolve) => {
            resolveAccounts = resolve;
          });
        }
        if (method === "eth_chainId") return "0x14a34";
        if (method === "eth_call") return "0x2710";
        return `0x${"3".repeat(130)}`;
      },
    } as never;
    const { coordinator } = createHarness();
    render(
      <PaymentPanel
        coordinator={coordinator}
        provider={provider}
        request={request}
      />,
    );

    expect(await screen.findByText("Wallet ready")).toBeVisible();
    const confirm = screen.getByRole("button", {
      name: "Pay with Base Sepolia",
    });
    await vi.waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);
    const connecting = await screen.findByRole("button", {
      name: "Connecting wallet…",
    });
    expect(connecting).toBeDisabled();
    fireEvent.click(connecting);
    expect(providerCalls).toEqual([
      "eth_accounts",
      "eth_chainId",
      "eth_call",
      "eth_requestAccounts",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await act(async () => {
      resolveAccounts?.(["0x0000000000000000000000000000000000000002"]);
    });
    expect(await screen.findByText("Payment cancelled")).toBeVisible();
  });

  it("keeps the WebMCP route payment-only when MetaMask is absent", async () => {
    const { coordinator } = createHarness();
    render(<PaymentPanel coordinator={coordinator} request={request} />);

    expect(await screen.findByText("MetaMask is not available")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Pay with Base Sepolia" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Use sponsor access" }),
    ).not.toBeInTheDocument();
  });

  it("offers an explicit Base Sepolia switch and sanitizes rejection", async () => {
    const provider = {
      request: async ({ method }: { method: string }) => {
        if (method === "eth_accounts") {
          return ["0x0000000000000000000000000000000000000002"];
        }
        if (method === "eth_chainId") return "0x1";
        throw Object.assign(new Error("private switch rejection"), {
          code: 4001,
        });
      },
    } as never;
    const { coordinator } = createHarness();
    render(
      <PaymentPanel
        coordinator={coordinator}
        provider={provider}
        request={request}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Switch network" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The wallet request was rejected.",
    );
    expect(
      screen.queryByText("private switch rejection"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Payment confirmed")).not.toBeInTheDocument();
  });

  it("shows the connected balance and blocks payment when USDC is insufficient", async () => {
    const provider = createMockEip1193Provider({
      accounts: ["0x0000000000000000000000000000000000000002"],
      chainId: "0x14a34",
      tokenBalance: "0x0",
    });
    const { coordinator } = createHarness();
    render(
      <PaymentPanel
        coordinator={coordinator}
        provider={provider}
        request={request}
      />,
    );

    expect(
      await screen.findByText("Insufficient Base Sepolia USDC"),
    ).toBeVisible();
    expect(screen.getByText(/0 USDC available/)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Pay with Base Sepolia" }),
    ).toBeDisabled();
  });

  it("keeps uncertain settlement recoverable without automatic re-signing", async () => {
    const { coordinator, provider } = createHarness({
      includeSettlementHeader: false,
    });
    render(
      <PaymentPanel
        coordinator={coordinator}
        provider={provider}
        request={request}
      />,
    );
    expect(await screen.findByText("Wallet ready")).toBeVisible();
    const confirm = screen.getByRole("button", {
      name: "Pay with Base Sepolia",
    });
    await vi.waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The settlement result is uncertain.",
    );
    expect(
      provider.calls.filter(({ method }) => method === "eth_signTypedData_v4"),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("button", {
        name: "Pay with Base Sepolia",
      }),
    ).toBeVisible();
    expect(
      provider.calls.filter(({ method }) => method === "eth_signTypedData_v4"),
    ).toHaveLength(1);
  });
});
