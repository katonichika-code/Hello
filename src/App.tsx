import { useState, useEffect, useCallback } from 'react';
import {
  getTransactions,
  getBudgets,
  getSettings,
  type Transaction,
  type Budget,
  type AppSettings,
} from './api/client';
import { HomeScreen } from './components/HomeScreen';
import { SettingsSheet } from './components/SettingsSheet';
import { CsvImport } from './components/CsvImport';
import { TransactionList } from './components/TransactionList';
import { SankeyDiagram } from './components/SankeyDiagram';
import './App.css';

type View = 'home' | 'transactions' | 'csvImport' | 'sankey';

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function App() {
  const [view, setView] = useState<View>('home');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [settings, setSettings] = useState<AppSettings>({});
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [txns, buds, sets] = await Promise.all([
        getTransactions(selectedMonth || undefined),
        getBudgets(),
        getSettings(),
      ]);
      setTransactions(txns);
      setBudgets(buds);
      setSettings(sets);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Detail pages ────────────────────────────────────────────────────────────

  if (view === 'transactions') {
    return (
      <div className="app-page">
        <header className="page-header">
          <button className="btn btn-ghost" onClick={() => setView('home')}>
            ← ホーム
          </button>
          <h1 className="page-title">取引一覧</h1>
        </header>
        <main className="page-body">
          <TransactionList transactions={transactions} onUpdate={fetchAll} />
        </main>
      </div>
    );
  }

  if (view === 'csvImport') {
    return (
      <div className="app-page">
        <header className="page-header">
          <button className="btn btn-ghost" onClick={() => setView('home')}>
            ← ホーム
          </button>
          <h1 className="page-title">CSV 取り込み</h1>
        </header>
        <main className="page-body">
          <CsvImport
            onImportComplete={() => {
              fetchAll();
              setView('home');
            }}
          />
        </main>
      </div>
    );
  }

  if (view === 'sankey') {
    return (
      <div className="app-page">
        <header className="page-header">
          <button className="btn btn-ghost" onClick={() => setView('home')}>
            ← ホーム
          </button>
          <h1 className="page-title">収支フロー図</h1>
        </header>
        <main className="page-body">
          <SankeyDiagram transactions={transactions} />
        </main>
      </div>
    );
  }

  // ── Home ──────────────────────────────────────────────────────────────────

  return (
    <>
      <HomeScreen
        transactions={transactions}
        budgets={budgets}
        settings={settings}
        selectedMonth={selectedMonth}
        loading={loading}
        onMonthChange={setSelectedMonth}
        onOpenSettings={() => setSettingsOpen(true)}
        onSeeAll={() => setView('transactions')}
        onRefresh={fetchAll}
      />

      {settingsOpen && (
        <SettingsSheet
          budgets={budgets}
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onRefresh={fetchAll}
          onOpenCsvImport={() => {
            setSettingsOpen(false);
            setView('csvImport');
          }}
          onOpenSankey={() => {
            setSettingsOpen(false);
            setView('sankey');
          }}
          onSettingsChange={setSettings}
        />
      )}
    </>
  );
}

export default App;
