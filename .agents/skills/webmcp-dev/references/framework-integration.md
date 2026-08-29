# WebMCP フレームワーク統合パターン（調査時点のスナップショット）

> `github.com/WebMCP-org/examples` と `azukiazusa.dev` の記事を基にした調査時点（2026-08）のスナップショット。コミュニティ製ツールキット（`@mcp-b/*`）はサードパーティのnpmパッケージであり、公式スペックの一部ではない点に注意。バージョンやAPIは変わりうるので、導入前に `npm view @mcp-b/global version` 等で最新版を確認すること。

## Vanilla JS

最も素直な形。`@mcp-b/global` を読み込むと `navigator.modelContext` にポリフィル/拡張が入る（Chromeがネイティブ実装していない環境向けの互換レイヤーとしても機能する）。

```javascript
import '@mcp-b/global';

navigator.modelContext.registerTool({
  name: 'my_tool',
  description: 'What this tool does',
  inputSchema: {
    type: 'object',
    properties: { param: { type: 'string' } },
    required: ['param'],
  },
  async execute(args) {
    return { content: [{ type: 'text', text: 'Result' }] };
  },
});
```

## React — `@mcp-b/react-webmcp`

`useWebMCP` フックがコンポーネントのマウント/アンマウントに合わせた登録・解除を面倒見る。**JSON Schemaではなく Zod スキーマ**を渡す点に注意（フック内部でJSON Schemaに変換される）。

```javascript
import { useWebMCP } from '@mcp-b/react-webmcp';
import { z } from 'zod';

useWebMCP({
  name: 'my_tool',
  inputSchema: { param: z.string().describe('Parameter description') },
  handler: async ({ param }) => ({ success: true, result: 'Done!' }),
});
```

このフックをコンポーネント内で呼ぶだけで、コンポーネントがアンマウントされた際にツールも自動的に解除される想定（`AbortSignal`ベースのライフサイクル管理をフックが肩代わりしている）。SPAでルートごとに異なるツールを出し分けたい場合、このパターンが最も安全（手動での登録解除漏れを防げる）。

## その他フレームワークの実装例（`WebMCP-org/examples` リポジトリ）

以下のフレームワーク向けサンプルが存在することを確認済み（詳細なコードパターンまでは今回のfetch範囲では取得できていないため、実装時は該当ディレクトリのREADMEを直接読むこと）:

- `/rails` — Railsアプリ（Stimulus使用）、ブックマークマネージャー
- `/angular` — Angular（Signalsを使用）、ノートアプリ
- `/phoenix-liveview` — Elixir/Phoenix LiveView、カウンター/アイテム管理
- `/svelte` — Svelteのサンプル
- `/relegated` — 非推奨の旧SDKベース実装（参考にしない）

導入手順は共通で `git clone` → 対象ディレクトリへ `cd` → `pnpm install` → `pnpm dev`（Node 18+、pnpm、Chrome + "MCP-B" 拡張機能が必要）。

## `provideContext()` の罠（最重要の落とし穴）

`provideContext({ tools: [...] })` は**呼ぶたびに登録済みツール一覧を丸ごと置き換える**。SPAで複数コンポーネントがそれぞれ独立に `provideContext()` を呼ぶと、後から呼ばれた方が先に登録された分を消してしまう。

```javascript
// コンポーネントAが登録
window.navigator.modelContext.provideContext({ tools: [toolA] });

// 後からコンポーネントBが登録 → toolAが消える(!)
window.navigator.modelContext.provideContext({ tools: [toolB] });
```

**対策**: 複数箇所から個別にツールを増減させたい場合は `provideContext()` を使わず、`registerTool()` / `unregisterTool()`（または `AbortSignal` の abort）を個別に呼ぶ。`provideContext()` は「アプリ全体のツール一覧をこの一箇所で一元管理する」設計のときだけ使う。

## フォームの宣言的な agentInvoked ハンドリング（`azukiazusa.dev` の例）

WebMCPのエージェント経由のフォーム送信は、通常のユーザー操作による送信と区別できる `event.agentInvoked` フラグを使って分岐できる（宣言的APIが正式に定まる前の橋渡し的パターンとして参考になる）:

```javascript
document.querySelector("form").addEventListener("submit", (e) => {
  if (e.agentInvoked) {
    e.respondWith(Promise.resolve(`Added todo: ${text}`));
  }
});
```

これを使うと、既存のフォームUIをそのまま流用しつつ、エージェント経由の送信時だけレスポンスを明示的に返す、といった実装がしやすい。ただし宣言的API自体がまだ「TODOステージ」（`references/api-reference.md` 参照）なので、本番導入は慎重に検討すること。
