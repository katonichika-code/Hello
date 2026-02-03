import { useState, useEffect, useCallback } from 'react';
import { getTransactions, type Transaction } from './api/client';
import { CsvImport } from './components/CsvImport';
import { TransactionList } from './components/TransactionList';
import { MonthFilter } from './components/MonthFilter';
import { SankeyDiagram } from './components/SankeyDiagram';
import { ManualEntry } from './components/ManualEntry';
import './App.css';

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setError(null);
      const data = await getTransactions(selectedMonth || undefined);
      setTransactions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleRefresh = () => {
    fetchTransactions();
  };

  return (
    <div className="app">
      <header>
        <h1>Kakeibo - Personal Finance</h1>
      </header>

      <main>
        <div className="controls">
          <MonthFilter value={selectedMonth} onChange={setSelectedMonth} />
        </div>

        {error && <p className="status error">{error}</p>}

        <div className="layout">
          <div className="sidebar">
            <CsvImport onImportComplete={handleRefresh} />
            <ManualEntry onEntryComplete={handleRefresh} />
          </div>

          <div className="content">
            <SankeyDiagram transactions={transactions} />

            <div className="transactions-section">
              <h3>
                Transactions{' '}
                {transactions.length > 0 && `(${transactions.length})`}
              </h3>
              {loading ? (
                <p>Loading...</p>
              ) : (
                <TransactionList
                  transactions={transactions}
                  onUpdate={handleRefresh}
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
