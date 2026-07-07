# AI State — Prompt 5 Gmail provider parser split

## 読んだファイル
- `CLAUDE.md`
- `src/api/gmailSync.ts`
- `src/db/database.ts`
- `src/db/repo.ts`
- `src/components/BackupRestore.tsx`
- `src/ui/screens/SettingsScreen.tsx`
- `src/ui/components/OnboardingModal.tsx`
- `package.json`

## 確認した事実
- Gmail OAuth token は既存実装で module-level memory のみ保持され、`src/db/` 配下に token 永続化コードは見つからなかった。
- Gmail API scope は `https://www.googleapis.com/auth/gmail.readonly` のまま維持した。
- Gmail sync は `gmail_sync` Dexie table に同期メタデータを保存している。
- Backup/Restore 導線は `SettingsScreen` と `AnalyticsScreen` から `BackupRestore` として利用されているため、Dexie schema 変更前のバックアップ導線確認条件を満たす。

## 重要な仮説
- Prompt 5 の「失敗件数を記録」は `gmail_sync.last_parse_failure_count` として同期ごとの最新 parse failure 件数を保存する意味だと解釈した。
- 実メール本文は提供されていないため、fixture は本物ではないサニタイズ済み構造サンプルで作成した。

## 決定
- `src/api/gmail/` 配下に `auth.ts`, `fetch.ts`, `providers/vpass.ts`, `index.ts`, `types.ts` を追加し、既存 `src/api/gmailSync.ts` は後方互換 re-export にした。
- Vpass parser は `parse(subject, body)` を export し、fixture test から直接検証できるようにした。
- Parse failure は `SyncResult.parseFailures` として返し、UI では件名と理由のみ表示し本文は表示しない。
- Dexie schema を v5 に上げ、既存 `gmail_sync` row には `last_parse_failure_count = 0` を backfill する。

## 次にやること
- 人間が実メールから個人情報を除去した本文構造を追加提供したら、fixture パターンを増やして parser の網羅性を高める。
- Prompt 6 で予定されている CLIENT_ID 設定化が必要。

## ブロッカー
- なし。

## 人間確認事項
- `gmail_sync.last_parse_failure_count` の保存粒度（最新同期のみ）で要件に合っているか確認してほしい。
- UI の parse failure 表示は件名と理由のみでよいか確認してほしい。
