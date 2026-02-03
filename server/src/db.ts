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
