import { useState, useRef } from 'react';
import { bulkCreateTransactions, generateHash } from '../api/client';
import {
  decodeFileContent,
  parseCsvText,
  toTransactionInputs,
  type CsvFormat,
  type ParsedTransaction,
} from '../api/csvParser';

interface ImportResult {
  inserted: number;
  skipped: number;
}

interface PreflightData {
  format: CsvFormat;
  totalRows: number;
  preview: ParsedTransaction[];
  allRows: ParsedTransaction[];
}

interface CsvImportProps {
  onImportComplete: () => void;
}

export function CsvImport({ onImportComplete }: CsvImportProps) {
  const [preflight, setPreflight] = useState<PreflightData | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setPreflight(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    resetState();

    try {
      // Read file as ArrayBuffer for encoding detection
      const buffer = await file.arrayBuffer();
      const text = decodeFileContent(buffer);

      // Parse CSV and detect format
      const parseResult = parseCsvText(text);

      if (parseResult.error) {
        setError(parseResult.error);
        return;
      }

      // Show preflight preview
      setPreflight({
        format: parseResult.format,
        totalRows: parseResult.rows.length,
        preview: parseResult.rows.slice(0, 3),
        allRows: parseResult.rows,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read CSV file');
    }
  };

  const handleImport = async () => {
    if (!preflight) return;

    setImporting(true);
    setError(null);

    try {
      // Convert to API format with hashes
      const transactions = await toTransactionInputs(preflight.allRows, generateHash);

      // Send to API
      const importResult = await bulkCreateTransactions(transactions);
      setResult(importResult);
      setPreflight(null);
      onImportComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCancel = () => {
    resetState();
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(-amount); // Show as negative (expense)
  };

  return (
    <div className="csv-import">
      <h3>Import CSV</h3>
      <p className="csv-format">
        Supports: Standard CSV or Japanese bank/card CSV
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        disabled={importing || preflight !== null}
      />

      {/* Preflight Preview */}
      {preflight && (
        <div className="preflight">
          <div className="preflight-header">
            <strong>Format detected:</strong>{' '}
            {preflight.format === 'A' ? 'Standard' : 'Japanese Bank/Card'}
          </div>
          <div className="preflight-count">
            <strong>Transactions to import:</strong> {preflight.totalRows}
          </div>

          {preflight.preview.length > 0 && (
            <div className="preflight-preview">
              <strong>Preview (first {preflight.preview.length}):</strong>
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {preflight.preview.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.date}</td>
                      <td className="expense">{formatAmount(row.amount)}</td>
                      <td>{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="preflight-actions">
            <button
              onClick={handleImport}
              disabled={importing}
              className="btn-import"
            >
              {importing ? 'Importing...' : 'Import'}
            </button>
            <button
              onClick={handleCancel}
              disabled={importing}
              className="btn-cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <p className="status success">
          Imported: {result.inserted} | Skipped (duplicates): {result.skipped}
        </p>
      )}
      {error && <p className="status error">{error}</p>}
    </div>
  );
}
