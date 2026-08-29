# Requirements Document

## Introduction

AdGate の `recipe_analysis` を、WebMCP エージェントとページ上の人が同じ試行を共有して完了できる単一ツールとして公開する。エージェントによる `analyze_recipe` 呼び出しは、ページ上でスポンサー閲覧または Base Sepolia x402 支払いが選択・完了されるまで待機し、同一呼び出しのまま決定的な分析結果または安全な終端エラーを返す。

## Boundary Context

- **In scope**: 単一 WebMCP ツール、利用可能なホスト名前空間の検出、重複しない登録と解除、入力検証、共有ゲートへの要求、スポンサー・支払い経路からの再開、単一 active 試行、取消・中断・unmount、可視ステータス、JSON-safe なエージェント向け結果と安全な外部内容の扱い。
- **Out of scope**: スポンサー閲覧・grant の実装、wallet 署名・x402 決済、分析内容の生成、共通契約の再定義、server MCP、複数 premium tool、自律的な支払い承認、headless 実行、および cross-origin tool 公開。
- **Adjacent expectations**: `publisher-demo` は表示中レシピと決定的分析を提供し、`sponsor-access` は人間確認済みの grant を返す。`x402-payment-access` は `PaymentCoordinatorPort.requestPaidAccess(request, signal)` を通じ、canonical `PremiumAnalysisSuccess` または `AdGateError` を含む `PaymentTerminalResult` を success/error/cancelled のいずれか一つとして返す。`adgate-contracts` の `GateState`、`GateEvent`、`RecipeAnalysisInput`、`WebMCPToolResult`、`AdGateError` を本機能が変更せず利用する。

## Requirements

### Requirement 1: 単一 premium WebMCP tool の公開

**Objective:** As a WebMCP エージェント, I want ページの premium recipe analysis を一つの明確なツールとして発見したい, so that 人の選択を尊重しながら正しい構造化入力で要求できる

#### Acceptance Criteria

1. When 対応 WebMCP ホストで publisher ページが利用可能になる, the WebMCP Gated Tool shall `analyze_recipe` という単一の premium analysis tool を登録する。
2. The WebMCP Gated Tool shall ツールの目的、人間によるアクセス選択が必要であること、および返却内容を静的で簡潔な説明として公開する。
3. The WebMCP Gated Tool shall レシピ名、材料、手順、および任意の食事上の目的だけを受理し、未知フィールドを許可しない入力契約を公開する。
4. If ツール入力が共有 `RecipeAnalysisInput` 契約に適合しない, the WebMCP Gated Tool shall ゲートを開始せず `INVALID_INPUT` の安全な結果を返す。
5. The WebMCP Gated Tool shall 外部レシピ内容、分析結果、エラー詳細、または実行時データをツール名・説明へ埋め込まない。

### Requirement 2: WebMCP host の互換性と登録 lifecycle

**Objective:** As a 審査員またはデモ運用者, I want 利用中の対応ブラウザでツールが一度だけ登録されて状態を確認できる, so that ChatGPT と Chrome の対象環境で再現可能に試せる

#### Acceptance Criteria

1. When 複数の対応 WebMCP 名前空間が利用可能である, the WebMCP Gated Tool shall `document` 側の対応名前空間を優先して一つだけ使用する。
2. When `document` 側の対応名前空間がなく `navigator` 側だけが利用可能である, the WebMCP Gated Tool shall `navigator` 側へツールを登録する。
3. If 対応 WebMCP 名前空間が存在しない, the WebMCP Gated Tool shall ページの通常閲覧を維持し、ツールが利用できないことを可視に示す。
4. While 同じページ lifecycle が継続している, the WebMCP Gated Tool shall 同じツールを重複登録しない。
5. When 登録を所有するページ lifecycle が終了する, the WebMCP Gated Tool shall 登録を解除し、未完了のツール試行を中断する。
6. If ツール登録または解除が失敗する, the WebMCP Gated Tool shall ページを停止させず、安全な unavailable 状態を可視に示す。

### Requirement 3: 共有ゲートによる人間参加の待機と再開

**Objective:** As a premium analysis を要求したエージェントと人, I want 同じ要求がページ上のアクセス選択を待って再開してほしい, so that WebMCP が人間参加の共有ワークフローになる

#### Acceptance Criteria

