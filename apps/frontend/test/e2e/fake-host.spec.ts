import { expect, type Page, type Route, test } from "@playwright/test";
import {
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
} from "@x402/core/http";
import type { PaymentRequired } from "@x402/core/types";

type HostMode =
  | "document-first"
  | "navigator-only"
  | "unsupported"
  | "registration-failure";

type RequestBody = {
  requestId: string;
  resourceId: "recipe_analysis";
  idempotencyKey: string;
  input: { recipeId: "roasted-chickpea-quinoa-bowl" };
};

const analysis = {
  summary: "A balanced plant-forward bowl.",
  nutritionalInsights: ["Chickpeas provide fiber."],
  suggestions: ["Add pumpkin seeds for crunch."],
  disclaimer: "This is general information, not medical advice.",
};
const sessionCredential = "s".repeat(43);
const sponsorToken = "t".repeat(43);
const asset = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const payTo = "0x0000000000000000000000000000000000000001";
const transaction = `0x${"1".repeat(64)}`;
const paymentChallenge = {
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

const installFakeHost = async (
  page: Page,
  mode: HostMode,
  options: { wallet?: boolean; repeatedIdentity?: boolean } = {},
) => {
  await page.addInitScript(
    ({ selectedMode, wallet, repeatedIdentity }) => {
      type Tool = {
        execute(
          input: unknown,
          context: { signal: AbortSignal },
        ): Promise<unknown>;
      };
      const state = {
        selectedSource: undefined as "document" | "navigator" | undefined,
        registrationSignalAborted: false,
        invocationSettled: false,
        settleCount: 0,
        invocationResult: undefined as unknown,
        duplicateResult: undefined as unknown,
        tool: undefined as Tool | undefined,
        controller: undefined as AbortController | undefined,
        startInvocation() {
          if (!this.tool) throw new Error("Tool is not registered.");
          this.controller = new AbortController();
          this.invocationSettled = false;
          this.invocationResult = undefined;
          void this.tool
            .execute(
              { recipeId: "roasted-chickpea-quinoa-bowl" },
              { signal: this.controller.signal },
            )
            .then((result) => {
              this.invocationResult = result;
              this.invocationSettled = true;
              this.settleCount += 1;
            });
        },
        async invokeDuplicate() {
          if (!this.tool) throw new Error("Tool is not registered.");
          this.duplicateResult = await this.tool.execute(
            { recipeId: "roasted-chickpea-quinoa-bowl" },
            { signal: new AbortController().signal },
          );
        },
        abortInvocation() {
          this.controller?.abort();
        },
      };
      Object.defineProperty(globalThis, "__fakeWebMCP", {
        configurable: true,
        value: state,
      });

      if (repeatedIdentity) {
        let index = 0;
        const identities = [
          "11111111-1111-4111-8111-111111111111",
          "22222222-2222-4222-8222-222222222222",
          "33333333-3333-4333-8333-333333333333",
          "22222222-2222-4222-8222-222222222222",
        ];
        Object.defineProperty(crypto, "randomUUID", {
          configurable: true,
          value: () => identities[index++ % identities.length],
        });
      }

      if (wallet) {
        Object.defineProperty(globalThis, "ethereum", {
          configurable: true,
          value: {
            async request({ method }: { method: string }) {
              if (method === "eth_requestAccounts") {
                return ["0x0000000000000000000000000000000000000002"];
              }
              if (method === "eth_accounts") {
                return ["0x0000000000000000000000000000000000000002"];
              }
              if (method === "eth_chainId") return "0x14a34";
              if (method === "eth_call") return "0x2710";
              if (method === "eth_signTypedData_v4") {
                return `0x${"3".repeat(130)}`;
              }
              throw new Error(`Unexpected wallet method: ${method}`);
            },
          },
        });
      }

      if (selectedMode === "unsupported") return;
      const createContext = (source: "document" | "navigator") => ({
        async registerTool(
          tool: Tool,
          registration?: { signal?: AbortSignal },
        ) {
          if (selectedMode === "registration-failure") {
            throw new DOMException("private host detail", "SecurityError");
          }
          state.selectedSource = source;
          state.tool = tool;
          registration?.signal?.addEventListener(
            "abort",
            () => {
              state.registrationSignalAborted = true;
            },
            { once: true },
          );
        },
      });

      if (
        selectedMode === "document-first" ||
        selectedMode === "registration-failure"
      ) {
        Object.defineProperty(document, "modelContext", {
          configurable: true,
          value: createContext("document"),
        });
      }
      if (
        selectedMode === "document-first" ||
        selectedMode === "navigator-only"
      ) {
        Object.defineProperty(navigator, "modelContext", {
          configurable: true,
          value: createContext("navigator"),
        });
      }
    },
    { selectedMode: mode, ...options },
  );
};

const fakeState = async <Value>(page: Page, property: string) =>
  page.evaluate(
    (name) =>
      Reflect.get(
        (globalThis as typeof globalThis & { __fakeWebMCP: object })
          .__fakeWebMCP,
        name,
      ) as Value,
    property,
  );

const callFakeState = async (page: Page, method: string) =>
  page.evaluate((name) => {
    const state = (
      globalThis as typeof globalThis & {
        __fakeWebMCP: Record<string, () => unknown>;
      }
    ).__fakeWebMCP;
    return state[name]?.call(state);
  }, method);

const readRequest = (route: Route): RequestBody =>
  route.request().postDataJSON() as RequestBody;

const fulfillSponsorSession = async (route: Route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      sessionCredential,
      sponsor: {
        id: "open-table-weekly",
        name: "Open Table Weekly",
        creativeKey: "weekly-static-v1",
      },
      requiredMs: 8_000,
      expiresAt: "2026-08-30T00:01:30.000Z",
    }),
  });
};

