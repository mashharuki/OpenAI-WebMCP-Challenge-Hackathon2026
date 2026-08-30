# Requirements Document

## Introduction

AdGate の実装を、審査員が公開 URL から短時間で理解・操作・再現できる提出可能なリリースへ仕上げる。現在は各機能の実装境界は定義されているが、公開環境の一括検証、WebMCP 対応ブラウザでの確認、障害時の案内、ハッカソン期間中の新規作業を示す来歴、および英語の提出素材が揃っていない。本仕様は上流機能を変更せず、リリース判定、公開デモの証跡、文書、提出前チェックを提供する。

## Boundary Context

- **In scope**: 最小cross-app release command、公開frontend/resource server診断、Origin Trial確認、fake WebMCP hostによるスポンサーgolden path、既存fallback表示の検証、手書き英語architecture/provenance/setup文書、Devpost原稿、スクリーンショット、3分未満の動画台本・shot list、提出checklist。
- **Out of scope**: 上流の契約・分析・スポンサー・支払い・WebMCP orchestration の再設計、新しい商品機能、mainnet、production accounting、外部 marketing、Devpost または YouTube への自動投稿。
- **Adjacent expectations**: 上流5仕様が提供する canonical contract、単一 protected route、sponsor fallback、Base Sepolia x402、WebMCP host status をそのまま検証する。release blocker が見つかった場合は所有元へ戻し、本仕様内で同義機能を複製しない。

## Requirements

### Requirement 1: 再現可能なリリース判定

**Objective:** As a リリース担当者, I want 一つの検証手順で全アプリの提出可否を判断したい, so that 手作業の見落としを残さず feature freeze できる

#### Acceptance Criteria

1. When release check が実行される, the Submission Readiness feature shall frontend、resource server、facilitator の build、型、lint、および自動 test の成否を一つの終了結果として報告する。
2. If いずれかの必須 check が失敗する, the Submission Readiness feature shall release を不合格とし、失敗した check と再実行方法を識別可能にする。
3. When 同じ commit と同じ設定で release check が再実行される, the Submission Readiness feature shall 外部 mainnet や実ウォレットに依存せず同じ自動判定を再現できるようにする。
4. The Submission Readiness feature shall contract、sponsor、payment、WebMCP、および publisher の上流 test を置き換えず必須 check として実行する。
5. When release check が成功する, the Submission Readiness feature shall 検証対象 commit、実行時刻、および各 check の成功を機密情報なしで記録可能にする。

### Requirement 2: 公開環境とブラウザ境界の検証

**Objective:** As a 審査員またはデモ運用者, I want 公開 URL の必要条件を事前に確認したい, so that 本番デモで接続・CORS・WebMCP 設定の不備に遭遇しない

#### Acceptance Criteria

1. When 公開環境の smoke check が実行される, the Submission Readiness feature shall frontend と resource server が HTTPS で到達可能であることを検証する。
2. When 許可されたfrontend originからprotected resourceを確認する, the Submission Readiness feature shall preflight、必要なrequest header、公開response header、および`no-store`を検証する。payment readinessがreadyなら単一Base Sepolia exact条件を必須とし、unavailableなら安全なpayment-disabled状態と成功するsponsor pathを必須とする。
3. When 公開 frontend を確認する, the Submission Readiness feature shall 配備 origin に対応する有効な Origin Trial 設定が応答または文書内に存在することを検証する。
4. When hosted facilitator を確認する, the Submission Readiness feature shall health と Base Sepolia `exact` 対応能力をbest-effortで検証し、失敗時はsponsor live releaseを阻害せずpaid pathをsame-release local recordingへ降格する。
5. If production の preview analysis endpoint が到達可能である, the Submission Readiness feature shall monetization bypass を release blocker として報告する。
6. If 公開応答に秘密値、stack trace、支払い payload、sponsor token、または許可されていない origin 向けの保護情報が含まれる, the Submission Readiness feature shall release を不合格にする。

### Requirement 3: 審査用ゴールデンパスと失敗経路

**Objective:** As a 審査員, I want ウォレットなしでも中核価値を完了し、有料経路も確認できる手順がほしい, so that 外部条件に左右されず製品を評価できる

#### Acceptance Criteria

