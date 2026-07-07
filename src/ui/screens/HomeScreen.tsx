import { useState, useEffect, useMemo, useRef } from 'react';
import type { Transaction, ApiSettings, ApiBudget } from '../../db/repo';
import { getSettings, getBudgets } from '../../db/repo';
import {
  remainingFreeToSpend,
  totalExpenses,
  categoryRemaining,
  categoryBreakdown,
  dailyAllowance,
  dangerCategories,
} from '../../domain/computations';
import type { Settings, Budget } from '../../domain/types';
import { RemainingCard } from '../components/RemainingCard';
import { SpendingPaceChart } from '../components/SpendingPaceChart';
import { BudgetCard } from '../components/BudgetCard';
import { ProjectionCard } from '../components/ProjectionCard';
import { QuickEntry } from '../components/QuickEntry';
import { TransactionDetailSheet } from '../components/TransactionDetailSheet';

export interface HomeScreenProps {
  transactions: Transaction[];
  selectedMonth: string;
  onRefresh: () => Promise<void> | void;
}

function toDomainSettings(api: ApiSettings): Settings {
  return {
    monthlyIncome: api.monthly_income,
    fixedCostTotal: api.fixed_cost_total,
    monthlySavingsTarget: api.monthly_savings_target,
    sharedMonthlyBudget: api.shared_monthly_budget || 0,
  };
}

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
    monthlyIncome: 0, fixedCostTotal: 0, monthlySavingsTarget: 0, sharedMonthlyBudget: 0,
  });
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [entryOpen, setEntryOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    void getSettings()
      .then((s) => {
        if (active) setSettings(toDomainSettings(s));
      })
      .catch(() => {
        // use defaults
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void getBudgets(selectedMonth, 'personal')
      .then((b) => {
        if (active) setBudgets(b.filter((x) => x.pinned === 1).map(toDomainBudget));
      })
      .catch(() => {
        // use empty
      });
    return () => { active = false; };
  }, [selectedMonth]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 1600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const domainTxns = useMemo(() => transactions.map((t) => ({
    ...t,
    wallet: t.wallet || 'personal',
    source: t.source || 'csv',
  })), [transactions]);

  const disposable = useMemo(
    () => settings.monthlyIncome - settings.fixedCostTotal - settings.monthlySavingsTarget,
    [settings],
  );
  const remaining = useMemo(() => remainingFreeToSpend(settings, domainTxns, 'personal'), [settings, domainTxns]);
  const expenses = useMemo(() => totalExpenses(domainTxns, 'personal'), [domainTxns]);
  const today = useMemo(() => new Date(), []);
  const monthEnd = useMemo(() => new Date(today.getFullYear(), today.getMonth() + 1, 0), [today]);
  const daysRemaining = useMemo(() => (monthEnd.getDate() - today.getDate() + 1), [monthEnd, today]);
  const dailyAmount = useMemo(() => dailyAllowance(remaining, today, monthEnd), [remaining, today, monthEnd]);
  const dangerCategoryNames = useMemo(
    () => dangerCategories(budgets, categoryBreakdown(domainTxns, 'personal'), today).map((c) => c.category),
    [budgets, domainTxns, today],
  );
  const budgetStatuses = useMemo(() => budgets.map((b) => categoryRemaining(b, domainTxns, 'personal')), [budgets, domainTxns]);

  const recent = useMemo(() => transactions.filter((t) => (t.wallet || 'personal') === 'personal').slice(0, 5), [transactions]);

  const formatJPY = useMemo(() => {
    const fmt = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' });
    return (n: number) => fmt.format(n);
  }, []);

  const needsSetup = settings.monthlyIncome === 0;

  return (
    <div className="screen-content home-screen">
      {needsSetup ? (
        <div className="setup-prompt">
          <div className="setup-title">はじめに設定</div>
          <div className="setup-desc">月収・固定費・貯蓄目標を入力してください</div>
        </div>
      ) : (
        <div className="hero-card-wrap">
          <RemainingCard
            selectedMonth={selectedMonth}
            remaining={remaining}
            totalExpenses={expenses}
            disposable={disposable}
            dailyAmount={dailyAmount}
            daysRemaining={daysRemaining}
            dangerCategories={dangerCategoryNames}
          />
        </div>
      )}

      {!needsSetup && <SpendingPaceChart selectedMonth={selectedMonth} spendableAmount={disposable} />}

      {budgetStatuses.length > 0 && (
        <div className="budget-cards">
          {budgetStatuses.map((s) => (
            <BudgetCard key={s.category} status={s} />
          ))}
        </div>
      )}

      {budgetStatuses.length === 0 && !needsSetup && (
        <div className="empty-state">
          <div className="empty-state-title">カテゴリ予算を設定しましょう</div>
          <div className="empty-state-description">設定画面から月間予算を設定できます。</div>
        </div>
      )}

      {!needsSetup && <ProjectionCard transactions={domainTxns} />}

      {recent.length > 0 && (
        <div className="recent-txns">
          <h4>最近の取引</h4>
          {recent.map((t) => (
            <div
              key={t.id}
              className="recent-row clickable"
              onClick={() => setSelectedTx(t)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedTx(t);
                }
              }}
            >
              <span className="recent-desc">{t.description}</span>
              <span className="recent-cat">{t.category}</span>
              <span className={`recent-amount ${t.amount < 0 ? 'expense' : 'income'}`}>
                {formatJPY(t.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      {transactions.length === 0 && !needsSetup && (
        <div className="empty-state">
          <div className="empty-state-title">まだ取引がありません</div>
          <div className="empty-state-description">
            Gmailを接続してカード利用を自動取り込み、
            <br />
            または＋ボタンで手入力できます。
          </div>
        </div>
      )}

      <button className="fab" onClick={() => setEntryOpen(true)} aria-label="取引を追加" type="button">+</button>

      {entryOpen && (
        <>
          <div className="bottom-sheet-backdrop" onClick={() => setEntryOpen(false)} />
          <div
            className="bottom-sheet"
            onTouchStart={(e) => {
              touchStartY.current = e.touches[0].clientY;
            }}
            onTouchEnd={(e) => {
              if (touchStartY.current === null) return;
              const deltaY = e.changedTouches[0].clientY - touchStartY.current;
              if (deltaY > 60) {
                setEntryOpen(false);
              }
              touchStartY.current = null;
            }}
          >
            <div className="bottom-sheet-handle" />
            <QuickEntry
              onSaved={onRefresh}
              onSuccess={() => {
                setEntryOpen(false);
                setToast('追加しました');
              }}
            />
          </div>
        </>
      )}

      {toast && <div className="quick-toast">{toast}</div>}

      <TransactionDetailSheet
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
        onUpdate={() => {
          setSelectedTx(null);
          void onRefresh();
        }}
      />
    </div>
  );
}
