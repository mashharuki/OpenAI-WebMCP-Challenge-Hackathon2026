import { serve } from "@hono/node-server";
import {
  paymentMiddlewareFromHTTPServer,
  x402HTTPResourceServer,
} from "@x402/hono";
import { Hono } from "hono";
import { x402Config } from "./config";
import { agentkitHooks, resourceServer } from "./resourceServer";

// Honoインスタンスの作成
const app = new Hono();

const httpServer = new x402HTTPResourceServer(
  resourceServer,
  x402Config,
).onProtectedRequest(agentkitHooks.requestHook);

app.use("*", async (c, next) => {
  console.log("[request headers]", {
    agentkit: Boolean(c.req.header("agentkit")),
    paymentSignature: Boolean(c.req.header("payment-signature")),
  });

  await next();
});

// x402ミドルウェアの設定
app.use(paymentMiddlewareFromHTTPServer(httpServer));

// エンドポイントの設定
app.get("/health", (c) => {
  return c.json({
    report: {
      status: "OK",
    },
  });
});

app.get("/weather", (c) => {
  return c.json({
    report: {
      weather: "sunny",
      temperature: 70,
    },
  });
});

serve({ fetch: app.fetch, port: 4021 });
