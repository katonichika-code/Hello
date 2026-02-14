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
    savings_target INTEGER NOT NULL DEFAULT 0
  )
`);
// Ensure the single row exists
db.exec(`INSERT OR IGNORE INTO settings (id) VALUES (1)`);

// Budgets table (per-month, per-category)
db.exec(`
  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    month TEXT NOT NULL,
    category TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    pinned INTEGER NOT NULL DEFAULT 0,
    display_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE(month, category)
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

export interface Settings {
  monthly_income: number;
  fixed_cost_total: number;
  savings_target: number;
}

export interface Budget {
  id: string;
  month: string;
  category: string;
  amount: number;
  pinned: number;
  display_order: number;
}
