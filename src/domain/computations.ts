/**
 * Pure domain computations.
 * No React, no DB, no IO — only data in, data out.
 */
import type {
  Settings,
  Budget,
  Transaction,
  Month,
  MonthSummary,
  CategoryTotal,
  BudgetStatus,
} from './types';

/** Filter transactions to a single month (YYYY-MM) */
export function forMonth(txns: Transaction[], month: Month): Transaction[] {
  return txns.filter((t) => t.date.startsWith(month));
}

/** Filter to expenses only (amount < 0) */
export function expensesOnly(txns: Transaction[]): Transaction[] {
  return txns.filter((t) => t.amount < 0);
}

/** Filter to a specific wallet */
export function forWallet(txns: Transaction[], wallet: string): Transaction[] {
  return txns.filter((t) => t.wallet === wallet);
}

/** Sum of absolute expense amounts */
export function totalExpenses(txns: Transaction[]): number {
  return expensesOnly(txns).reduce((sum, t) => sum + Math.abs(t.amount), 0);
}

/**
 * Definition A — the single source of truth number.
 *
 * Remaining Free-to-Spend =
 *   monthly_income − fixed_cost_total − monthly_savings_target − SUM(all month expenses)
 *
 * All inputs are positive JPY. Expenses in txns are negative (convention).
 */
export function remainingFreeToSpend(
  settings: Settings,
  monthTxns: Transaction[],
): number {
  const spent = totalExpenses(monthTxns);
  return settings.monthlyIncome - settings.fixedCostTotal - settings.monthlySavingsTarget - spent;
}

/**
 * How much is left in a single tracked category's budget.
 * remaining = budgeted − actual spend in that category
 */
export function categoryRemaining(
  budget: Budget,
  monthTxns: Transaction[],
): BudgetStatus {
  const spent = expensesOnly(monthTxns)
    .filter((t) => t.category === budget.category)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return {
    category: budget.category,
    budgeted: budget.limitAmount,
    spent,
    remaining: budget.limitAmount - spent,
  };
}

/** Breakdown of spending by category */
export function categoryBreakdown(monthTxns: Transaction[]): CategoryTotal[] {
  const map = new Map<string, number>();
  for (const t of expensesOnly(monthTxns)) {
    const abs = Math.abs(t.amount);
    map.set(t.category, (map.get(t.category) || 0) + abs);
  }
  return Array.from(map.entries())
    .map(([category, spent]) => ({ category, spent }))
    .sort((a, b) => b.spent - a.spent);
}

/** Full month summary */
export function monthSummary(
  settings: Settings,
  monthTxns: Transaction[],
  month: Month,
): MonthSummary {
  const spent = totalExpenses(monthTxns);
  return {
    month,
    totalExpenses: spent,
    remainingFreeToSpend: remainingFreeToSpend(settings, monthTxns),
    categoryBreakdown: categoryBreakdown(monthTxns),
  };
}

/**
 * Projected month-end remaining, assuming daily spending rate continues.
 * Returns null if not enough data (day 0 or no expenses).
 */
export function projectedMonthEnd(
  settings: Settings,
  monthTxns: Transaction[],
  today: Date,
): number | null {
  const dayOfMonth = today.getDate();
  if (dayOfMonth === 0) return null;

  const spent = totalExpenses(monthTxns);
  if (spent === 0) return remainingFreeToSpend(settings, monthTxns);

  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const dailyRate = spent / dayOfMonth;
  const projectedTotal = dailyRate * daysInMonth;
  const disposable = settings.monthlyIncome - settings.fixedCostTotal - settings.monthlySavingsTarget;

  return disposable - projectedTotal;
}

/** Get current month as YYYY-MM */
export function currentMonth(now: Date = new Date()): Month {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Get the last N months (including the reference month) as YYYY-MM labels.
 */
export function lastNMonths(count: number, from: Date = new Date()): Month[] {
  if (count <= 0) return [];

  return Array.from({ length: count }, (_, index) => {
    const d = new Date(from.getFullYear(), from.getMonth() - (count - 1 - index), 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
}
