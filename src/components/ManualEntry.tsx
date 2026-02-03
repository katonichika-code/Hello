import { useState } from 'react';
import { createTransaction, generateHash } from '../api/client';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!date || !amount || !description) {
      setError('Please fill in all required fields');
      return;
    }

    const amountNum = parseInt(amount, 10);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Amount must be a positive number');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const hash = await generateHash(date, amountNum, description);

      await createTransaction({
        date,
        amount: -Math.abs(amountNum), // Expenses are negative
        category: category.trim() || 'Uncategorized',
        account: 'cash',
        description: description.trim(),
        hash,
      });

      setSuccess(true);
      setAmount('');
      setCategory('');
      setDescription('');
      onEntryComplete();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="manual-entry">
      <h3>Add Cash Expense</h3>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label htmlFor="entry-date">Date *</label>
          <input
            id="entry-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="form-row">
          <label htmlFor="entry-amount">Amount (JPY) *</label>
          <input
            id="entry-amount"
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g., 500"
            required
          />
        </div>
        <div className="form-row">
          <label htmlFor="entry-category">Category</label>
          <input
            id="entry-category"
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g., Food"
          />
        </div>
        <div className="form-row">
          <label htmlFor="entry-description">Description *</label>
          <input
            id="entry-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Lunch at cafe"
            required
          />
        </div>
        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Add Entry'}
        </button>
      </form>
      {error && <p className="status error">{error}</p>}
      {success && <p className="status success">Entry saved!</p>}
    </div>
  );
}
