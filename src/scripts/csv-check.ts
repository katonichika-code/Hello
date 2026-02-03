/**
 * CSV Parser Verification Script
 * Tests both Format A (standard) and Format B (Japanese bank) parsing
 * Run with: npm run csvcheck
 */

import Encoding from 'encoding-japanese';

// ============================================================
// Inline parser logic (mirrors src/api/csvParser.ts for Node.js)
// ============================================================

type CsvFormat = 'A' | 'B';

interface ParsedTransaction {
  date: string;
  amount: number;
  description: string;
}

interface CsvParseResult {
  format: CsvFormat;
  rows: ParsedTransaction[];
  error?: string;
}

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

function detectFormat(rows: string[][]): CsvFormat | null {
  if (rows.length < 2) return null;

  const firstRow = rows[0].map(col => col.toLowerCase().trim());
  if (
    firstRow.includes('date') &&
    firstRow.includes('amount') &&
    firstRow.includes('description')
  ) {
    return 'A';
  }

  const secondRow = rows[1];
  if (secondRow && secondRow.length >= 6) {
    const datePattern = /^\d{4}\/\d{2}\/\d{2}$/;
    if (datePattern.test(secondRow[0])) {
      return 'B';
    }
  }

  return null;
}

function convertDateFormat(date: string): string {
  return date.replace(/\//g, '-');
}

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

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    transactions.push({
      date,
      amount: Math.abs(amount),
      description,
    });
  }

  return transactions;
}

function parseFormatB(rows: string[][]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  // Skip first row (metadata - never log or display)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 3) continue;

    const dateRaw = row[0]?.trim();
    const description = row[1]?.trim();
    let amountStr = row[2]?.trim();

    if (!amountStr && row.length > 5) {
      amountStr = row[5]?.trim();
    }

    if (!dateRaw || !description || !amountStr) continue;

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

function parseCsvText(text: string): CsvParseResult {
  const rows = parseCsvRows(text);

  if (rows.length < 2) {
    return { format: 'A', rows: [], error: 'CSV must have at least 2 rows' };
  }

  const format = detectFormat(rows);

  if (!format) {
    return {
      format: 'A',
      rows: [],
      error: 'Unrecognized CSV format',
    };
  }

  const parsedRows = format === 'A' ? parseFormatA(rows) : parseFormatB(rows);

  if (parsedRows.length === 0) {
    return {
      format,
      rows: [],
      error: `No valid transactions found`,
    };
  }

  return { format, rows: parsedRows };
}

// ============================================================
// Test Data
// ============================================================

const SAMPLE_FORMAT_A = `date,amount,description
2024-01-15,1500,Grocery store
2024-01-16,800,Coffee shop
2024-01-17,3000,Restaurant`;

// Format B: First row is metadata (customer info - NEVER display)
// Data rows have 7 columns: date, merchant, amount, "１", "１", amount_again, ""
const SAMPLE_FORMAT_B = `MASKED_CUSTOMER,****-****-****-1234,VISA
2025/12/01,セブン－イレブン,159,１,１,159,
2025/12/02,スターバックス,550,１,１,550,
2025/12/03,ローソン,298,１,１,298,`;

// Test Shift_JIS encoding simulation
function testShiftJisEncoding(): boolean {
  const text = 'セブン－イレブン';
  const sjisArray = Encoding.convert(Encoding.stringToCode(text), {
    to: 'SJIS',
    from: 'UNICODE',
  });
  const backToUnicode = Encoding.convert(sjisArray, {
    to: 'UNICODE',
    from: 'SJIS',
  });
  const decoded = Encoding.codeToString(backToUnicode);
  return decoded === text;
}

// ============================================================
// Run Tests
// ============================================================

console.log('=== CSV Parser Verification ===\n');

// Test Format A
console.log('--- Format A (Standard CSV) ---');
const resultA = parseCsvText(SAMPLE_FORMAT_A);
console.log(`Detected format: ${resultA.format}`);
console.log(`Parsed rows: ${resultA.rows.length}`);
if (resultA.rows.length > 0) {
  console.log(`First row: ${JSON.stringify(resultA.rows[0])}`);
}
if (resultA.error) {
  console.log(`Error: ${resultA.error}`);
}

const formatAPass = resultA.format === 'A' && resultA.rows.length === 3;
console.log(`Status: ${formatAPass ? '✓ PASS' : '✗ FAIL'}\n`);

// Test Format B
console.log('--- Format B (Japanese Bank CSV) ---');
const resultB = parseCsvText(SAMPLE_FORMAT_B);
console.log(`Detected format: ${resultB.format}`);
console.log(`Parsed rows: ${resultB.rows.length}`);
if (resultB.rows.length > 0) {
  console.log(`First row: ${JSON.stringify(resultB.rows[0])}`);
}
if (resultB.error) {
  console.log(`Error: ${resultB.error}`);
}

const formatBPass = resultB.format === 'B' && resultB.rows.length === 3;
console.log(`Status: ${formatBPass ? '✓ PASS' : '✗ FAIL'}\n`);

// Test Shift_JIS encoding
console.log('--- Shift_JIS Encoding ---');
const encodingPass = testShiftJisEncoding();
console.log(`Encoding roundtrip: ${encodingPass ? '✓ PASS' : '✗ FAIL'}\n`);

// Summary
console.log('=== Summary ===');
const allPass = formatAPass && formatBPass && encodingPass;
console.log(`Format A: ${formatAPass ? 'PASS' : 'FAIL'}`);
console.log(`Format B: ${formatBPass ? 'PASS' : 'FAIL'}`);
console.log(`Encoding: ${encodingPass ? 'PASS' : 'FAIL'}`);
console.log(`\nOverall: ${allPass ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);

if (!allPass) {
  process.exit(1);
}
