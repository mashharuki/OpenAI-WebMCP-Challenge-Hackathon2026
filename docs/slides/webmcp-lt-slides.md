---
marp: true
theme: brave-dark
paginate: true
size: 16:9
html: true
style: |
  /* @theme brave-dark
     Dark theme inspired by Brave's red-to-purple brand gradient
     Supports Japanese and English content
  */

  /* =========================================
     Base
     ========================================= */
  section {
    --accent:      #FF3B5C;
    --accent-warm: #9D4EDD;
    --dark:        #05030A;
    --dark-2:      #170F20;
    --muted:       #A9A4B2;
    --border:      #332941;
    --bg-subtle:   #170F20;

    color-scheme: dark;
    width: 1280px;
    height: 720px;
    box-sizing: border-box;
    font-family: 'Hiragino Sans', 'BIZ UDGothic', 'Yu Gothic Medium',
                 'Noto Sans JP', 'Segoe UI', -apple-system, sans-serif;
    background: #0A0612;
    color: #F1ECF6;
    padding: 48px 72px 58px;
    font-size: 24px;
    line-height: 1.65;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  /* Gradient top bar on all slides */
  section::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 4px;
    background: linear-gradient(90deg, var(--accent), var(--accent-warm));
  }

  /* Page number */
  section::after {
    font-size: 0.5em;
    color: var(--muted);
    bottom: 20px;
    right: 40px;
    letter-spacing: 0.04em;
  }

  /* =========================================
     Typography
     ========================================= */
  h1 {
    font-size: 2.0em;
    font-weight: 800;
    color: #FFFFFF;
    margin: 0 0 14px;
    line-height: 1.2;
    letter-spacing: -0.02em;
  }

  h2 {
    font-size: 1.45em;
    font-weight: 700;
    color: #FFFFFF;
    margin: 0 0 18px;
    padding-bottom: 10px;
    border-bottom: 3px solid var(--accent);
    line-height: 1.3;
  }

  h3 {
    font-size: 1.05em;
    font-weight: 600;
    color: var(--accent-warm);
    margin: 14px 0 8px;
  }

  p { margin: 8px 0; }

  /* Lists */
  ul, ol { margin: 8px 0; padding-left: 1.4em; }
  li { margin: 5px 0; }
  ul > li::marker { color: var(--accent); font-size: 1.1em; }
  ol > li::marker { color: var(--accent); font-weight: 700; }

  /* Emphasis — use to draw attention to key terms */
  strong { color: var(--accent); font-weight: 700; }
  em     { color: var(--accent-warm); font-style: normal; font-weight: 600; }

  /* =========================================
     Code
     ========================================= */
  code {
    font-family: 'JetBrains Mono', 'Fira Code', 'Source Code Pro', monospace;
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 1px 6px;
    font-size: 0.82em;
    color: #FF9BB0;
  }

  pre {
    background: var(--dark);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 18px 22px;
    margin: 10px 0;
    flex-shrink: 0;
  }

  pre code {
    background: none;
    border: none;
    color: #E9E1F5;
    padding: 0;
    font-size: 0.75em;
    line-height: 1.6;
  }

  /* =========================================
     Table
     ========================================= */
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 10px 0;
    font-size: 0.88em;
  }

  th {
    background: var(--accent);
    color: white;
    padding: 8px 14px;
    text-align: left;
    font-weight: 600;
  }

  td {
    padding: 7px 14px;
    border-bottom: 1px solid var(--border);
  }

  tr:nth-child(even) td { background: var(--bg-subtle); }

  /* Defensive override: marp-core's bundled GitHub-flavored base CSS
     sets <tr> background via light-dark() vars, which can win the
     cascade over the rules above. Force it back to this theme. */
  section table tr { background-color: transparent; border-top-color: var(--border); }
  section table tr:nth-child(2n) { background-color: var(--bg-subtle); }

  /* =========================================
     Blockquote
     ========================================= */
  blockquote {
    border-left: 4px solid var(--accent);
    background: var(--bg-subtle);
    margin: 10px 0;
    padding: 10px 18px;
    border-radius: 0 6px 6px 0;
    color: var(--muted);
    font-size: 0.95em;
  }

  hr {
    border: none;
    border-top: 2px solid var(--border);
    margin: 16px 0;
  }

  /* =========================================
     Slide Class Variants
     ========================================= */

  /* --- title: Cover slide --- */
  section.title {
    background: linear-gradient(145deg, #05030A 0%, #5B1030 52%, #3B0764 100%);
    color: white;
    justify-content: flex-end;
    padding-bottom: 64px;
  }

  section.title::before { height: 6px; }

  section.title h1 {
    color: white;
    font-size: 2.4em;
    letter-spacing: -0.03em;
    max-width: 86%;
    border-bottom: none;
    margin-bottom: 0;
  }

  section.title h2 {
    color: rgba(255,255,255,0.7);
    font-size: 1.0em;
    font-weight: 400;
    border-bottom: none;
    margin-top: 12px;
  }

  section.title p {
    color: rgba(255,255,255,0.55);
    font-size: 0.8em;
    margin-top: 28px;
  }

  /* --- section: Chapter break slide --- */
  section.section {
    background: linear-gradient(135deg, var(--accent), var(--accent-warm));
    color: white;
    justify-content: center;
  }

  section.section::before {
    background: rgba(255,255,255,0.3);
  }

  section.section h2 {
    color: white;
    font-size: 2.0em;
    border-bottom: 2px solid rgba(255,255,255,0.4);
    padding-bottom: 12px;
  }

  section.section p {
    color: rgba(255,255,255,0.85);
    font-size: 0.9em;
  }

  /* --- lead: Centered key message --- */
  section.lead {
    justify-content: center;
    align-items: center;
    text-align: center;
  }

  section.lead h1 {
    font-size: 2.5em;
    border-bottom: none;
    background: linear-gradient(90deg, var(--accent), var(--accent-warm));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  section.lead h2 {
    border-bottom: none;
    color: var(--muted);
    font-weight: 400;
  }

  /* --- dark: Extra-dark background slide (code showcase) --- */
  section.dark {
    background: #000000;
    color: #E9E1F5;
  }

  section.dark h1 { color: white; }

  section.dark h2 {
    color: white;
    border-color: var(--accent);
  }

  section.dark code {
    background: var(--dark-2);
    border-color: var(--border);
    color: var(--muted);
  }

  section.dark td { border-color: var(--border); }
  section.dark tr:nth-child(even) td { background: var(--dark-2); }
  section.dark blockquote { background: var(--dark-2); }

  /* --- ending: Thank you / closing slide --- */
  section.ending {
    background: linear-gradient(145deg, #05030A 0%, #5B1030 50%, #3B0764 100%);
    color: white;
    justify-content: center;
    align-items: center;
    text-align: center;
  }

  section.ending::before { height: 6px; }

  section.ending h1 {
    color: white;
    font-size: 2.8em;
    border-bottom: none;
    margin-bottom: 12px;
  }

  section.ending h2 {
    color: rgba(255,255,255,0.7);
    border-bottom: none;
    font-weight: 400;
    font-size: 1.0em;
  }

  section.ending p {
    color: rgba(255,255,255,0.55);
    font-size: 0.82em;
    margin-top: 20px;
  }

  /* =========================================
     Layout Components
     (use inside HTML <div> elements)
     ========================================= */

  /* Two-column grid */
  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 36px;
    align-items: start;
  }

  .columns.col-3    { grid-template-columns: 1fr 1fr 1fr; gap: 24px; }
  .columns.col-6-4  { grid-template-columns: 3fr 2fr; }
  .columns.col-4-6  { grid-template-columns: 2fr 3fr; }
  .columns.middle   { align-items: center; }

  /* Card */
  .card {
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px 18px;
    margin: 6px 0;
  }

  .card.accent  { border-left: 4px solid var(--accent);      background: rgba(255,59,92,0.10); }
  .card.warn    { border-left: 4px solid var(--accent-warm); background: rgba(157,78,221,0.10); }
  .card.success { border-left: 4px solid #22c55e;            background: rgba(34,197,94,0.10); }
  .card.danger  { border-left: 4px solid #ef4444;            background: rgba(239,68,68,0.10); }

  /* Highlight box — key messages */
  .highlight {
    background: linear-gradient(135deg, rgba(255,59,92,0.16), rgba(157,78,221,0.16));
    border: 1px solid rgba(157,78,221,0.4);
    border-radius: 10px;
    padding: 14px 22px;
    font-size: 1.05em;
    font-weight: 600;
    text-align: center;
    margin: 10px 0;
    color: #FFFFFF;
  }

  /* Big number / metric */
  .number {
    font-size: 2.8em;
    font-weight: 800;
    color: var(--accent);
    line-height: 1.0;
    display: block;
    letter-spacing: -0.03em;
  }

  .number.warm { color: var(--accent-warm); }

  /* Tag / badge */
  .tag {
    display: inline-block;
    background: var(--accent);
    color: white;
    font-size: 0.6em;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 999px;
    vertical-align: middle;
    letter-spacing: 0.03em;
    margin: 0 3px;
  }

  .tag.warm    { background: var(--accent-warm); }
  .tag.success { background: #22c55e; }
  .tag.danger  { background: #ef4444; }
  .tag.outline { background: none; border: 1.5px solid var(--accent); color: var(--accent); }

  /* Icon row — emoji + label */
  .icons {
    display: flex;
    gap: 20px;
    justify-content: center;
    align-items: flex-start;
    margin: 16px 0;
  }

  .icon-item { text-align: center; flex: 1; }
  .icon-item .icon  { font-size: 2.2em; display: block; margin-bottom: 6px; }
  .icon-item .label { font-size: 0.75em; font-weight: 600; color: var(--muted); }

  /* Progress bar */
  .progress {
    height: 8px;
    background: var(--border);
    border-radius: 4px;
    overflow: hidden;
    margin: 6px 0 12px;
  }

  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--accent-warm));
    border-radius: 4px;
  }

  /* Step list — numbered steps with visual treatment */
  .steps { counter-reset: step; }
  .step {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    margin: 10px 0;
  }
  .step::before {
    counter-increment: step;
    content: counter(step);
    background: var(--accent);
    color: white;
    font-weight: 700;
    font-size: 0.85em;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 2px;
  }
---

<!-- _class: title -->

# AdGate for WebMCP

## エージェント時代の新しい広告・決済モデル

---

![bg](./../img/me.png)

---

## 今日話すこと(10分)

1. **WebMCP** の概要
2. **OpenAI WebMCP Challenge** とは
3. 作った作品 **AdGate** の概要
4. 実際に作って **わかったこと**

<div class="highlight">キーワードは「人がアクセスの主導権を握ったまま、AIに任せる」</div>

<!-- 約20秒。4部構成であることを一気に見せる。 -->

---

<!-- _class: section -->

## 01. WebMCPの概要

エージェントが「Webページの中の道具」を直接使うための標準

<!-- 約10秒のつなぎ。 -->

---

## WebMCPとは

- ページ自身が **AIエージェント向けの道具(ツール)** を公開する実験的なオープン標準
- エージェントは画面を **スクレイピング/推測せず**、構造化ツールを直接呼び出せる
- 人とエージェントが **同じ認証済みセッション・同じUI** をそのまま共有できる
- OpenAI・Google Chrome・Cloudflareなどが中心になって推進中

<div class="highlight">「ページの中に、エージェント専用の操作口をつくる」という発想</div>

<!-- 約40秒。定義→なぜ嬉しいかの順で。 -->

---

<!-- _class: dark -->

## WebMCPの仕組み

```js
// ページ側であらかじめツールを宣言しておく
document.modelContext.registerTool({
  name: "analyze_recipe",
  description: "レシピを解析し、栄養メモや代替案を返す",
  inputSchema: { /* Zodなどでスキーマを定義 */ },
  async execute(input, { signal }) {
    // 実行前に人の確認ゲートを挟むこともできる
    return await gateCoordinator.run(input, signal);
  },
});
```

> `navigator.modelContext` へのフォールバックも用意しておくのが定石

<!-- 約35秒。コードは読み上げず、"ページがツールを宣言する"点だけ強調。 -->

---

## MCPとWebMCPの違い

<div class="columns">
<div class="card accent">

### MCP
- **サーバー側**でツールを呼び出す
- バックエンド/ローカルツール向け
- ブラウザUIとは独立に動く

</div>
<div class="card warn">

### WebMCP
- **ブラウザ・ページの中**でツールを呼ぶ
- 既存のUI・ログイン状態をそのまま利用
- 実行中に **人がその場で介入・承認** できる

</div>
</div>

<!-- 約35秒。「人が割り込める」がAdGateの伏線になる。 -->

---

<!-- _class: section -->

## 02. OpenAI WebMCP Challengeとは

今回このAdGateを作ったハッカソン

<!-- 約10秒。 -->

---

## Challenge概要

- OpenAI主催、**約10日間**のオンラインハッカソン
- 登録開始 8/25 → 提出締切 9/4 → 結果発表 9/23予定
- 協賛: **Google Chrome / Cloudflare / Shopify / Vercel / Render / Netlify**
- 賞金総額 **$35,000**(上位10チームに各$3,000 現金 + ChatGPT Pro 1年 など)

<!-- 約35秒。日程と規模感を数字でサラッと。 -->

---

<!-- _class: section -->

## 03. AdGateの概要

WebMCP × x402 で考えた、エージェント時代の広告モデル

<!-- 約10秒。 -->

---

## 課題意識

- AIエージェントが **人の代わりにWebを読む** 時代がやってきた
- エージェントは広告を見ない → **パブリッシャーの収益機会が消える**
- 便利さと引き換えに、**無料コンテンツを支えてきた仕組み**が崩れるリスク

<div class="highlight">人がアクセス許可の主導権を保ったまま、収益化の道を残せないか?</div>

<!-- 約30秒。ここが提案の出発点。 -->

---

## AdGateとは

- 架空のレシピサイト **「Open Table Journal」** を構築
- プレミアム機能として WebMCPツール **`analyze_recipe`** を実装
- 画面のボタンから使っても、エージェント経由で使っても **同じ1つのゲート** を通る
- ゲート通過後、栄養メモ・代替案・注意書きを含む **1つの構造化結果** が返る

<!-- 約35秒。"ボタンもAIも同じ入口"がポイント。 -->

---

## 2つのアクセス方法

<div class="columns">
<div class="card accent">

### 🎥 スポンサー広告
- **8秒間** の広告視聴
- ウォレット不要・無料
- サーバー側で視聴時間を厳密に検証

</div>
<div class="card warn">

### 💳 x402決済
- Base Sepolia上で **0.01 testnet USDC**
- ウォレットで金額を確認して明示的に承認
- 秘密鍵はAI側に一切渡らない

</div>
</div>

<div class="highlight">どちらの経路も、同じ「保護されたエンドポイント」を解放する</div>

<!-- 約40秒。AdGateの核心スライド。 -->

---

## システム構成

| コンポーネント | 役割 |
|---|---|
| **Frontend**(React / Vite) | WebMCP登録・ゲートUI・ウォレット連携 |
| **Resource Server**(Hono) | 認可判定・スポンサー/決済の検証・解析処理 |
| **Facilitator**(Hono / viem・任意) | x402決済の検証とtestnet決済の実行 |

Cloudflare **Durable Object** でスポンサーセッションと発行済みグラントを永続化

<span class="tag">React</span><span class="tag">Vite</span><span class="tag warm">Hono</span><span class="tag success">Cloudflare Workers</span><span class="tag outline">x402</span><span class="tag outline">Base Sepolia</span>

<!-- 約35秒。役割分担の表として見せる。 -->

---

## デモの流れ

<div class="steps">

<div class="step">

エージェントに「このレシピを解析して」と依頼する

</div>

<div class="step">

`analyze_recipe` が呼ばれ、**ゲートで一時停止**する

</div>

<div class="step">

その場で **広告視聴 or 決済承認** を選ぶ

</div>

<div class="step">

同じツール呼び出しが **自動的に再開** し、結果が返る

</div>

</div>

<!-- 約30秒。ここで実演/動画に切り替えても良い。 -->

---

## 実際の画面

<div class="columns">
<div>

![WebMCPのツールインスペクタにanalyze_recipeツールが見えている画面](../img/0.jpg)

**エージェント側**:ツールインスペクタに `analyze_recipe` が見える

</div>
<div>

![スポンサーアクセスのゲート画面と視聴カウントダウン](../img/3.jpg)

**人側**:スポンサー視聴のゲートとカウントダウン

</div>
</div>

<!-- 約25秒。スクリーンショットは docs/img から参照。実機デモに差し替えてもよい。 -->

---

<!-- _class: section -->

## 04. 実際に作ってみてわかったこと

短い開発期間で見えた学びと反省

<!-- 約10秒。 -->

---

## 苦労した点

- WebMCPとx402を **どう組み合わせるか**、ウォレットの置き場所に悩んだ
- 初期版は注入型ウォレットのみ → **アプリ内ブラウザで決済デモがしづらい**
- **Privyのパスキー embedded wallet** を追加し、ブラウザウォレットと併用可能に
- パスキー認証そのものは決済を承認しない設計を維持(人が金額を見て署名)

<!-- 約35秒。技術的な苦労を率直に。 -->

---

## 学んだこと

- WebMCPは **「見えるブラウザ」が前提** → 人とAIの役割分担を設計しやすい
- MCPとの違いは、**実際に実装して初めて体感**できた
- x402との相性の良さ:**決済も「見えるゲート」の一部**にできる

<div class="highlight">人が主導権を握ったまま、AIに任せる範囲を広げる設計は十分できる</div>

<!-- 約30秒。この回の一番言いたいこと。 -->

---

## 今後の展望

- ニュース・研究・クリエイターツールなど **他コンテンツへゲートを拡張**
- スポンサー向け **ダッシュボード**、対応チェーン/資産の拡充
- 本番運用に向けて:認証・レート制限・監視・鍵管理・決済レールの検証
- プライバシーに配慮した **スポンサー計測** の検討

<!-- 約25秒。 -->

---

## まとめ

<div class="steps">

<div class="step">

WebMCPは「ページの中にエージェント専用の入口を作る」標準

</div>

<div class="step">

AdGateは **人の承認を挟んだまま** 広告 or 決済で収益化する一例

</div>

<div class="step">

見えるWebだからこそ、**人とAIの役割分担**を設計できる

</div>

</div>

<!-- 約30秒。3点で締める。 -->

---

<!-- _class: lead -->

# 見えるWebが、人とAIの信頼を設計する

<!-- 約15秒。会場に一番残したい一言だけを置く。 -->

---

<!-- _class: ending -->

# Thank you！

<!-- 約15秒。QRコードがあれば貼り付けてください。 -->
