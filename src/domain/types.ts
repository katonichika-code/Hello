/**
 * Domain types for the Spending OS.
 * Pure data — no React, no DB, no IO.
 */

/** User-configurable monthly parameters */
export interface Settings {
  monthlyIncome: number;          // JPY
  fixedCostTotal: number;         // JPY (rent, utilities, loans — total)
  monthlySavingsTarget: number;   // JPY monthly savings goal
}

/** Per-category budget for a specific month */
export interface Budget {
  id: string;
  month: string;               // YYYY-MM
  category: string;
  limitAmount: number;         // JPY budget limit
  pinned: boolean;             // shown on Home
  displayOrder: number;        // sort order on Home
  wallet: string;              // 'personal' | 'shared'
}

/** Canonical transaction (superset of legacy fields) */
export interface Transaction {
  id: string;
  date: string;                // YYYY-MM-DD
  amount: number;              // negative = expense, positive = income
  category: string;
  account: string;             // "card" | "cash"
  wallet: string;              // "personal" | "shared"
  source: string;              // "manual" | "csv"
  description: string;
  hash: string;
  createdAt: string;
}

/** YYYY-MM string */
export type Month = string;

/** Summary produced by domain computations */
export interface MonthSummary {
  month: Month;
  totalExpenses: number;       // positive number (absolute sum of negatives)
  remainingFreeToSpend: number;
  categoryBreakdown: CategoryTotal[];
}

export interface CategoryTotal {
  category: string;
  spent: number;               // positive
}

export interface BudgetStatus {
  category: string;
  budgeted: number;
  spent: number;
  remaining: number;           // can be negative (overspent)
}

/** Default settings for first-time users */
export const DEFAULT_SETTINGS: Settings = {
  monthlyIncome: 0,
  fixedCostTotal: 0,
  monthlySavingsTarget: 0,
};
