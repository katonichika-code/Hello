import Encoding from "encoding-japanese";
import type { TransactionInput } from "../../db/repo";
import { genericCsvProvider } from "./providers/generic";
import { smbcCardCsvProvider } from "./providers/smbcCard";

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
  status: "selected" | "needs-user-selection" | "unrecognized";
  provider?: CsvProvider;
  candidates: Array<{ provider: CsvProvider; confidence: number }>;
}

export const LOW_CONFIDENCE_THRESHOLD = 0.5;

export const csvProviders: CsvProvider[] = [
  genericCsvProvider,
  smbcCardCsvProvider,
];

export function decodeFileContent(buffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(buffer);

  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const text = decoder.decode(uint8Array);
    if (!text.includes("\uFFFD")) {
      return text;
    }
  } catch {
    // UTF-8 failed, try Shift_JIS
  }

  const detected = Encoding.detect(uint8Array);
  if (detected === "SJIS" || detected === "UTF8" || detected === "ASCII") {
    const unicodeArray = Encoding.convert(uint8Array, {
      to: "UNICODE",
      from: detected === "UTF8" ? "UTF8" : "SJIS",
    });
    return Encoding.codeToString(unicodeArray);
  }

  const unicodeArray = Encoding.convert(uint8Array, {
    to: "UNICODE",
    from: "SJIS",
  });
  return Encoding.codeToString(unicodeArray);
}

export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (line.trim() === "") continue;

    const row: string[] = [];
    let current = "";
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
      } else if (char === "," && !inQuotes) {
        row.push(current.trim());
        current = "";
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
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function normalizeExpenseAmount(amount: string | number): number | null {
  const numeric =
    typeof amount === "number"
      ? amount
      : parseInt(amount.trim().replace(/,/g, ""), 10);

  if (Number.isNaN(numeric)) return null;
  return -Math.abs(numeric);
}

export function selectCsvProvider(rows: string[][]): CsvProviderSelection {
  if (rows.length < 2) {
    return { status: "unrecognized", candidates: [] };
  }

  const [headerLine, secondLine] = rows;
  const candidates = csvProviders
    .map((provider) => ({
      provider,
      confidence: provider.detect(headerLine, secondLine),
    }))
    .sort((a, b) => b.confidence - a.confidence);

  const [best, runnerUp] = candidates;
  if (!best || best.confidence < LOW_CONFIDENCE_THRESHOLD) {
    return { status: "unrecognized", candidates };
  }

  if (runnerUp && runnerUp.confidence === best.confidence) {
    return {
      status: "needs-user-selection",
      candidates: candidates.filter((c) => c.confidence === best.confidence),
    };
  }

  return { status: "selected", provider: best.provider, candidates };
}

export function parseCsvWithRegistry(
  text: string,
): CsvProviderSelection & { rows: NormalizedTx[] } {
  const rows = parseCsvRows(text);
  const selection = selectCsvProvider(rows);

  if (selection.status !== "selected" || !selection.provider) {
    return { ...selection, rows: [] };
  }

  return { ...selection, rows: selection.provider.parse(rows) };
}

export type CsvFormat = "A" | "B";

export interface ParsedTransaction {
  date: string; // YYYY-MM-DD
  amount: number; // positive for display, will be negated on save
  description: string;
}

export interface CsvParseResult {
  format: CsvFormat;
  rows: ParsedTransaction[];
  error?: string;
}

export function detectFormat(rows: string[][]): CsvFormat | null {
  const selection = selectCsvProvider(rows);
  return selection.status === "selected" && selection.provider
    ? (selection.provider.id as CsvFormat)
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
    return { format: "A", rows: [], error: "CSV must have at least 2 rows" };
  }

  const result = parseCsvWithRegistry(text);

  if (result.status !== "selected" || !result.provider) {
    return {
      format: "A",
      rows: [],
      error:
        result.status === "needs-user-selection"
          ? "CSV provider selection is ambiguous. Please select a provider."
          : "Unrecognized CSV format. Expected Format A (date,amount,description header) or Format B (Japanese bank CSV with YYYY/MM/DD dates)",
    };
  }

  const parsedRows = result.rows.map(toParsedTransaction);
  const format = result.provider.id as CsvFormat;

  if (parsedRows.length === 0) {
    return {
      format,
      rows: [],
      error: `No valid transactions found in ${format === "A" ? "standard" : "Japanese bank"} CSV format`,
    };
  }

  return { format, rows: parsedRows };
}

/**
 * Convert parsed transactions to API format with hash generation.
 * Hash generation intentionally keeps the legacy positive-amount input so
 * imports remain byte-for-byte compatible with hashes created before the
 * provider registry existed.
 */
export async function toTransactionInputs(
  parsed: ParsedTransaction[],
  generateHash: (
    date: string,
    amount: number,
    description: string,
  ) => Promise<string>,
): Promise<TransactionInput[]> {
  const inputs: TransactionInput[] = [];

  for (const row of parsed) {
    const hash = await generateHash(row.date, row.amount, row.description);

    inputs.push({
      date: row.date,
      amount: -Math.abs(row.amount),
      category: "Uncategorized",
      account: "card",
      description: row.description,
      hash,
    });
  }

  return inputs;
}
