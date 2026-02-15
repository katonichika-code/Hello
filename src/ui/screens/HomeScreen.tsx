import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Transaction, ApiSettings, ApiBudget } from '../../db/repo';
import { getSettings, getBudgets, copyBudgetsFromPrevMonth } from '../../db/repo';
import {
  remainingFreeToSpend,
  totalExpenses,
  categoryRemaining,
} from '../../domain/computations';
import type { Settings, Budget } from '../../domain/types';
import { RemainingCard } from '../components/RemainingCard';
import { BudgetCard } from '../components/BudgetCard';
import { QuickEntry } from '../components/QuickEntry';

export interface HomeScreenProps {
  transactions: Transaction[];
  selectedMonth: string;
  onRefresh: () => void;
}

/** Convert API settings to domain Settings */
function toDomainSettings(api: ApiSettings): Settings {
  return {
    monthlyIncome: api.monthly_income,
    fixedCostTotal: api.fixed_cost_total,
    monthlySavingsTarget: api.monthly_savings_target,
  };
}

/** Convert API budget to domain Budget */
function toDomainBudget(api: ApiBudget): Budget {
  return {
    id: api.id,
    month: api.month,
    category: api.category,
    limitAmount: api.limit_amount,
    pinned: api.pinned === 1,
    displayOrder: api.display_order,
    wallet: api.wallet || 'personal',
  };
}

export function HomeScreen({ transactions, selectedMonth, onRefresh }: HomeScreenProps) {
  const [settings, setSettings] = useState<Settings>({
    monthlyIncome: 0, fixedCostTotal: 0, monthlySavingsTarget: 0,
  });
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  // Local form state for settings
  const [formIncome, setFormIncome] = useState('');
  const [formFixed, setFormFixed] = useState('');
  const [formSavings, setFormSavings] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      const s = await getSettings();
      setSettings(toDomainSettings(s));
    } catch { /* use defaults */ }
  }, []);

  const loadBudgets = useCallback(async () => {
    try {
      const b = await getBudgets(selectedMonth, 'personal');
      setBudgets(b.filter((x) => x.pinned === 1).map(toDomainBudget));
    } catch { /* use empty */ }
  }, [selectedMonth]);

  useEffect(() => { loadSettings(); }, [loadSettings]);
  useEffect(() => { loadBudgets(); }, [loadBudgets]);

  // Memoized domain computations — avoid recalc on unrelated re-renders
  const domainTxns = useMemo(() => transactions.map((t) => ({
    ...t,
    wallet: t.wallet || 'personal',
    source: t.source || 'csv',
  })), [transactions]);

  const disposable = useMemo(
    () => settings.monthlyIncome - settings.fixedCostTotal - settings.monthlySavingsTarget,
    [settings],
  );
  const remaining = useMemo(() => remainingFreeToSpend(settings, domainTxns), [settings, domainTxns]);
  const expenses = useMemo(() => totalExpenses(domainTxns), [domainTxns]);
  const budgetStatuses = useMemo(() => budgets.map((b) => categoryRemaining(b, domainTxns)), [budgets, domainTxns]);

  const recent = useMemo(() => transactions.slice(0, 5), [transactions]);

  const formatJPY = useMemo(() => {
    const fmt = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' });
    return (n: number) => fmt.format(n);
  }, []);

  const needsSetup = settings.monthlyIncome === 0;

  // Copy previous month budgets
  const [copyResult, setCopyResult] = useState<string | null>(null);
  const handleCopyBudgets = async () => {
    try {
      const result = await copyBudgetsFromPrevMonth(selectedMonth, 'personal');
      if (result.created === 0 && result.updated === 0) {
        setCopyResult('前月の予算がありません');
      } else {
        setCopyResult(`${result.created}件作成, ${result.updated}件更新`);
      }
      loadBudgets();
    } catch {
      setCopyResult('コピー失敗');
    }
  };

  return (
    <div className="screen-content home-screen">
      {/* Remaining Free-to-Spend */}
      {needsSetup ? (
        <div className="setup-prompt" onClick={() => setShowSettings(true)}>
          <div className="setup-title">はじめに設定</div>
          <div className="setup-desc">月収・固定費・貯蓄目標を入力してください</div>
        </div>
      ) : (
        <RemainingCard
          remaining={remaining}
          totalExpenses={expenses}
          disposable={disposable}
        />
      )}

      {/* Settings modal */}
      {showSettings && (
        <div className="settings-panel">
          <h3>月次設定</h3>
          <label>
            月収 (円)
            <input
              type="number" inputMode="numeric"
              value={formIncome || settings.monthlyIncome || ''}
              onChange={(e) => setFormIncome(e.target.value)}
            />
          </label>
          <label>
            固定費 合計 (円)
            <input
              type="number" inputMode="numeric"
              value={formFixed || settings.fixedCostTotal || ''}
              onChange={(e) => setFormFixed(e.target.value)}
            />
          </label>
          <label>
            貯蓄目標 (円)
            <input
              type="number" inputMode="numeric"
              value={formSavings || settings.monthlySavingsTarget || ''}
              onChange={(e) => setFormSavings(e.target.value)}
            />
          </label>
          <div className="settings-actions">
            <button
              className="btn-save"
              onClick={async () => {
                const { updateSettings } = await import('../../db/repo');
                await updateSettings({
                  monthly_income: parseInt(formIncome) || settings.monthlyIncome,
                  fixed_cost_total: parseInt(formFixed) || settings.fixedCostTotal,
                  monthly_savings_target: parseInt(formSavings) || settings.monthlySavingsTarget,
                });
                await loadSettings();
                setShowSettings(false);
              }}
            >
              保存
            </button>
            <button className="btn-cancel-settings" onClick={() => setShowSettings(false)}>
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Settings gear (always available) */}
      {!showSettings && !needsSetup && (
        <button className="settings-gear" onClick={() => {
          setFormIncome(String(settings.monthlyIncome));
          setFormFixed(String(settings.fixedCostTotal));
          setFormSavings(String(settings.monthlySavingsTarget));
          setShowSettings(true);
        }}>
          ⚙ 設定
        </button>
      )}

      {/* Tracked category budget cards */}
      {budgetStatuses.length > 0 && (
        <div className="budget-cards">
          {budgetStatuses.map((s) => (
            <BudgetCard key={s.category} status={s} />
          ))}
        </div>
      )}

      {/* Copy previous month budgets */}
      {budgetStatuses.length === 0 && !needsSetup && (
        <button className="copy-budgets-btn" onClick={handleCopyBudgets}>
          先月の予算をコピー
        </button>
      )}
      {copyResult && (
        <div className="copy-result" onClick={() => setCopyResult(null)}>{copyResult}</div>
      )}

      {/* Quick entry */}
      <QuickEntry onSaved={onRefresh} />

      {/* Recent transactions */}
      {recent.length > 0 && (
        <div className="recent-txns">
          <h4>最近の取引</h4>
          {recent.map((t) => (
            <div key={t.id} className="recent-row">
              <span className="recent-desc">{t.description}</span>
              <span className="recent-cat">{t.category}</span>
              <span className={`recent-amount ${t.amount < 0 ? 'expense' : 'income'}`}>
                {formatJPY(t.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
