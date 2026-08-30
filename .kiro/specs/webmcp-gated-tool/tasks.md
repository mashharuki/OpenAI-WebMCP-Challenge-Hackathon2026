# Implementation Plan

- [ ] 1. WebMCP と protected resource の browser 境界を準備する
- [ ] 1.1 WebMCP host の型と選択規則を安定させる
  - tool 実行 callback の取消 signal と、旧 Chrome 互換名前空間を unsafe cast なしで表現する。
  - `document` 側を優先し、存在しない場合だけ `navigator` 側を選ぶ一意の選択規則を設ける。
  - 両方利用可能、`document` のみ、`navigator` のみ、どちらも利用不能の各条件で、選択元または unsupported が観測できる test を通す。
  - _Requirements: 2.1, 2.2, 2.3, 5.2_
  - _Boundary: ModelContextSelector, WebMCP type boundary_

- [ ] 1.2 スポンサー認可付き premium analysis client を構築する
  - canonical request body と `Idempotency-Key` の同一性を維持し、スポンサー token を一時的な Authorization header だけに使用する。
  - 成功と共通エラーを strict に検証し、network failure、invalid response、abort を安全な結果へ正規化する。
  - request/header 検証、成功・失敗 parse、abort、および token が response、storage、URL、log に露出しない test を通す。
  - _Requirements: 3.3, 4.3, 5.2, 5.4, 5.5, 6.2, 6.3, 6.4, 6.5_
  - _Boundary: ProtectedAnalysisClient_

- [ ] 2. 単一試行の gate orchestration を実装する
- [ ] 2.1 canonical state machine 上に single-flight attempt core を作る
  - 一試行ごとに request ID、idempotency key、`requestId` と同じ nonce、入力、呼出元を一度だけ生成して保持する。
  - upstream state transition、snapshot 購読、一回限りの completion latch、child abort の fan-out を一つの coordinator lifetime にまとめる。
  - active中の二件目をretryableな`INVALID_TRANSITION`で拒否し、visible CTAをdisabledにしてbusy案内を表示し、最初のattempt identity/state/Promiseが変化しないことをtestする。
  - success、failure、cancel 後は一度だけ完了し、新しい attempt を開始できる状態になる。
  - _Depends: 1.2_
  - _Requirements: 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 6.1_
  - _Boundary: GateCoordinator_

- [ ] 2.2 スポンサー経路を同じ pending attempt へ接続する
  - sponsor 選択を canonical event として進行させ、既存 `SponsorGatePort` の成功・取消・失敗だけを購読する。
  - 成功時の evidence と token を一回だけ protected client へ渡し、premium success または共通エラーを元の Promise へ返す。
  - sponsor 完了までは Promise が pending で、完了後の protected call は一回だけ、別 attempt または終端後の遅延結果は破棄される test を通す。
  - sponsor の閲覧、grant 発行、検証、消費処理が coordinator に複製されていないことを import boundary で確認する。
  - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5_
  - _Boundary: GateCoordinator_

- [ ] 2.3 支払い経路と sponsor fallback を同じ attempt へ接続する
  - payment 選択時、active な canonical `PremiumAnalysisRequest` と attempt 用 `AbortSignal` を既存 `PaymentCoordinatorPort.requestPaidAccess(request, signal)` へ一度だけ渡し、その Promise を待機する。
  - 上流`PaymentTerminalResult`のsuccessはanalysisとreceiptを受け、receiptはmemory-only UIへ渡し、Gateは`payment_succeeded`で原子的に成功へ遷移する。WebMCP resultにはanalysisと短いaccess referenceだけを返す。
  - gate 開始から `confirm` や wallet method を自動実行せず、payment snapshot は UI 表示だけに使う。元の WebMCP invocation は payment/sponsor/abort/cancel の最初の終端で一度だけ settle し、late terminal result を破棄する。
  - 支払い unavailable でも sponsor 選択が維持され、開始時には wallet method が呼ばれず、success/error/cancelled と abort 競合のすべてで同じ invocation が exactly once に完了する test を通す。
  - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - _Boundary: GateCoordinator_

