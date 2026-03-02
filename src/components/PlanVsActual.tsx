import { useEffect, useMemo, useState } from 'react';
import type { Transaction } from '../db/repo';
import * as repo from '../db/repo';

const jpyFmt = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' });

interface PlanVsActualProps {
  transactions: Transaction[];
}

interface BudgetRow {
  category: string;
  budget: number;
  actual: number;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function PlanVsActual({ transactions }: PlanVsActualProps) {
  const [budgets, setBudgets] = useState<repo.ApiBudget[]>([]);

  useEffect(() => {
    const month = getCurrentMonth();
    void repo
      .getBudgets(month)
      .then((data) => setBudgets(data))
      .catch(() => setBudgets([]));
  }, []);

  const monthKey = getCurrentMonth();

  const { withBudget, withoutBudget } = useMemo(() => {
    const actualByCategory = new Map<string, number>();
    transactions
      .filter((t) => t.monthKey === monthKey && t.amount < 0)
      .forEach((t) => {
        actualByCategory.set(t.category, (actualByCategory.get(t.category) || 0) + Math.abs(t.amount));
      });

    const budgetMap = new Map<string, number>();
    budgets.forEach((b) => {
      budgetMap.set(b.category, (budgetMap.get(b.category) || 0) + b.limit_amount);
    });

    const rows: BudgetRow[] = Array.from(budgetMap.entries())
      .map(([category, budget]) => ({
        category,
        budget,
        actual: actualByCategory.get(category) || 0,
      }))
      .sort((a, b) => b.actual - a.actual);

    const noBudgetRows = Array.from(actualByCategory.entries())
      .filter(([category, amount]) => amount > 0 && !budgetMap.has(category))
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    return { withBudget: rows, withoutBudget: noBudgetRows };
  }, [budgets, monthKey, transactions]);

  if (withBudget.length === 0 && withoutBudget.length === 0) {
    return null;
  }

  return (
    <div className="plan-actual-card">
      <h3 className="plan-actual-title">計画 vs 実績</h3>

      {withBudget.map((row) => {
        const ratio = row.budget > 0 ? row.actual / row.budget : 0;
        const width = `${Math.min(ratio, 1.2) * 100}%`;
        let color = 'var(--k-positive, var(--success, #10B981))';
        if (ratio >= 0.7 && ratio <= 1) {
          color = 'var(--k-warning, #F59E0B)';
        } else if (ratio > 1) {
          color = 'var(--k-danger, var(--danger, #EF4444))';
        }

        const remaining = row.budget - row.actual;

        return (
          <div className="plan-actual-row" key={row.category}>
            <div className="plan-actual-label">
              <span className="plan-actual-category">{row.category}</span>
              <span className="plan-actual-amounts">
                {jpyFmt.format(row.actual)} / {jpyFmt.format(row.budget)}
              </span>
            </div>
            <div className="plan-actual-bar-bg">
              <div className="plan-actual-bar-fill" style={{ width, background: color }}></div>
            </div>
            <div className="plan-actual-remaining" style={{ color }}>
              {remaining >= 0 ? `残 ${jpyFmt.format(remaining)}` : `${jpyFmt.format(Math.abs(remaining))} 超過`}
            </div>
          </div>
        );
      })}

      {withoutBudget.length > 0 && (
        <div className="plan-actual-unset">
          <h4>予算未設定</h4>
          {withoutBudget.map((row) => (
            <div className="plan-actual-unset-row" key={row.category}>
              <span>{row.category}</span>
              <span>{jpyFmt.format(row.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
