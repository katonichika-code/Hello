# Kakeibo - 家計簿アプリ

ローカル専用の個人家計簿アプリ。CSV取り込み対応、サンキーダイアグラムで支出フローを可視化。

## クイックスタート

```bash
# 依存関係をインストール
npm install

# アプリを起動（フロントエンド + API）
npm run dev
```

ブラウザで http://localhost:5173 を開く

## 機能

- **CSV取り込み**: カード明細CSVを取り込み（重複検出あり）
- **自動仕訳**: 加盟店名からカテゴリを自動推定
- **手動入力**: 現金支出を手入力
- **カテゴリ編集**: 一覧表でクリックして編集
- **月別フィルタ**: 対象月で絞り込み
- **サンキーダイアグラム**: 支払元 → カテゴリの支出フロー

## CSV対応フォーマット

### Format A: 標準CSV

```csv
date,amount,description
2024-01-15,1500,スーパー
2024-01-16,800,コーヒー
```

- 日付: `YYYY-MM-DD`
- 金額: 正の整数
- 内容: テキスト

### Format B: 銀行・カード明細CSV

日本の銀行・カード会社からのCSVエクスポートに対応。

- **文字コード**: UTF-8 または Shift_JIS（自動判定）
- **1行目**: 顧客情報（無視・保存されません）
- **2行目以降**: 取引データ

```csv
顧客名,****-****-****-1234,VISA
2025/12/01,セブン－イレブン,159,１,１,159,
2025/12/02,スターバックス,550,１,１,550,
```

**重要**: 1行目のカード番号や顧客名は絶対に保存・表示されません。

## 自動仕訳（ルールベース）

CSV取り込み時、加盟店名から自動的にカテゴリを推定します。

| カテゴリ | キーワード例 |
|---------|-------------|
| 食費 | セブン、ファミマ、スタバ、マクドナルド、すき家 |
| 交通費 | JR、メトロ、Suica、タクシー、ガソリン |
| 日用品 | マツキヨ、ダイソー、ニトリ、ユニクロ |
| 娯楽 | 映画、ゲーム、カラオケ、ディズニー |
| サブスク | Netflix、Spotify、docomo、Amazon Prime |
| 医療 | 病院、クリニック、薬局 |
| その他 | 郵便、保険、税金 |
| 未分類 | 上記に該当しない場合 |

**ルール評価スクリプト**:

```bash
# CSVファイルでカバレッジを確認
npm run ruleeval -- --file <path-to-csv>
```

出力例:
```
=== ルール評価結果 ===
総取引数: 150
ユニーク加盟店数: 45
--- カバレッジ ---
自動分類: 127件 (84.7%)
未分類: 23件 (15.3%)
```

未分類の加盟店は一覧で表示され、必要に応じてルールを追加できます。

## 使い方

1. **CSV取り込み**: ファイルを選択 → プレビュー確認 → 「取り込む」
2. **現金支出追加**: 左のフォームで日付・金額・内容を入力
3. **カテゴリ編集**: 一覧表のカテゴリをクリックして編集
4. **月別表示**: 「対象月」で絞り込み

**ヒント**: 未分類（黄色背景）の行をクリックしてカテゴリを修正しましょう。

## スマホで現金入力する方法（同一Wi-Fi）

PCで起動したアプリにスマホからアクセスして、外出先で現金支出を入力できます。

### 手順

1. **PCでアプリをネットワーク公開モードで起動**:
   ```bash
   npm run dev -- --host
   ```

2. **PCのIPアドレスを確認**:
   ```bash
   # Windows
   ipconfig
   # → "IPv4 Address" を確認 (例: 192.168.1.100)

   # Mac/Linux
   ifconfig | grep "inet "
   # → "inet 192.168.x.x" を確認
   ```

3. **スマホのブラウザでアクセス**:
   ```
   http://<PCのIPアドレス>:5173
   例: http://192.168.1.100:5173
   ```

4. **現金支出を入力**:
   - 「現金支出を追加」フォームで日付・金額・内容を入力
   - 「追加」ボタンをタップ

### 注意事項

- **同一Wi-Fiネットワーク**に接続している必要があります
- **Windowsファイアウォール**: 初回起動時に「アクセスを許可しますか？」と表示されたら「許可」を選択
- **セキュリティ**: 公共Wi-Fiでは使用しないでください（暗号化されていません）
- PCとスマホが同じネットワーク上にないとアクセスできません

## トラブルシューティング

### ポートが使用中

```bash
# APIポート (8787) を解放
lsof -i :8787 | grep LISTEN | awk '{print $2}' | xargs kill

# フロントエンドポート (5173) を解放
lsof -i :5173 | grep LISTEN | awk '{print $2}' | xargs kill
```

### データベースをリセット

```bash
rm -f server/prisma/dev.db server/prisma/dev.db-*
npm run dev:api
```

### TypeScript エラー

```bash
npx tsc --noEmit
```

### CSV取り込みの確認

```bash
npm run csvcheck
```

## コマンド一覧

| コマンド | 説明 |
|---------|------|
| `npm run dev` | フロントエンド + API 起動 |
| `npm run dev:web` | フロントエンドのみ (5173) |
| `npm run dev:api` | APIのみ (8787) |
| `npm run smoke` | APIスモークテスト |
| `npm run csvcheck` | CSVパーサー検証 |
| `npm run ruleeval -- --file <csv>` | 自動仕訳ルール評価 |
| `npm run build` | 本番ビルド |

## 技術スタック

- **Frontend**: React 19, TypeScript, Vite, d3-sankey, encoding-japanese
- **Backend**: Node.js, Express 5, TypeScript, tsx
- **Database**: SQLite (better-sqlite3)

## アーキテクチャ

```
├── src/                      # Frontend (React + TypeScript + Vite)
│   ├── api/
│   │   ├── client.ts         # APIクライアント
│   │   ├── csvParser.ts      # CSV解析 (Format A/B対応)
│   │   └── categorizer.ts    # 自動仕訳ルール
│   ├── components/           # Reactコンポーネント
│   └── scripts/
│       ├── csv-check.ts      # CSVパーサー検証
│       └── rule-eval.ts      # ルール評価スクリプト
├── server/                   # Backend (Express + TypeScript)
│   ├── src/
│   │   ├── index.ts          # APIサーバー
│   │   └── db.ts             # SQLiteデータベース
│   └── prisma/
│       └── dev.db            # SQLiteファイル (自動生成)
└── package.json
```

## API エンドポイント

| Method | Endpoint | 説明 |
|--------|----------|------|
| GET | /health | ヘルスチェック |
| GET | /transactions | 取引一覧 (`?month=YYYY-MM` 対応) |
| POST | /transactions | 取引作成 |
| POST | /transactions/bulk | 一括取り込み |
| PATCH | /transactions/:id | カテゴリ更新 |

---

# Kakeibo - Personal Finance App

A local-only personal expense tracking application with CSV import and Sankey diagram visualization.

## Quick Start (English)

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Features

- CSV import for card transactions (with duplicate detection)
- Rule-based auto-categorization for Japanese merchants
- Manual cash expense entry
- Transaction list with inline category editing
- Month-based filtering
- Sankey diagram showing money flow (Account → Category)

See Japanese section above for detailed usage.
