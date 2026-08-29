# Implementation Plan

- [ ] 1. Server の契約テスト実行基盤を整える
  - runtime 境界検証と test runner に必要な依存、workspace に沿った test command、lockfile 更新を追加する。
  - 空の test discovery ではなく、最小の smoke test が server package の command から成功する状態にする。
  - 既存 server の開発起動経路と x402 runtime dependency を変更しない。
  - _Requirements: 6.1, 6.2_
  - _Boundary: ServerContracts_

- [ ] 2. Canonical runtime contracts を実装する
- [ ] 2.1 (P) Browser 境界の strict contract と host result 正規化を実装する
  - 固定 resource ID、上限付き分析入力・出力、二種の access evidence、公開 error envelope を unknown-key 拒否の runtime schema として提供する。
  - JSON-unsafe な値と秘密情報を境界から排除し、未知の例外を安全な error code と message へ正規化する。
  - 成功と失敗を WebMCP host が受け取れる JSON-safe な判別可能結果へ変換する。
  - 完了時、後続 frontend 機能が unsafe cast や独自 field 定義なしで型と validator を import できる。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5, 6.3_
  - _Boundary: FrontendContracts_

- [ ] 2.2 (P) Server 境界の HTTP、evidence、error contract を実装する
  - 分析要求・成功応答・sponsor grant 発行 envelope を browser と同じ domain field と上限で strict validation する。
  - UTC expiry、single-use 識別子、resource binding、Base Sepolia 固定、asset address、base-unit amount、transaction hash を検証する。
  - request ID と idempotency key の形式、および再送の一致・競合を後続 route が判定できる typed contract を提供する。
  - 完了時、正しい sponsor/payment evidence は受理され、wrong resource/network、期限切れ境界、secret-like key は安定した error code で拒否される。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5_
  - _Boundary: ServerContracts_
  - _Depends: 1_

- [ ] 2.3 Gate の決定的な状態遷移 contract を実装する
  - 一試行の state と event を判別可能 union として表し、設計の transition table を純粋関数へ落とし込む。
  - attempt ID の不一致、不許可 event、終端 state の再開を、元 state を保持した `INVALID_TRANSITION` として返す。
  - cancel reason と成功・失敗の terminal semantics を固定し、I/O、timer、React、payment/sponsor 処理には依存しない。
  - 完了時、同じ state/event の組は常に構造的に同じ次状態または error を返す。
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - _Boundary: GateMachine_
  - _Depends: 2.1_

- [ ] 3. Cross-app contract conformance を検証する
- [ ] 3.1 Version 付きの正常・異常 contract fixture を作成する
  - 分析要求・応答、両 evidence、gate event、error の正常例と、unknown key、各上限超過、expiry equality、wrong resource/network、secret-like key の異常例を収録する。
  - 各 case に contract 名、期待成否、値、必要な期待 error code を持たせ、実秘密・有効 token・実署名は含めない。
  - fixture は test-only の immutable JSON とし、runtime app から import されない状態にする。
  - 完了時、schema version 1 の全 case を frontend/server の test registry が決定的に列挙できる。
  - _Requirements: 1.4, 1.5, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 6.1, 6.2, 6.4, 6.5_
  - _Boundary: ConformanceFixtures_
  - _Depends: 2.1, 2.2_

- [ ] 3.2 (P) Browser contract の適合性と安全な正規化をテストする
  - 共通 fixture の browser 対象 case が期待どおり受理・拒否されることを table-driven test で検証する。
  - field 上限、unknown key、秘密情報の除去、未知例外の固定 message と retryable semantics を境界値で検証する。
  - WebMCP 成功・失敗結果が JSON round-trip 後も同値で、undefined、Date、bigint を含まないことを検証する。
  - 完了時、browser contract の意味を片側だけ変更すると test が失敗し、全適合例では frontend test suite が成功する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5_
  - _Boundary: FrontendContracts_
  - _Depends: 2.1, 3.1_

- [ ] 3.3 Gate transition table と terminal semantics をテストする
  - 全許可 edge、各 state の代表的な不許可 event、attempt ID mismatch を table-driven test で検証する。
  - succeeded、failed、cancelled が terminal であり、invalid transition 後に元 state が保持されることを検証する。
  - 同じ入力を繰り返した結果の deep equality により純粋性と決定性を確認する。
  - 完了時、設計の全 state と event type が test case に現れ、transition test が成功する。
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - _Boundary: GateMachine_
  - _Depends: 2.3_

- [ ] 3.4 (P) Server contract の evidence、冪等性、error 適合性をテストする
  - 共通 fixture の server 対象 case が browser と同じ成功・失敗判定になることを検証する。
  - expiry equality、single-use 識別、同一 idempotency key の一致・payload 競合、wrong network/resource を境界値で検証する。
  - 未加工例外、stack、secret marker が公開 error envelope へ現れず、HTTP 利用側が安定 code を得ることを検証する。
  - 完了時、契約ドリフトを fixture test が検出し、server test command から全 case が成功する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.4, 6.5_
  - _Boundary: ServerContracts_
  - _Depends: 1, 2.2, 3.1_

- [ ] 4. App 間 contract の統合整合性を確定する
  - frontend と server の test、frontend build、repository lint/type checks を実行し、契約起因の失敗のみを修復する。
  - production dependency graph に cross-app import と test fixture import が存在しないことを確認する。
  - fixture schema version、全 valid/invalid case 数、両 app の判定結果が一致することを最終検証する。
  - 完了時、全 validation command が成功し、後続仕様が各 app-local contract だけへ依存して着手できる。
  - _Requirements: 6.2, 6.4, 6.5_
  - _Boundary: FrontendContracts, ServerContracts, GateMachine, ConformanceFixtures_
  - _Depends: 3.2, 3.3, 3.4_

