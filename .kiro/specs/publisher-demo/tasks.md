# Implementation Plan

- [x] 1. Publisher が共有する sample recipe foundation を固定する
- [x] 1.1 Owned recipe content と分析入力を一つの source として提供する
  - `Open Table Journal`の`Roasted Chickpea Quinoa Bowl`を固定recipe ID、owned copy、CSS/illustrationとして定義する。
  - tool/HTTP入力はrecipe IDと任意dietary goalsだけにし、title、ingredients、instructionsはcanonical sourceから解決する。
  - publisher の brand、紹介、人数、所要時間、tag、代替説明付き hero asset、材料、順序付き手順を immutable な sample として定義する。
  - 画面表示するtitle、ingredients、instructionsはcanonical recipeから描画し、上流の厳格な`recipe_analysis`入力にはrecipe IDと任意dietary goalsだけを渡す。
  - sample が shared input contract に適合し、reload や呼出時刻に関係なく同じ値になることを focused test で確認する。
  - 完了時、単一のRoasted Chickpea Quinoa Bowl sampleとowned assetが表示・分析の双方から利用できる。
  - _Requirements: 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1_
  - _Boundary: SampleRecipe_

- [x] 2. Deterministic premium analysis backend を実装する
- [x] 2.1 Pure analyzer と canonical result を実装する
  - 検証済み入力だけを受け、recipe の材料・手順・dietary goals に対応する summary、nutritional insights、suggestions、disclaimer を返す。
  - 時刻、乱数、environment、network、外部 AI に依存せず、同一入力から deep-equal な result を返す。
  - unsupported な有効入力を上流 taxonomy の safe error outcome にし、入力値を公開しない。thrown/unknown failure の正規化は HTTP boundary に委ねる。
  - 完了時、sample input の反復分析が常に canonical result schema に適合し、unsupported case が安全に失敗する unit test が成功する。
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - _Boundary: DeterministicAnalyzer_

- [x] 2.2 Preview HTTP boundary を追加する
  - preview request を上流 server contract で strict validation し、analyzer outcome を success または normalized error response に写像する。
  - access evidence を生成・要求せず、invalid body、unsupported sample、unknown exception を設計どおりの status と safe envelope で返す。
  - router を server import 時に自己登録しない factory として公開し、development composition が明示的に mount または省略できる seam にする。
  - Hono in-memory request によって valid、unknown field、unsupported、sanitized internal failure、および省略時の route absence を検証する。
  - 完了時、`POST /api/recipe-analysis/preview` router が network listener なしで契約適合 response を返し、factory を組み込まない app には route が追加されない。
  - _Requirements: 3.5, 3.6, 4.3, 4.5, 5.2, 5.3_
  - _Boundary: PreviewRoute_

- [x] 3. Publisher presentation と browser client を構築する
- [x] 3.1 (P) Semantic recipe article を実装する
  - publisher value proposition と recipe metadata、材料、順序付き手順、食事上の特徴を semantic heading/list 構造で提示する。
  - owned hero asset に意味のある代替説明を付け、asset failure 時にも本文と分析操作を失わない layout を提供する。
  - 完了時、desktop と small viewport の双方で todo 文脈を表示せず、recipe 全情報を横 scroll なしで読める component になる。
  - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 6.1, 6.2, 6.3_
  - _Boundary: RecipeArticle_
  - _Depends: 1.1_

- [x] 3.2 (P) Accessible analysis states を実装する
  - idle CTA、loading、success の四結果領域、safe error と retry action を判別 state から表示する。
  - loading と更新を色以外の text、disabled semantics、live announcement で伝え、全操作を keyboard から実行可能にする。
  - 完了時、各 state を単独 render して summary、insights、suggestions、disclaimer、error、retry の accessible name/state を検証できる。
  - _Requirements: 3.2, 3.3, 5.1, 5.2, 5.3, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5_
  - _Boundary: AnalysisPanel_

