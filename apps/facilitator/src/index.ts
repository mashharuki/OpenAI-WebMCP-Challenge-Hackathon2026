import { serve } from "@hono/node-server";
import { x402Facilitator } from "@x402/core/facilitator";
import type {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
} from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/facilitator";
import { UptoEvmScheme } from "@x402/evm/upto/facilitator";
import dotenv from "dotenv";
import { Hono } from "hono";
import {
  baseSepoliaChainInfo,
  chainInfo,
  getFacilitatorEvmSignerForChain,
  getViemClientForChain,
} from "./viem.js";

dotenv.config();

// ========================================
// Configuration
// ========================================

const PORT = Number(process.env.PORT ?? 4022);

// create  Viem client for the chain
const viemClient = getViemClientForChain(chainInfo.chain);
const viemClient2 = getViemClientForChain(baseSepoliaChainInfo.chain);

// Facilitator EVM signerを作成(チェーンごとに作成する必要がある)
const evmSigner = getFacilitatorEvmSignerForChain(viemClient);
const evmSigner2 = getFacilitatorEvmSignerForChain(viemClient2);

// ========================================
// x402 Facilitator
// ========================================

// ファシリテーターインスタンスを生成
export const facilitator = new x402Facilitator()
  .onBeforeVerify(async (context) => {
    console.log("================ Before verify ================", context);
  })
  .onAfterVerify(async (context) => {
    console.log("================ After verify ================", context);
  })
  .onVerifyFailure(async (context) => {
    console.log("================ Verify failure ================", context);
  })
  .onBeforeSettle(async (context) => {
    console.log("================ Before settle ================", context);
  })
  .onAfterSettle(async (context) => {
    console.log("================ After settle ================", context);
  })
  .onSettleFailure(async (context) => {
    console.log("================ Settle failure ================", context);
  });

// ========================================
// Register schemes
// ========================================

// World Sepolia - Exact
facilitator.register(
  chainInfo.chainId as `eip155:${number}`,
  new ExactEvmScheme(evmSigner, { eip6492AllowedFactories: [] }),
);

// World Sepolia - Upto
facilitator.register(
  chainInfo.chainId as `eip155:${number}`,
  new UptoEvmScheme(evmSigner),
);

// Base Sepolia - Exact
facilitator.register(
  baseSepoliaChainInfo.chainId as `eip155:${number}`,
  new ExactEvmScheme(evmSigner2, { eip6492AllowedFactories: [] }),
);

// Base Sepolia - Upto
facilitator.register(
  baseSepoliaChainInfo.chainId as `eip155:${number}`,
  new UptoEvmScheme(evmSigner2),
);

// ========================================
// Hono
// ========================================

// Honoアプリケーションのインスタンスを作成
const app = new Hono();

// ========================================
// POST /verify
// ========================================

/**
 * 署名済みの支払いペイロードと支払い要件を検証するエンドポイント
 */
app.post("/verify", async (c) => {
  try {
    // リクエストボディをJSONとしてパース
    const body = await c.req.json<{
      paymentPayload?: PaymentPayload;
      paymentRequirements?: PaymentRequirements;
    }>();

    const { paymentPayload, paymentRequirements } = body;

    if (!paymentPayload || !paymentRequirements) {
      return c.json(
        {
          error: "Missing paymentPayload or paymentRequirements",
        },
        400,
      );
    }

    // ファシリテーターのverifyメソッドを呼び出して検証
    const response: VerifyResponse = await facilitator.verify(
      paymentPayload,
      paymentRequirements,
    );

    return c.json(response);
  } catch (error) {
    console.error("Verify error:", error);

    return c.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

// ========================================
// POST /settle
// ========================================

/**
 * 署名済みの支払いペイロードと支払い要件を使用して決済を行うエンドポイント
 */
app.post("/settle", async (c) => {
  try {
    // リクエストボディをJSONとしてパース
    const body = await c.req.json<{
      paymentPayload?: PaymentPayload;
      paymentRequirements?: PaymentRequirements;
    }>();

    const { paymentPayload, paymentRequirements } = body;

    if (!paymentPayload || !paymentRequirements) {
      return c.json(
        {
          error: "Missing paymentPayload or paymentRequirements",
        },
        400,
      );
    }

    // ファシリテーターのsettleメソッドを呼び出して決済(トランザクションを流す)
    const response: SettleResponse = await facilitator.settle(
      paymentPayload,
      paymentRequirements,
    );

    return c.json(response);
  } catch (error) {
    console.error("Settle error:", error);

    if (
      error instanceof Error &&
      error.message.includes("Settlement aborted:")
    ) {
      const response: SettleResponse = {
        success: false,
        errorReason: error.message.replace("Settlement aborted: ", ""),
        network: "unknown",
      };

      return c.json(response);
    }

    return c.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

// ========================================
// GET /supported
// ========================================

/**
 * サポートされているスキームとネットワークを返すエンドポイント
 */
app.get("/supported", (c) => {
  try {
    const response = facilitator.getSupported();

    return c.json(response);
  } catch (error) {
    console.error("Supported error:", error);

    return c.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

// ========================================
// Health check
// ========================================

app.get("/health", (c) => {
  return c.json({
    status: "ok",
  });
});

// ========================================
// Start server
// ========================================

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`🚀 Facilitator listening on http://localhost:${info.port}`);
  },
);
