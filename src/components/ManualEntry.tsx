import { useState, useEffect } from 'react';
import { createTransaction, generateHash } from '../db/repo';
import { categorize, getAllCategories } from '../api/categorizer';

interface ManualEntryProps {
  onEntryComplete: () => void;
}

export function ManualEntry({ onEntryComplete }: ManualEntryProps) {
  const today = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [suggestedCategory, setSuggestedCategory] = useState('');

  // Auto-suggest category when description changes
  useEffect(() => {
    if (description.trim()) {
      const suggested = categorize(description.trim());
      setSuggestedCategory(suggested);
    } else {
      setSuggestedCategory('');
    }
  }, [description]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!date || !amount || !description) {
      setError('必須項目を入力してください');
      return;
    }

    const amountNum = parseInt(amount, 10);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('金額は1以上の整数を入力してください');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const hash = await generateHash(date, amountNum, description);

      // Use user's category if provided, otherwise use auto-suggested category
      const finalCategory = category.trim() || suggestedCategory || '未分類';

      await createTransaction({
        date,
        amount: -Math.abs(amountNum), // Expenses are negative
        category: finalCategory,
        account: 'cash',
        description: description.trim(),
        hash,
      });

      setSuccess(true);
      setAmount('');
      setCategory('');
      setDescription('');
      setSuggestedCategory('');
      onEntryComplete();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleUseSuggestion = () => {
    setCategory(suggestedCategory);
  };

  const categories = getAllCategories();

  return (
    <div className="manual-entry">
      <h3>現金支出を追加</h3>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label htmlFor="entry-date">日付 *</label>
          <input
            id="entry-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="form-row">
          <label htmlFor="entry-amount">金額 (円) *</label>
          <input
            id="entry-amount"
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="例: 500"
            required
          />
        </div>
        <div className="form-row">
          <label htmlFor="entry-category">カテゴリ</label>
          <input
            id="entry-category"
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="例: 食費"
            list="category-list"
          />
          <datalist id="category-list">
            {categories.map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
          {suggestedCategory && !category && (
            <div className="category-suggestion">
              推定: <span className="suggested">{suggestedCategory}</span>
              <button type="button" onClick={handleUseSuggestion} className="btn-use-suggestion">
                使用
              </button>
            </div>
          )}
        </div>
        <div className="form-row">
          <label htmlFor="entry-description">内容 *</label>
          <input
            id="entry-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例: ランチ 喫茶店"
            required
          />
        </div>
        <button type="submit" disabled={saving}>
          {saving ? '保存中...' : '追加'}
        </button>
      </form>
      {error && <p className="status error">{error}</p>}
      {success && <p className="status success">保存しました</p>}
    </div>
  );
}
