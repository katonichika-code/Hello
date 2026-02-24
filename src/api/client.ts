const API_BASE = 'http://localhost:8787';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  category: string;
  account: string;
  description: string;
  hash: string;
  createdAt: string;
  isPending: number; // 0 = confirmed, 1 = pending
}

export interface TransactionInput {
  date: string;
  amount: number;
  category: string;
  account: string;
  description: string;
  hash: string;
}

export interface BulkResult {
  inserted: number;
  skipped: number;
}

export interface Summary {
  income: number;
  expenses: number;
  net: number;
}

export interface Budget {
  id: string;
  name: string;
  category: string;
  monthlyLimit: number;
  createdAt: string;
}

export type BudgetInput = Omit<Budget, 'id' | 'createdAt'>;

export type AppSettings = Record<string, string>;

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function getTransactions(month?: string): Promise<Transaction[]> {
  const url = month
    ? `${API_BASE}/transactions?month=${month}`
    : `${API_BASE}/transactions`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch transactions');
  return res.json();
}

export async function getSummary(month?: string): Promise<Summary> {
  const url = month
    ? `${API_BASE}/transactions/summary?month=${month}`
    : `${API_BASE}/transactions/summary`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch summary');
  return res.json();
}

export async function createTransaction(data: TransactionInput): Promise<Transaction> {
  const res = await fetch(`${API_BASE}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok && res.status !== 409) throw new Error('Failed to create transaction');
  return res.json();
}

export async function bulkCreateTransactions(data: TransactionInput[]): Promise<BulkResult> {
  const res = await fetch(`${API_BASE}/transactions/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to bulk create transactions');
  return res.json();
}

export async function updateTransactionCategory(id: string, category: string): Promise<Transaction> {
  const res = await fetch(`${API_BASE}/transactions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category }),
  });
  if (!res.ok) throw new Error('Failed to update transaction');
  return res.json();
}

// ─── Budgets ─────────────────────────────────────────────────────────────────

export async function getBudgets(): Promise<Budget[]> {
  const res = await fetch(`${API_BASE}/budgets`);
  if (!res.ok) throw new Error('Failed to fetch budgets');
  return res.json();
}

export async function createBudget(data: BudgetInput): Promise<Budget> {
  const res = await fetch(`${API_BASE}/budgets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create budget');
  return res.json();
}

export async function updateBudget(id: string, data: Partial<BudgetInput>): Promise<Budget> {
  const res = await fetch(`${API_BASE}/budgets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update budget');
  return res.json();
}

export async function deleteBudget(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/budgets/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete budget');
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<AppSettings> {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function putSettings(data: AppSettings): Promise<AppSettings> {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}

// ─── Utility ─────────────────────────────────────────────────────────────────

export async function generateHash(date: string, amount: number, description: string): Promise<string> {
  const text = `${date}${amount}${description}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
