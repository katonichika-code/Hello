import { useState } from 'react';
import type { Transaction } from '../db/repo';
import { TransactionDetailSheet } from '../ui/components/TransactionDetailSheet';

interface TransactionListProps {
  transactions: Transaction[];
  onUpdate: () => void;
}

export function TransactionList({ transactions, onUpdate }: TransactionListProps) {
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(amount);
  };

  if (transactions.length === 0) {
    return <p className="no-data">取引データがありません</p>;
  }

  return (
    <>
      <div className="transaction-list">
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
              <tr
                key={t.id}
                className={`${t.category === '未分類' ? 'row-uncategorized' : ''} tx-row-clickable`}
                onClick={() => setSelectedTx(t)}
              >
                <td>{t.date}</td>
                <td className={t.amount < 0 ? 'expense' : 'income'}>
                  {formatAmount(t.amount)}
                </td>
                <td className="category-cell">
                  <span className={t.category === '未分類' ? 'uncategorized' : ''}>{t.category}</span>
                </td>
                <td>
                  <span>{t.description}</span>
                  {t.isPending === 1 && <span className="pending-badge">未確定</span>}
                </td>
                <td>{t.account === 'card' ? 'カード' : '現金'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TransactionDetailSheet
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
        onUpdate={() => {
          setSelectedTx(null);
          onUpdate();
        }}
      />
    </>
  );
}
