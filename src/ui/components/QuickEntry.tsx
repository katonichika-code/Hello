import { useEffect, useRef, useState } from 'react';
import {
  createTransaction,
  generateHash,
  getQuickEntryRecents,
  recordQuickEntryRecent,
  upsertMerchantMap,
  type QuickEntryRecent,
} from '../../db/repo';
import { categorize, getAllCategories } from '../../api/categorizer';
import { deriveMerchantKey } from '../../api/merchantKey';
import type { Wallet } from '../../domain/types';

interface QuickEntryProps {
  onSaved: () => void | Promise<void>;
  onSuccess?: () => void;
}

type QuickEntryAccount = 'cash' | 'card' | 'paypay';

const accountOptions: Array<{ value: QuickEntryAccount; label: string }> = [
  { value: 'cash', label: '現金' },
  { value: 'card', label: 'カード' },
  { value: 'paypay', label: 'PayPay' },
];

const todayString = () => new Date().toISOString().split('T')[0];

export function QuickEntry({ onSaved, onSuccess }: QuickEntryProps) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayString);
  const [wallet, setWallet] = useState<Wallet>('personal');
  const [account, setAccount] = useState<QuickEntryAccount>('cash');
  const [recents, setRecents] = useState<QuickEntryRecent[]>([]);
  const [saving, setSaving] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);

  const categories = getAllCategories().filter((c) => c !== '未分類');

  useEffect(() => {
    amountInputRef.current?.focus();
    let active = true;
    void getQuickEntryRecents()
      .then((items) => {
        if (active) setRecents(items);
      })
      .catch(() => {
        // Recents are an accelerator only; keep manual entry usable.
      });
    return () => { active = false; };
  }, []);

  const applyRecent = (recent: QuickEntryRecent) => {
    setAmount(String(recent.amount));
    setCategory(recent.category);
    setDescription(recent.description);
    setWallet(recent.wallet || 'personal');
    setAccount((recent.account === 'card' || recent.account === 'paypay') ? recent.account : 'cash');
    setDate(todayString());
    amountInputRef.current?.focus();
  };

  const handleSave = async () => {
    const num = parseInt(amount, 10);
    if (isNaN(num) || num <= 0) return;

    setSaving(true);
    try {
      const entryDate = date || todayString();
      const desc = description.trim() || category || '支出';
      const cat = category || categorize(desc);
      const merchantKey = deriveMerchantKey(desc);
      const hash = await generateHash(entryDate, num, `${account}:${wallet}:${desc}`);

      await createTransaction({
        date: entryDate,
        amount: -Math.abs(num),
        category: cat,
        account,
        wallet,
        source: 'manual',
        description: desc,
        hash,
        merchant_key: merchantKey,
        category_source: category ? 'manual' : 'rule',
        confidence: category ? 1 : 0.8,
      });

      if (merchantKey && cat !== '未分類' && cat !== 'Uncategorized') {
        await upsertMerchantMap(merchantKey, cat);
      }
      const nextRecents = await recordQuickEntryRecent({
        amount: Math.abs(num),
        category: cat,
        description: desc,
        account,
        wallet,
      });

      setAmount('');
      setCategory('');
      setDescription('');
      setDate(todayString());
      setShowDetail(false);
      setRecents(nextRecents);
      await onSaved();
      onSuccess?.();
    } catch {
      // silent — user sees amount didn't clear
    } finally {
      setSaving(false);
      amountInputRef.current?.focus();
    }
  };

  return (
    <div className="quick-entry">
      <div className="wallet-toggle" aria-label="登録先">
        <button
          type="button"
          className={`toggle-btn ${wallet === 'personal' ? 'active' : ''}`}
          onClick={() => setWallet('personal')}
          disabled={saving}
        >
          個人
        </button>
        <button
          type="button"
          className={`toggle-btn ${wallet === 'shared' ? 'active' : ''}`}
          onClick={() => setWallet('shared')}
          disabled={saving}
        >
          共有
        </button>
      </div>

      <div className="quick-amount-row">
        <span className="yen-sign">¥</span>
        <input
          ref={amountInputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className="quick-amount-input"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
          disabled={saving}
          autoFocus
        />
        <button
          className="quick-save-btn"
          onClick={handleSave}
          disabled={saving || !amount || parseInt(amount) <= 0}
        >
          {saving ? '...' : '保存'}
        </button>
      </div>

      {recents.length > 0 && (
        <div className="recent-entry-chips" aria-label="直近の入力候補">
          {recents.map((recent) => (
            <button
              type="button"
              key={`${recent.description}-${recent.category}-${recent.amount}-${recent.account}-${recent.wallet}`}
              className="recent-entry-chip"
              onClick={() => applyRecent(recent)}
              disabled={saving}
            >
              <span>{recent.description}</span>
              <strong>¥{recent.amount.toLocaleString('ja-JP')}</strong>
              <small>{recent.category}</small>
            </button>
          ))}
        </div>
      )}

      <div className="account-selector" aria-label="支払元">
        {accountOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`account-btn ${account === option.value ? 'active' : ''}`}
            onClick={() => setAccount(option.value)}
            disabled={saving}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Category chips */}
      <div className="category-chips">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            className={`chip ${category === c ? 'selected' : ''}`}
            onClick={() => setCategory(category === c ? '' : c)}
            disabled={saving}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Toggle detail */}
      <button
        type="button"
        className="toggle-detail"
        onClick={() => setShowDetail(!showDetail)}
      >
        {showDetail ? '閉じる' : '日付・メモ'}
      </button>

      {showDetail && (
        <div className="quick-detail-fields">
          <input
            type="date"
            className="quick-date-input"
            value={date}
            onChange={(e) => setDate(e.target.value || todayString())}
            disabled={saving}
          />
          <input
            type="text"
            className="quick-desc-input"
            placeholder="店舗・メモ（例: コンビニ）"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={saving}
          />
        </div>
      )}
    </div>
  );
}
