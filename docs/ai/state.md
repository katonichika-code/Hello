# AI state

## 読んだファイル

- `README.md`
- `CLAUDE.md`
- `package.json`
- `index.html`
- `public/manifest.json`
- `public/sw.js`
- `src/main.tsx`
- `src/ui/AppShell.tsx`
- `src/ui/screens/HomeScreen.tsx`
- `src/ui/screens/SharedScreen.tsx`
- `src/ui/screens/AnalyticsScreen.tsx`
- `src/ui/screens/SettingsScreen.tsx`
- `src/db/database.ts`
- `src/db/repo.ts`
- `src/api/csvParser.ts`
- `src/api/gmailSync.ts`
- `src/components/BackupRestore.tsx`
- `src/` と `public/` のファイル一覧

## 確認した事実

- 実装は React 19 + Vite 7 + Dexie 4 の serverless PWA。
- `package.json` に旧 README の `dev:web`, `dev:api`, `smoke` は存在しない。
- Vite 開発サーバーの基本ポートは 5173。
- Gmail scope は `https://www.googleapis.com/auth/gmail.readonly` のみ。
- Dexie schema は v4 で `transactions`, `settings`, `budgets`, `merchant_map`, `gmail_sync` を持つ。
- JSON backup / restore 導線は `BackupRestore` として存在する。
- `src/components/ManualEntry.tsx`, `src/components/MonthFilter.tsx`, `src/api/gmailTypes.ts` は import / 参照が見つからない。
- `src/components/PlanVsActual.tsx` は AnalyticsScreen に JSX 参照があるが import がなく、初回 `npm run build` が失敗した。

## 重要な仮説

- `ManualEntry` と `MonthFilter` は旧 UI からの未削除ファイル。
- `PlanVsActual` は削除対象ではなく、import 漏れまたは途中実装。
- README の正は CLAUDE.md と実装であり、旧サーバー世代の記述は全面的に古い。

## 決定

- 原則として README / CLAUDE.md / docs のみ更新したが、初回 `npm run build` が `PlanVsActual` 未 import で失敗したため、共通制約を満たすために最小限の import 追加のみ行った。
- 死にコードは削除せず `docs/ai/current_audit.md` に根拠付きで一覧化した。
- README には `package.json` に実在する npm scripts だけを記載した。

## 次にやること

- `ManualEntry`, `MonthFilter`, `gmailTypes` の削除可否を人間確認後に整理する。
- PWA deploy / quality gates の実運用手順を固める。

## ブロッカー

- なし。

## 人間確認事項

- `ManualEntry`, `MonthFilter`, `gmailTypes` を次ラウンドで削除してよいか。
- Gmail 同期メタデータの `email` 固定値の扱いを見直すか。
