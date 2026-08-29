# WebMCP API リファレンス（調査時点のスナップショット）

> このファイルは `webmachinelearning.github.io/webmcp/` のドラフト仕様と `github.com/webmachinelearning/webmcp` の内容を基にした調査時点（2026-08）のスナップショット。仕様は Draft Community Group Report であり **W3C標準トラックにすら乗っていない** ため、頻繁に変わる。実装前に必ず一次情報を再確認すること。

## 重要な食い違い: `document.modelContext` vs `navigator.modelContext`

| ソース | Namespace |
|---|---|
| 公式スペック文書（webmachinelearning.github.io/webmcp/） | `document.modelContext` |
| ChatGPT公式ドキュメント（learn.chatgpt.com/docs/webmcp） | `document.modelContext` |
| Chrome実験フラグ実装（`webmcp-for-testing`, Chrome 146+で確認） | `navigator.modelContext`（DevToolsで `"modelContext" in navigator` が `true` になることを確認） |
| コミュニティツールキット `@mcp-b/global` / `@mcp-b/react-webmcp` | `navigator.modelContext` |

現時点でどちらか一方が「廃止された」という一次情報は確認できていない。**実装は両方をフィーチャー検出するのが最も安全**:

```javascript
const modelContext = document.modelContext ?? navigator.modelContext;
```

Chrome の Origin Trial（Chrome 149〜、trial id `4163014905550602241`）でどちらに収束するかは要追跡。トライアル登録の具体的な手順（`<meta http-equiv="origin-trial">` タグか `Origin-Trial` HTTPヘッダーか）はChromeの標準的なOrigin Trialの作法に準じると推測されるが、WebMCP固有の確認は取れていない — 実装前に Chrome Origin Trials ダッシュボードで最新情報を確認すること。

## コアメソッド

- **`registerTool(tool, options)`** — ツールを登録する。`options.signal`（`AbortSignal`）を渡すと、signalがabortされた時点で自動的に登録解除される。
- **`getTools(options)`** — 現在登録されているツールを取得する。`options.fromOrigins` でクロスオリジンのツールをフィルタして取得できる。
- **`executeTool(tool, inputObject, options)`** — プログラム的にツールを実行する（エージェントだけでなくページ自身のコードからも呼べる）。
- **`unregisterTool(name)`**（コミュニティ実装 `@mcp-b/global` で確認。公式スペックでは `AbortSignal` 経由の解除が正とされている可能性があるため要確認）

## イベント

- **`toolchange`**（`ontoolchange` / `addEventListener("toolchange", ...)`）— ツールが登録/解除されるたびに発火。ホスト側（エージェント）がツール一覧を再同期するために使う。

## `ModelContextTool` 辞書（ツール定義オブジェクト）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | ○ | 1〜128文字。英数字・アンダースコア・ハイフン・ピリオドのみ |
| `title` | string | – | 人間向けの表示ラベル |
| `description` | string | ○ | エージェントに渡る自然言語の説明。**プロンプトインジェクションの経路になり得るので `references/security.md` の文字数制限を守る** |
| `inputSchema` | object | ○ | **JSON Schema**（Zodではない。ただし `@mcp-b/react-webmcp` の `useWebMCP` フックはZodスキーマを受け取り内部でJSON Schemaに変換している） |
| `execute` | function | ○ | `(inputObject, { signal }) => Promise<any>`。返り値は `{ content: [{ type: "text", text: "..." }] }` のようなMCP風の構造で返すのが一般的 |
| `annotations` | object | – | `readOnlyHint`（boolean）: 非破壊的かどうか。`untrustedContentHint`（boolean）: 出力/入力に信頼できないコンテンツが含まれるかどうか |
| `exposedTo` | array | – | クロスオリジン公開時の許可オリジン一覧。省略時は同一オリジンのみ |

## ライフサイクルと状態同期

- 登録はいつでも動的に行える。マニフェストのような事前宣言ステップは不要。
- 同一オリジンのドキュメントはデフォルトでツールを閲覧可能。クロスオリジンは `exposedTo` によるオプトインが必要。
- ページ状態の変化（ログアウト、フォームの無効化など）に応じてツールを一時的に無効化したい場合は、`AbortController` を使って登録時の `signal` を abort する。
- 宣言的API（標準の `<form>` 要素へのアノテーションで自動的にWebMCPツールを生成する仕組み）も仕様内で言及されているが、具体的な属性名は本調査のfetch範囲では確認できていない（Chrome側でも「TODOステージ」との言及あり、`:tool-form-active` / `:tool-submit-active` という関連CSS擬似クラスは調査時点で未機能）。実装前に `webmachinelearning/webmcp` リポジトリの `declarative-api-explainer.md` 相当のドキュメントを確認すること。

## パーミッションポリシー

- Permissions Policy の機能名は `"tools"`。デフォルトのアローリストは `['self']` — つまりiframe等でクロスオリジンにツールを見せる/登録するには明示的な委譲が必要。

## エラーハンドリング

独自のエラー体系ではなく標準の `DOMException` を使う:

- `InvalidStateError`
- `SecurityError`
- `NotAllowedError`
- `UnknownError`

## 未解決の仕様上の論点（GitHub issue、要トラッキング）

- マルチモーダルな入出力（画像/音声など）のサポート
- クロスドキュメントでのツール応答
- ストリーミング/転送可能な入出力
- 入出力スキーマのバリデーション意味論
- 複数ツールを束ねた「スキル」的な協調動作
- フォーマルな出力スキーマの宣言
- ユーザー確認/パーミッションプロンプトのUX
- ツールの進捗報告、Service Workerとの統合

これらは全て「仕様が今後変わりうる領域」なので、これらに依存する実装をする場合は特に一次情報の確認を優先すること。

## 明示的な設計思想

スペック自身が「Web MCPを使うWebページは、ツールをバックエンドではなくクライアント側スクリプトで実装したMCPサーバーとみなせる」と説明している一方、MCPのワイヤープロトコルをそのまま採用しているわけではなく「MCPと共通の語彙からインスピレーションを得た、Web向けにネイティブ設計されたクライアントセーフなソリューション」と位置付けている。また、**完全自律・ヘッドレスな利用は想定しておらず、人間がブラウザセッションに関与する（human-in-the-loop）ことを前提**にしている点は設計判断に直結するので覚えておくこと。
