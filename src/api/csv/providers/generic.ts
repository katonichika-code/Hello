import type { CsvProvider, NormalizedTx } from '../registry';
import { normalizeDate, normalizeExpenseAmount } from '../registry';

export const genericCsvProvider: CsvProvider = {
  id: 'A',
  label: '標準',
  detect(headerLine) {
    const header = headerLine.map(col => col.toLowerCase().trim());
    return header.includes('date') && header.includes('amount') && header.includes('description') ? 1 : 0;
  },
  parse(rows): NormalizedTx[] {
    const header = rows[0].map(col => col.toLowerCase().trim());
    const dateIdx = header.indexOf('date');
    const amountIdx = header.indexOf('amount');
    const descIdx = header.indexOf('description');

    if (dateIdx === -1 || amountIdx === -1 || descIdx === -1) {
      return [];
    }

    const transactions: NormalizedTx[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length <= Math.max(dateIdx, amountIdx, descIdx)) continue;

      const date = normalizeDate(row[dateIdx] ?? '');
      const amount = normalizeExpenseAmount(row[amountIdx] ?? '');
      const description = row[descIdx]?.trim();

      if (!date || amount === null || !description) continue;

      transactions.push({
        date,
        amount,
        description,
        provider: 'A',
        raw: row,
      });
    }

    return transactions;
  },
};