- [ ] 3. WebMCP と React publisher を共有 gate へ統合する
- [ ] 3.1 `analyze_recipe` WebMCP adapter を登録・実行・解除できるようにする
  - starter tool 群を、静的 name/title/description、`additionalProperties: false` の schema、untrusted content annotation を持つ単一 tool へ置き換える。
  - 固定recipe IDと任意dietary goalsだけをruntime schemaで検証し、recipe本文・unknown ID・unknown fieldはcoordinatorを開始せず`INVALID_INPUT`を返す。
  - execute callback の signal を attempt へ渡し、canonical `WebMCPToolResult` の plain JSON value を返す。
  - 同じ page lifetime で一回だけ登録され、登録 controller の abort で解除され、登録・解除の拒否は raw DOMException を出さない unavailable status になる test を通す。
  - _Depends: 1.1, 2.3_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 5.2, 5.3, 5.4, 5.5, 6.2, 6.3, 6.4, 6.5_
  - _Boundary: WebMCPAdapter_

- [ ] 3.2 React tree に一つの gate lifetime と snapshot を提供する
  - coordinator instance を page lifetime に一つだけ保ち、consumer が現在の canonical state と payment availability を購読できるようにする。
  - unmount 時に購読を解除し、active attempt を `unmounted` として cancel する。
  - provider の再描画で coordinator が増殖せず、state 更新が一回通知され、unmount 後の更新が React へ届かない component test を通す。
  - _Depends: 2.3_
  - _Requirements: 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 6.1_
  - _Boundary: GateProvider_

- [ ] 3.3 (P) 可視 publisher 操作用の gated analysis adapter を提供する
  - publisher が期待する分析 port を満たし、可視 UI source と AbortSignal を同じ coordinator へ渡す。
  - canonical success から分析 data を返し、失敗 union は token や raw cause を含まない既存 publisher error flow へ変換する。
  - 可視 CTA から表示中 recipe input が変更されず coordinator へ届き、成功結果と安全な失敗が既存 panel で観測できる test を通す。
  - _Depends: 2.3_
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 6.2, 6.3, 6.4, 6.5, 6.6_
  - _Boundary: GatedAnalysisAdapter_

- [ ] 3.4 アクセス選択と進行状況をアクセシブルに表示する
  - 選択待ちでは sponsor/payment の明示操作を表示し、選択後は upstream sponsor modal または payment panel を canonical phase に合わせて配置する。
  - 選択待ち、閲覧中、承認待ち、access granted、実行中、終端を色だけに依存せず live status として伝える。
  - payment unavailable の理由を安全に表示して payment 操作を無効化し、sponsor 操作は利用可能なまま維持する。
  - keyboard 操作、phase announcement、二重 click 抑止、payment-disabled sponsor fallback の UI test を通す。
  - _Depends: 3.2_
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.2, 5.1, 5.4, 5.5, 5.6, 6.1, 6.6_
  - _Boundary: GateExperience_

- [ ] 3.5 publisher、gate、WebMCP status を app root で composition する
  - publisher へ gated analysis adapter を注入し、gate provider、access experience、WebMCP hook が同じ coordinator を共有するよう接続する。
  - upstream publisher、sponsor、payment component の内部 ownership を変更せず、top-level wiring だけを行う。
  - WebMCP unsupported または registration failure でも publisher と可視 gated CTA が利用できる状態を維持する。
  - tool と可視 CTA のどちらから開始しても同じ gate status が表示され、unsupported host でも通常 UI が動く smoke test を通す。
  - _Depends: 3.1, 3.2, 3.3, 3.4_
  - _Requirements: 2.3, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - _Boundary: AppComposition_

- [ ] 4. Cross-boundary behavior と regression を検証する
- [ ] 4.1 sponsor、payment、abort、重複、race の統合 test を完成させる
  - deferred fake ports により、両 access path の tool Promise が人間の終端操作まで pending であることを検証する。
  - host abort、user cancel、unmount と成功の競合で、最初の終端だけが state/result に反映され、遅延結果は無視されることを検証する。
  - active 中の二つ目の tool invocation と可視 UI の重複 start を個別に発生させ、両方が拒否されても既存 attempt が変化しないことを検証する。
  - `requestPaidAccess` が同じ request と signal で一回だけ呼ばれ、sponsor/payment の成功が同じ structured result を返し、payment error/cancelled を含む全 failure が JSON-safe かつ token、signature、stack、raw provider data を含まないことを確認する。
  - _Depends: 3.5_
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - _Boundary: WebMCPGateIntegration_

- [ ] 4.2 frontend regression と品質 gate を通す
  - `document`、legacy `navigator`、unsupported の各 host、keyboard 操作、live region、publisher 表示をまとめて回帰検証する。
  - 旧 todo tool が登録・表示されず、`analyze_recipe` が一件だけ discoverable であることを確認する。
  - frontend test、production build、repository Biome check を実行し、すべて成功する状態にする。
  - _Depends: 4.1_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - _Boundary: ReleaseValidation_
