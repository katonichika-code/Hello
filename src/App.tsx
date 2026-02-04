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
      setError(err instanceof Error ? err.message : '取引データの読み込みに失敗しました');
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
        <h1>家計簿 - Kakeibo</h1>
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
                取引一覧{' '}
                {transactions.length > 0 && `(${transactions.length}件)`}
              </h3>
              {loading ? (
                <p>読み込み中...</p>
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
