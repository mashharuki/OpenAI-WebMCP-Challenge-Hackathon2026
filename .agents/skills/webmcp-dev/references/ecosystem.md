# WebMCP エコシステムと仕様ステータス（調査時点のスナップショット）

> 調査時点（2026-08）でのスナップショット。WebMCPはW3C標準トラックにすら乗っていないドラフトであり、対応ブラウザ・ベンダーの状況は今後大きく動く前提で読むこと。

## 仕様のステータス

- W3C **Web Machine Learning Community Group** による **Draft Community Group Report**。明示的に「W3C標準ではなく、標準化トラック上にもない」と記載されている、つまりインキュベーション段階。
- GitHubリポジトリ `webmachinelearning/webmcp` 上で初出は2025年8月13日、以降も活発に更新されている。
- 調査時点で具体的な実装/トライアルが確認できたブラウザベンダーは **Chromeのみ**。他ベンダーの対応表明は確認できていない。

## 実行環境ごとの比較

| 実行環境 | Namespace | 公開範囲・特徴 | 想定ユースケース |
|---|---|---|---|
| Chrome 実験フラグ (`webmcp-for-testing`) | `navigator.modelContext` | ローカル検証・Model Context Tool Inspector拡張と組み合わせた手動/エージェント駆動テストに向く | 開発中の動作検証 |
| Chrome Origin Trial（Chrome 149〜、trial id `4163014905550602241`） | 未確定（要最新確認） | 本番相当のオリジンで限定公開できる正式な早期アクセス経路 | 本番ドメインでの実地検証 |
| コミュニティツールキット `@mcp-b/*` | `navigator.modelContext` | React/Vanilla向けのラッパー、OSSのExamplesリポジトリが充実 | フレームワーク統合の実装リファレンス |
| ChatGPTの「Site tools」 | `document.modelContext` | ChatGPT内蔵ブラウザがページ訪問時に自動検出し、アドレスバーの「Site tools」から確認できる。実行前に毎回安全性レビューが入る | ChatGPTユーザーにページ内機能を使わせたい場合 |
| バックエンドMCPサーバー / OpenAI Apps SDK | WebMCPとは無関係 | ページを開いていなくても常設で動く連携（コネクタ/プラグイン） | WebMCPと**併用可能**。1つのサイトが両方を持てる（例: 常設APIはApps SDK、ブラウジング中の細かい操作はWebMCP） |

## ChatGPT側の位置付け（`learn.chatgpt.com/docs/webmcp` より）

- 自らを「WebMCPという提案中の標準の、ChatGPTによる実装」と明記しており、独自仕様ではなく `webmachinelearning.github.io/webmcp/` に追従する意図が明言されている。
- フィーチャー検出パターン: `typeof document.modelContext?.registerTool === "function"`。
- ユーザーはアドレスバーの「Site tools」からそのページが提供するツール一覧を見られ、エージェントの直近の利用状況は「Sources」から追跡できる。
- **Apps SDK（MCPサーバーによるプラグイン）とWebMCPは明確に別物**として説明されている。「MCPサーバーを使うプラグインはページが開かれていなくても独立して動く連携を提供できる。ウェブサイトは両方をサポートできる」という一文が象徴的。

```javascript
// ChatGPT公式ドキュメントのサンプル（検証用に軽量な読み取り専用ツール）
if (typeof document.modelContext?.registerTool === "function") {
  await document.modelContext.registerTool({
    name: "get_page_title",
    description: "Read the title of the current page.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async () => ({ title: document.title }),
  });
}
```

## OpenAIショーケース（`developers.openai.com/showcase`）について

調査時点でショーケースページ自体に **「WebMCP examples are coming soon（近日公開）」** という記載があり、確認できた掲載アプリ（Codexのデモ、エージェント協調系デモ等）はいずれも「WebMCPの実例」と明示的にラベル付けされたものではなかった。今後掲載が増える可能性が高いので、実装の参考事例を探す際は再度このページを確認すると良い。

## 設計・実装上の含意

- ターゲットにする実行環境（自社サイトに来るユーザーがどのAIエージェント/ブラウザを使うか）によって、フィーチャー検出すべきnamespaceの優先順位が変わる。ChatGPTユーザー向けなら `document.modelContext` を先に見る実装、Chrome拡張エコシステム（Model Context Tool Inspector等）での検証を重視するなら `navigator.modelContext` も併せて見る、という判断ができる。
- 既にバックエンドMCPサーバー（Apps SDK等）を持っている場合、WebMCPは「ページを開いている間だけの、より細かい粒度の操作」を追加する位置付けとして設計すると、既存の連携と役割が衝突しない。
- 仕様が未成熟な領域（宣言的API、ストリーミング、マルチモーダル入出力、パーミッションUX）に依存する機能は、本番導入を急がず、まずはOrigin Trialやフラグ有効化での検証にとどめるのが安全。
