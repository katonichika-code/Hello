import Encoding from 'encoding-japanese';
import type { TransactionInput } from './client';

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

/**
 * Decode file bytes to string, trying UTF-8 first, then Shift_JIS/CP932
 */
export function decodeFileContent(buffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(buffer);

  // Try UTF-8 first
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const text = decoder.decode(uint8Array);
    // Check for common corruption patterns (replacement characters)
    if (!text.includes('\uFFFD')) {
      return text;
    }
  } catch {
    // UTF-8 failed, try Shift_JIS
  }

  // Try Shift_JIS/CP932
  const detected = Encoding.detect(uint8Array);
  if (detected === 'SJIS' || detected === 'UTF8' || detected === 'ASCII') {
    const unicodeArray = Encoding.convert(uint8Array, {
      to: 'UNICODE',
      from: detected === 'UTF8' ? 'UTF8' : 'SJIS',
    });
    return Encoding.codeToString(unicodeArray);
  }

  // Fallback: force Shift_JIS decode
  const unicodeArray = Encoding.convert(uint8Array, {
    to: 'UNICODE',
    from: 'SJIS',
  });
  return Encoding.codeToString(unicodeArray);
}

/**
 * Parse CSV text into rows (handles quoted fields)
 */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (line.trim() === '') continue;

    const row: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    rows.push(row);
  }

  return rows;
}

/**
 * Detect CSV format based on content
 */
export function detectFormat(rows: string[][]): CsvFormat | null {
  if (rows.length < 2) return null;

  // Check for Format A: header row with date,amount,description
  const firstRow = rows[0].map(col => col.toLowerCase().trim());
  if (
    firstRow.includes('date') &&
    firstRow.includes('amount') &&
    firstRow.includes('description')
  ) {
    return 'A';
  }

  // Check for Format B: second row has >= 6 columns and first column is YYYY/MM/DD
  const secondRow = rows[1];
  if (secondRow && secondRow.length >= 6) {
    const datePattern = /^\d{4}\/\d{2}\/\d{2}$/;
    if (datePattern.test(secondRow[0])) {
      return 'B';
    }
  }

  return null;
}

/**
 * Convert YYYY/MM/DD to YYYY-MM-DD
 */
function convertDateFormat(date: string): string {
  return date.replace(/\//g, '-');
}

/**
 * Parse Format A CSV (standard format)
 */
function parseFormatA(rows: string[][]): ParsedTransaction[] {
  const header = rows[0].map(col => col.toLowerCase().trim());
  const dateIdx = header.indexOf('date');
  const amountIdx = header.indexOf('amount');
  const descIdx = header.indexOf('description');

  if (dateIdx === -1 || amountIdx === -1 || descIdx === -1) {
    return [];
  }

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length <= Math.max(dateIdx, amountIdx, descIdx)) continue;

    const date = row[dateIdx]?.trim();
    const amountStr = row[amountIdx]?.trim();
    const description = row[descIdx]?.trim();

    if (!date || !amountStr || !description) continue;

    const amount = parseInt(amountStr, 10);
    if (isNaN(amount)) continue;

    // Validate date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    transactions.push({
      date,
      amount: Math.abs(amount),
      description,
    });
  }

  return transactions;
}

/**
 * Parse Format B CSV (Japanese bank/card format)
 * First row is metadata (ignored), data starts from row 2
 * Columns: [date, merchant, amount, "１", "１", amount_again, ""]
 */
function parseFormatB(rows: string[][]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  // Skip first row (metadata with customer info - never log or display)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 3) continue;

    const dateRaw = row[0]?.trim();
    const description = row[1]?.trim();
    let amountStr = row[2]?.trim();

    // Use column 6 (index 5) if column 3 is missing or empty
    if (!amountStr && row.length > 5) {
      amountStr = row[5]?.trim();
    }

    if (!dateRaw || !description || !amountStr) continue;

    // Validate and convert date YYYY/MM/DD -> YYYY-MM-DD
    if (!/^\d{4}\/\d{2}\/\d{2}$/.test(dateRaw)) continue;
    const date = convertDateFormat(dateRaw);

    const amount = parseInt(amountStr, 10);
    if (isNaN(amount)) continue;

    transactions.push({
      date,
      amount: Math.abs(amount),
      description,
    });
  }

  return transactions;
}

/**
 * Main parser function - detects format and parses CSV
 */
export function parseCsvText(text: string): CsvParseResult {
  const rows = parseCsvRows(text);

  if (rows.length < 2) {
    return { format: 'A', rows: [], error: 'CSV must have at least 2 rows' };
  }

  const format = detectFormat(rows);

  if (!format) {
    return {
      format: 'A',
      rows: [],
      error: 'Unrecognized CSV format. Expected Format A (date,amount,description header) or Format B (Japanese bank CSV with YYYY/MM/DD dates)',
    };
  }

  const parsedRows = format === 'A' ? parseFormatA(rows) : parseFormatB(rows);

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
