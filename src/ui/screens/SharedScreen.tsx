import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Transaction } from '../../db/repo';
import {
  createTransaction, generateHash, getBudgets,
  bulkCreateTransactions, createBudget, deleteBudget,
  type ApiBudget, type TransactionInput,
} from '../../db/repo';
import { db, type DbTransaction, type DbBudget } from '../../db/database';
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

  // --- Shared exchange ---
  const [showShare, setShowShare] = useState(false);
  const [shareStatus, setShareStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [shareImporting, setShareImporting] = useState(false);
  const shareFileRef = useRef<HTMLInputElement>(null);

  const handleExportShared = async () => {
    try {
      const [sharedTxns, sharedBudgets] = await Promise.all([
        db.transactions.where('wallet').equals('shared').toArray(),
        db.budgets.where('wallet').equals('shared').toArray(),
      ]);

      const payload = {
        type: 'shared_exchange' as const,
        version: 1,
        exportedAt: new Date().toISOString(),
        transactions: sharedTxns,
        budgets: sharedBudgets,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kakeibo-shared-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setShareStatus({ type: 'ok', msg: `${sharedTxns.length}件の取引をエクスポートしました` });
    } catch (err) {
      setShareStatus({ type: 'err', msg: err instanceof Error ? err.message : 'エクスポート失敗' });
    }
  };

  const handleImportShared = async (file: File) => {
    setShareImporting(true);
    setShareStatus(null);

    try {
      const text = await file.text();
      let data: {
        type: string;
        version: number;
        transactions: DbTransaction[];
        budgets: DbBudget[];
      };
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('JSONの形式が不正です');
      }

      if (data.type !== 'shared_exchange' || !Array.isArray(data.transactions)) {
        throw new Error('共有エクスポートファイルの形式が不正です');
      }

      // Import transactions — dedup by hash
      let imported = 0;
      let skipped = 0;
      if (data.transactions.length > 0) {
        const inputs: TransactionInput[] = data.transactions.map((t) => ({
          date: t.date,
          amount: t.amount,
          category: t.category,
          account: t.account,
          wallet: 'shared',
          source: t.source,
          description: t.description,
          hash: t.hash,
          merchant_key: t.merchant_key,
          category_source: t.category_source,
          confidence: t.confidence,
        }));
        const result = await bulkCreateTransactions(inputs);
        imported = result.inserted;
        skipped = result.skipped;
      }

      // Import budgets — clear shared budgets, then add
      let budgetCount = 0;
      if (Array.isArray(data.budgets) && data.budgets.length > 0) {
        const existingShared = await db.budgets.where('wallet').equals('shared').toArray();
        for (const b of existingShared) {
          await deleteBudget(b.id);
        }
        for (const b of data.budgets) {
          await createBudget({
            month: b.month,
            category: b.category,
            limit_amount: b.limit_amount,
            pinned: b.pinned,
            display_order: b.display_order,
            wallet: 'shared',
          });
          budgetCount++;
        }
      }

      setShareStatus({
        type: 'ok',
        msg: `取引 ${imported}件追加, ${skipped}件スキップ` +
          (budgetCount > 0 ? `, 予算 ${budgetCount}件` : ''),
      });
      loadBudgets();
      onRefresh();
    } catch (err) {
      setShareStatus({ type: 'err', msg: err instanceof Error ? err.message : 'インポート失敗' });
    } finally {
      setShareImporting(false);
      if (shareFileRef.current) shareFileRef.current.value = '';
    }
  };

  return (
    <div className="screen-content shared-screen">
      {/* Share button */}
      <button className="share-btn" onClick={() => { setShowShare(true); setShareStatus(null); }}>
        共有データ
      </button>

      {/* Share modal */}
      {showShare && (
        <div className="share-modal-overlay" onClick={() => setShowShare(false)}>
          <div className="share-modal" onClick={(e) => e.stopPropagation()}>
            <div className="share-modal-header">
              <h3>共有データ交換</h3>
              <button className="share-modal-close" onClick={() => setShowShare(false)}>&times;</button>
            </div>
            <p className="share-modal-desc">共有ウォレットの取引と予算をパートナーと交換できます</p>
            <div className="share-modal-actions">
              <button className="backup-btn-export" onClick={handleExportShared}>
                エクスポート
              </button>
              <label className="backup-btn-import">
                インポート
                <input
                  ref={shareFileRef}
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportShared(f);
                  }}
                  disabled={shareImporting}
                />
              </label>
            </div>
            {shareImporting && <p className="share-modal-status">読み込み中...</p>}
            {shareStatus && (
              <p className={`share-modal-status ${shareStatus.type === 'err' ? 'error' : 'success'}`}>
                {shareStatus.msg}
              </p>
            )}
          </div>
        </div>
      )}

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
