const API_BASE = '/api';

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  category: string;
  account: string;
  wallet: string;
  source: string;
  description: string;
  hash: string;
  createdAt: string;
}

export interface TransactionInput {
  date: string;
  amount: number;
  category: string;
  account: string;
  wallet?: string;
  source?: string;
  description: string;
  hash: string;
}

export interface BulkResult {
  inserted: number;
  skipped: number;
}

export interface ApiSettings {
  monthly_income: number;
  fixed_cost_total: number;
  monthly_savings_target: number;
}

export interface ApiBudget {
  id: string;
  month: string;
  category: string;
  limit_amount: number;
  pinned: number;
  display_order: number;
}

export interface ApiSummary {
  month: string;
  remaining_free_to_spend: number;
  total_expenses: number;
  disposable: number;
  category_totals: { category: string; spent: number }[];
}

export async function getTransactions(month?: string): Promise<Transaction[]> {
  const url = month
    ? `${API_BASE}/transactions?month=${month}`
    : `${API_BASE}/transactions`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch transactions');
  return response.json();
}

export async function createTransaction(data: TransactionInput): Promise<Transaction> {
  const response = await fetch(`${API_BASE}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok && response.status !== 409) {
    throw new Error('Failed to create transaction');
  }
  return response.json();
}

export async function bulkCreateTransactions(data: TransactionInput[]): Promise<BulkResult> {
  const response = await fetch(`${API_BASE}/transactions/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to bulk create transactions');
  return response.json();
}

export async function updateTransactionCategory(id: string, category: string): Promise<Transaction> {
  const response = await fetch(`${API_BASE}/transactions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category }),
  });
  if (!response.ok) throw new Error('Failed to update transaction');
  return response.json();
}

// Generate SHA-256 hash for deduplication
export async function generateHash(date: string, amount: number, description: string): Promise<string> {
  const text = `${date}${amount}${description}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- Settings ---

export async function getSettings(): Promise<ApiSettings> {
  const response = await fetch(`${API_BASE}/settings`);
  if (!response.ok) throw new Error('Failed to fetch settings');
  return response.json();
}

export async function updateSettings(data: ApiSettings): Promise<ApiSettings> {
  const response = await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update settings');
  return response.json();
}

// --- Budgets ---

export async function getBudgets(month?: string): Promise<ApiBudget[]> {
  const url = month
    ? `${API_BASE}/budgets?month=${month}`
    : `${API_BASE}/budgets`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch budgets');
  return response.json();
}

export async function createBudget(data: Omit<ApiBudget, 'id'>): Promise<ApiBudget> {
  const response = await fetch(`${API_BASE}/budgets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create budget');
  return response.json();
}

export async function deleteBudget(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/budgets/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete budget');
}

// --- Summary ---

export async function getSummary(month: string): Promise<ApiSummary> {
  const response = await fetch(`${API_BASE}/summary?month=${month}`);
  if (!response.ok) throw new Error('Failed to fetch summary');
  return response.json();
}
