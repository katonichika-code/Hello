import { useState } from 'react';
import { createTransaction, generateHash } from '../../db/repo';
import { categorize, getAllCategories } from '../../api/categorizer';

interface QuickEntryProps {
  onSaved: () => void | Promise<void>;
  onSuccess?: () => void;
}

export function QuickEntry({ onSaved, onSuccess }: QuickEntryProps) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const categories = getAllCategories().filter((c) => c !== '未分類');

  const handleSave = async () => {
    const num = parseInt(amount, 10);
    if (isNaN(num) || num <= 0) return;

    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const desc = description.trim() || category || '支出';
      const cat = category || categorize(desc);
      const hash = await generateHash(today, num, desc);

      await createTransaction({
        date: today,
        amount: -Math.abs(num),
        category: cat,
        account: 'cash',
        wallet: 'personal',
        source: 'manual',
        description: desc,
        hash,
      });

      setAmount('');
      setCategory('');
      setDescription('');
      setShowDetail(false);
      await onSaved();
      onSuccess?.();
    } catch {
      // silent — user sees amount didn't clear
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="quick-entry">
      <div className="quick-amount-row">
        <span className="yen-sign">¥</span>
        <input
          type="number"
          inputMode="numeric"
          className="quick-amount-input"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={saving}
        />
        <button
          className="quick-save-btn"
          onClick={handleSave}
          disabled={saving || !amount || parseInt(amount) <= 0}
        >
          {saving ? '...' : '追加'}
        </button>
      </div>

      {/* Category chips */}
      <div className="category-chips">
        {categories.map((c) => (
          <button
            key={c}
            className={`chip ${category === c ? 'selected' : ''}`}
            onClick={() => setCategory(category === c ? '' : c)}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Toggle detail */}
      <button
        className="toggle-detail"
        onClick={() => setShowDetail(!showDetail)}
      >
        {showDetail ? '閉じる' : 'メモを追加'}
      </button>

      {showDetail && (
        <input
          type="text"
          className="quick-desc-input"
          placeholder="メモ（例: ランチ）"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      )}
    </div>
  );
}