- [x] 3.3 (P) Typed preview analysis client を実装する
  - sample input を request ID と idempotency key を持つ preview request として一度送信し、成功・error の双方を frontend contract で検証する。
  - network failure、invalid JSON、wrong resource、unknown response を safe error に正規化し、AbortSignal を transport へ伝播する。
  - 完了時、mock transport に対する success、failure、abort の focused test で unvalidated payload が UI へ到達しない。
  - _Requirements: 3.1, 3.3, 3.4, 3.5, 5.1, 5.2, 5.3_
  - _Boundary: AnalysisClient_

- [x] 4. Publisher vertical slice を app へ統合する
- [x] 4.1 Publisher request lifecycle を接続する
  - recipe article、analysis panel、typed client を一画面に構成し、idle、loading、success、error の state transition を所有する。
  - pending 中の連打を一回の client call に抑え、retry は同じ recipe への新しい要求を一回だけ開始し、unmount abort 後は state を更新しない。
  - 完了時、fake client を使う UI test で loading、duplicate prevention、success、safe failure、retry recovery を一連に観察できる。
  - _Requirements: 1.1, 1.3, 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3, 5.4, 5.5, 6.2, 6.3, 6.4, 6.5_
  - _Boundary: PublisherDemo_
  - _Depends: 3.1, 3.2, 3.3_

- [x] 4.2 Frontend root を publisher composition へ切り替える
  - todo UI を root から外し、publisher header、recipe、analysis experience と responsive visual treatment を app entry に接続する。
  - starter の reusable UI/runtime entry を維持しつつ、主要画面から todo/task 文言と操作を除く。
  - 完了時、root smoke test が publisher value proposition と analysis CTA を確認し、旧 todo UI が存在しないことを確認する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.1, 6.2, 6.3_
  - _Boundary: PublisherDemo, AppComposition_

- [x] 4.3 Preview router を development composition へ接続する
  - preview router factory を既存 Hono app の development composition に一度だけ明示接続し、health、weather、x402 middleware/config の既存挙動を変更しない。
  - preview が sponsor/payment header を要求せず、canonical protected route と異なる path であることを smoke test する。
  - production runtime の条件分岐を本 task へ取り込まず、後続 `x402-payment-access` が同じ seam から preview mount/除去 policy を所有できる状態を維持する。
  - 完了時、development 用 in-memory composition から preview endpoint が利用でき、seam を省略した composition では同 path が存在せず、既存 endpoint の regression check も成功する。
  - _Requirements: 3.1, 3.5, 3.6, 5.1, 5.2, 5.3_
  - _Boundary: PreviewRouteFactory, DevelopmentServerComposition_
  - _Depends: 2.2_

- [ ] 5. Publisher slice の contract と user journey を最終検証する
- [ ] 5.1 Cross-app preview contract を検証する
  - 同じ test-only JSON fixture を frontend と server の app-local validator が独立に読み、sample request と response を同じ意味で受理することを確認する。
  - production code は fixture または相手 app の source を import せず、preview success の四結果領域と disclaimer が canonical schema に一致することを確認する。
  - preview endpoint が grant、payment、wallet、WebMCP import や自己登録 side effect を持たず、省略可能な development-only seam として隔離されていることを検証する。
  - 完了時、片側の field drift で contract test が失敗し、整合した fixture では frontend/server の双方が成功する。
  - _Requirements: 2.2, 3.1, 3.3, 3.5, 3.6, 4.3, 5.2, 5.3_
  - _Boundary: AnalysisClient, PreviewRoute_
  - _Depends: 4.1, 4.3_

- [ ] 5.2 Publisher UI、accessibility、build regression を検証する
  - frontend unit/UI suite、server analyzer/route suite、frontend build、repository quality check を実行する。
  - 320px 相当の responsive layout、keyboard CTA/retry、live status、owned local asset、raw error/secret 非公開を検証する。
  - publisher root が todo UI を表示せず、sample の閲覧から loading、result または retry recovery までを完了できることを確認する。
  - deployed endpoint や production preview availability を release verification として判定せず、完了時には publisher demo の boundary 内 validation command が成功し、後続 gate が analyzer、UI、preview integration seam を再利用できる。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.3, 2.4, 2.5, 3.2, 3.4, 4.1, 4.2, 4.4, 4.5, 5.1, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5_
  - _Boundary: PublisherDemo, DeterministicAnalyzer_
  - _Depends: 5.1_
