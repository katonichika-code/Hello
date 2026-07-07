# AI State — 2026-07-07 Prompt 4

## 読んだファイル
- `CLAUDE.md`
- `src/ui/components/QuickEntry.tsx`
- `src/db/repo.ts`
- `src/api/categorizationAdapter.ts`
- `src/api/merchantKey.ts`
- `src/db/database.ts`
- `src/ui/screens/HomeScreen.tsx`
- `src/App.css`
- `src/domain/types.ts`
- `src/components/TransactionList.tsx`

## 確認した事実
- QuickEntry は既存で Home の bottom sheet から開き、保存時に `onSaved` 経由で Home 側の transaction refresh を実行していた。
- 既存の手入力は `account: "cash"` 固定、CSV/Gmail は `account: "card"` で、Gmail 判定は `source: "gmail"` に分離されている。
- `transactions.account` は string 型で Dexie index ではないため、`paypay` の保存は Dexie スキーマ変更なしで可能。
- `settings` は key-value 的な単一行テーブルで、非 index フィールド追加なら Dexie stores 定義変更は不要。
- `merchant_map` には `merchant_key -> category` の学習データがあり、手入力保存時にも `upsertMerchantMap` で補強できる。

## 重要な仮説
- PayPay はカードでも現金でもない支払元として `account: "paypay"` に保存し、既存の `cash`/`card` はそのまま維持するのが後方互換上もっとも安全。
- 直近候補は `settings.quick_entry_recents` に最大6件保存すれば、スキーマ変更なしで Home の最短入力を実現できる。
- 保存後に QuickEntry 内の状態を即クリアし、直後に `await onSaved()` することで Home の残額カード更新を体感上即時にできる。

## 決定
- QuickEntry の金額入力を `autoFocus` + `inputMode="numeric"` + 数字以外除去にした。
- 日付は詳細欄に置き、初期値と保存後リセットを当日にした。
- 直近の「カテゴリ×店舗/メモ×金額×支払元×wallet」候補を settings に最大6件保存し、チップタップで全フィールドを復元する。
- 支払元セレクタは `cash`（現金）/`card`（カード）/`paypay`（PayPay）の3値にした。Gmail 由来かどうかは従来通り `source` で判定する。
- 保存時に `merchant_key` を付与し、カテゴリが確定していれば `merchant_map` も更新する。

## 次にやること
- 実機で「＋ → 金額入力 → 直近候補タップ → 保存」が10秒以内に収まるか確認する。
- PayPay 表示が必要な一覧・分析画面が他にもあれば、次ラウンドで表示ラベルだけを追加する。

## ブロッカー
- なし。

## 人間確認事項
- `account: "paypay"` を新しい支払元値として扱う方針で問題ないか。
- 直近候補に保存する店舗名を現状は QuickEntry のメモ/説明欄としているが、将来「店舗」専用フィールドを追加するか。
