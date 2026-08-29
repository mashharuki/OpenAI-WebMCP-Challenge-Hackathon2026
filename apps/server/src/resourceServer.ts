import {
  agentkitResourceServerExtension,
  createAgentBookVerifier,
  createAgentkitHooks,
  InMemoryAgentKitStorage,
} from "@worldcoin/agentkit";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { x402ResourceServer } from "@x402/hono";
import { facilitatorClient } from "./facilitator";

const agentBook = createAgentBookVerifier();
export const agentkitHooks = createAgentkitHooks({
  agentBook,
  storage: new InMemoryAgentKitStorage(),
  mode: { type: "free-trial", uses: 3 },
  onEvent: console.log,
});

// リソースサーバーの設定
export const resourceServer = new x402ResourceServer(facilitatorClient);
// EIP-155チェーンID84532のExactEvmSchemeを登録
resourceServer.register(
  "eip155:84532" as `${string}:${string}`,
  new ExactEvmScheme(),
);

// worldchain SepoliaのExactEvmSchemeを登録
resourceServer.register(
  "eip155:4801" as `${string}:${string}`,
  new ExactEvmScheme(),
);

// AgentKit の 402 拡張を有効化
resourceServer.registerExtension({
  ...agentkitResourceServerExtension,
  // 402 ごとに生成される値は payment payload の echo 比較から除外する
  dynamicInfoFields: ["nonce", "issuedAt", "expirationTime"],
});
