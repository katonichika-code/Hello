import { useState, useEffect, useCallback } from 'react';
import type { Transaction, ApiSettings, ApiBudget } from '../../api/client';
import { getSettings, getBudgets } from '../../api/client';
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
      const b = await getBudgets(selectedMonth);
      setBudgets(b.filter((x) => x.pinned === 1).map(toDomainBudget));
    } catch { /* use empty */ }
  }, [selectedMonth]);

  useEffect(() => { loadSettings(); }, [loadSettings]);
  useEffect(() => { loadBudgets(); }, [loadBudgets]);

  // Domain computations
  const domainTxns = transactions.map((t) => ({
    ...t,
    wallet: t.wallet || 'personal',
    source: t.source || 'csv',
  }));

  const disposable = settings.monthlyIncome - settings.fixedCostTotal - settings.monthlySavingsTarget;
  const remaining = remainingFreeToSpend(settings, domainTxns);
  const expenses = totalExpenses(domainTxns);

  const budgetStatuses = budgets.map((b) => categoryRemaining(b, domainTxns));

  // Recent transactions (last 5)
  const recent = [...transactions].slice(0, 5);

  const formatJPY = (n: number) =>
    new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(n);

  const needsSetup = settings.monthlyIncome === 0;

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
                const { updateSettings } = await import('../../api/client');
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
