# Current audit

## 実装確認サマリ

- `package.json` の npm scripts は `dev`, `dev:lan`, `build`, `lint`, `preview`, `csvcheck`, `ruleeval`, `test:domain`。
- `src/ui/AppShell.tsx` は `SharedScreen`, `HomeScreen`, `AnalyticsScreen` の 3 画面横スクロール構成。
- `src/db/database.ts` は Dexie v4 / IndexedDB の `transactions`, `settings`, `budgets`, `merchant_map`, `gmail_sync` を定義。
- `src/api/gmailSync.ts` は Gmail readonly scope のみを使用し、GIS OAuth トークンはメモリ上の `accessToken` に保持。
- `src/components/BackupRestore.tsx` に JSON backup / restore 導線あり。

## 死にコード一覧

この節は削除ではなく一覧化のみ。根拠は `rg` による import / 参照検索。

### `src/components/ManualEntry.tsx`

- 根拠: `rg -n "(from ['\"].*ManualEntry|import\(['\"].*ManualEntry|<ManualEntry|\bManualEntry\b)" src --glob '!**/ManualEntry.tsx'` が 0 件。
- 現行 UI の手入力は `src/ui/components/QuickEntry.tsx` が `HomeScreen` から使われているため、旧フォーム系コンポーネントの残骸と推定。

### `src/components/MonthFilter.tsx`

- 根拠: `rg -n "(from ['\"].*MonthFilter|import\(['\"].*MonthFilter|<MonthFilter|\bMonthFilter\b)" src --glob '!**/MonthFilter.tsx'` が 0 件。
- 現行の月切り替えは `src/ui/AppShell.tsx` のヘッダーに実装されているため、旧 UI の残骸と推定。

### `src/components/PlanVsActual.tsx` の監査時検出事項

- 監査時点では `src/ui/screens/AnalyticsScreen.tsx` に `<PlanVsActual transactions={transactions} />` の JSX 参照がある一方で import がなく、`npm run build` が `TS2304: Cannot find name 'PlanVsActual'` で失敗した。
- 共通制約の「`npm run build` と `npm run lint` が通らない状態でラウンドを終えない」を優先し、最小限の import 追加で修正済み。
- 現在は `rg -n "from ['\"].*PlanVsActual|import\(['\"].*PlanVsActual" src --glob '!**/PlanVsActual.tsx'` により `src/ui/screens/AnalyticsScreen.tsx` の import が確認できるため、死にコードではない。

### `src/api/gmailTypes.ts`

- 根拠: `rg -n "(from ['\"].*gmailTypes|import\(['\"].*gmailTypes|\bgmailTypes\b)" src --glob '!**/gmailTypes.ts'` が 0 件。
- Gmail 同期の型は `src/api/gmailSync.ts` 内にローカル定義されているため、未使用型定義の残骸と推定。

## `src/components/` と `src/ui/components/` の重複・境界

- `src/components/TransactionList.tsx` と `src/ui/components/TransactionDetailSheet.tsx` はどちらも取引表示・編集に関わる。`TransactionList` は分析画面から使われ、詳細編集は `TransactionDetailSheet` に委譲している。
- `src/components/ManualEntry.tsx` と `src/ui/components/QuickEntry.tsx` は手入力 UI として役割が重複。現行画面で使われているのは `QuickEntry` のみ。
- `src/components/BackupRestore.tsx` は `AnalyticsScreen` と `SettingsScreen` の双方から利用されており、データ管理コンポーネントとして現役。
- `src/components/SankeyDiagram.tsx`, `CsvImport.tsx`, `UncategorizedInbox.tsx`, `PlanVsActual.tsx` は分析・データ管理寄り、`src/ui/components/*` はモバイル UI / 画面内カード寄りに分かれている。`PlanVsActual` は監査中に import 漏れを検出し、最小修正済み。

## 旧 API client 残骸

- `src/api/client.ts` は存在しない。
- `src/db/repo.ts` の冒頭コメントに「Repository layer: IndexedDB operations replacing HTTP client.ts.」とあり、HTTP client 置換後の互換レイヤーであることが明記されている。
- README に残っていた旧 API / server / DB 説明は今回削除済み。
