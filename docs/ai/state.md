# AI State — Prompt 6 Gmail configuration hardening

## 読んだファイル
- `CLAUDE.md`
- `.gitignore`
- `.env.example`
- `README.md`
- `vite.config.ts`
- `src/api/gmail/auth.ts`
- `src/api/gmail/fetch.ts`
- `src/api/gmail/index.ts`
- `src/api/gmail/providers/vpass.ts`
- `src/api/gmail/types.ts`
- `src/api/gmailSync.ts`
- `src/db/database.ts`
- `src/db/repo.ts`
- `src/ui/screens/SettingsScreen.tsx`
- `src/ui/components/OnboardingModal.tsx`
- `src/components/BackupRestore.tsx`（既存導線の存在確認は前回 state と実装検索結果に基づく）
- `package.json`

## 確認した事実
- 変更前 grep で OAuth Client ID 文字列は `src/api/gmail/auth.ts` に、個人メールアドレスは `src/api/gmail/index.ts` に、Gmail 検索クエリは `src/api/gmail/fetch.ts` に存在した。
- Gmail API scope は `src/api/gmail/auth.ts` の `GMAIL_READONLY_SCOPE` で `https://www.googleapis.com/auth/gmail.readonly` のみ。
- Dexie schema の index/store 定義は変更していないが、`settings` row に `gmail_search_query` プロパティを追加してアプリ設定として保存するようにした。
- Backup/Restore 導線は `SettingsScreen` と `AnalyticsScreen` から `BackupRestore` として利用されているため、settings データ変更前のバックアップ導線確認条件を満たす。
- `.env.example` を追加し、`.gitignore` は `.env` / `.env.*` を無視しつつ `.env.example` を追跡対象にしている。
- `npm run build` と `npm run lint` は成功した。

## 重要な仮説
- Gmail 検索条件（送信元や件名）はユーザー環境に依存するため、provider 側の送信元・件名一致条件ではなく、設定保存された Gmail 検索クエリで絞り込む方針が今回の目的に合う。
- 既存ユーザーの settings row に `gmail_search_query` が存在しない場合は repo layer のデフォルト値で補完すれば、schema version bump なしで互換性を維持できる。

## 決定
- OAuth Client ID は `import.meta.env.VITE_GOOGLE_CLIENT_ID` から読み込む。未設定時は Gmail 同期を無効化し、他機能は動作させる。
- Gmail 検索クエリは `settings.gmail_search_query` として保存し、設定画面から編集可能にした。
- 個人メールアドレスは同期メタデータに保存しないよう空文字へ変更した。
- OAuth フロー自体と Gmail readonly scope は変更しない。
- git 履歴の書き換えは実行しない。過去コミットに個人メールアドレスが残る可能性があるため、人間がリポジトリ再作成または filter-repo 等で履歴除去するか判断する必要がある。

## 次にやること
- 人間が Google Cloud Console で OAuth Client ID を作成・制限し、デプロイ先の環境変数 `VITE_GOOGLE_CLIENT_ID` に設定する。
- 必要に応じて設定画面で Gmail 検索クエリを実メール環境に合わせて調整する。

## ブロッカー
- 現在の作業ブランチ上のコード変更にはブロッカーなし。
- 公開済み git 履歴に個人メールアドレスが残っている場合、履歴除去は人間判断が必要。

## 人間確認事項
- 公開リポジトリで過去履歴に残った個人メールアドレスを消すため、リポジトリ作り直しまたは `git filter-repo` 等の履歴書き換えを行うか判断してください。
- `.env.example` のコメント内容と、設定画面で編集する Gmail 検索クエリの初期値が運用に合っているか確認してください。
