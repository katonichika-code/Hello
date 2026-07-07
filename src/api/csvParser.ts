import type { TransactionInput } from '../db/repo';
import {
  decodeFileContent,
  parseCsvRows,
  parseCsvWithRegistry,
  selectCsvProvider,
  type NormalizedTx,
} from './csv/registry';

export { decodeFileContent };
export type { NormalizedTx };

export type CsvFormat = 'A' | 'B';

export interface ParsedTransaction {
  date: string;       // YYYY-MM-DD
  amount: number;     // positive for display, will be negated on save
  description: string;
}

export interface CsvParseResult {
  format: CsvFormat;
  rows: ParsedTransaction[];
  error?: string;
}

export function detectFormat(rows: string[][]): CsvFormat | null {
  const selection = selectCsvProvider(rows);
  return selection.status === 'selected' && selection.provider
    ? selection.provider.id as CsvFormat
    : null;
}

function toParsedTransaction(row: NormalizedTx): ParsedTransaction {
  return {
    date: row.date,
    amount: Math.abs(row.amount),
    description: row.description,
  };
}

export function parseCsvText(text: string): CsvParseResult {
  const rows = parseCsvRows(text);

  if (rows.length < 2) {
    return { format: 'A', rows: [], error: 'CSV must have at least 2 rows' };
  }

  const result = parseCsvWithRegistry(text);

  if (result.status !== 'selected' || !result.provider) {
    return {
      format: 'A',
      rows: [],
      error: result.status === 'needs-user-selection'
        ? 'CSV provider selection is ambiguous. Please select a provider.'
        : 'Unrecognized CSV format. Expected Format A (date,amount,description header) or Format B (Japanese bank CSV with YYYY/MM/DD dates)',
    };
  }

  const parsedRows = result.rows.map(toParsedTransaction);
  const format = result.provider.id as CsvFormat;

  if (parsedRows.length === 0) {
    return {
      format,
      rows: [],
      error: `No valid transactions found in ${format === 'A' ? 'standard' : 'Japanese bank'} CSV format`,
    };
  }

  return { format, rows: parsedRows };
}

/**
 * Convert parsed transactions to API format with hash generation
 */
export async function toTransactionInputs(
  parsed: ParsedTransaction[],
  generateHash: (date: string, amount: number, description: string) => Promise<string>
): Promise<TransactionInput[]> {
  const inputs: TransactionInput[] = [];

  for (const row of parsed) {
    // Hash uses POSITIVE amount consistently
    const hash = await generateHash(row.date, row.amount, row.description);

    inputs.push({
      date: row.date,
      amount: -Math.abs(row.amount), // Store as NEGATIVE
      category: 'Uncategorized',
      account: 'card',
      description: row.description,
      hash,
    });
  }

  return inputs;
}
