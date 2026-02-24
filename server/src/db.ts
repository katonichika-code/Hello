import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../prisma/dev.db');

const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Transactions table
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

// Add isPending column to transactions (idempotent)
try {
  db.exec(`ALTER TABLE transactions ADD COLUMN isPending INTEGER NOT NULL DEFAULT 0`);
} catch {
  // Column already exists — safe to ignore
}

// Create index on date for faster queries
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)
`);

// Budgets table: category-level monthly spend targets
db.exec(`
  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    monthlyLimit INTEGER NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Settings table: key-value store for app configuration
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

export default db;

// Helper: cuid-like ID
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

export interface Budget {
  id: string;
  name: string;
  category: string;
  monthlyLimit: number;
  createdAt: string;
}

export interface BudgetInput {
  name: string;
  category: string;
  monthlyLimit: number;
}
