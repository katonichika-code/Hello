import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../prisma/dev.db');

const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    amount INTEGER NOT NULL,
    category TEXT NOT NULL,
    account TEXT NOT NULL,
    description TEXT NOT NULL,
    hash TEXT UNIQUE NOT NULL,
    createdAt TEXT DEFAULT (datetime('now'))
  )
`);

// Create index on date for faster queries
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)
`);

// --- Migrations: add new columns/tables safely ---

// Add wallet + source columns to transactions (safe for existing DBs)
const txnColumns = db.pragma('table_info(transactions)') as { name: string }[];
const colNames = new Set(txnColumns.map((c) => c.name));

if (!colNames.has('wallet')) {
  db.exec(`ALTER TABLE transactions ADD COLUMN wallet TEXT NOT NULL DEFAULT 'personal'`);
}
if (!colNames.has('source')) {
  db.exec(`ALTER TABLE transactions ADD COLUMN source TEXT NOT NULL DEFAULT 'csv'`);
  // Backfill: cash entries were manual, card entries were csv
  db.exec(`UPDATE transactions SET source = 'manual' WHERE account = 'cash'`);
}

// Settings table (single-row)
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    monthly_income INTEGER NOT NULL DEFAULT 0,
    fixed_cost_total INTEGER NOT NULL DEFAULT 0,
    monthly_savings_target INTEGER NOT NULL DEFAULT 0
  )
`);
// Migrate: rename savings_target → monthly_savings_target (safe for existing DBs)
const settingsCols = db.pragma('table_info(settings)') as { name: string }[];
const settingsColNames = new Set(settingsCols.map((c) => c.name));
if (settingsColNames.has('savings_target') && !settingsColNames.has('monthly_savings_target')) {
  db.exec(`ALTER TABLE settings RENAME COLUMN savings_target TO monthly_savings_target`);
}

// Ensure the single row exists
db.exec(`INSERT OR IGNORE INTO settings (id) VALUES (1)`);

// Budgets table (per-month, per-category)
db.exec(`
  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    month TEXT NOT NULL,
    category TEXT NOT NULL,
    limit_amount INTEGER NOT NULL DEFAULT 0,
    pinned INTEGER NOT NULL DEFAULT 0,
    display_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE(month, category)
  )
`);

// Migrate: rename budgets.amount → limit_amount (safe for existing DBs)
const budgetCols = db.pragma('table_info(budgets)') as { name: string }[];
const budgetColNames = new Set(budgetCols.map((c) => c.name));
if (budgetColNames.has('amount') && !budgetColNames.has('limit_amount')) {
  db.exec(`ALTER TABLE budgets RENAME COLUMN amount TO limit_amount`);
}

// Add merchant categorization columns to transactions (safe for existing DBs)
const txnCols2 = db.pragma('table_info(transactions)') as { name: string }[];
const txnColNames2 = new Set(txnCols2.map((c) => c.name));

if (!txnColNames2.has('merchant_key')) {
  db.exec(`ALTER TABLE transactions ADD COLUMN merchant_key TEXT DEFAULT NULL`);
}
if (!txnColNames2.has('category_source')) {
  db.exec(`ALTER TABLE transactions ADD COLUMN category_source TEXT NOT NULL DEFAULT 'unknown'`);
}
if (!txnColNames2.has('confidence')) {
  db.exec(`ALTER TABLE transactions ADD COLUMN confidence REAL NOT NULL DEFAULT 0`);
}

// Merchant mapping table (learned categorization)
db.exec(`
  CREATE TABLE IF NOT EXISTS merchant_map (
    merchant_key TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')),
    hits INTEGER NOT NULL DEFAULT 0
  )
`);

export default db;

// Helper function to generate cuid-like IDs
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `c${timestamp}${randomPart}`;
}

// Types
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
  merchant_key: string | null;
  category_source: string;
  confidence: number;
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
  merchant_key?: string | null;
  category_source?: string;
  confidence?: number;
}

export interface MerchantMapping {
  merchant_key: string;
  category: string;
  updated_at: string;
  hits: number;
}

export interface Settings {
  monthly_income: number;
  fixed_cost_total: number;
  monthly_savings_target: number;
}

export interface Budget {
  id: string;
  month: string;
  category: string;
  limit_amount: number;
  pinned: number;
  display_order: number;
}
