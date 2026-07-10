# AI State — Prompt 7 CSV parser registry化

## 読んだファイル
- `CLAUDE.md`
- `package.json`
- `src/api/csvParser.ts`
- `src/scripts/csv-check.ts`
- `src/components/CsvImport.tsx`
- `docs/ai/state.md`
- 既存 fixture 確認: `find` で `*.csv` / `*fixture*` を探索し、CSV fixture は未存在だった。

## 確認した事実
- 既存 CSV parser は `src/api/csvParser.ts` に Format A（`date,amount,description` header）と Format B（SMBC系カード明細、2行目以降が `YYYY/MM/DD`）の検出・parse ロジックが同居していた。
- CSV import UI は `decodeFileContent` と `parseCsvText` を利用し、取り込み時に `Math.abs(row.amount)` を hash 生成へ渡してから保存金額を負数化していたため、互換 API では `ParsedTransaction.amount` を従来通り正数で返す必要がある。
- Hash 生成実装自体には手を入れていない。CSV parser registry 内部の `NormalizedTx.amount` は負数（支出）に正規化し、互換層の `parseCsvText` で正数へ戻して既存 UI/hash 経路を維持した。
- Dexie schema は変更していないため、バックアップ導線確認の停止条件には該当しない。
- `npm run csvcheck` の before/after 出力 diff は空だった。
- `npm run build` と `npm run lint` は成功した。

## 重要な仮説
- Prompt 8 以降で provider 選択 UI を追加する前提のため、今回の互換 `parseCsvText` は同点・低 confidence の registry 結果を既存通り error として返すだけに留めるのが「UIプレビューの機能拡張はしない」境界に合う。
- Registry 内部では `NormalizedTx` に `provider` と `raw` を持たせるが、現行 UI へ渡す `ParsedTransaction` からは除外することで既存挙動を変えない。

## 決定
- `src/api/csv/registry.ts` に `CsvProvider` / `NormalizedTx` / provider 選択 / CSV row parse / encoding decode / 日付・金額正規化ユーティリティを集約した。
- `src/api/csv/providers/generic.ts` に標準CSV provider、`src/api/csv/providers/smbcCard.ts` にSMBCカード明細 provider を移植した。
- `src/api/csvParser.ts` は既存 public API 互換の薄い facade とし、`detectFormat` / `parseCsvText` / `decodeFileContent` / `toTransactionInputs` を維持した。
- 既存サンプルを `src/fixtures/csv/format-a.csv` と `src/fixtures/csv/format-b-smbc-card.csv` に fixture 化し、`src/scripts/csv-check.ts` は fixture と registry 経由の検証に変更した。

## 次にやること
- Prompt 8 以降で、registry の `needs-user-selection` 結果を UI で選択可能にするか検討する。
- 実ユーザー提供のカード明細CSVがあれば、今回追加した fixture と同じ形式でスナップショット検証を追加する。

## ブロッカー
- 現在の作業範囲にブロッカーなし。

## 人間確認事項
- Provider ID は既存互換のため `A` / `B` を維持している。将来 UI 表示やデータ保存でより説明的な ID（例: `generic`, `smbc-card`）へ移行するか確認してください。

---

# AI State — Prompt 24 CSV取り込みの新旧経路の一本化

## 読んだファイル
- `src/components/CsvImport.tsx`
- `src/api/csvParser.ts`
- `src/api/csv/registry.ts`
- `src/api/csv/providers/generic.ts`
- `src/api/csv/providers/smbcCard.ts`
- `src/scripts/csv-check.ts`
- `docs/ai/state.md`

## 確認した事実
- `CsvImport.tsx` は旧 facade の `../api/csvParser` から `decodeFileContent` / `parseCsvText` / 型を import していた。
- registry 側には provider 選択と正規化ロジックがあり、旧互換 API（`parseCsvText` / `detectFormat` / `toTransactionInputs`）だけが `csvParser.ts` に残っていた。
- `npm run csvcheck` の before/after 出力 diff は空で、Format A / Format B / Shift_JIS の検証結果は変わらなかった。
- Dexie schema は変更していないため、バックアップ導線確認が必要な作業ではなかった。

## 重要な仮説
- 旧 import を使う UI が残ると、今後 provider registry の拡張時に新旧経路の差分が再発するため、UI は registry の公開 API を直接参照するのが安全。
- 既存スクリプトや外部的な内部参照の互換性を壊さないため、`csvParser.ts` はロジックを持たない再exportとして短期的に残すのが最小変更に合う。

## 決定
- `parseCsvText` / `detectFormat` / `ParsedTransaction` / `CsvParseResult` / `toTransactionInputs` を `src/api/csv/registry.ts` の公開 API に移し、hash 互換のため positive amount を hash 入力に使う仕様コメントを registry 側へ移した。
- `src/components/CsvImport.tsx` は `../api/csv/registry` から直接 import するよう変更した。
- `src/api/csvParser.ts` は 13 行の再exportのみとし、CSV parse / detect / transaction input 変換ロジックの二重定義をなくした。

## 次にやること
- `src/scripts/csv-check.ts` と `src/scripts/rule-eval.ts` も将来の別ラウンドで registry 直 import に寄せると、facade を完全削除できる。

## ブロッカー
- 現在の作業範囲にブロッカーなし。

## 人間確認事項
- 今回は後方互換のため `csvParser.ts` を再exportとして残した。完全削除する場合は、残る script import を別ラウンドで registry 直 import に変更してください。
