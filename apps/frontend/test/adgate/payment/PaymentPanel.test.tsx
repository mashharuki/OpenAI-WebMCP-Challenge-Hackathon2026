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
    expect(provider.calls).toEqual([]);

    fireEvent.click(
      screen.getByRole("button", { name: "Confirm 0.01 USDC payment" }),
    );

    expect(await screen.findByText("Payment confirmed")).toBeVisible();
    expect(screen.getByText("0x1111…1111")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "View Base Sepolia receipt" }),
    ).toHaveAttribute("href", `https://sepolia.basescan.org/tx/${transaction}`);
    expect(provider.calls.map(({ method }) => method)).toEqual([
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
    const returnToSponsor = vi.fn();
    const { coordinator } = createHarness();
    const rejectingProvider = {
      request: async () => {
        throw Object.assign(new Error("private provider details"), {
          code: 4001,
        });
      },
    } as never;
    render(
      <PaymentPanel
        coordinator={coordinator}
        onReturnToSponsor={returnToSponsor}
        provider={rejectingProvider}
        request={request}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Confirm 0.01 USDC payment",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The wallet request was rejected.",
    );
    expect(
      screen.queryByText("private provider details"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Use sponsor access" }));
    expect(returnToSponsor).toHaveBeenCalledOnce();
  });

  it("disables duplicate confirmation while the wallet is connecting", async () => {
    let resolveAccounts: ((accounts: readonly string[]) => void) | undefined;
    const providerCalls: string[] = [];
    const provider = {
      request: async ({ method }: { method: string }) => {
        providerCalls.push(method);
        if (method === "eth_requestAccounts") {
          return new Promise<readonly string[]>((resolve) => {
            resolveAccounts = resolve;
          });
        }
        if (method === "eth_chainId") return "0x14a34";
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

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Confirm 0.01 USDC payment",
      }),
    );
    const connecting = await screen.findByRole("button", {
      name: "Connecting wallet…",
    });
    expect(connecting).toBeDisabled();
    fireEvent.click(connecting);
    expect(providerCalls).toEqual(["eth_requestAccounts"]);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await act(async () => {
      resolveAccounts?.(["0x0000000000000000000000000000000000000002"]);
    });
    expect(await screen.findByText("Payment cancelled")).toBeVisible();
  });

  it.each([
    ["wallet absence", undefined, "An injected wallet is required."],
    [
      "network switch rejection",
      {
        request: async ({ method }: { method: string }) => {
          if (method === "eth_requestAccounts") {
            return ["0x0000000000000000000000000000000000000002"];
          }
          if (method === "eth_chainId") return "0x1";
          throw Object.assign(new Error("private switch rejection"), {
            code: 4001,
          });
        },
      },
      "The wallet request was rejected.",
    ],
    [
      "insufficient funds",
      {
        request: async ({ method }: { method: string }) => {
          if (method === "eth_requestAccounts") {
            return ["0x0000000000000000000000000000000000000002"];
          }
          if (method === "eth_chainId") return "0x14a34";
          throw new Error("insufficient funds; private balance response");
        },
      },
      "The wallet has insufficient funds or allowance.",
    ],
  ])("recovers safely from %s", async (_name, unsafeProvider, message) => {
    const { coordinator } = createHarness();
    render(
      <PaymentPanel
        coordinator={coordinator}
        provider={unsafeProvider as never}
        request={request}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Confirm 0.01 USDC payment",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText(/private/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Payment confirmed")).not.toBeInTheDocument();
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
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Confirm 0.01 USDC payment",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The settlement result is uncertain.",
    );
    expect(
      provider.calls.filter(({ method }) => method === "eth_signTypedData_v4"),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("button", {
        name: "Confirm 0.01 USDC payment",
      }),
    ).toBeVisible();
    expect(
      provider.calls.filter(({ method }) => method === "eth_signTypedData_v4"),
    ).toHaveLength(1);
  });
});
