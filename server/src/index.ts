import express from 'express';
import cors from 'cors';
import db, { generateId, type Transaction, type TransactionInput, type Budget, type BudgetInput } from './db.js';

const app = express();
const PORT = 8787;

app.use(cors());
app.use(express.json());

// ─── Health ──────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// ─── Transactions ─────────────────────────────────────────────────────────────

app.get('/transactions', (req, res) => {
  try {
    const month = req.query.month as string | undefined;

    let transactions: Transaction[];

    if (month) {
      transactions = db.prepare(`
        SELECT * FROM transactions
        WHERE date LIKE ? || '%'
        ORDER BY date DESC, createdAt DESC
      `).all(month) as Transaction[];
    } else {
      transactions = db.prepare(`
        SELECT * FROM transactions
        ORDER BY date DESC, createdAt DESC
      `).all() as Transaction[];
    }

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// GET /transactions/summary?month=YYYY-MM
// Returns confirmed income, expenses and net for the given month (or all time)
app.get('/transactions/summary', (req, res) => {
  try {
    const month = req.query.month as string | undefined;

    const where = month ? `WHERE date LIKE ? || '%' AND isPending = 0` : `WHERE isPending = 0`;
    const params = month ? [month] : [];

    const row = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) AS expenses
      FROM transactions
      ${where}
    `).get(...params) as { income: number; expenses: number };

    res.json({
      income: row.income,
      expenses: row.expenses,
      net: row.income - row.expenses,
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

app.post('/transactions', (req, res) => {
  try {
    const { date, amount, category, account, description, hash } = req.body as TransactionInput;

    const existing = db.prepare('SELECT id FROM transactions WHERE hash = ?').get(hash);
    if (existing) {
      res.status(409).json({ error: 'Transaction already exists', duplicate: true });
      return;
    }

    const id = generateId();
    db.prepare(`
      INSERT INTO transactions (id, date, amount, category, account, description, hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, date, amount, category, account, description, hash);

    const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Transaction;
    res.status(201).json(transaction);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

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

    db.transaction((items: TransactionInput[]) => {
      for (const item of items) {
        if (checkStmt.get(item.hash)) { skipped++; continue; }
        insertStmt.run(generateId(), item.date, item.amount, item.category, item.account, item.description, item.hash);
        inserted++;
      }
    })(transactions);

    res.json({ inserted, skipped });
  } catch (error) {
    console.error('Error bulk creating transactions:', error);
    res.status(500).json({ error: 'Failed to create transactions' });
  }
});

app.patch('/transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { category } = req.body as { category: string };

    if (!db.prepare('SELECT id FROM transactions WHERE id = ?').get(id)) {
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

// ─── Budgets ─────────────────────────────────────────────────────────────────

app.get('/budgets', (_req, res) => {
  try {
    const budgets = db.prepare('SELECT * FROM budgets ORDER BY category').all() as Budget[];
    res.json(budgets);
  } catch (error) {
    console.error('Error fetching budgets:', error);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
});

app.post('/budgets', (req, res) => {
  try {
    const { name, category, monthlyLimit } = req.body as BudgetInput;
    const id = generateId();

    db.prepare(`
      INSERT INTO budgets (id, name, category, monthlyLimit)
      VALUES (?, ?, ?, ?)
    `).run(id, name, category, monthlyLimit);

    const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(id) as Budget;
    res.status(201).json(budget);
  } catch (error) {
    console.error('Error creating budget:', error);
    res.status(500).json({ error: 'Failed to create budget' });
  }
});

app.patch('/budgets/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, monthlyLimit } = req.body as Partial<BudgetInput>;

    if (!db.prepare('SELECT id FROM budgets WHERE id = ?').get(id)) {
      res.status(404).json({ error: 'Budget not found' });
      return;
    }

    if (name !== undefined) db.prepare('UPDATE budgets SET name = ? WHERE id = ?').run(name, id);
    if (monthlyLimit !== undefined) db.prepare('UPDATE budgets SET monthlyLimit = ? WHERE id = ?').run(monthlyLimit, id);

    const updated = db.prepare('SELECT * FROM budgets WHERE id = ?').get(id) as Budget;
    res.json(updated);
  } catch (error) {
    console.error('Error updating budget:', error);
    res.status(500).json({ error: 'Failed to update budget' });
  }
});

app.delete('/budgets/:id', (req, res) => {
  try {
    const { id } = req.params;

    if (!db.prepare('SELECT id FROM budgets WHERE id = ?').get(id)) {
      res.status(404).json({ error: 'Budget not found' });
      return;
    }

    db.prepare('DELETE FROM budgets WHERE id = ?').run(id);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting budget:', error);
    res.status(500).json({ error: 'Failed to delete budget' });
  }
});

// ─── Settings ─────────────────────────────────────────────────────────────────

app.get('/settings', (_req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.put('/settings', (req, res) => {
  try {
    const updates = req.body as Record<string, string>;

    const upsert = db.prepare(`
      INSERT INTO settings (key, value, updatedAt)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
    `);

    db.transaction((kvs: Record<string, string>) => {
      for (const [key, value] of Object.entries(kvs)) {
        upsert.run(key, value);
      }
    })(updates);

    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});

export default app;
