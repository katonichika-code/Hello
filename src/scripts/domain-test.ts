/**
 * Domain computation tests.
 * Run with: npm run test:domain
 */
import {
  remainingFreeToSpend,
  categoryRemaining,
  categoryBreakdown,
  monthSummary,
  projectedMonthEnd,
  forMonth,
  forWallet,
  totalExpenses,
  currentMonth,
} from '../domain/computations';
import type { Settings, Budget, Transaction } from '../domain/types';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    results.push({ name, passed: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: message });
    console.log(`✗ ${name}: ${message}`);
  }
}

function assertEq(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// --- Test data factories ---

function makeTxn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'test-1',
    date: '2025-01-15',
    amount: -1000,
    category: '食費',
    account: 'card',
    wallet: 'personal',
    source: 'csv',
    description: 'テスト',
    hash: 'abc123',
    createdAt: '2025-01-15T00:00:00Z',
    ...overrides,
  };
}

const baseSettings: Settings = {
  monthlyIncome: 300000,
  fixedCostTotal: 100000,
  monthlySavingsTarget: 50000,
};

// --- Tests ---

console.log('\n=== Domain Computation Tests ===\n');

test('remainingFreeToSpend: no expenses = full disposable', () => {
  const r = remainingFreeToSpend(baseSettings, []);
  // 300000 - 100000 - 50000 - 0 = 150000
  assertEq(r, 150000, 'remaining');
});

test('remainingFreeToSpend: with expenses', () => {
  const txns = [
    makeTxn({ amount: -10000 }),
    makeTxn({ id: '2', amount: -5000 }),
  ];
  const r = remainingFreeToSpend(baseSettings, txns);
  // 300000 - 100000 - 50000 - 15000 = 135000
  assertEq(r, 135000, 'remaining');
});

test('remainingFreeToSpend: ignores positive amounts (income)', () => {
  const txns = [
    makeTxn({ amount: -10000 }),
    makeTxn({ id: '2', amount: 5000 }), // income — not an expense
  ];
  const r = remainingFreeToSpend(baseSettings, txns);
  // 300000 - 100000 - 50000 - 10000 = 140000
  assertEq(r, 140000, 'remaining');
});

test('remainingFreeToSpend: can go negative (overspent)', () => {
  const txns = [makeTxn({ amount: -200000 })];
  const r = remainingFreeToSpend(baseSettings, txns);
  // 300000 - 100000 - 50000 - 200000 = -50000
  assertEq(r, -50000, 'remaining');
});

test('remainingFreeToSpend: zero settings = negative of spending', () => {
  const zero: Settings = { monthlyIncome: 0, fixedCostTotal: 0, monthlySavingsTarget: 0 };
  const txns = [makeTxn({ amount: -5000 })];
  assertEq(remainingFreeToSpend(zero, txns), -5000, 'remaining');
});

test('categoryRemaining: basic', () => {
  const budget: Budget = {
    id: 'b1', month: '2025-01', category: '食費',
    limitAmount: 30000, pinned: true, displayOrder: 0,
  };
  const txns = [
    makeTxn({ amount: -8000, category: '食費' }),
    makeTxn({ id: '2', amount: -3000, category: '交通費' }), // different category
  ];
  const status = categoryRemaining(budget, txns);
  assertEq(status.budgeted, 30000, 'budgeted');
  assertEq(status.spent, 8000, 'spent');
  assertEq(status.remaining, 22000, 'remaining');
});

test('categoryRemaining: overspent', () => {
  const budget: Budget = {
    id: 'b1', month: '2025-01', category: '食費',
    limitAmount: 5000, pinned: true, displayOrder: 0,
  };
  const txns = [makeTxn({ amount: -8000, category: '食費' })];
  const status = categoryRemaining(budget, txns);
  assertEq(status.remaining, -3000, 'remaining');
});

test('categoryBreakdown: groups and sorts by amount', () => {
  const txns = [
    makeTxn({ amount: -5000, category: '食費' }),
    makeTxn({ id: '2', amount: -3000, category: '食費' }),
    makeTxn({ id: '3', amount: -10000, category: '交通費' }),
    makeTxn({ id: '4', amount: -2000, category: '日用品' }),
  ];
  const bd = categoryBreakdown(txns);
  assertEq(bd.length, 3, 'category count');
  assertEq(bd[0].category, '交通費', 'first category');
  assertEq(bd[0].spent, 10000, 'first spent');
  assertEq(bd[1].category, '食費', 'second category');
  assertEq(bd[1].spent, 8000, 'second spent');
  assertEq(bd[2].category, '日用品', 'third category');
  assertEq(bd[2].spent, 2000, 'third spent');
});

test('monthSummary: combines everything', () => {
  const txns = [
    makeTxn({ amount: -10000, category: '食費' }),
    makeTxn({ id: '2', amount: -5000, category: '交通費' }),
  ];
  const s = monthSummary(baseSettings, txns, '2025-01');
  assertEq(s.month, '2025-01', 'month');
  assertEq(s.totalExpenses, 15000, 'totalExpenses');
  assertEq(s.remainingFreeToSpend, 135000, 'remaining');
  assertEq(s.categoryBreakdown.length, 2, 'breakdown count');
});

test('forMonth: filters by YYYY-MM prefix', () => {
  const txns = [
    makeTxn({ date: '2025-01-15' }),
    makeTxn({ id: '2', date: '2025-02-01' }),
    makeTxn({ id: '3', date: '2025-01-31' }),
  ];
  const jan = forMonth(txns, '2025-01');
  assertEq(jan.length, 2, 'january count');
});

test('forWallet: filters by wallet', () => {
  const txns = [
    makeTxn({ wallet: 'personal' }),
    makeTxn({ id: '2', wallet: 'shared' }),
    makeTxn({ id: '3', wallet: 'personal' }),
  ];
  assertEq(forWallet(txns, 'personal').length, 2, 'personal');
  assertEq(forWallet(txns, 'shared').length, 1, 'shared');
});

test('totalExpenses: sums absolute values of negatives only', () => {
  const txns = [
    makeTxn({ amount: -5000 }),
    makeTxn({ id: '2', amount: 3000 }), // income ignored
    makeTxn({ id: '3', amount: -2000 }),
  ];
  assertEq(totalExpenses(txns), 7000, 'total');
});

test('projectedMonthEnd: linear projection', () => {
  // Day 15 of a 31-day month, spent 15000 so far
  const txns = [makeTxn({ amount: -15000 })];
  const today = new Date(2025, 0, 15); // Jan 15
  const proj = projectedMonthEnd(baseSettings, txns, today);
  // dailyRate = 15000/15 = 1000, projected = 1000*31 = 31000
  // disposable = 300000-100000-50000 = 150000
  // projected remaining = 150000 - 31000 = 119000
  assertEq(proj, 119000, 'projected');
});

test('projectedMonthEnd: zero expenses returns full remaining', () => {
  const proj = projectedMonthEnd(baseSettings, [], new Date(2025, 0, 15));
  assertEq(proj, 150000, 'projected');
});

test('currentMonth: formats correctly', () => {
  const m = currentMonth(new Date(2025, 0, 15));
  assertEq(m, '2025-01', 'month');
  const m2 = currentMonth(new Date(2025, 11, 1));
  assertEq(m2, '2025-12', 'december');
});

// --- Summary ---
console.log('\n=== Summary ===');
const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;
console.log(`Passed: ${passed}, Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
