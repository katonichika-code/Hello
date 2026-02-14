import { useState, useRef } from 'react';
import { bulkCreateTransactions, generateHash } from '../api/client';
import {
  decodeFileContent,
  parseCsvText,
  type CsvFormat,
  type ParsedTransaction,
} from '../api/csvParser';
import { categorize } from '../api/categorizer';

interface ImportResult {
  inserted: number;
  skipped: number;
}

interface PreflightRow extends ParsedTransaction {
  predictedCategory: string;
}

interface PreflightData {
  format: CsvFormat;
  totalRows: number;
  preview: PreflightRow[];
  allRows: PreflightRow[];
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

      // Add predicted categories to all rows
      const rowsWithCategories: PreflightRow[] = parseResult.rows.map((row) => ({
        ...row,
        predictedCategory: categorize(row.description),
      }));

      // Show preflight preview
      setPreflight({
        format: parseResult.format,
        totalRows: rowsWithCategories.length,
        preview: rowsWithCategories.slice(0, 5),
        allRows: rowsWithCategories,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSVファイルの読み込みに失敗しました');
    }
  };

  const handleImport = async () => {
    if (!preflight) return;

    setImporting(true);
    setError(null);

    try {
      // Convert to API format with hashes and predicted categories
      const transactions = await Promise.all(
        preflight.allRows.map(async (row) => {
          const positiveAmount = Math.abs(row.amount);
          const hash = await generateHash(row.date, positiveAmount, row.description);
          return {
            date: row.date,
            amount: -positiveAmount, // Expenses are negative
            category: row.predictedCategory,
            account: 'card' as const,
            wallet: 'personal' as const,
            source: 'csv' as const,
            description: row.description,
            hash,
          };
        })
      );

      // Send to API
      const importResult = await bulkCreateTransactions(transactions);
      setResult(importResult);
      setPreflight(null);
      onImportComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : '取り込みに失敗しました');
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
      <h3>CSV取り込み</h3>
      <p className="csv-format">
        対応: 標準CSV / 銀行・カード明細CSV
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
            <strong>検出フォーマット:</strong>{' '}
            {preflight.format === 'A' ? '標準' : '銀行・カード明細'}
          </div>
          <div className="preflight-count">
            <strong>取り込み件数:</strong> {preflight.totalRows}件
          </div>

          {preflight.preview.length > 0 && (
            <div className="preflight-preview">
              <strong>プレビュー (先頭{preflight.preview.length}件):</strong>
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>金額</th>
                    <th>内容</th>
                    <th>推定カテゴリ</th>
                  </tr>
                </thead>
                <tbody>
                  {preflight.preview.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.date}</td>
                      <td className="expense">{formatAmount(row.amount)}</td>
                      <td>{row.description}</td>
                      <td className={row.predictedCategory === '未分類' ? 'uncategorized' : ''}>
                        {row.predictedCategory}
                      </td>
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
              {importing ? '取り込み中...' : '取り込む'}
            </button>
            <button
              onClick={handleCancel}
              disabled={importing}
              className="btn-cancel"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {result && (
        <p className="status success">
          追加: {result.inserted}件 | スキップ (重複): {result.skipped}件
        </p>
      )}
      {error && <p className="status error">{error}</p>}
    </div>
  );
}
