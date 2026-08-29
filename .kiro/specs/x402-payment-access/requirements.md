# Requirements Document

## Introduction

AdGate の即時アクセスを選ぶ利用者が、Base Sepolia 上の少額 testnet USDC 支払いを画面上で明示的に確認し、元の `recipe_analysis` 要求を安全に再開できる支払い経路を提供する。リソースサービスが価格・ネットワーク・資産の唯一の正となり、ブラウザは 402 応答から受け取った条件だけを表示・承認する。

## Boundary Context

- **In scope**: Base Sepolia `exact` 支払い条件、`POST /api/recipe-analysis` の canonical sponsor/payment composition、プレミアムリソースの支払い保護、402 条件の表示、注入ウォレットの接続とネットワーク確認、明示承認、支払い付き再試行、WebMCP 向け terminal bridge、決済結果、preview route の環境別 mounting、ブラウザ越しのヘッダー公開、依存サービス可用性の検証。
- **Out of scope**: World Chain を含む他ネットワーク、mainnet、秘密鍵保管、custodial wallet、fiat 購入、無確認の自動支払い、スポンサー付与、プレミアム分析生成、WebMCP tool の pending lifecycle、production accounting。
- **Adjacent expectations**: `adgate-contracts` が `recipe_analysis`、`AccessEvidence`、公開エラー、および HTTP envelope を定義する。`sponsor-access` は `SponsorAuthorizer` を提供し、`publisher-demo` は両認可経路が共有する premium handler と開発専用 preview router を提供する。`webmcp-gated-tool` は本仕様の payment terminal bridge を消費する。`submission-readiness` は production で preview が到達不能であることを検証するだけで、mounting policy を実装しない。

## Requirements

### Requirement 1: 単一の支払い条件

**Objective:** As a 支払いを検討する利用者, I want サービスが提示した一つの明確な条件を確認したい, so that 意図しない資産またはネットワークへ支払わずに済む

#### Acceptance Criteria

1. When `recipe_analysis` が有効な支払い証跡なしで要求される, the AdGate payment flow shall Base Sepolia、`exact` scheme、testnet USDC、受取先、および支払額を含む支払い必須応答を返す。
2. The AdGate payment flow shall `eip155:84532` だけを支払い対象ネットワークとして受理する。
3. If 支払い要求または支払い証跡が Base Sepolia 以外のネットワークを示す, the AdGate payment flow shall その支払いを拒否し、元のプレミアム処理を実行しない。
4. When 支払い条件が画面に表示される, the AdGate payment flow shall サーバーから受け取った金額、資産、およびネットワークを表示する。
5. If 受け取った支払い条件が欠落、不正、複数候補、または `recipe_analysis` と不一致である, the AdGate payment flow shall 署名要求を開始せず安全なエラーを表示する。

### Requirement 2: 明示的なウォレット同意

**Objective:** As a ウォレット利用者, I want 接続・ネットワーク変更・署名を自分で承認したい, so that 支払いの主導権を保持できる

#### Acceptance Criteria

1. When 利用者が支払い経路を選択する, the AdGate payment flow shall 支払い条件と必要なウォレット操作を表示してから確認操作を提示する。
2. When ウォレット接続、ネットワーク変更、または署名が必要になる, the AdGate payment flow shall 利用者の明示操作によってのみ対応するウォレット要求を開始する。
3. If 接続済みウォレットが Base Sepolia 以外を選択している, the AdGate payment flow shall Base Sepolia への変更を案内し、変更が確認されるまで署名を要求しない。
4. If 注入ウォレットが存在しない、接続が拒否された、ネットワーク変更が拒否された、または署名が拒否された, the AdGate payment flow shall プレミアム要求を実行せず、再試行またはスポンサー経路へ戻れる状態を示す。
5. The AdGate payment flow shall ブラウザへ秘密鍵、seed phrase、または署名用秘密情報の入力・保存を要求しない。

### Requirement 3: 支払い付き要求と決済結果

**Objective:** As a 即時アクセスを選んだ利用者, I want 承認した支払いで元の要求を一度だけ再開したい, so that 支払い後にプレミアム結果を受け取れる

#### Acceptance Criteria

1. When 利用者が支払いを承認する, the AdGate payment flow shall 402 応答に対応する署名済み支払い情報を付けて同じ request ID、idempotency key、および分析入力の要求を再送する。
2. When 支払いの検証と決済が成功する, the AdGate payment flow shall `x402_payment` 証跡に対応するプレミアム分析成功結果を返す。
3. When 決済済み応答が返される, the AdGate payment flow shall 取引識別情報、Base Sepolia、資産、支払額、および確認結果を利用者が確認できるようにする。
4. If 同じ idempotency key で異なる payload が再送される, the AdGate payment flow shall 競合として拒否し、追加の決済を開始しない。
5. If 支払い済み要求の応答が失われ同一内容が再試行される, the AdGate payment flow shall 二重課金を避けながら既存結果または安全に再試行可能な結果を返す。

