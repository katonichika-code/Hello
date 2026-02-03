import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { bulkCreateTransactions, generateHash, type TransactionInput } from '../api/client';

interface CsvRow {
  date: string;
  amount: string;
  description: string;
}

interface ImportResult {
  inserted: number;
  skipped: number;
}

interface CsvImportProps {
  onImportComplete: () => void;
}

export function CsvImport({ onImportComplete }: CsvImportProps) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);
    setError(null);

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const transactions: TransactionInput[] = [];

          for (const row of results.data) {
            if (!row.date || !row.amount || !row.description) continue;

            const amount = parseInt(row.amount, 10);
            if (isNaN(amount)) continue;

            const hash = await generateHash(row.date, amount, row.description);

            transactions.push({
              date: row.date,
              amount: -Math.abs(amount), // Expenses are negative
              category: 'Uncategorized',
              account: 'card',
              description: row.description,
              hash,
            });
          }

          if (transactions.length === 0) {
            setError('No valid transactions found in CSV');
            setImporting(false);
            return;
          }

          const importResult = await bulkCreateTransactions(transactions);
          setResult(importResult);
          onImportComplete();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Import failed');
        } finally {
          setImporting(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      },
      error: (err) => {
        setError(`CSV parsing error: ${err.message}`);
        setImporting(false);
      },
    });
  };

  return (
    <div className="csv-import">
      <h3>Import CSV</h3>
      <p className="csv-format">
        Format: date (YYYY-MM-DD), amount (positive integer), description
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        disabled={importing}
      />
      {importing && <p className="status">Importing...</p>}
      {result && (
        <p className="status success">
          Imported: {result.inserted} | Skipped (duplicates): {result.skipped}
        </p>
      )}
      {error && <p className="status error">{error}</p>}
    </div>
  );
}