1. When `analyze_recipe` が対応 WebMCP host から呼び出される, the Submission Readiness feature shall 同じ呼出しがページ上の選択を待ち、スポンサー完了後に一度だけ canonical analysis を返す経路を検証する。
2. When 可視 UI から同じ分析が開始される, the Submission Readiness feature shall WebMCP 経路と同じ gate と結果契約を使用することを検証する。
3. When 支払い経路が確認される, the Submission Readiness feature shall 手動でBase Sepolia、0.01 testnet USDC、明示wallet承認、settlement receipt、および同一要求の一回実行を検証し、公開環境で未検証なら録画/local-onlyと明示する。
4. If WebMCP、wallet、payment infrastructure、または facilitator が利用できない, the Submission Readiness feature shall publisher の閲覧を維持し、利用可能な sponsor 経路または具体的な復旧案内が表示されることを検証する。
5. When 取消、host abort、重複実行、期限切れ sponsor grant、または不正 network が発生する, the Submission Readiness feature shall 成功を誤表示せず安全な終端結果になることを検証する。
6. When 自動化できない実ブラウザまたは実 wallet の確認が必要である, the Submission Readiness feature shall 対象環境、手順、期待結果、証跡を記録する手動検証表を提供する。

### Requirement 4: 公開リポジトリの理解可能性と来歴

**Objective:** As a 審査員または再現者, I want リポジトリだけで構成・新規作業・安全上の制約を理解したい, so that 提出物の真正性と再現性を評価できる

#### Acceptance Criteria

1. When 公開 README を読む, the Submission Readiness feature shall 問題、解決策、WebMCP の役割、二つの access path、architecture、local setup、test、deployment、および live demo 導線を英語で説明する。
2. The Submission Readiness feature shall starter 由来の既存部分とハッカソン期間中に作成した AdGate 部分を区別する provenance を提示する。
3. The Submission Readiness feature shall upstream の各 app、主要な trust boundary、Base Sepolia 固定条件、および sponsor ledger の prototype 制約を誤解なく説明する。
4. The Submission Readiness feature shall 公開 repository から OSI 互換 license を容易に確認可能にし、package metadata と license 表示の矛盾を残さない。
5. If repository または配備手順に秘密鍵、seed、実 token、wallet secret、または private environment value が含まれる, the Submission Readiness feature shall release を不合格にする。
6. When 再現者が environment example を利用する, the Submission Readiness feature shall 必須値、公開可能値、secret 値、および testnet-only 制約を区別できるようにする。

### Requirement 5: Devpost とデモ動画の提出素材

**Objective:** As a 提出者, I want 審査基準に対応した英語素材を事前に揃えたい, so that 締切直前に説明や証跡が不足しない

#### Acceptance Criteria

1. The Submission Readiness feature shall project title、短い tagline、problem、solution、WebMCP 活用、human-in-the-loop、technology、challenges、accomplishments、および今後を含む英語 Devpost 原稿を提供する。
2. The Submission Readiness feature shall 四つの同等な judging criteria それぞれに対して、示す機能と証跡を対応付ける。
3. The Submission Readiness feature shall live app、公開 source repository、license、および公開 YouTube 動画の最終 URL を確認する提出 checklist を提供する。
4. The Submission Readiness feature shall 音声付きで3分未満となる英語動画台本と shot list を提供し、WebMCP invocation、ページ上の人間選択、スポンサー成功、Base Sepolia 支払いの証跡を含める。
5. The Submission Readiness feature shall publisher、gate choice、sponsor 経路、payment receipt、および WebMCP result を識別できる英語スクリーンショット一式の取得条件を定義する。
6. If 動画内のlive paymentまたは外部依存が失敗する, the Submission Readiness feature shall live fallbackなら同じcommitとpublic URL、local fallbackなら同じrelease SHAと`recorded local prototype`ラベルを持つ成功済みclipへ切り替える手順を提供する。
7. The Submission Readiness feature shall 素材の英語版または英語翻訳を必須とし、第三者の権利を確認できない素材を使用しない。

### Requirement 6: 提出統制と締切保護

**Objective:** As a ハッカソン参加者, I want feature freeze から最終送信までを明示的に管理したい, so that 未検証変更や誤った外部投稿で提出を危険にさらさない

#### Acceptance Criteria

1. When feature freeze に到達する, the Submission Readiness feature shall release blocker 以外の新機能追加を停止する checklist を提示する。
2. When release blocker が見つかる, the Submission Readiness feature shall 所有する上流仕様、影響する回帰 check、および再検証対象を記録するよう求める。
3. When 最終候補を選定する, the Submission Readiness feature shall live deployment、recording、README、Devpost 原稿、および repository commit が同じ release identity を参照するよう求める。
4. The Submission Readiness feature shall 2026年9月4日03:00 JST を内部提出期限、同日05:00 JST を公式締切としてチェック可能にする。
5. The Submission Readiness feature shall 利用者の明示操作なしに Devpost、YouTube、repository、または第三者サービスへ提出・公開・更新しない。
6. The Submission Readiness feature shall documentation generator、manual evidence recorder、typed artifact manifest、または自動final readiness evaluatorを必須実装に含めず、version-controlledな手書き資料とchecklistを使用する。