1. When 有効な `analyze_recipe` 呼び出しが開始される, the WebMCP Gated Tool shall 同じ入力に結び付く新しいゲート試行を開始し、ページ上にスポンサーまたは支払いの選択を表示する。
2. While 人がアクセス経路を選択または完了していない, the WebMCP Gated Tool shall 元のツール呼び出しを未完了のまま保持し、分析成功を返さない。
3. When スポンサー経路が正常に完了する, the WebMCP Gated Tool shall 返されたスポンサー証跡と token を用いて元のプレミアム分析要求を一度だけ継続する。
4. When 支払い経路が選択される, the WebMCP Gated Tool shall active 試行の同じ `PremiumAnalysisRequest` と試行用 `AbortSignal` を `PaymentCoordinatorPort.requestPaidAccess(request, signal)` へ一度だけ渡し、その Promise が返す `PaymentTerminalResult` の success/error/cancelled を元のツール呼び出しの唯一の終端へ対応させる。
5. When いずれかのアクセス経路から分析が成功する, the WebMCP Gated Tool shall 両経路で同じ `recipe_analysis` 結果契約を返す。
6. The WebMCP Gated Tool shall スポンサーの検証・消費、支払い署名・決済、または分析生成を独自に再実装しない。

### Requirement 4: 同時実行、冪等性、および試行分離

**Objective:** As a 人またはエージェント, I want 重複呼び出しが既存の選択や支払いを上書きしないでほしい, so that 一つの意図が一つの結果に対応する

#### Acceptance Criteria

1. While 一つのゲート試行が未完了である, the WebMCP Gated Tool shall 二つ目のツール呼び出しを開始せず `INVALID_TRANSITION` の安全な結果を返す。
2. While 一つのゲート試行が未完了である, the WebMCP Gated Tool shall 可視 UI からの重複開始操作も同じ active 試行を上書きしないようにする。
3. When 元の要求がアクセス取得後に実行される, the WebMCP Gated Tool shall その試行で作成した request ID、idempotency key、nonce、および分析入力の対応を維持する。
4. If 終了済みまたは別試行に属する遅延成功・失敗イベントが届く, the WebMCP Gated Tool shall 現在の試行を変更せず、そのイベントを元の呼び出しへ返さない。
5. When active 試行が成功、失敗、または取消の終端状態になる, the WebMCP Gated Tool shall sponsor 経路、`requestPaidAccess`、host abort、または user cancel のうち最初の終端だけで元の WebMCP 呼び出しを一度だけ完了し、遅延した terminal result を無視してから新しい試行を開始可能にする。

### Requirement 5: 取消、中断、および安全な失敗

**Objective:** As a 人または WebMCP ホスト, I want 不要または継続不能な呼び出しを確実に終了したい, so that wallet prompt、スポンサー表示、network request が裏で継続しない

#### Acceptance Criteria

1. When 人が共有ゲートを取り消す, the WebMCP Gated Tool shall active なスポンサー処理と premium request を中止し、payment coordinator へ `cancel("user")` を一度だけ伝え、元のツール呼び出しを `CANCELLED` で一度だけ完了する。
2. When WebMCP ホストがツール呼び出しを中断する, the WebMCP Gated Tool shall 同じ中断を active なゲート、スポンサー経路、premium request、および `requestPaidAccess` へ渡した試行用 signal へ伝播し、payment の cancelled/abort 終端と競合しても元の呼び出しを一度だけ完了する。
3. When ページが unmount または navigation により破棄される, the WebMCP Gated Tool shall active 試行を中止し、以後の遅延結果による画面更新またはツール完了を防ぐ。
4. If sponsor、payment、premium resource の依存先が利用不能である, the WebMCP Gated Tool shall 共通エラー分類による安全な失敗を返し、成功として扱わない。
5. If 内部例外、wallet/provider 応答、支払い payload、token、stack trace、または設定値が失敗原因に含まれる, the WebMCP Gated Tool shall それらをツール結果、画面表示、および公開 status から除外する。
6. While 支払い経路だけが利用不能である, the WebMCP Gated Tool shall 利用可能なスポンサー経路を選択可能なまま維持する。

### Requirement 6: エージェント向け結果と可視ステータス

**Objective:** As a 人と WebMCP エージェント, I want 同じ試行の状態と終端結果をそれぞれ理解できる形で受け取りたい, so that 待機、回復、成功を誤認しない

#### Acceptance Criteria

1. While ツール試行が選択待ち、スポンサー閲覧中、支払い承認待ち、アクセス付与済み、または実行中である, the WebMCP Gated Tool shall 現在段階をページ上で色だけに依存せず表示する。
2. When ツール試行が成功する, the WebMCP Gated Tool shall `WebMCPToolResult` の成功形として `recipe_analysis` の構造化結果を返す。
3. When ツール試行が失敗または取消になる, the WebMCP Gated Tool shall `WebMCPToolResult` の失敗形として共通 `AdGateError` だけを返す。
4. The WebMCP Gated Tool shall ツールの全終端結果を JSON で損失なく表現可能にする。
5. When 外部由来のレシピ内容または分析結果をエージェントへ返す, the WebMCP Gated Tool shall それをデータとして構造化し、ツール指示または信頼済み命令として扱わせる表現を付加しない。
6. When status または結果が更新される, the WebMCP Gated Tool shall 支援技術の利用者が更新を認識できるようにする。
