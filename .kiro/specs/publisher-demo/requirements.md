# Requirements Document

## Introduction

現在の todo リファレンス体験を、単一のレシピとプレミアム分析の価値を短時間で理解できる publisher demo に置き換える。閲覧者はレシピの内容を確認し、`recipe_analysis` の共有契約に準拠した栄養・代替提案を直接実行して、同じ入力から再現可能な結果を得られる。本仕様では monetization を導入せず、後続の gate 統合前に限って publisher と分析処理を独立して検証できる development preview seam を提供する。

## Boundary Context

- **In scope**: 単一レシピの publisher 体験、レシピ詳細、分析を開始する可視操作、決定的なプレミアム分析、結果・読込中・失敗状態、レスポンシブ表示とアクセシビリティ、および独立して組み込み・省略できる development-only preview route seam。
- **Out of scope**: sponsor 閲覧、支払い、wallet、アクセス証跡、アクセス制御、WebMCP tool 登録、複数レシピ検索、CMS、生成 AI、および production runtime で preview route を mount するかを決める policy と release verification。
- **Adjacent expectations**: 分析の入出力と公開エラーは `adgate-contracts` の `recipe_analysis` 契約に従う。後続の gate と WebMCP 機能は、本仕様の分析結果を変更せず同じ分析処理へ到達できることを期待する。`x402-payment-access` は本仕様が公開する integration seam を利用し、production では un-gated preview route を条件付きで mount しない、または composition から除去する責務を持つ。

## Requirements

### Requirement 1: Publisher としての第一印象

**Objective:** As a 審査員または閲覧者, I want レシピ publisher の目的と premium analysis の価値をすぐ理解したい, so that monetization flow を試す前に製品の文脈を把握できる

#### Acceptance Criteria

1. When 閲覧者が最初にページを開く, the Publisher Demo shall publisher 名、レシピの主題、および premium analysis が提供する価値を最初の画面範囲で識別可能に表示する。
2. The Publisher Demo shall todo、task 管理、または旧 reference application の利用を示す文言や操作を主要体験に表示しない。
3. The Publisher Demo shall sponsor、支払い、wallet、またはアクセス選択を分析開始前後のいずれにも要求しない。
4. When 閲覧者がページを再読み込みする, the Publisher Demo shall 同じサンプルレシピと基本表示内容を再現する。

### Requirement 2: 単一レシピの理解可能な提示

**Objective:** As a 料理を検討する閲覧者, I want 分析対象となるレシピを十分に理解したい, so that 分析結果を元の材料と手順に照らして評価できる

#### Acceptance Criteria

1. The Publisher Demo shall レシピ名、短い紹介、人数または分量、所要時間、材料、および順序付きの調理手順を表示する。
2. The Publisher Demo shall 分析要求へ渡されるレシピ名、材料、および手順と、閲覧者に表示する内容を意味的に一致させる。
3. When レシピに食事上の特徴または注意事項がある, the Publisher Demo shall それをレシピ詳細内で識別可能に表示する。
4. If レシピの画像を表示できない, the Publisher Demo shall レシピ本文と分析操作を失わずに代替説明を提示する。
5. The Publisher Demo shall 使用する文章、画像、およびブランド要素をオリジナルまたは再利用許諾を確認できる素材に限定する。

### Requirement 3: Premium analysis の直接実行

**Objective:** As a 閲覧者, I want レシピ画面から premium analysis を直接開始したい, so that gate 統合前にも分析価値を一連の操作で確認できる

#### Acceptance Criteria

1. When 閲覧者が分析操作を開始する, the Publisher Demo shall 表示中レシピから `recipe_analysis` の有効な構造化入力を作成して分析を要求する。
2. While 分析要求が進行中である, the Publisher Demo shall 進行中であることを明示し、同じ要求を重複して開始できないようにする。
3. When 分析が成功する, the Publisher Demo shall 要約、栄養上の所見、改善提案、および免責情報をそれぞれ識別可能に表示する。
4. When 閲覧者が同じレシピを変更せずに再度分析する, the Publisher Demo shall 内容が同一の分析結果を表示する。
5. If 分析要求へ未知または許容範囲外のレシピ値が渡される, the Premium Analysis Service shall 分析を実行せず `INVALID_INPUT` として応答する。
6. The Publisher Demo shall un-gated preview handler を独立して組み込みまたは省略できる development-only integration seam として公開し、後続の `x402-payment-access` が analyzer を変更せず production の mount policy を所有できるようにする。

### Requirement 4: 決定的で信頼できる分析内容

**Objective:** As a デモ実施者, I want 分析結果が再現可能でレシピに対応してほしい, so that 三分以内の審査デモを外部生成サービスに依存せず繰り返せる

#### Acceptance Criteria

1. When 同一の有効な分析入力を複数回受け取る, the Premium Analysis Service shall 実行時刻や呼出順序に左右されない同一内容の結果を返す。
2. The Premium Analysis Service shall 分析入力で示された材料、手順、または食事上の目的に関連する所見と提案のみを返す。
3. The Premium Analysis Service shall 各成功応答を `recipe_analysis` の共有成功契約に適合させる。
4. The Premium Analysis Service shall 医療上の診断または個別治療の代替ではないことを示す免責情報を全ての成功結果に含める。
5. If 有効だがサンプル分析の対象として扱えない入力を受け取る, the Premium Analysis Service shall 内部情報を含まない安全な失敗応答を返す。

### Requirement 5: 失敗からの理解可能な回復

**Objective:** As a 閲覧者, I want 分析が失敗した理由と次に取れる行動を理解したい, so that ページを離れずに再試行できる

#### Acceptance Criteria

1. If 分析サービスへ到達できないまたは一時的に利用できない, the Publisher Demo shall 分析結果の代わりに再試行可能であることを示す安全なエラー表示を提示する。
2. If 分析サービスが入力不正を返す, the Publisher Demo shall 失敗を表示し、不正な入力値や内部診断情報を公開しない。
3. If 分析サービスが未知の失敗を返す, the Publisher Demo shall その失敗を安全な内部失敗として表示する。
4. When 失敗表示から閲覧者が再試行する, the Publisher Demo shall 同じレシピについて新しい分析要求を一回だけ開始する。
5. While 分析が失敗または再試行中である, the Publisher Demo shall レシピ本文を引き続き閲覧可能にする。

### Requirement 6: レスポンシブでアクセシブルな閲覧体験

**Objective:** As a キーボード、支援技術、または異なる画面幅を使う閲覧者, I want レシピと分析を同等に操作・理解したい, so that デモ環境に依存せず主要体験を完了できる

#### Acceptance Criteria

1. When Publisher Demo が小型画面からデスクトップ画面まで表示される, the Publisher Demo shall 横方向のページスクロールなしでレシピ、分析操作、および分析結果を閲覧可能にする。
2. The Publisher Demo shall 全ての対話操作をキーボードだけで到達および実行可能にする。
3. The Publisher Demo shall 画像、見出し、操作、進行状態、およびエラー状態を支援技術が識別できる名前または状態として提示する。
4. While 分析状態が変化する, the Publisher Demo shall 色だけに依存せず状態を伝える。
5. When 分析結果または失敗が表示される, the Publisher Demo shall 支援技術の利用者がその更新を認識できるようにする。