const fulfillSponsorGrant = async (route: Route, nonce: string) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      token: sponsorToken,
      evidence: {
        kind: "sponsor_grant",
        grantId: "grant-browser-1",
        resourceId: "recipe_analysis",
        issuedAt: "2026-08-30T00:00:00.000Z",
        expiresAt: "2026-08-30T00:01:00.000Z",
        nonce,
      },
    }),
  });
};

const sponsorSuccess = (request: RequestBody) => ({
  ok: true,
  requestId: request.requestId,
  resourceId: "recipe_analysis",
  access: { kind: "sponsor_grant", referenceId: "grant-browser-1" },
  data: analysis,
});

const completeSponsorView = async (page: Page) => {
  await page.getByRole("button", { name: "Use sponsor access" }).click();
  await page.getByRole("button", { name: "Start sponsor view" }).click();
  await expect(page.getByText("Sponsored message")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Seasonal Pantry Box" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /seasonal pantry box/i }),
  ).toBeVisible();
  const continueButton = page.getByRole("button", {
    name: "Continue to recipe analysis",
  });
  await expect(continueButton).toBeDisabled();
  await page.clock.fastForward(7_000);
  await expect(continueButton).toBeDisabled();
  await page.clock.fastForward(1_250);
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
};

test.describe("fake WebMCP host modes", () => {
  test("prefers the current document namespace", async ({ page }) => {
    await installFakeHost(page, "document-first");
    await page.goto("/");

    await expect(
      page.getByText("WebMCP tool ready via document."),
    ).toBeVisible();
    await expect.poll(() => fakeState(page, "selectedSource")).toBe("document");
  });

  test("falls back to the navigator namespace", async ({ page }) => {
    await installFakeHost(page, "navigator-only");
    await page.goto("/");

    await expect(
      page.getByText("WebMCP tool ready via navigator."),
    ).toBeVisible();
  });

  test("keeps on-page analysis available without WebMCP", async ({ page }) => {
    await installFakeHost(page, "unsupported");
    await page.goto("/");

    await expect(
      page.getByText(
        "WebMCP is not available in this browser. On-page analysis still works.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Analyze this recipe" }),
    ).toBeEnabled();
  });

  test("shows a safe registration failure", async ({ page }) => {
    await installFakeHost(page, "registration-failure");
    await page.goto("/");

    await expect(
      page.getByText("WebMCP tool registration is unavailable."),
    ).toBeVisible();
    await expect(page.getByText("private host detail")).toHaveCount(0);
  });
});

