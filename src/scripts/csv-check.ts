/**
 * CSV Parser Verification Script
 * Tests both Format A (standard) and Format B (Japanese bank) parsing through the provider registry.
 * Run with: npm run csvcheck
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import Encoding from 'encoding-japanese';
import { parseCsvText } from '../api/csvParser.js';
import { parseCsvWithRegistry } from '../api/csv/registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturePath = (name: string) => resolve(__dirname, '../../src/fixtures/csv', name);

const SAMPLE_FORMAT_A = readFileSync(fixturePath('format-a.csv'), 'utf8').trimEnd();
const SAMPLE_FORMAT_B = readFileSync(fixturePath('format-b-smbc-card.csv'), 'utf8').trimEnd();

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

console.log('=== CSV Parser Verification ===\n');

console.log('--- Format A (Standard CSV) ---');
const registryA = parseCsvWithRegistry(SAMPLE_FORMAT_A);
const resultA = parseCsvText(SAMPLE_FORMAT_A);
console.log(`Detected format: ${resultA.format}`);
console.log(`Parsed rows: ${resultA.rows.length}`);
if (resultA.rows.length > 0) {
  console.log(`First row: ${JSON.stringify(resultA.rows[0])}`);
}
if (resultA.error) {
  console.log(`Error: ${resultA.error}`);
}

const formatAPass = registryA.status === 'selected' && registryA.provider?.id === 'A' && resultA.format === 'A' && resultA.rows.length === 3;
console.log(`Status: ${formatAPass ? '✓ PASS' : '✗ FAIL'}\n`);

console.log('--- Format B (Japanese Bank CSV) ---');
const registryB = parseCsvWithRegistry(SAMPLE_FORMAT_B);
const resultB = parseCsvText(SAMPLE_FORMAT_B);
console.log(`Detected format: ${resultB.format}`);
console.log(`Parsed rows: ${resultB.rows.length}`);
if (resultB.rows.length > 0) {
  console.log(`First row: ${JSON.stringify(resultB.rows[0])}`);
}
if (resultB.error) {
  console.log(`Error: ${resultB.error}`);
}

const hasMetadata = resultB.rows.some(r =>
  r.description.includes('MASKED') ||
  r.description.includes('****') ||
  r.description.includes('VISA')
);
console.log(`Metadata excluded: ${!hasMetadata ? '✓' : '✗'}`);

const formatBPass = registryB.status === 'selected' && registryB.provider?.id === 'B' && resultB.format === 'B' && resultB.rows.length === 3 && !hasMetadata;
console.log(`Status: ${formatBPass ? '✓ PASS' : '✗ FAIL'}\n`);

console.log('--- Shift_JIS Encoding ---');
const encodingPass = testShiftJisEncoding();
console.log(`Encoding roundtrip: ${encodingPass ? '✓ PASS' : '✗ FAIL'}\n`);

console.log('=== Summary ===');
const allPass = formatAPass && formatBPass && encodingPass;
console.log(`Format A: ${formatAPass ? 'PASS' : 'FAIL'}`);
console.log(`Format B: ${formatBPass ? 'PASS' : 'FAIL'}`);
console.log(`Encoding: ${encodingPass ? 'PASS' : 'FAIL'}`);
console.log(`\nOverall: ${allPass ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);

if (!allPass) {
  process.exit(1);
}
