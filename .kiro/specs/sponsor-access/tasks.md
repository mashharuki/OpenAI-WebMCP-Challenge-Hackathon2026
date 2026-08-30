# Implementation Plan

- [x] 1. スポンサーアクセス境界を準備する
- [x] 1.1 (P) server のスポンサー発行境界を定義する
  - 上流 AdGate 契約を再利用し、session開始、grant発行、成功応答、エラー応答をstrict validationする。
  - server-owned sponsor metadata、8秒の必要時間、90秒session、60秒grantを固定し、client-supplied sponsor/completion IDを受け取らない。
  - server validator の valid/invalid payload と上限境界 test を追加する。
  - 完了時、発行 route が未知 JSON を安全な型へ変換できる server contract と test 結果が得られる。
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 6.3_
  - _Boundary: SponsorGrantRoutes_

- [x] 1.2 (P) frontend のスポンサー発行 client 境界を定義する
  - server と同じ発行要求・成功応答・共通 error envelope を frontend で strict validation する。
  - valid/invalid fixture を用い、server schema と同じ payload を同じ結果として判定する。
  - token を永続 storage、URL、error message へ出さない client contract を固定する。
  - 完了時、browser が発行応答を上流 evidence または安全な error へ変換できる test が通る。
  - _Requirements: 4.1, 4.2, 4.3, 4.5, 6.1, 6.3_
  - _Boundary: SponsorGrantClient_

- [x] 2. スポンサー閲覧体験を実装する
- [x] 2.1 (P) 試行単位の可視時間と終端状態を実装する
  - 単調時計と visibility を注入可能にし、visible 区間だけを required duration へ加算する。
  - attempt ID と nonce を保持し、別試行の event、cancel 後の tick、遅延 response を無視する。
  - success、cancel、abort、unmount のうち最初の終端結果だけを通知する。
  - fake clock test で hidden 区間、時計変動、時間境界、再試行分離が決定的に通る。
  - server-issued sessionを開始し、browserの8 visible secondsとserverの8 wall-clock secondsの両方を満たした場合だけissueする。
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.2, 3.3, 3.4, 6.2, 6.4_
  - _Boundary: SponsorFlowController_
  - _Depends: 1.2_

- [x] 2.2 (P) アクセシブルなスポンサー表示を実装する
  - 無料経路、必要時間、取消方法、static sponsor creative を明確に表示する。
  - 明示的な start、disabled な continue、残り秒、完了状態、cancel 操作を提供する。
  - dialog semantics、initial focus、focus confinement、Escape、focus restoration を実装し、autoplay audio と tracking を含めない。
  - UI test でキーボードのみの開始・取消と、完了前後の操作可否が確認できる。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.3, 2.4, 3.1_
  - _Boundary: SponsorModal_
  - _Depends: 1.2_

- [x] 2.3 sponsor provider と発行 client を接続する
  - 一件だけの active attempt を modal host へ公開し、二件目を既存 attempt を壊さず拒否する。
  - countdown 完了後のみ発行 endpoint を呼び、成功証跡または安全な失敗を元 attempt へ一度返す。
  - AbortSignal と provider unmount で HTTP と UI を終了し、token は memory 外へ保存しない。
  - provider harness test で成功、取消、dependency failure、late response の observable result が確認できる。
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.5, 6.1, 6.2, 6.3, 6.4_
  - _Boundary: SponsorGateProvider, SponsorGrantClient_

- [x] 3. 一回限り grant domain を実装する
- [x] 3.1 (P) process-local grant ledger を実装する
  - session/grant credentialのdigest、binding、開始・期限、上流証跡、状態だけを保持し、credential原文を保存しない。
  - available から consumed への比較と更新を await のない同期区間で行う。
  - expiry equality、resource/nonce mismatch、unknown、replay、競合 consume を上流 error code へ区別する。
  - test で競合する二消費の最大一件だけが成功し、再起動相当の新 ledger では旧 token が無効になる。
  - session create/expiry/atomic consumeと、同一issue identityへgrant期限内だけ同じtoken/evidenceを返すbounded issuance-response cacheを実装する。
  - _Requirements: 4.2, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.3_
  - _Boundary: SponsorGrantLedger_
  - _Depends: 1.1_

- [x] 3.2 grant 発行・消費 policy を実装する
  - CSPRNG token、短期 TTL、resource/nonce binding を用いて上流 `SponsorAccessEvidence` を発行する。
  - 同じ完了試行の再送を同じ logical issue とし、異なる内容の digest conflict を拒否する。
  - token digest を用いて ledger を消費し、安全な discriminated result だけを返す。
  - service test で idempotent issue、重複 nonce、expired、binding mismatch、single use が確認できる。
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 6.3_
  - _Boundary: SponsorGrantService_

- [ ] 4. server adapter と grant domain を統合する
- [ ] 4.1 (P) sponsor grant 発行 route を提供する
  - `/api/sponsor-sessions`は固定creative metadataとsingle-use sessionを201で返し、`/api/sponsor-grants`はstrict parse済みsession credentialだけをserviceへ渡す。
  - grant発行前にsession binding、90秒期限、未消費、server経過8秒を検証する。
  - invalid、conflict、dependency、internal failure を共通 error envelope と固定 status へ変換する。
  - response と構造化 log から token 以外の秘密値、stack、raw exception を除外する。
  - standalone Hono test app で成功、再送、invalid、safe failure の HTTP behavior が通る。
  - _Requirements: 4.1, 4.3, 4.4, 4.5, 6.3_
  - _Boundary: SponsorGrantRoutes_
  - _Depends: 3.2_

- [ ] 4.2 (P) Sponsor authorization adapter を提供する
  - Authorization header の exact Sponsor scheme を parse し、resource と nonce を grant に照合する。
  - missing、malformed、unknown、expired、reused、mismatch を対応する AdGate error へ正規化する。
  - 成功時は上流 `SponsorAccessEvidence` のみを premium integration へ返す。
  - adapter test で発行 token の一回目だけが成功し、二回目と全 invalid variant が期待 code になる。
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.3_
  - _Boundary: SponsorAuthorizer_
  - _Depends: 3.2_

- [ ] 5. スポンサー経路を境界横断で検証する
- [ ] 5.1 browser から一回消費までの統合 test を完成する
  - session開始、hidden中に止まる8秒visible countdown、server elapsed検証、grant issue、Authorization変換、consume successを一つのdeterministic flowで検証する。
  - cancel、abort、hidden countdown、expiry、replay、resource/nonce mismatch を end-to-end boundary case として検証する。
  - sponsor content や token が storage、URL、公開 error、log に残らないことを確認する。
  - 完了時、wallet なしのスポンサー経路が共通 evidence を一度返し、再利用が明示的に拒否される test suite が通る。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4_
  - _Boundary: Sponsor Access integration tests_
  - _Depends: 2.3, 4.1, 4.2_
