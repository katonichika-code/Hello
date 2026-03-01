import { useEffect, useMemo, useState } from 'react';
import { getAllCategories } from '../../api/categorizer';
import { deriveMerchantKey } from '../../api/merchantKey';
import {
  deleteTransaction,
  type Transaction,
  updateTransaction,
  upsertMerchantMap,
} from '../../db/repo';

interface TransactionDetailSheetProps {
  transaction: Transaction | null;
  onClose: () => void;
  onUpdate: () => void;
}

const fmtDate = (date: string) => {
  const [, month, day] = date.split('-').map(Number);
  return `${month}/${day}`;
};

const fmtCurrency = (amount: number) => new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY',
  maximumFractionDigits: 0,
}).format(Math.abs(amount));

export function TransactionDetailSheet({ transaction, onClose, onUpdate }: TransactionDetailSheetProps) {
  const categories = useMemo(() => getAllCategories().filter((c) => c !== '未分類'), []);
  const [category, setCategory] = useState('未分類');
  const [wallet, setWallet] = useState<'personal' | 'shared'>('personal');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!transaction) return;
    setCategory(transaction.category || '未分類');
    setWallet((transaction.wallet || 'personal') as 'personal' | 'shared');
    setAmount(String(Math.abs(transaction.amount)));
    setMemo(transaction.description || '');
  }, [transaction]);

  if (!transaction) return null;

  const handleSave = async () => {
    const parsedAmount = Number(amount.replace(/,/g, ''));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return;

    setSaving(true);
    try {
      await updateTransaction(transaction.id, {
        category,
        wallet,
        amount: transaction.amount < 0 ? -Math.abs(parsedAmount) : Math.abs(parsedAmount),
        description: memo.trim(),
      });

      if (transaction.category !== category) {
        const key = transaction.merchant_key || deriveMerchantKey(memo || transaction.description);
        if (key) {
          await upsertMerchantMap(key, category);
        }
      }

      onClose();
      onUpdate();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm('この取引を削除しますか？');
    if (!confirmed) return;

    setSaving(true);
    try {
      await deleteTransaction(transaction.id);
      onClose();
      onUpdate();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="tx-detail-overlay" onClick={onClose} />
      <div className="tx-detail-sheet" role="dialog" aria-modal="true" aria-label="取引詳細">
        <div className="drag-handle" />

        <div className="tx-detail-headline">
          <div className="tx-detail-merchant">{transaction.description}</div>
          <div className="tx-detail-date">{fmtDate(transaction.date)}</div>
        </div>
        <div className="tx-detail-amount">{fmtCurrency(transaction.amount)}</div>
        {transaction.isPending === 1 && <div className="pending-badge">🟡 未確定</div>}

        <label className="tx-detail-label">カテゴリ</label>
        <div className="category-chips tx-detail-category-chips">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={`category-chip ${category === c ? 'selected' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <label className="tx-detail-label">ウォレット</label>
        <div className="wallet-radio">
          <label>
            <input
              type="radio"
              name="wallet"
              checked={wallet === 'personal'}
              onChange={() => setWallet('personal')}
            />
            個人
          </label>
          <label>
            <input
              type="radio"
              name="wallet"
              checked={wallet === 'shared'}
              onChange={() => setWallet('shared')}
            />
            共有
          </label>
        </div>

        <label className="tx-detail-label" htmlFor="tx-memo">メモ</label>
        <input
          id="tx-memo"
          type="text"
          className="tx-detail-input"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />

        <label className="tx-detail-label" htmlFor="tx-amount">金額修正</label>
        <div className="tx-detail-amount-edit">
          <span>¥</span>
          <input
            id="tx-amount"
            type="number"
            inputMode="numeric"
            className="tx-detail-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="tx-detail-actions">
          <button className="btn-save" type="button" onClick={handleSave} disabled={saving}>保存</button>
          <button className="btn-delete" type="button" onClick={handleDelete} disabled={saving}>削除</button>
        </div>
      </div>
    </>
  );
}
