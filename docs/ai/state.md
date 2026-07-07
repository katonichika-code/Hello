# AI State — 2026-07-07 Prompt 3

## 読んだファイル
- `CLAUDE.md`
- `src/domain/computations.ts`
- `src/domain/types.ts`
- `src/db/repo.ts`
- `src/db/database.ts`
- `src/ui/screens/HomeScreen.tsx`
- `src/ui/screens/SharedScreen.tsx`
- `src/ui/screens/SettingsScreen.tsx`
- `src/ui/AppShell.tsx`
- `src/ui/components/QuickEntry.tsx`
- `src/ui/components/ProjectionCard.tsx`
- `src/ui/components/SpendingPaceChart.tsx`
- `src/scripts/domain-test.ts`
- `src/components/BackupRestore.tsx`（SettingsScreen経由でバックアップ導線の存在を確認）

## 確認した事実
- Dexie transactions には `[monthKey+wallet]` index が既にあり、スキーマバージョン追加なしで wallet 別取得に利用できる。
- 既存の `wallet` 未設定行は、実装上 `personal` として扱う必要がある。
- Settings 画面には `BackupRestore` があり、データ管理セクションから復元/バックアップ導線が存在する。
- Gmail 連携は既存実装のままで、readonly スコープ以外の変更は行っていない。

## 重要な仮説
- `sharedMonthlyBudget` は IndexedDB settings の非 index フィールドとして追加すれば、Dexie stores 定義変更（スキーマ変更）なしに保存できる。
- Home は personal の Definition A のみを表示し、Shared は shared 月予算から shared 支出を引くことで、画面間の残額混入を防げる。

## 決定
- 集計関数 `totalExpenses` / `remainingFreeToSpend` / `categoryRemaining` / `categoryBreakdown` は wallet 引数必須にした。
- `forWallet` は `wallet` 未設定を `personal` に正規化して扱う。
- `getTransactions(month, wallet)` を追加し、wallet 指定時は Dexie の `.where('[monthKey+wallet]').equals([month, wallet])` を使う。
- SharedScreen の月予算は settings の `shared_monthly_budget` を利用し、1人あたり表示は固定で ÷2 のみとした。負担割合・精算・立替機能には踏み込んでいない。

## 次にやること
- 実機/ブラウザで QuickEntry から shared 登録し、Home の残額が変化しないことを手動確認するとよい。
- 必要なら SharedScreen の共有月予算が未設定の場合の案内文をより明確化する。

## ブロッカー
- なし。

## 人間確認事項
- `sharedMonthlyBudget` の初期値 0 と「未設定時は共有支出合計を表示」の挙動で問題ないか。
- 共有月予算をカテゴリ予算合計とは独立した上位予算として扱う方針で問題ないか。
