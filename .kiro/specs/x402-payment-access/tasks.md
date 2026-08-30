# Implementation Plan

- [x] 1. Base Sepolia 支払い基盤を単一方針へ整理する
- [x] 1.1 Server-authoritative な支払い設定と起動時検証を実装する
  - 価格を0.01 testnet USDCへ固定し、canonical asset/decimalsからbase-unit量を検証する。payToとfacilitator URLはenvironmentから取得する。
  - `recipe_analysis`、Base Sepolia、exact、testnet USDC、受取先、支払額を一つの immutable 方針として構築する。
  - 欠落設定、不正 address/amount、複数 offer、他 network/scheme を fail-closed の安全な error にする。
  - 完了時、正常設定は一件の offer だけを返し、World Chain または mainnet を含む設定では支払い経路が ready にならない。
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 6.1, 6.2_
  - _Boundary: PaymentPolicy_

- [x] 1.2 Resource server の登録を Base Sepolia exact だけへ縮退する
  - weather 用 policy、World Chain、multi-network accepts の登録を除去する。
  - resource server が `eip155:84532` の exact だけを登録し、AgentKit free-trial を支払い authorization として扱わないようにする。
  - 完了時、server の payment registration と offer に Base Sepolia exact 以外が現れない。
  - _Requirements: 1.1, 1.2, 1.3, 6.2, 6.3_
  - _Boundary: ServerPaymentRegistration_

- [x] 1.3 Optional local facilitator を Base Sepolia exact だけへ縮退する
  - World Chain client、World Chain registration、upto scheme を削除し、Base Sepolia signer だけを構築する。
  - lifecycle logging から payment payload、signature、未加工 context を除去する。
  - 完了時、supported capability に Base Sepolia exact 以外が現れず、facilitator package の build が成功する。
  - _Requirements: 1.2, 1.3, 2.5, 5.5, 6.2, 6.3_
  - _Boundary: LocalFacilitatorCompatibility_

- [x] 1.4 Server 支払い用の再現可能な test runtime を追加する
  - server に package-level test command と mock facilitator を実行できる test dependency を追加する。
  - 実秘密鍵、testnet RPC、hosted facilitator なしで server 境界 test が動く構成にする。
  - 完了時、server test command が最小 smoke test を検出して成功する。
  - _Requirements: 5.5, 6.5_
  - _Boundary: ServerPaymentTestHarness_

- [x] 1.5 Browser payer dependency と mock provider 基盤を追加する
  - frontend に viem、x402 HTTP client、EVM exact client の既存 2.23 系列 dependency を追加する。
  - EIP-1193 mock provider を frontend の既存 Vitest 環境から利用可能にする。
  - 完了時、実 wallet なしで provider method の呼出順を検証する smoke test と frontend build が成功する。
  - _Requirements: 2.2, 2.5, 6.5_
  - _Boundary: BrowserPaymentTestHarness_

- [ ] 2. Server の支払い保護境界を実装する
- [x] 2.1 Prototype の bounded idempotency registry を実装する
  - sponsor/payment共通でidempotency key、request digest、evidence fingerprintを照合し、成功結果だけ五分cacheする。
  - route認可より先にidentityのin-flight slotをclaimし、そのoperation内でauthorize/consume/verify/settle/handlerを一度だけ実行する。同一identityはpromise/cacheを共有し、既存keyに対するdigestまたはfingerprint不一致は409にする。
  - idempotency key と canonical request digest を結び付け、同じ操作の in-flight promise を共有する。
  - 同じ key の異なる payload を競合として拒否し、成功結果を bounded TTL 内で再利用する。
  - signature と payment payload は registry に保存せず、期限後の状態を確実に破棄する。
  - 完了時、同内容の同時・事後 retry は operation を一度だけ実行し、異内容 retry は安定した競合 error になる。
  - _Requirements: 3.4, 3.5_
  - _Boundary: ProtectedAttemptRegistry_
  - _Depends: 1.4_

- [x] 2.2 x402 保護 adapter を実装する
  - 無証跡要求には単一の 402 offer を返し、検証・決済成功時だけ注入された premium handler へ委譲する。
  - request ID、idempotency key、canonical payload を registry へ渡し、同内容 retry と payload 競合を一貫して扱う。
  - settlement 成功を canonical payment evidence と成功 envelope へ正規化し、未加工 facilitator response を公開しない。
  - 完了時、mock 経路で 402 から paid 200 へ到達し、handler は決済成功時に一度だけ呼ばれる。
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.4, 3.5, 4.3, 4.5, 5.5_
  - _Boundary: PaymentProtection_
  - _Depends: 1.1, 1.4, 2.1_

