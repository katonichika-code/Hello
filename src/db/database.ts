/**
 * IndexedDB database definition using Dexie.
 * All data persists in the browser — no server required.
 */
import Dexie, { type Table } from 'dexie';

// --- Table interfaces ---

export interface DbTransaction {
  id: string;
  date: string;        // YYYY-MM-DD
  monthKey: string;     // YYYY-MM (derived, indexed for fast month filtering)
  amount: number;       // JPY; expenses negative
  category: string;     // allow 'Uncategorized'
  account: string;      // 'card' | 'cash' — keeps Sankey semantics
  wallet: string;       // 'personal' (future: multi-wallet)
  source: string;       // 'manual' | 'csv'
  description: string;
  hash: string;         // SHA-256 for dedup (unique)
  createdAt: string;    // ISO timestamp
  merchant_key: string | null;
  category_source: string; // 'learned' | 'rule' | 'manual' | 'unknown'
  confidence: number;      // 0–1
  isPending: number;       // 0 = confirmed, 1 = pending (gmail notifications)
}

export interface DbSettings {
  id: number; // always 1
  monthly_income: number;
  fixed_cost_total: number;
  monthly_savings_target: number;
}

export interface DbBudget {
  id: string;
  month: string;
  category: string;
  limit_amount: number;
  pinned: number; // 0 or 1
  display_order: number;
  wallet: string; // 'personal' | 'shared'
}

export interface DbMerchantMapping {
  merchant_key: string;
  category: string;
  updated_at: string;
  hits: number;
}

export interface DbGmailSync {
  id: number; // always 1
  email: string;
  last_sync_at: string;
  last_history_id: string;
}

// --- Database class ---

class KakeiboDB extends Dexie {
  transactions!: Table<DbTransaction, string>;
  settings!: Table<DbSettings, number>;
  budgets!: Table<DbBudget, string>;
  merchant_map!: Table<DbMerchantMapping, string>;
  gmail_sync!: Table<DbGmailSync, number>;

  constructor() {
    super('kakeibo-db');

    // v1 — initial schema (may exist on early dev machines)
    this.version(1).stores({
      transactions: 'id, date, hash, category, wallet, merchant_key, category_source',
      settings: 'id',
      budgets: 'id, [month+category], month, pinned',
      merchant_map: 'merchant_key',
    });

    // v2 — add monthKey for fast month filtering; add [monthKey+wallet] compound index
    this.version(2).stores({
      transactions: 'id, date, monthKey, [monthKey+wallet], &hash, category, wallet, merchant_key, category_source',
      settings: 'id',
      budgets: 'id, [month+category], month, pinned, display_order',
      merchant_map: 'merchant_key',
    }).upgrade((tx) => {
      // Backfill monthKey for any existing v1 rows
      return tx.table('transactions').toCollection().modify((txn: DbTransaction) => {
        if (!txn.monthKey && txn.date) {
          txn.monthKey = txn.date.slice(0, 7);
        }
      });
    });

    // v3 — add wallet to budgets; upsert key becomes [month+wallet+category]
    this.version(3).stores({
      transactions: 'id, date, monthKey, [monthKey+wallet], &hash, category, wallet, merchant_key, category_source',
      settings: 'id',
      budgets: 'id, [month+wallet+category], [month+wallet], month, wallet, pinned, display_order',
      merchant_map: 'merchant_key',
    }).upgrade((tx) => {
      // Backfill wallet='personal' for existing budgets
      return tx.table('budgets').toCollection().modify((b: DbBudget) => {
        if (!b.wallet) {
          b.wallet = 'personal';
        }
      });
    });

    // v4 — add isPending to transactions + gmail_sync table
    this.version(4).stores({
      transactions: 'id, date, monthKey, [monthKey+wallet], &hash, category, wallet, merchant_key, category_source, isPending',
      settings: 'id',
      budgets: 'id, [month+wallet+category], [month+wallet], month, wallet, pinned, display_order',
      merchant_map: 'merchant_key',
      gmail_sync: 'id',
    }).upgrade((tx) => {
      return tx.table('transactions').toCollection().modify((txn: DbTransaction) => {
        if (txn.isPending === undefined) {
          txn.isPending = 0;
        }
      });
    });
  }
}

export const db = new KakeiboDB();

// Ensure default settings row exists
export async function ensureDefaults(): Promise<void> {
  const existing = await db.settings.get(1);
  if (!existing) {
    await db.settings.put({
      id: 1,
      monthly_income: 0,
      fixed_cost_total: 0,
      monthly_savings_target: 0,
    });
  }
}
