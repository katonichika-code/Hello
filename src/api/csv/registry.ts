import Encoding from 'encoding-japanese';
import { genericCsvProvider } from './providers/generic';
import { smbcCardCsvProvider } from './providers/smbcCard';

export interface NormalizedTx {
  date: string;
  amount: number; // negative = expense
  description: string;
  provider: string;
  raw: string[];
}

export interface CsvProvider {
  id: string;
  label: string;
  detect(headerLine: string[], secondLine?: string[]): number;
  parse(rows: string[][]): NormalizedTx[];
}

export interface CsvProviderSelection {
  status: 'selected' | 'needs-user-selection' | 'unrecognized';
  provider?: CsvProvider;
  candidates: Array<{ provider: CsvProvider; confidence: number }>;
}

export const LOW_CONFIDENCE_THRESHOLD = 0.5;

export const csvProviders: CsvProvider[] = [genericCsvProvider, smbcCardCsvProvider];

export function decodeFileContent(buffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(buffer);

  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const text = decoder.decode(uint8Array);
    if (!text.includes('\uFFFD')) {
      return text;
    }
  } catch {
    // UTF-8 failed, try Shift_JIS
  }

  const detected = Encoding.detect(uint8Array);
  if (detected === 'SJIS' || detected === 'UTF8' || detected === 'ASCII') {
    const unicodeArray = Encoding.convert(uint8Array, {
      to: 'UNICODE',
      from: detected === 'UTF8' ? 'UTF8' : 'SJIS',
    });
    return Encoding.codeToString(unicodeArray);
  }

  const unicodeArray = Encoding.convert(uint8Array, {
    to: 'UNICODE',
    from: 'SJIS',
  });
  return Encoding.codeToString(unicodeArray);
}

export function parseCsvRows(text: string): string[][] {
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

export function normalizeDate(date: string): string | null {
  const trimmed = date.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const slashMatch = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(trimmed);
  if (!slashMatch) return null;

  const [, year, month, day] = slashMatch;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function normalizeExpenseAmount(amount: string | number): number | null {
  const numeric = typeof amount === 'number'
    ? amount
    : parseInt(amount.trim().replace(/,/g, ''), 10);

  if (Number.isNaN(numeric)) return null;
  return -Math.abs(numeric);
}

export function selectCsvProvider(rows: string[][]): CsvProviderSelection {
  if (rows.length < 2) {
    return { status: 'unrecognized', candidates: [] };
  }

  const [headerLine, secondLine] = rows;
  const candidates = csvProviders
    .map(provider => ({ provider, confidence: provider.detect(headerLine, secondLine) }))
    .sort((a, b) => b.confidence - a.confidence);

  const [best, runnerUp] = candidates;
  if (!best || best.confidence < LOW_CONFIDENCE_THRESHOLD) {
    return { status: 'unrecognized', candidates };
  }

  if (runnerUp && runnerUp.confidence === best.confidence) {
    return { status: 'needs-user-selection', candidates: candidates.filter(c => c.confidence === best.confidence) };
  }

  return { status: 'selected', provider: best.provider, candidates };
}

export function parseCsvWithRegistry(text: string): CsvProviderSelection & { rows: NormalizedTx[] } {
  const rows = parseCsvRows(text);
  const selection = selectCsvProvider(rows);

  if (selection.status !== 'selected' || !selection.provider) {
    return { ...selection, rows: [] };
  }

  return { ...selection, rows: selection.provider.parse(rows) };
}
