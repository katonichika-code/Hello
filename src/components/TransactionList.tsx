import { useState } from 'react';
import { updateTransactionCategory, type Transaction } from '../db/repo';
import { getAllCategories } from '../api/categorizer';

interface TransactionListProps {
  transactions: Transaction[];
  onUpdate: () => void;
}

export function TransactionList({ transactions, onUpdate }: TransactionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = getAllCategories();

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(amount);
  };

  const startEdit = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setEditValue(transaction.category);
    setError(null);
  };

  const saveCategory = async (id: string) => {
    if (!editValue.trim()) return;

    setSaving(true);
    setError(null);

    try {
      await updateTransactionCategory(id, editValue.trim());
      setEditingId(null);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      saveCategory(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  if (transactions.length === 0) {
    return <p className="no-data">取引データがありません</p>;
  }

  return (
    <div className="transaction-list">
      {error && <p className="status error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>日付</th>
            <th>金額</th>
            <th>カテゴリ</th>
            <th>内容</th>
            <th>支払元</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id} className={t.category === '未分類' ? 'row-uncategorized' : ''}>
              <td>{t.date}</td>
              <td className={t.amount < 0 ? 'expense' : 'income'}>
                {formatAmount(t.amount)}
              </td>
              <td className="category-cell">
                {editingId === t.id ? (
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => saveCategory(t.id)}
                    onKeyDown={(e) => handleKeyDown(e, t.id)}
                    disabled={saving}
                    list="category-edit-list"
                    autoFocus
                  />
                ) : (
                  <span
                    className={`editable ${t.category === '未分類' ? 'uncategorized' : ''}`}
                    onClick={() => startEdit(t)}
                    title="クリックして編集"
                  >
                    {t.category}
                  </span>
                )}
              </td>
              <td>{t.description}</td>
              <td>{t.account === 'card' ? 'カード' : '現金'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <datalist id="category-edit-list">
        {categories.map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>
    </div>
  );
}