### Requirement 4: 失敗・取消・回復

**Objective:** As a 支払いを試す利用者, I want 失敗理由と次に取れる行動を理解したい, so that 資金や進行状況が不明な状態にならない

#### Acceptance Criteria

1. While 支払いが署名、検証、決済、または再試行の途中である, the AdGate payment flow shall 現在の段階を表示し、同じ操作の重複開始を防ぐ。
2. If 残高または allowance が不足している, the AdGate payment flow shall 支払いが完了していないことと再試行可能な対応を表示する。
3. If 支払いサービスが利用不能、タイムアウト、または互換性のない応答を返す, the AdGate payment flow shall プレミアム処理を実行せず、依存サービス障害として表示し、スポンサー経路を維持する。
4. When 利用者が決済確定前に支払いを取り消す, the AdGate payment flow shall 元の要求を実行せず取消済み状態へ遷移する。
5. If 決済結果が不確定である, the AdGate payment flow shall 新しい署名を直ちに要求せず、同じ request ID による状態確認または安全な再試行を案内する。

### Requirement 5: ブラウザ境界と応答保護

**Objective:** As a 公開デモの運用者, I want ブラウザとリソースサービス間で支払い応答を安全に交換したい, so that 公開 origin でも支払いフローが再現可能に動作する

#### Acceptance Criteria

1. When 許可された frontend origin が支払い保護リソースへアクセスする, the AdGate payment flow shall preflight と本要求の双方へ必要な origin、method、および header の許可情報を返す。
2. When 支払い必須または決済済み応答がブラウザへ返る, the AdGate payment flow shall ブラウザが必要な支払い header を読み取れるようにする。
3. The AdGate payment flow shall 支払い必須、支払い処理、および決済結果の応答を共有 cache に保存させない。
4. If 許可されていない origin が支払い保護リソースへアクセスする, the AdGate payment flow shall 支払い条件、支払い証跡、およびプレミアム結果を公開しない。
5. If 公開エラーが返される, the AdGate payment flow shall 署名、ウォレット秘密、内部設定、stack trace、および第三者サービスの未加工応答を含めない。

### Requirement 6: 運用互換性と検証

**Objective:** As a デモ運用者, I want 支払い経路の前提条件と互換性を事前に確認したい, so that ライブデモで復旧可能な判断ができる

#### Acceptance Criteria

1. When リソースサービスが起動する, the AdGate payment flow shall 受取先、facilitator 接続先、および Base Sepolia 支払い方針の必須設定が存在することを検証する。
2. If 支払い方針に複数ネットワーク、Base Sepolia 以外、`exact` 以外、または不正な資産が構成されている, the AdGate payment flow shall 支払い保護リソースを利用可能として公開しない。
3. When facilitator の対応能力を確認する, the AdGate payment flow shall Base Sepolia の `exact` 支払いを検証・決済できることだけを必須条件とする。
4. If facilitator の health または対応能力の確認が失敗する, the AdGate payment flow shall 支払い経路を利用不能として示し、スポンサー経路の利用可否へ影響を与えない。
5. The AdGate payment flow shall 実ネットワークへ依存しない自動検証で、402 提示、他ネットワーク拒否、利用者拒否、成功再試行、二重課金防止、および依存障害を再現できるようにする。

### Requirement 7: Canonical route composition と統合 seam

**Objective:** As a 統合実装者, I want 一つの保護 route と明確な terminal contract を使いたい, so that sponsor、payment、WebMCP、および preview の境界が曖昧にならない

#### Acceptance Criteria

1. The AdGate payment flow shall `POST /api/recipe-analysis` の server composition を所有し、sponsor と payment の両認可経路を同じ premium handler へ委譲する。
2. When `Authorization` header が存在する, the AdGate payment flow shall `SponsorAuthorizer` を最初かつ唯一の認可分岐として実行し、header の形式不正、無効、期限切れ、再利用、または dependency failure を payment challenge へ fall through させず fail closed で返す。
3. When `Authorization` header が存在しない, the AdGate payment flow shall `PaymentProtection` だけを実行し、有効な決済後にのみ同じ premium handler へ委譲する。
4. The AdGate payment flow shall WebMCP gate が一つの `PremiumAnalysisRequest` と任意の `AbortSignal` で呼べる `requestPaidAccess` bridge を公開し、成功、公開 error、または取消のうち最初の terminal result だけで Promise を一度だけ完了する。
5. If terminal result の後に wallet、network、facilitator、または abort callback が到着する, the AdGate payment flow shall その callback を無視し、premium handler の再実行、Promise の再完了、または新しい署名要求を行わない。
6. The AdGate payment flow shall `/api/recipe-analysis/preview` の mounting policy を所有し、production では設定値にかかわらず route を mount せず、非 production では明示 opt-in の場合だけ publisher の preview router を mount する。
