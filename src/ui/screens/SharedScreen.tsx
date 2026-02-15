import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Transaction } from '../../db/repo';
import { createTransaction, generateHash, getBudgets, type ApiBudget } from '../../db/repo';
import { categorize, getAllCategories } from '../../api/categorizer';
import {
  forWallet,
  totalExpenses,
  categoryBreakdown,
  categoryRemaining,
} from '../../domain/computations';
import type { Budget } from '../../domain/types';
import { BudgetCard } from '../components/BudgetCard';

/** Convert API budget to domain Budget */
function toDomainBudget(api: ApiBudget): Budget {
  return {
    id: api.id,
    month: api.month,
    category: api.category,
    limitAmount: api.limit_amount,
    pinned: api.pinned === 1,
    displayOrder: api.display_order,
    wallet: api.wallet || 'shared',
  };
}

export interface SharedScreenProps {
  transactions: Transaction[];
  selectedMonth: string;
  onRefresh: () => void;
}

export function SharedScreen({ transactions, selectedMonth, onRefresh }: SharedScreenProps) {
  const shared = useMemo(() => forWallet(
    transactions.map((t) => ({
      ...t,
      wallet: t.wallet || 'personal',
      source: t.source || 'csv',
    })),
    'shared',
  ), [transactions]);

  const expenses = useMemo(() => totalExpenses(shared), [shared]);
  const breakdown = useMemo(() => categoryBreakdown(shared), [shared]);

  const formatJPY = useMemo(() => {
    const fmt = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' });
    return (n: number) => fmt.format(n);
  }, []);

  // Shared budgets
  const [budgets, setBudgets] = useState<Budget[]>([]);

  const loadBudgets = useCallback(async () => {
    try {
      const b = await getBudgets(selectedMonth, 'shared');
      setBudgets(b.filter((x) => x.pinned === 1).map(toDomainBudget));
    } catch { /* use empty */ }
  }, [selectedMonth]);

  useEffect(() => { loadBudgets(); }, [loadBudgets]);

  const budgetStatuses = useMemo(() => budgets.map((b) => categoryRemaining(b, shared)), [budgets, shared]);

  // Quick entry state
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
      const desc = description.trim() || category || '共有支出';
      const cat = category || categorize(desc);
      const hash = await generateHash(today, num, desc);

      await createTransaction({
        date: today,
        amount: -Math.abs(num),
        category: cat,
        account: 'cash',
        wallet: 'shared',
        source: 'manual',
        description: desc,
        hash,
      });

      setAmount('');
      setCategory('');
      setDescription('');
      setShowDetail(false);
      onRefresh();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const recent = useMemo(() => shared.filter((t) => t.amount < 0).slice(0, 10), [shared]);

  return (
    <div className="screen-content shared-screen">
      {/* Total shared expenses */}
      <div className="shared-total-card">
        <div className="shared-label">共有ウォレット合計</div>
        <div className="shared-amount">{formatJPY(expenses)}</div>
        <div className="shared-per-person">
          一人あたり {formatJPY(Math.round(expenses / 2))}
        </div>
      </div>

      {/* Category breakdown */}
      {breakdown.length > 0 && (
        <div className="shared-breakdown">
          {breakdown.map((c) => (
            <div key={c.category} className="shared-breakdown-row">
              <span className="shared-cat">{c.category}</span>
              <span className="shared-cat-amount">{formatJPY(c.spent)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tracked category budget cards */}
      {budgetStatuses.length > 0 && (
        <div className="budget-cards">
          {budgetStatuses.map((s) => (
            <BudgetCard key={s.category} status={s} />
          ))}
        </div>
      )}

      {/* Quick entry for shared */}
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
            placeholder="メモ（例: 食材）"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        )}
      </div>

      {/* Recent shared transactions */}
      {recent.length > 0 && (
        <div className="recent-txns">
          <h4>最近の共有取引</h4>
          {recent.map((t) => (
            <div key={t.id} className="recent-row">
              <span className="recent-desc">{t.description}</span>
              <span className="recent-cat">{t.category}</span>
              <span className="recent-amount expense">
                {formatJPY(t.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {shared.length === 0 && (
        <div className="shared-empty">
          <p>共有の支出はまだありません</p>
          <p className="shared-empty-hint">上の入力欄から共有の支出を追加してください</p>
        </div>
      )}
    </div>
  );
}
