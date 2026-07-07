import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../api/gmail/providers/vpass';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(here, '../api/gmail/fixtures/vpass-sanitized.txt');
const body = readFileSync(fixturePath, 'utf8');
const actual = parse('【三井住友カード】ご利用のお知らせ', body);
const expected = {
  date: '2026-06-15',
  merchant: 'サンプルストア東京',
  amount: -1234,
};

if ('reason' in actual) {
  throw new Error(`Expected fixture to parse, got failure: ${actual.reason}`);
}

const actualJson = JSON.stringify(actual);
const expectedJson = JSON.stringify(expected);
if (actualJson !== expectedJson) {
  throw new Error(`Vpass fixture parse mismatch\nactual:   ${actualJson}\nexpected: ${expectedJson}`);
}

console.log('Vpass fixture parse OK:', actualJson);
