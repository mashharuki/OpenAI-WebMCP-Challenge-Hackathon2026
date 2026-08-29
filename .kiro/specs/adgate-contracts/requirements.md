# Requirements Document

## Introduction

AdGate のブラウザ、プレミアムリソースサービス、支払い facilitator が独立して実装されても、単一の `recipe_analysis` リソースを同じ意味で扱える共通契約を定義する。契約は入力・出力、ゲートの状態とイベント、スポンサー付与および支払い証跡、有効期限・冪等性、ならびに安全なエラーを対象とし、境界を越える値を決定的かつ検証可能にする。

## Boundary Context

- **In scope**: `recipe_analysis` の識別子と分析データ、ゲート状態・イベント、スポンサー付与と支払い証跡、期限・一回限り利用・冪等性、エラー分類、互換性を検証する共通例。
- **Out of scope**: 画面表示、広告再生、WebMCP 登録、支払い署名・検証・決済、アクセス制御の業務ロジック、HTTP ルート実装、永続化、および汎用 SDK の公開。
- **Adjacent expectations**: 後続機能は本仕様の契約を各外部境界で検証し、スポンサー経路と支払い経路の双方から同じプレミアムリソース結果へ到達する。本仕様はアクセス証跡を発行・検証・消費しない。

## Requirements

### Requirement 1: プレミアムリソース契約

**Objective:** As a 後続機能の開発者, I want プレミアム分析の入出力を一意かつ検証可能な契約として扱いたい, so that ブラウザとサービス間で解釈がずれない

#### Acceptance Criteria

1. The AdGate contract shall プレミアムリソースを固定識別子 `recipe_analysis` によって一意に識別する。
2. When 分析要求が契約境界へ渡される, the AdGate contract shall レシピ名、材料、手順、および任意の食事上の目的を含む構造化入力として表現できるようにする。
3. When 分析結果が契約境界から返される, the AdGate contract shall 要約、栄養上の所見、改善提案、および免責情報を含む構造化出力として表現できるようにする。
4. If 入力に未知フィールド、許容されない値、または規定上限を超える文字列・配列が含まれる, the AdGate contract shall その入力を拒否可能なものとして定義する。
5. The AdGate contract shall 全ての境界値を JSON で損失なく表現できるものに限定する。

### Requirement 2: 決定的なゲート状態とイベント

**Objective:** As a ゲートフロー実装者, I want 状態とイベントの共通語彙および遷移規則を使いたい, so that UI とエージェント実行が同じ進行状況を共有できる

#### Acceptance Criteria

1. The AdGate contract shall 未開始、選択待ち、スポンサー閲覧中、支払い承認待ち、アクセス付与済み、実行中、成功、失敗、および取消済みを区別する。
2. When 有効なイベントが現在状態へ適用される, the AdGate contract shall 次状態を一意に決定できる遷移として定義する。
3. If 現在状態では許可されないイベントが適用される, the AdGate contract shall 状態を変更せず、無効遷移として識別できるようにする。
4. When 成功、失敗、または取消済みへ到達する, the AdGate contract shall そのゲート試行を終端状態として扱う。
5. While ゲート試行が終端状態にある, the AdGate contract shall 新しい試行を開始するイベント以外による再開を許可しない。

### Requirement 3: アクセス証跡契約

**Objective:** As a プレミアムリソースサービス実装者, I want スポンサー付与と支払い証跡を明確に区別したい, so that どちらの経路も安全に同じリソースへアクセスできる

#### Acceptance Criteria

1. The AdGate contract shall スポンサー付与と支払い証跡を判別可能な二つの証跡種別として定義する。
2. When スポンサー付与が表現される, the AdGate contract shall 不透明な付与 ID、対象リソース、発行時刻、有効期限、および一回限り利用の識別情報を含める。
3. When 支払い証跡が表現される, the AdGate contract shall 対象リソース、支払い要求との対応情報、取引識別情報、ネットワーク識別子、資産識別子、支払額、および確認時刻を含める。
4. If アクセス証跡の対象リソースが要求されたプレミアムリソースと一致しない, the AdGate contract shall 証跡を不適合として識別できるようにする。
5. If アクセス証跡に秘密鍵、ウォレット署名用秘密情報、または再利用可能な認証秘密が含まれる, the AdGate contract shall その値を拒否可能なものとして定義する。

### Requirement 4: 有効期限、一回限り利用、冪等性

**Objective:** As a アクセス経路実装者, I want 時間と重複要求に関する規則を共有したい, so that 再試行時にも二重実行や期限切れアクセスが起きない

#### Acceptance Criteria

1. The AdGate contract shall 全ての有効期限と発生時刻をタイムゾーン非依存の絶対時刻として表現する。
2. If 現在時刻がスポンサー付与の有効期限以上である, the AdGate contract shall その付与を期限切れとして扱う。
3. When 一回限りのスポンサー付与が正常に消費される, the AdGate contract shall 同じ付与 ID による後続利用を再利用として識別できるようにする。
4. When 同じ冪等性キーと同じ要求内容が再送される, the AdGate contract shall 同じ論理操作として関連付けられるようにする。
5. If 同じ冪等性キーが異なる要求内容に使用される, the AdGate contract shall 競合として識別できるようにする。

### Requirement 5: 安全で機械可読なエラー契約

**Objective:** As a 利用者と連携機能の実装者, I want 安定したエラー分類と安全な説明を受け取りたい, so that 復旧可能性を判断でき、内部情報が漏えいしない

#### Acceptance Criteria

1. The AdGate contract shall 入力不正、無効遷移、アクセス必須、証跡不正、期限切れ、再利用、冪等性競合、取消、依存サービス利用不可、および内部失敗を安定した機械可読コードで区別する。
2. When 契約エラーが返される, the AdGate contract shall コード、人間が読める安全なメッセージ、再試行可否、および任意の相関 ID を含める。
3. If エラー原因に秘密情報、スタックトレース、内部設定、または第三者サービスの未加工応答が含まれる, the AdGate contract shall それらを公開メッセージから除外する。
4. When 入力の特定箇所が不正である, the AdGate contract shall 秘密値を含めずに問題箇所を識別できる詳細を表現する。
5. If エラーコードが契約で定義されていない, the AdGate contract shall 既知の安全な内部失敗として正規化できるようにする。

### Requirement 6: 境界間互換性

**Objective:** As a リリース担当者, I want 各アプリの契約表現を共通例で検証したい, so that 個別実装を変更しても統合時の破壊を検出できる

#### Acceptance Criteria

1. The AdGate contract shall 正常な分析要求・応答、各アクセス証跡、各ゲートイベント、および代表的なエラーについて共通の適合例を提供する。
2. When フロントエンドまたはリソースサービスが共通の適合例を検証する, the AdGate contract shall 同じ例を同じ成功または失敗結果として判定できるようにする。
3. When WebMCP ホストへ結果が渡される, the AdGate contract shall プレミアム分析結果または契約エラーを JSON 安全な正規形へ変換できるようにする。
4. If 契約に後方互換性のない変更が加えられる, the AdGate contract shall 互換性検証でその変更を検出できるようにする。
5. The AdGate contract shall スポンサー閲覧、支払い処理、アクセス制御、またはプレミアム分析の業務処理そのものを適合例の責務に含めない。
