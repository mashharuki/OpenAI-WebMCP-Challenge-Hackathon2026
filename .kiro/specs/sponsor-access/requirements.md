# Requirements Document

## Introduction

AdGate を利用する人と審査員が、ウォレットを用意せず、ページ上でスポンサー閲覧を明示的に選択してプレミアムレシピ分析を一度だけ利用できる経路を提供する。現在はスポンサー表示、閲覧時間の確認、サーバーが認識するアクセス付与が存在しない。本機能は、人が短いスポンサー表示を最後まで確認した場合にのみ、有効期限付きかつ一回限りのアクセスを発行し、元の要求を安全に継続可能にする。

## Boundary Context

- **In scope**: スポンサー選択画面、アクセシブルなスポンサー表示、可視時間のカウントダウン、取消、要求 nonce に結び付く短期・一回限りアクセスの発行、検証、消費、および再利用・期限切れの明示。
- **Out of scope**: WebMCP ツール登録、x402 支払い、プレミアム分析内容、第三者広告ネットワーク、追跡、パーソナライズ、不正閲覧防止、永続的または分散したアクセス台帳。
- **Adjacent expectations**: 共通 AdGate 契約が状態、証跡、エラーを定義し、後続の共有ゲート統合がスポンサー成功または取消を元の UI・エージェント要求へ伝える。プレミアムリソースは、スポンサー証跡の正常消費後にのみ実行される。

## Requirements

### Requirement 1: 明示的でアクセシブルなスポンサー選択

**Objective:** As a プレミアム分析を要求した人, I want スポンサー閲覧の内容と条件を理解して自分で選択したい, so that ウォレットなしの経路を納得して利用できる

#### Acceptance Criteria

1. When プレミアムアクセスの選択が必要になる, the Sponsor Access feature shall スポンサー閲覧が無料経路であること、必要な閲覧時間、取消方法をページ上に明示する。
2. When スポンサー経路が選択される, the Sponsor Access feature shall キーボード操作可能で、適切な名前と説明を持ち、フォーカスが管理されたモーダルを表示する。
3. The Sponsor Access feature shall スポンサー表示を開始するための明示操作を要求し、自動再生音声、偽装操作、外部追跡を使用しない。
4. When スポンサー表示が閉じられる, the Sponsor Access feature shall フォーカスを開始元へ戻す。

### Requirement 2: 可視閲覧時間と完了条件

**Objective:** As a パブリッシャー, I want スポンサーが実際にページ上で一定時間表示された後にだけアクセスを付与したい, so that スポンサー支援の意図をデモで明確に示せる

#### Acceptance Criteria

1. When 人がスポンサー表示を明示的に開始する, the Sponsor Access feature shall 残り閲覧時間を秒単位で知覚可能に表示する。
2. While スポンサーモーダルまたはページが人から見えない状態にある, the Sponsor Access feature shall 完了へ向けた閲覧時間を進めない。
3. While 必要な可視閲覧時間が完了していない, the Sponsor Access feature shall アクセス取得操作を利用不可にする。
4. When 必要な可視閲覧時間が完了する, the Sponsor Access feature shall 完了状態とアクセス継続操作を明示する。
5. If 表示中に時計値が前後へ変化する, the Sponsor Access feature shall 経過時間を減少させず、必要時間より早く完了させない。

### Requirement 3: 取消と試行の分離

**Objective:** As a 人または呼び出し元, I want スポンサー閲覧を安全に取り消したい, so that 不要になった要求が裏で継続しない

#### Acceptance Criteria

1. When 人が取消操作または Escape キーを使用する, the Sponsor Access feature shall 現在のスポンサー試行を取消済みとして通知し、アクセスを発行しない。
2. When 呼び出し元がスポンサー試行を中止する, the Sponsor Access feature shall 表示とカウントダウンを終了し、以後の完了操作を無効にする。
3. If 終了済みまたは別の試行に属する遅延イベントが届く, the Sponsor Access feature shall 現在の試行状態を変更せず、アクセスを発行しない。
4. When 取消後に新しい要求が開始される, the Sponsor Access feature shall 新しい試行と閲覧時間を以前の試行から独立して扱う。

### Requirement 4: 短期スポンサーアクセスの発行

**Objective:** As a プレミアムリソースサービス, I want 完了したスポンサー試行に限定した不透明なアクセスを発行したい, so that クライアント申告だけで保護対象を利用できない

#### Acceptance Criteria

1. When 完了済みスポンサー試行が正しい対象リソースと要求 nonce を伴って提示される, the Sponsor Access feature shall 対象リソース、要求 nonce、発行時刻、有効期限、一意の付与 ID に結び付く不透明なアクセスを発行する。
2. The Sponsor Access feature shall 発行したアクセスを短い固定有効期間に限定し、人が再利用可能な認証秘密またはウォレット秘密情報を応答に含めない。
3. If 発行要求が未完了、不正、対象外リソース、または重複した要求 nonce を含む, the Sponsor Access feature shall アクセスを発行せず、安全な機械可読エラーを返す。
4. When 同じ完了済み試行の発行要求が同じ内容で再送される, the Sponsor Access feature shall 複数の有効なアクセスを作らず、同じ論理的な発行結果として扱う。
5. If スポンサーアクセス発行機能が利用できない, the Sponsor Access feature shall 支払いを成功したものとして扱わず、スポンサー経路が現在利用できないことと再試行可否を示す。

### Requirement 5: 一回限りの検証と消費

**Objective:** As a プレミアムリソースサービス, I want スポンサーアクセスを原子的に一度だけ消費したい, so that リプレイや競合要求で無償アクセスが増えない

#### Acceptance Criteria

1. When 未使用で期限内のスポンサーアクセスが対応するリソースと要求 nonce に使用される, the Sponsor Access feature shall そのアクセスを一回のプレミアム要求へ付与し、使用済みとして扱う。
2. If 現在時刻がスポンサーアクセスの有効期限以上である, the Sponsor Access feature shall そのアクセスを期限切れとして拒否する。
3. If スポンサーアクセスが既に消費済みである, the Sponsor Access feature shall 後続利用を再利用として拒否する。
4. If スポンサーアクセスの対象リソースまたは要求 nonce が要求と一致しない, the Sponsor Access feature shall そのアクセスを不正証跡として拒否する。
5. When 同じスポンサーアクセスに対する競合消費が発生する, the Sponsor Access feature shall 最大一つの要求だけを成功させる。
6. The Sponsor Access feature shall プロセス再起動や複数インスタンスを越える耐久性または不正防止を保証すると表示しない。

### Requirement 6: 継続結果と安全な失敗

**Objective:** As a 元の要求を待っている人またはエージェント, I want スポンサー経路の結果を一意に受け取りたい, so that ページや要求コンテキストを失わずに継続または中止できる

#### Acceptance Criteria

1. When スポンサーアクセスが正常に発行される, the Sponsor Access feature shall 共通 AdGate 契約に適合するスポンサー証跡を元の試行へ一度だけ返す。
2. When スポンサー試行が取り消される, the Sponsor Access feature shall 共通 AdGate 契約の取消として元の試行へ一度だけ通知する。
3. If 発行、検証、または消費が失敗する, the Sponsor Access feature shall 共通 AdGate 契約の安全なエラー分類で失敗を示し、内部例外、付与 token、設定値を公開しない。
4. While スポンサー選択または閲覧が進行中である, the Sponsor Access feature shall 元の試行識別子と要求 nonce の対応を保持する。
