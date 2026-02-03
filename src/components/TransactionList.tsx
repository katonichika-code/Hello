import { useState } from 'react';
import { updateTransactionCategory, type Transaction } from '../api/client';

interface TransactionListProps {
  transactions: Transaction[];
  onUpdate: () => void;
}

export function TransactionList({ transactions, onUpdate }: TransactionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : 'Failed to save');
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
    return <p className="no-data">No transactions found</p>;
  }

  return (
    <div className="transaction-list">
      {error && <p className="status error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Amount</th>
            <th>Category</th>
            <th>Description</th>
            <th>Account</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id}>
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
                    autoFocus
                  />
                ) : (
                  <span
                    className="editable"
                    onClick={() => startEdit(t)}
                    title="Click to edit"
                  >
                    {t.category}
                  </span>
                )}
              </td>
              <td>{t.description}</td>
              <td>{t.account}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