test.describe("fake-host browser journeys", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install();
  });

  test("holds one host invocation through human payment approval and settles once", async ({
    page,
  }) => {
    let paidRetries = 0;
    await installFakeHost(page, "document-first", { wallet: true });
    await page.route("**/api/recipe-analysis", async (route) => {
      const request = readRequest(route);
      if (!route.request().headers()["payment-signature"]) {
        await route.fulfill({
          status: 402,
          headers: {
            "Payment-Required": encodePaymentRequiredHeader(paymentChallenge),
          },
        });
        return;
      }
      paidRetries += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "Payment-Response": encodePaymentResponseHeader({
            success: true,
            transaction,
            network: "eip155:84532",
            amount: "10000",
          }),
        },
        body: JSON.stringify({
          ok: true,
          requestId: request.requestId,
          resourceId: "recipe_analysis",
          access: { kind: "x402_payment", referenceId: transaction },
          data: analysis,
        }),
      });
    });
    await page.goto("/");
    await callFakeState(page, "startInvocation");

    await expect(page.getByText("0.01 USDC").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Use sponsor access" }),
    ).toHaveCount(0);
    expect(await fakeState(page, "invocationSettled")).toBe(false);
    await callFakeState(page, "invokeDuplicate");
    await expect
      .poll(() => fakeState(page, "duplicateResult"))
      .toMatchObject({
        ok: false,
        error: {
          code: "REQUEST_IN_PROGRESS",
          message: expect.stringContaining("in progress on the page"),
        },
      });
    await expect(
      page.getByRole("button", { name: "Analyze this recipe" }),
    ).toBeDisabled();

    const confirmPayment = page.getByRole("button", {
      name: "Confirm 0.01 USDC payment",
    });
    await expect(confirmPayment).toBeEnabled();
    await confirmPayment.click();
    await expect.poll(() => fakeState(page, "invocationSettled")).toBe(true);
    expect(await fakeState(page, "invocationResult")).toEqual({
      ok: true,
      resourceId: "recipe_analysis",
      data: analysis,
    });
    expect(await fakeState(page, "settleCount")).toBe(1);
    expect(paidRetries).toBe(1);
    expect(
      JSON.stringify(await fakeState(page, "invocationResult")),
    ).not.toContain(transaction);
  });

  test("host abort cancels automatic payment before human confirmation", async ({
    page,
  }) => {
    await installFakeHost(page, "document-first", { wallet: true });
    await page.route("**/api/recipe-analysis", async (route) => {
      await route.fulfill({
        status: 402,
        headers: {
          "Payment-Required": encodePaymentRequiredHeader(paymentChallenge),
        },
      });
    });
    await page.goto("/");
    await callFakeState(page, "startInvocation");
    await expect(page.getByText("0.01 USDC").first()).toBeVisible();
    await callFakeState(page, "abortInvocation");

    await expect
      .poll(() => fakeState(page, "invocationResult"))
      .toMatchObject({
        ok: false,
        error: { code: "CANCELLED" },
      });
    expect(await fakeState(page, "settleCount")).toBe(1);
    await expect(
      page.getByText("Recipe analysis was cancelled."),
    ).toBeVisible();
    expect(await fakeState(page, "settleCount")).toBe(1);
  });

  test("visible UI uses the same gate and reports an expired grant without success", async ({
    page,
  }) => {
    let grantNonce = "unknown";
    await installFakeHost(page, "document-first");
    await page.route("**/api/sponsor-sessions", async (route) => {
      grantNonce = (route.request().postDataJSON() as { nonce: string }).nonce;
      await fulfillSponsorSession(route);
    });
    await page.route("**/api/sponsor-grants", (route) =>
      fulfillSponsorGrant(route, grantNonce),
    );
    await page.route("**/api/recipe-analysis", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: {
            code: "ACCESS_EXPIRED",
            message: "Sponsor access expired. Start a new attempt.",
            retryable: true,
          },
        }),
      });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Analyze this recipe" }).click();
    await completeSponsorView(page);

    await expect(
      page.getByText("Sponsor access expired. Start a new attempt.").first(),
    ).toBeVisible();
    await expect(page.getByText(analysis.summary)).toHaveCount(0);
  });

  test("visible sponsor access replays a same identity success within five minutes", async ({
    page,
  }) => {
    const cached = new Map<string, { expiresAt: number; response: object }>();
    let grantNonce = "unknown";
    let logicalNow = 0;
    let protectedExecutions = 0;
    await installFakeHost(page, "document-first", { repeatedIdentity: true });
    await page.route("**/api/sponsor-sessions", async (route) => {
      grantNonce = (route.request().postDataJSON() as { nonce: string }).nonce;
      await fulfillSponsorSession(route);
    });
    await page.route("**/api/sponsor-grants", (route) =>
      fulfillSponsorGrant(route, grantNonce),
    );
    await page.route("**/api/recipe-analysis", async (route) => {
      const activeRequest = readRequest(route);
      const key = `${activeRequest.requestId}:${activeRequest.idempotencyKey}`;
      let entry = cached.get(key);
      if (!entry || entry.expiresAt <= logicalNow) {
        protectedExecutions += 1;
        entry = {
          expiresAt: logicalNow + 300_000,
          response: sponsorSuccess(activeRequest),
        };
        cached.set(key, entry);
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(entry.response),
      });
    });
    await page.goto("/");

    for (let run = 0; run < 2; run += 1) {
      if (run === 1) {
        logicalNow = 299_999;
        await page.reload();
      }
      await page.getByRole("button", { name: "Analyze this recipe" }).click();
      await completeSponsorView(page);
      await expect(page.getByText("Recipe analysis completed.")).toBeVisible();
    }
    expect(protectedExecutions).toBe(1);
    await expect(page.getByText(analysis.summary)).toBeVisible();
  });

  test("shows fake payment terms and receipt without a private key or transaction", async ({
    page,
  }) => {
    let paidRetries = 0;
    await installFakeHost(page, "document-first", { wallet: true });
    await page.route("**/api/recipe-analysis", async (route) => {
      const request = readRequest(route);
      if (!route.request().headers()["payment-signature"]) {
        await route.fulfill({
          status: 402,
          headers: {
            "Payment-Required": encodePaymentRequiredHeader(paymentChallenge),
          },
        });
        return;
      }
      paidRetries += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "Payment-Response": encodePaymentResponseHeader({
            success: true,
            transaction,
            network: "eip155:84532",
            amount: "10000",
          }),
        },
        body: JSON.stringify({
          ok: true,
          requestId: request.requestId,
          resourceId: "recipe_analysis",
          access: { kind: "x402_payment", referenceId: transaction },
          data: analysis,
        }),
      });
    });
    await page.goto("/");
    await callFakeState(page, "startInvocation");

    await expect(page.getByText("Base Sepolia").first()).toBeVisible();
    await expect(page.getByText("0.01 USDC").first()).toBeVisible();
    await page
      .getByRole("button", { name: "Confirm 0.01 USDC payment" })
      .click();
    await expect.poll(() => fakeState(page, "invocationSettled")).toBe(true);
    expect(paidRetries).toBe(1);
    await expect(page.getByText("Payment confirmed")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View Base Sepolia receipt" }),
    ).toHaveAttribute("href", `https://sepolia.basescan.org/tx/${transaction}`);
  });

  test("stops agent payment without sponsor fallback when no wallet is injected", async ({
    page,
  }) => {
    await installFakeHost(page, "document-first");
    await page.goto("/");
    await callFakeState(page, "startInvocation");

    await expect(
      page.getByText(
        "Base Sepolia payment is unavailable in this browser. No alternative access path was selected.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Use sponsor access" }),
    ).toHaveCount(0);
    await expect
      .poll(() => fakeState(page, "invocationResult"))
      .toMatchObject({
        ok: false,
        error: { code: "DEPENDENCY_UNAVAILABLE" },
      });
  });
});