- [ ] 2.3 (P) CORS、支払い header 公開、no-store policy を実装する
  - sponsor session/grant/protected analysis全routeへ共通適用し、`Authorization`をrequest allowlistへ含める。
  - allowlist origin の OPTIONS/POST、必要 request header、支払い response header の公開を設定する。
  - 402、200、4xx、5xx の全応答へ no-store と origin variation を適用する。
  - 未許可 origin を payment middleware より前で拒否し、challenge、evidence、premium result を返さない。
  - 完了時、allowed origin の browser preflight は成功し、disallowed origin と cacheable payment response の test は拒否される。
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - _Boundary: PaymentHttpPolicy_
  - _Depends: 1.4_

- [ ] 2.4 (P) Facilitator readiness を安全に評価する
  - 必須 config、health、supported capability を timeout 付きで検証し、Base Sepolia exact の組だけを ready とする。
  - probe failure と互換性不一致を安全な dependency error へ正規化し、raw response を公開しない。
  - payment unavailable を process health と sponsor availability から分離する。
  - 完了時、mock facilitator の timeout、unsupported network/scheme、正常応答がそれぞれ決定的な readiness state になる。
  - _Requirements: 4.3, 5.5, 6.1, 6.2, 6.3, 6.4_
  - _Boundary: PaymentReadiness_
  - _Depends: 1.1, 1.4_

- [ ] 2.5 Canonical recipe analysis route と preview mounting を合成する
  - `POST /api/recipe-analysis` を一度だけ mount し、`Authorization` header が存在すれば `SponsorAuthorizer`、存在しなければ `PaymentProtection` へ排他的に振り分ける。
  - malformed/invalid/expired/reused sponsor header と sponsor dependency failure は payment challenge へ fall through させず、payment failure/challenge も sponsor へ fall through させない。どの失敗でも premium handler を呼ばない。
  - 両認可経路が同一 `PremiumAnalysisHandler` instance へ canonical request と対応する `AccessEvidence` subtype を渡すようにし、publisher の分析ロジックを composition 内へ複製しない。
  - publisher の preview router は production では設定値にかかわらず未登録、非 production では明示 opt-in 時だけ登録する。`submission-readiness` には到達不能の検証だけを残す。
  - 完了時、branch spy test で各要求が一つの authorizer だけを呼び、両成功が同じ handler を一度だけ呼び、production preview が 404 になる。
  - _Requirements: 7.1, 7.2, 7.3, 7.6_
  - _Boundary: RecipeAnalysisRouteComposition_
  - _Depends: 2.2, 2.3_

- [ ] 3. Browser の支払い boundary を実装する
- [ ] 3.1 (P) 402 challenge client を実装する
  - premium request の初回応答を strict に分類し、server が提示する単一 offer だけを画面用の安全な値へ正規化する。
  - 欠落、複数 offer、wrong resource/network/scheme/asset、invalid amount/address を署名前に拒否する。
  - 完了時、server-derived price/network/asset を取得でき、不正 challenge は安全な error になる。
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 3.1_
  - _Boundary: ChallengeClient_
  - _Depends: 1.5_

- [ ] 3.2 Paid retry identity を維持する payment client を実装する
  - settlement headerをstrict parseし、analysis resultとnormalized receiptを一つのterminal successとして返す。
  - paid retry では元 request ID、idempotency key、canonical body を維持し、同一 attempt の concurrent retry を一つへまとめる。
  - 不正 challenge または uncertain settlement では新しい payment header を自動生成しない。
  - 完了時、同じ attempt の同時再試行が一要求になり、body または identity の変更を test が検出する。
  - _Requirements: 3.1, 3.4, 3.5, 4.5_
  - _Boundary: PaymentClient_
  - _Depends: 1.5, 3.1_

- [ ] 3.3 (P) 注入ウォレット adapter と Base Sepolia enforcement を実装する
  - provider の存在、account 接続、chain ID、必要な network switch、switch 後の再確認を typed port 越しに扱う。
  - connect、switch、signature は caller の明示確認後だけ開始し、他 chain のまま署名しない。
  - user reject、provider absence、insufficient funds/allowance、unknown provider error を秘密情報なしの公開 error へ正規化する。
  - 完了時、mock provider の call sequence が確認操作前は空で、承認時だけ Base Sepolia 接続から署名まで進む。
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 4.2, 5.5_
  - _Boundary: WalletAdapter_
  - _Depends: 1.5_

