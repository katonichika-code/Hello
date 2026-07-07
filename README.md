# Kakeibo - serverless PWA 家計簿

Kakeibo は「今月あといくら自由に使えるか」を最短で確認するための、ローカル専用・serverless の個人家計簿 PWA です。

- フロントエンド: React 19 + TypeScript + Vite 7
- 永続化: Dexie 4 / IndexedDB（ブラウザ内）
- 外部連携: Google Identity Services + Gmail API（Gmail readonly のみ）
- 配布形態: 静的ホスティング向け PWA（`public/manifest.json` と `public/sw.js`）

**アプリ独自サーバー、サーバーサイド DB、銀行 API 連携、送金、課金処理はありません。**

## クイックスタート

```bash
npm install
npm run dev
```

ブラウザで <http://localhost:5173> を開きます。Vite 単体の開発サーバーです。

スマホ実機など同一 LAN から確認する場合:

```bash
npm run dev:lan
```

## npm scripts

`package.json` に実在するスクリプトのみを記載しています。

| コマンド | 説明 |
| --- | --- |
| `npm run dev` | Vite 開発サーバーを起動 |
| `npm run dev:lan` | `vite --host 0.0.0.0` で LAN からアクセス可能にして起動 |
| `npm run build` | `tsc -b` と `vite build` による本番ビルド |
| `npm run lint` | ESLint を実行 |
| `npm run preview` | Vite preview サーバーを起動 |
| `npm run csvcheck` | CSV パーサー検証スクリプトを実行 |
| `npm run ruleeval -- --file <csv>` | CSV に対する自動分類ルールのカバレッジ分析 |
| `npm run test:domain` | Definition A などドメイン計算の検証スクリプトを実行 |

## 現行機能

### Definition A: 今月あといくら自由に使えるか

アプリの中心指標は次の式です。

```text
Remaining Free-to-Spend =
  monthly_income - fixed_cost_total - monthly_savings_target - SUM(month expenses)
```

取引ルール:

- 支出は負の金額、収入は正の金額として保存します。
- CSV 取り込みと Gmail 同期は `account: "card"`、手入力は `account: "cash"` を使います。
- 重複検出には `date + amount + description` の SHA-256 ハッシュを使います。

### 3 画面スワイプ UI

`src/ui/AppShell.tsx` は横スクロールの 3 画面構成です。

1. **共有**: 共有ウォレットの支出、共有予算、共有データ JSON のエクスポート / インポート。
2. **ホーム**: Remaining Free-to-Spend、支出ペース、予算カード、予測カード、最近の取引、Gmail 同期、クイック入力。
3. **分析**: 収入・支出・ネット、Plan vs Actual、月次トレンド、支出フロー（Sankey）、取引一覧、CSV インポート、未分類 inbox、バックアップ。

ホーム右上の設定画面では、Gmail 同期、月収・固定費・貯蓄目標、CSV インポートへの導線、未分類再分類、バックアップ、ストレージ永続化状態を扱います。

### Gmail 同期

ブラウザ上の Google Identity Services で OAuth トークンを取得し、Gmail API を直接呼び出します。Google OAuth Client ID は `VITE_GOOGLE_CLIENT_ID` 環境変数から読み込み、未設定の場合は Gmail 同期だけ「設定が必要です」と表示します。

- スコープは `https://www.googleapis.com/auth/gmail.readonly` のみです。
- OAuth アクセストークンはメモリ変数だけに保持し、IndexedDB には保存しません。
- 検索対象は設定画面の「Gmail検索クエリ」で編集できます（初期値は SMBC Vpass の利用通知メール）。
- 初回同期は直近 90 日を対象にし、以後は `gmail_sync.last_sync_at` 以降を検索します。
- Gmail 由来の取引は `source: "gmail"`、`isPending: 1` として保存されます。

### Wallet

取引には `wallet` があり、既定は `personal` です。共有支出は `shared` に保存され、共有画面で合計、カテゴリ内訳、予算残、1 人あたり概算を表示します。共有データ交換は JSON ファイルのダウンロード / 読み込みで行い、外部サーバーには送信しません。

### CSV インポート

CSV はブラウザ内で読み込み、保存前プレビューと重複スキップを行います。文字コードは UTF-8 を優先し、Shift_JIS / CP932 系も処理します。

#### Format A: 標準 CSV

```csv
date,amount,description
2026-01-15,1500,スーパー
2026-01-16,800,コーヒー
```

- ヘッダーに `date`, `amount`, `description` が必要です。
- 日付は `YYYY-MM-DD` です。
- 金額は整数として読み取り、保存時は支出として負の値になります。

#### Format B: 日本の銀行・カード明細風 CSV

```csv
顧客名,****-****-****-1234,VISA
2026/01/15,セブン－イレブン,159,１,１,159,
2026/01/16,スターバックス,550,１,１,550,
```

- 1 行目はメタデータとして無視され、保存・表示されません。
- 2 行目以降を取引データとして扱います。
- 日付は `YYYY/MM/DD` から `YYYY-MM-DD` に変換します。
- 金額は 3 列目を優先し、空の場合は 6 列目を使います。

### 自動分類と学習

カテゴリ分類は 3 層です。

1. 学習済み `merchant_map`
2. ルールベース分類
3. fallback（未分類）

取引詳細や未分類 inbox からカテゴリを手動設定すると、加盟店キーに紐づく学習ルールとして再利用できます。設定画面の「未分類を再分類」から既存取引に再適用できます。

### PWA / local-only データ管理

- アプリデータは Dexie の IndexedDB (`kakeibo-db`) に保存されます。
- 通常利用でアプリ独自サーバーへ家計データを送信しません。
- Gmail 同期時のみ、ユーザー操作により Gmail API へ readonly リクエストを送ります。
- `navigator.storage.persist()` を起動時に要求し、ブラウザによる IndexedDB 退避リスクを下げます。
- JSON バックアップ / 復元導線があります。

## データモデル概要

Dexie v4 のテーブル:

| テーブル | 用途 |
| --- | --- |
| `transactions` | 取引。`monthKey`, `[monthKey+wallet]`, `&hash`, `isPending` などで検索・重複検出 |
| `settings` | 月収、固定費合計、月間貯蓄目標 |
| `budgets` | 月・wallet・カテゴリ単位の予算 |
| `merchant_map` | 加盟店キーとカテゴリの学習済み対応 |
| `gmail_sync` | Gmail 同期メタデータ |

## ディレクトリ構成

```text
src/
  api/          CSV parsing, categorization, Gmail sync
  components/   analytics/data-management oriented shared components
  db/           Dexie schema and repository functions
  domain/       pure computation and domain types
  scripts/      local verification scripts
  ui/           app shell, screens, mobile-first UI components
public/         PWA manifest, service worker, icons
```

## トラブルシューティング

### 開発サーバーのポートが使用中

Vite の既定ポートは 5173 です。使用中の場合は対象プロセスを終了するか、Vite の起動オプションで別ポートを指定してください。

```bash
npm run dev -- --port 5174
```

### IndexedDB データを保全したい

分析画面または設定画面の `Advanced / Backup` から JSON エクスポートを実行してください。ブラウザのサイトデータ削除や別端末移行の前にはバックアップを推奨します。

### CSV パーサーを確認したい

```bash
npm run csvcheck
```

### 自動分類ルールのカバレッジを確認したい

```bash
npm run ruleeval -- --file <path-to-csv>
```
