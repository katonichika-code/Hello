# AI state

## 読んだファイル

- `CLAUDE.md`
- `package.json`
- `src/domain/computations.ts`
- `src/domain/types.ts`
- `src/ui/screens/HomeScreen.tsx`
- `src/ui/components/RemainingCard.tsx`
- `src/ui/components/BudgetCard.tsx`
- `src/ui/components/ProjectionCard.tsx`
- `src/scripts/domain-test.ts`
- `src/App.css`
- `src/db/database.ts`
- `src/db/repo.ts`
- リポジトリ直下のファイル一覧（`rg --files`）

## 確認した事実

- Definition A は `remainingFreeToSpend(settings, monthTxns)` に実装されており、支出（負数）の絶対値合計を月収・固定費・貯蓄目標から差し引く。
- `Transaction` は負数を支出、正数を収入として扱う。Gmail 由来の未確定取引は DB/API 型側の `isPending` で表現されるが、Home の残額計算には `transactions` 配列をそのまま domain へ渡しているため、未確定支出も除外せず含まれる。
- `getSettings()` は `ensureDefaults()` を呼び、settings row がなければ 0 のデフォルト値を作成するため、settings 未設定時の挙動は「セットアップ促し表示」に定義済み。
- Dexie schema は変更していない。
- Gmail scope / 銀行 API / 送金 / 課金 / 外部サーバー送信は変更していない。
- `npm run test:domain`, `npm run lint`, `npm run build` は成功した。build は既存のチャンクサイズ警告のみ出る。

## 重要な仮説

- 375×667 の first view では、最上部の `RemainingCard` 内に「残額」「1日あたり」「今月使った額/自由予算プログレス」「危険カテゴリチップ」をまとめるのが最もスクロールなし要件を満たしやすい。
- 予算未設定カテゴリの危険判定は、当月カテゴリ支出の中央値を基準にすると、単独の「未分類のみ」でも過剰ペースを検出できる。

## 決定

- domain 層に `dailyAllowance(remaining, today, monthEnd)` と `dangerCategories(budgets, monthSpendByCategory, today?)` を追加した。domain 層は React/DB/IO に依存していない。
- 残額マイナス時は赤で責める文言ではなく、「残りN日、1日¥N抑えると月末±0」という行動提案を表示する。
- Home 最上部の価値表示から Gmail 同期導線・予算コピー導線を外し、管理系 UI を Home に置かない方針に寄せた。
- `isPending` 取引は残額に含める。理由: Gmail 通知はカード明細確定前の near-real-time 支出把握が目的であり、Definition A の Σ(当月支出) から除外すると「今月あと使える額」が楽観的になるため。
- `src/App.css` 末尾付近の余分な `}` により build 時 CSS minify warning が出ていたため、同じ CSS ファイル内の品質ゲート修正として削除した。

## 次にやること

- 375×667 実機またはブラウザ viewport で、RemainingCard の4要素がスクロールなしに見えるか視覚確認する。
- 危険カテゴリ判定の閾値（経過率を何ポイント超えたら表示するか）は、実データでノイズが多ければ調整する。
- Home から外した Gmail 同期導線・予算コピー導線を Settings 側に集約するか確認する。

## ブロッカー

- なし。

## 人間確認事項

- 危険カテゴリの表示条件を「経過率を少しでも超過」でよいか、例えば +10pt 以上にするか。
- 予算未設定カテゴリの代替基準を「月間支出中央値」で継続してよいか。
