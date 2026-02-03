/**
 * CSV Parser Verification Script
 * Tests both Format A (standard) and Format B (Japanese bank) parsing
 * Run with: npm run csvcheck
 */

import Encoding from 'encoding-japanese';
import { parseCsvText } from '../api/csvParser.js';

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

// Test Shift_JIS encoding roundtrip
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

// Verify metadata row was NOT included
const hasMetadata = resultB.rows.some(r =>
  r.description.includes('MASKED') ||
  r.description.includes('****') ||
  r.description.includes('VISA')
);
console.log(`Metadata excluded: ${!hasMetadata ? '✓' : '✗'}`);

const formatBPass = resultB.format === 'B' && resultB.rows.length === 3 && !hasMetadata;
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
