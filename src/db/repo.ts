/**
 * Repository layer: IndexedDB operations replacing HTTP client.ts.
 *
 * Every function here has the same return type as the HTTP version it replaces,
 * enabling a 1:1 swap in UI components.
 */
import { db, ensureDefaults, type DbTransaction, type DbSettings, type DbBudget, type DbMerchantMapping } from './database';

// Re-export types for consumers (match client.ts shape)
export type Transaction = DbTransaction;
export type TransactionInput = {
  date: string;
  amount: number;
  category: string;
  account: string;
  wallet?: string;
  source?: string;
  description: string;
  hash: string;
  merchant_key?: string | null;
  category_source?: string;
  confidence?: number;
};
export type ApiSettings = Omit<DbSettings, 'id'>;
export type ApiBudget = DbBudget;
export type ApiMerchantMapping = DbMerchantMapping;
export type BulkResult = { inserted: number; skipped: number };

// --- ID generation (same as server) ---

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `c${timestamp}${randomPart}`;
}

// --- Transactions ---

export async function getTransactions(month?: string): Promise<Transaction[]> {
  let txns: Transaction[];
  if (month) {
    // Use indexed monthKey for fast month filtering
    txns = await db.transactions
      .where('monthKey')
      .equals(month)
      .reverse()
      .sortBy('date');
  } else {
    txns = await db.transactions.orderBy('date').reverse().toArray();
  }
  return txns;
}

export async function createTransaction(data: TransactionInput): Promise<Transaction> {
  // Check hash uniqueness
  const existing = await db.transactions.where('hash').equals(data.hash).first();
  if (existing) {
    return existing; // Silently return existing (matches 409 behavior)
  }

  const txn: Transaction = {
    id: generateId(),
    date: data.date,
    monthKey: data.date.slice(0, 7),
    amount: data.amount,
    category: data.category,
    account: data.account,
    wallet: data.wallet || 'personal',
    source: data.source || 'manual',
    description: data.description,
    hash: data.hash,
    createdAt: new Date().toISOString(),
    merchant_key: data.merchant_key ?? null,
    category_source: data.category_source || 'unknown',
    confidence: data.confidence ?? 0,
  };

  await db.transactions.add(txn);
  return txn;
}

export async function bulkCreateTransactions(items: TransactionInput[]): Promise<BulkResult> {
  let inserted = 0;
  let skipped = 0;

  // Batch hash check for performance
  const hashes = items.map((i) => i.hash);
  const existingTxns = await db.transactions.where('hash').anyOf(hashes).toArray();
  const existingHashes = new Set(existingTxns.map((t) => t.hash));

  const toInsert: Transaction[] = [];
  for (const item of items) {
    if (existingHashes.has(item.hash)) {
      skipped++;
      continue;
    }
    existingHashes.add(item.hash); // prevent duplicates within the batch
    toInsert.push({
      id: generateId(),
      date: item.date,
      monthKey: item.date.slice(0, 7),
      amount: item.amount,
      category: item.category,
      account: item.account,
      wallet: item.wallet || 'personal',
      source: item.source || 'csv',
      description: item.description,
      hash: item.hash,
      createdAt: new Date().toISOString(),
      merchant_key: item.merchant_key ?? null,
      category_source: item.category_source || 'unknown',
      confidence: item.confidence ?? 0,
    });
    inserted++;
  }

  if (toInsert.length > 0) {
    await db.transactions.bulkAdd(toInsert);
  }

  return { inserted, skipped };
}

export async function updateTransactionCategory(
  id: string,
  category: string,
  learnMerchant = false,
): Promise<Transaction> {
  const existing = await db.transactions.get(id);
  if (!existing) throw new Error('Transaction not found');

  await db.transactions.update(id, {
    category,
    category_source: 'manual',
  });

  // Merchant learning
  if (learnMerchant && existing.merchant_key) {
    const mapping = await db.merchant_map.get(existing.merchant_key);
    if (mapping) {
      await db.merchant_map.update(existing.merchant_key, {
        category,
        updated_at: new Date().toISOString(),
        hits: mapping.hits + 1,
      });
    } else {
      await db.merchant_map.add({
        merchant_key: existing.merchant_key,
        category,
        updated_at: new Date().toISOString(),
        hits: 1,
      });
    }
  }

  return { ...existing, category, category_source: 'manual' };
}

// --- Settings ---

export async function getSettings(): Promise<ApiSettings> {
  await ensureDefaults();
  const row = await db.settings.get(1);
  return {
    monthly_income: row!.monthly_income,
    fixed_cost_total: row!.fixed_cost_total,
    monthly_savings_target: row!.monthly_savings_target,
  };
}

export async function updateSettings(data: ApiSettings): Promise<ApiSettings> {
  await db.settings.put({ id: 1, ...data });
  return data;
}

// --- Budgets ---

export async function getBudgets(month?: string, wallet?: string): Promise<ApiBudget[]> {
  if (month && wallet) {
    return db.budgets
      .where('[month+wallet]')
      .equals([month, wallet])
      .sortBy('display_order');
  }
  if (month) {
    return db.budgets
      .where('month')
      .equals(month)
      .sortBy('display_order');
  }
  return db.budgets.orderBy('month').reverse().toArray();
}

export async function createBudget(data: Omit<ApiBudget, 'id'>): Promise<ApiBudget> {
  const wallet = data.wallet || 'personal';

  // Upsert: check for existing [month+wallet+category]
  const existing = await db.budgets
    .where('[month+wallet+category]')
    .equals([data.month, wallet, data.category])
    .first();

  if (existing) {
    await db.budgets.update(existing.id, {
      limit_amount: data.limit_amount,
      pinned: data.pinned,
      display_order: data.display_order,
    });
    return { ...existing, ...data, wallet };
  }

  const budget: ApiBudget = { id: generateId(), ...data, wallet };
  await db.budgets.add(budget);
  return budget;
}

export async function deleteBudget(id: string): Promise<void> {
  await db.budgets.delete(id);
}

// --- Merchant Map ---

export async function getMerchantMap(): Promise<ApiMerchantMapping[]> {
  const all = await db.merchant_map.toArray();
  return all.sort((a, b) => b.hits - a.hits);
}

export async function upsertMerchantMapping(
  merchantKey: string,
  category: string,
): Promise<ApiMerchantMapping> {
  const existing = await db.merchant_map.get(merchantKey);
  const mapping: ApiMerchantMapping = {
    merchant_key: merchantKey,
    category,
    updated_at: new Date().toISOString(),
    hits: existing ? existing.hits + 1 : 1,
  };
  await db.merchant_map.put(mapping);
  return mapping;
}

export async function bulkApplyMerchantCategory(
  merchantKey: string,
  category: string,
): Promise<{ updated: number }> {
  // Upsert merchant_map
  await upsertMerchantMapping(merchantKey, category);

  // Update all matching uncategorized transactions
  const matching = await db.transactions
    .where('merchant_key')
    .equals(merchantKey)
    .filter((t) => t.category === 'Uncategorized')
    .toArray();

  if (matching.length > 0) {
    await db.transactions.bulkPut(
      matching.map((t) => ({ ...t, category, category_source: 'learned' })),
    );
  }

  return { updated: matching.length };
}

// --- Hash generation (pure, same as client.ts) ---

export async function generateHash(
  date: string,
  amount: number,
  description: string,
): Promise<string> {
  const text = `${date}${amount}${description}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
