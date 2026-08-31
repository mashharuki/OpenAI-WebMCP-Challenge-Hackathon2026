import { DurableObject } from "cloudflare:workers";
import { createRecipeAnalysisApp } from "./adgate/recipeAnalysisApp.js";
import { createPaymentRuntimeConfig } from "./config.js";
import { createRuntimeRecipeAnalysisDependencies } from "./runtimeComposition.js";
import {
  createSponsorGrantLedger,
  type SponsorGrantLedger,
  type SponsorGrantLedgerSnapshot,
} from "./sponsor/grantLedger.js";

const SPONSOR_LEDGER_STORAGE_KEY = "sponsor-ledger-v1";

const isSponsorLedgerSnapshot = (
  value: unknown,
): value is SponsorGrantLedgerSnapshot =>
  typeof value === "object" &&
  value !== null &&
  "version" in value &&
  value.version === 1 &&
  "sessions" in value &&
  Array.isArray(value.sessions) &&
  "grants" in value &&
  Array.isArray(value.grants) &&
  "responses" in value &&
  Array.isArray(value.responses);

export class ApiCoordinator extends DurableObject<Env> {
  readonly #ready: Promise<void>;
  readonly #storage: DurableObjectStorage;
  #app!: ReturnType<typeof createRecipeAnalysisApp>;
  #ledger!: SponsorGrantLedger;
  #requestTail: Promise<void> = Promise.resolve();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.#storage = ctx.storage;
    this.#ready = ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<unknown>(SPONSOR_LEDGER_STORAGE_KEY);
      this.#ledger = createSponsorGrantLedger({
        initialSnapshot: isSponsorLedgerSnapshot(stored) ? stored : undefined,
      });
      const runtimeConfig = createPaymentRuntimeConfig(env);
      this.#app = createRecipeAnalysisApp(
        createRuntimeRecipeAnalysisDependencies(runtimeConfig, {
          sponsorLedger: this.#ledger,
        }),
      );
    });
  }

  fetch(request: Request): Promise<Response> {
    const handled = this.#requestTail.then(async () => {
      await this.#ready;
      const response = await this.#app.fetch(request);
      await this.#storage.put(
        SPONSOR_LEDGER_STORAGE_KEY,
        this.#ledger.snapshot(),
      );
      return response;
    });
    this.#requestTail = handled.then(
      () => undefined,
      () => undefined,
    );
    return handled;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await env.API_COORDINATOR.getByName("adgate").fetch(request);
    } catch (error) {
      console.error(
        JSON.stringify({
          message: "resource server request failed",
          error: error instanceof Error ? error.message : String(error),
          path: new URL(request.url).pathname,
        }),
      );
      return Response.json(
        { error: "Service temporarily unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  },
} satisfies ExportedHandler<Env>;
