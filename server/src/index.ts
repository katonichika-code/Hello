import express from 'express';
import cors from 'cors';
import db, { generateId, type Transaction, type TransactionInput } from './db.js';

const app = express();
const PORT = 8787;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// GET /transactions - Get all transactions, optionally filtered by month
app.get('/transactions', (req, res) => {
  try {
    const month = req.query.month as string | undefined;

    let stmt;
    let transactions: Transaction[];

    if (month) {
      // Filter by month (YYYY-MM)
      stmt = db.prepare(`
        SELECT * FROM transactions
        WHERE date LIKE ? || '%'
        ORDER BY date DESC, createdAt DESC
      `);
      transactions = stmt.all(month) as Transaction[];
    } else {
      stmt = db.prepare(`
        SELECT * FROM transactions
        ORDER BY date DESC, createdAt DESC
      `);
      transactions = stmt.all() as Transaction[];
    }

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// POST /transactions - Create a single transaction
app.post('/transactions', (req, res) => {
  try {
    const { date, amount, category, account, description, hash } = req.body as TransactionInput;

    // Check if hash already exists
    const existing = db.prepare('SELECT id FROM transactions WHERE hash = ?').get(hash);
    if (existing) {
      res.status(409).json({ error: 'Transaction already exists', duplicate: true });
      return;
    }

    const id = generateId();
    const stmt = db.prepare(`
      INSERT INTO transactions (id, date, amount, category, account, description, hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, date, amount, category, account, description, hash);

    const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Transaction;
    res.status(201).json(transaction);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// POST /transactions/bulk - Create multiple transactions
app.post('/transactions/bulk', (req, res) => {
  try {
    const transactions = req.body as TransactionInput[];

    let inserted = 0;
    let skipped = 0;

    const insertStmt = db.prepare(`
      INSERT INTO transactions (id, date, amount, category, account, description, hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const checkStmt = db.prepare('SELECT id FROM transactions WHERE hash = ?');

    const insertMany = db.transaction((items: TransactionInput[]) => {
      for (const item of items) {
        const existing = checkStmt.get(item.hash);
        if (existing) {
          skipped++;
          continue;
        }

        const id = generateId();
        insertStmt.run(id, item.date, item.amount, item.category, item.account, item.description, item.hash);
        inserted++;
      }
    });

    insertMany(transactions);

    res.json({ inserted, skipped });
  } catch (error) {
    console.error('Error bulk creating transactions:', error);
    res.status(500).json({ error: 'Failed to create transactions' });
  }
});

// PATCH /transactions/:id - Update category only
app.patch('/transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { category } = req.body as { category: string };

    const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    db.prepare('UPDATE transactions SET category = ? WHERE id = ?').run(category, id);

    const updated = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Transaction;
    res.json(updated);
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});

export default app;
