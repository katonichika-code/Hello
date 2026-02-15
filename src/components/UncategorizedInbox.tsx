import { useState } from 'react';
import type { Transaction } from '../db/repo';
import {
  updateTransactionCategory,
  bulkApplyMerchantCategory,
} from '../db/repo';
import { getAllCategories } from '../api/categorizer';

interface UncategorizedInboxProps {
  transactions: Transaction[];
  onUpdate: () => void;
}

export function UncategorizedInbox({ transactions, onUpdate }: UncategorizedInboxProps) {
  const uncategorized = transactions.filter(
    (t) => t.category === 'Uncategorized' || t.category === '未分類',
  );

  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categories = getAllCategories().filter(
    (c) => c !== '未分類' && c !== 'Uncategorized',
  );

  if (uncategorized.length === 0) {
    return null; // Don't show inbox if no uncategorized items
  }

  const formatJPY = (n: number) =>
    new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(n);

  // Group by merchant_key for "apply to all same merchant"
  const merchantGroups = new Map<string, Transaction[]>();
  for (const t of uncategorized) {
    const key = t.merchant_key || t.id; // fallback to id if no merchant_key
    if (!merchantGroups.has(key)) {
      merchantGroups.set(key, []);
    }
    merchantGroups.get(key)!.push(t);
  }

  const handleCategorize = async (
    transaction: Transaction,
    category: string,
  ) => {
    setSaving(transaction.id);
    setError(null);

    try {
      // Update this transaction with merchant learning
      await updateTransactionCategory(transaction.id, category, true);

      // If merchant_key exists and there are other uncategorized with same key,
      // bulk-apply to all of them
      if (transaction.merchant_key) {
        const sameKey = uncategorized.filter(
          (t) =>
            t.id !== transaction.id &&
            t.merchant_key === transaction.merchant_key,
        );
        if (sameKey.length > 0) {
          await bulkApplyMerchantCategory(transaction.merchant_key, category);
        }
      }

      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新に失敗しました');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="inbox">
      <h3>未分類の取引 ({uncategorized.length}件)</h3>
      <p className="inbox-hint">カテゴリを選ぶと同じ店舗も自動で学習します</p>

      {error && <p className="status error">{error}</p>}

      <div className="inbox-list">
        {uncategorized.slice(0, 20).map((t) => {
          const sameCount = t.merchant_key
            ? (merchantGroups.get(t.merchant_key)?.length ?? 1)
            : 1;

          return (
            <div key={t.id} className="inbox-item">
              <div className="inbox-item-header">
                <span className="inbox-desc">{t.description}</span>
                <span className="inbox-amount">{formatJPY(t.amount)}</span>
              </div>
              <div className="inbox-meta">
                <span>{t.date}</span>
                {sameCount > 1 && (
                  <span className="inbox-same-count">
                    同じ店舗 {sameCount}件
                  </span>
                )}
              </div>
              <div className="inbox-chips">
                {saving === t.id ? (
                  <span className="inbox-saving">保存中...</span>
                ) : (
                  categories.map((c) => (
                    <button
                      key={c}
                      className="chip"
                      onClick={() => handleCategorize(t, c)}
                    >
                      {c}
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {uncategorized.length > 20 && (
        <p className="inbox-more">
          他 {uncategorized.length - 20}件の未分類取引があります
        </p>
      )}
    </div>
  );
}
