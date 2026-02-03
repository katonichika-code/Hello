const API_BASE = 'http://localhost:8787';

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  category: string;
  account: string;
  description: string;
  hash: string;
  createdAt: string;
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