- [ ] 3.4 支払い coordinator と terminal semantics を実装する
  - review、wallet 接続、署名待ち、settling、success、not-paid failure、uncertain failure、cancel を一試行の状態として進める。
  - duplicate confirm を coalesce し、決済前 cancel では retry/handler を実行しない。
  - uncertain settlement では新しい署名を自動生成せず、同じ identity の安全な retry 情報を保持する。
  - `PaymentCoordinatorPort.requestPaidAccess(request, signal?)` を公開し、Promise を人間操作中も保持して、`PaymentTerminalResult` の success/error/cancel の最初の一件だけで完了する。
  - terminal 後の wallet/network/facilitator/abort callback を attempt ID と completion latch で無視し、active 中の二件目は最初の attempt を壊さず typed error terminal にする。WebMCP lifecycle 自体は呼ばない。
  - 完了時、mock の成功・拒否・cancel・timeout・pre-abort・late callback の各 flow が一つの terminal result に exactly once で到達する。
  - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 7.4, 7.5_
  - _Boundary: PaymentCoordinator_
  - _Depends: 3.2, 3.3_

- [ ] 4. 人間確認と支払い結果を画面へ接続する
- [ ] 4.1 支払い確認 panel を実装する
  - 402 由来の network、USDC amount、asset、短縮 payTo と必要操作を署名前に表示する。
  - 明示確認、進行段階、disabled duplicate action、safe error、retry、sponsor return、settlement receipt を表示する。
  - provider request は確認 button の user event からだけ開始し、mount または challenge 表示では開始しない。
  - 完了時、UI test で確認前の wallet call がゼロであり、成功時に transaction と Base Sepolia receipt、失敗時に回復 action が見える。
  - _Requirements: 1.4, 2.1, 2.2, 2.3, 2.4, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5_
  - _Boundary: PaymentPanel_
  - _Depends: 3.4_

- [ ] 5. 支払い経路の統合契約を検証する
- [ ] 5.1 Server の 402、決済、CORS、idempotency integration test を完成させる
  - contract-compliant stub handler と mock facilitator で、無証跡 402、paid retry 200、payment evidence、settlement header を検証する。
  - verify failure、timeout、wrong network、同一 retry、payload conflict、未許可 origin では handler と追加 settlement が呼ばれないことを検証する。
  - 全 response の no-store、公開 header、safe error body を検証する。
  - sponsor header 有無の排他的 branch、invalid sponsor の no-fallback、共有 handler identity、production preview 404、development explicit opt-in も同じ in-memory app で検証する。
  - 完了時、server test command が実ネットワークなしで全 critical paid-path と canonical composition case を成功させる。
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3, 3.4, 3.5, 4.3, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 6.5, 7.1, 7.2, 7.3, 7.6_
  - _Boundary: ServerPaymentTestHarness_
  - _Depends: 2.4, 2.5_

- [ ] 5.2 (P) Browser の consent、network、retry、recovery integration test を完成させる
  - UI、coordinator、mock provider、mock server を結び、表示された条件を明示承認して同じ要求が再送されることを検証する。
  - wallet absence/reject、wrong chain/switch reject、insufficient funds、cancel、uncertain settlement で premium success が返らないことを検証する。
  - error/serialized state/log に private key、seed、signature、raw provider response が現れないことを検証する。
  - `requestPaidAccess` が success/error/cancel を exactly once で返し、terminal 後の late response/abort と active 中の二件目が最初の結果を変更しないことを検証する。
  - 完了時、frontend test suite と build が成功し、全 wallet interaction が user confirmation に追従する。
  - _Requirements: 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 5.5, 6.5, 7.4, 7.5_
  - _Boundary: BrowserPaymentTestHarness_
  - _Depends: 4.1_

- [ ] 5.3 Base Sepolia-only invariant と package validation を最終確認する
  - repository 内の payment registration と runtime policy に World Chain、mainnet、upto、複数 accepts が残っていないことを検証する。
  - frontend test/build、server test、facilitator build、lint/type checks を実行し、本仕様起因の失敗を修復する。
  - app 間 runtime import がなく、composition が sponsor domain/analyzer/WebMCP lifecycle を再実装せず、production app に preview route が登録されないことを確認する。
  - 完了時、全 validation が成功し、後続 gate integration が `PaymentCoordinatorPort` と canonical evidence だけを利用できる。
  - _Requirements: 1.2, 1.3, 2.5, 5.5, 6.2, 6.3, 6.4, 6.5, 7.1, 7.4, 7.6_
  - _Boundary: PaymentPolicy, PaymentProtection, RecipeAnalysisRouteComposition, PaymentCoordinator, LocalFacilitatorCompatibility_
  - _Depends: 5.1, 5.2_
