import express from 'express';
import cors from 'cors';
import db, { generateId, type Transaction, type TransactionInput, type Settings, type Budget } from './db.js';

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
    const { date, amount, category, account, description, hash,
            wallet = 'personal', source = 'manual' } = req.body as TransactionInput;

    // Check if hash already exists
    const existing = db.prepare('SELECT id FROM transactions WHERE hash = ?').get(hash);
    if (existing) {
      res.status(409).json({ error: 'Transaction already exists', duplicate: true });
      return;
    }

    const id = generateId();
    const stmt = db.prepare(`
      INSERT INTO transactions (id, date, amount, category, account, wallet, source, description, hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, date, amount, category, account, wallet, source, description, hash);

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
      INSERT INTO transactions (id, date, amount, category, account, wallet, source, description, hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        const wallet = item.wallet || 'personal';
        const source = item.source || 'csv';
        insertStmt.run(id, item.date, item.amount, item.category, item.account, wallet, source, item.description, item.hash);
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

// --- Settings ---

// GET /settings
app.get('/settings', (_req, res) => {
  try {
    const row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as Settings & { id: number };
    res.json({
      monthly_income: row.monthly_income,
      fixed_cost_total: row.fixed_cost_total,
      monthly_savings_target: row.monthly_savings_target,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /settings
app.put('/settings', (req, res) => {
  try {
    const { monthly_income, fixed_cost_total, monthly_savings_target } = req.body as Settings;
    db.prepare(`
      UPDATE settings SET monthly_income = ?, fixed_cost_total = ?, monthly_savings_target = ?
      WHERE id = 1
    `).run(monthly_income, fixed_cost_total, monthly_savings_target);

    const row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as Settings & { id: number };
    res.json({
      monthly_income: row.monthly_income,
      fixed_cost_total: row.fixed_cost_total,
      monthly_savings_target: row.monthly_savings_target,
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// --- Budgets ---

// GET /budgets?month=YYYY-MM
app.get('/budgets', (req, res) => {
  try {
    const month = req.query.month as string | undefined;
    let budgets: Budget[];
    if (month) {
      budgets = db.prepare(
        'SELECT * FROM budgets WHERE month = ? ORDER BY display_order ASC'
      ).all(month) as Budget[];
    } else {
      budgets = db.prepare(
        'SELECT * FROM budgets ORDER BY month DESC, display_order ASC'
      ).all() as Budget[];
    }
    res.json(budgets);
  } catch (error) {
    console.error('Error fetching budgets:', error);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
});

// POST /budgets
app.post('/budgets', (req, res) => {
  try {
    const { month, category, limit_amount, pinned = 0, display_order = 0 } = req.body as Budget;
    const id = generateId();
    db.prepare(`
      INSERT INTO budgets (id, month, category, limit_amount, pinned, display_order)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(month, category) DO UPDATE SET
        limit_amount = excluded.limit_amount, pinned = excluded.pinned, display_order = excluded.display_order
    `).run(id, month, category, limit_amount, pinned, display_order);

    const created = db.prepare('SELECT * FROM budgets WHERE month = ? AND category = ?')
      .get(month, category) as Budget;
    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating budget:', error);
    res.status(500).json({ error: 'Failed to create budget' });
  }
});

// DELETE /budgets/:id
app.delete('/budgets/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM budgets WHERE id = ?').get(id);
    if (!existing) {
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

// --- Summary (server-side Definition A) ---

interface CategoryTotalRow {
  category: string;
  spent: number;
}

// GET /summary?month=YYYY-MM
app.get('/summary', (req, res) => {
  try {
    const month = req.query.month as string | undefined;
    if (!month) {
      res.status(400).json({ error: 'month query parameter required (YYYY-MM)' });
      return;
    }

    // Load settings
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as Settings & { id: number };

    // Sum expenses (amount < 0) for the month
    const expenseRow = db.prepare(`
      SELECT COALESCE(SUM(ABS(amount)), 0) as total
      FROM transactions
      WHERE date LIKE ? || '%' AND amount < 0
    `).get(month) as { total: number };

    const totalExpenses = expenseRow.total;
    const disposable = settings.monthly_income - settings.fixed_cost_total - settings.monthly_savings_target;
    const remainingFreeToSpend = disposable - totalExpenses;

    // Category breakdown
    const categoryRows = db.prepare(`
      SELECT category, SUM(ABS(amount)) as spent
      FROM transactions
      WHERE date LIKE ? || '%' AND amount < 0
      GROUP BY category
      ORDER BY spent DESC
    `).all(month) as CategoryTotalRow[];

    res.json({
      month,
      remaining_free_to_spend: remainingFreeToSpend,
      total_expenses: totalExpenses,
      disposable,
      category_totals: categoryRows,
    });
  } catch (error) {
    console.error('Error computing summary:', error);
    res.status(500).json({ error: 'Failed to compute summary' });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});

export default app;
