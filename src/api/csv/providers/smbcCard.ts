import type { CsvProvider, NormalizedTx } from '../registry';
import { normalizeDate, normalizeExpenseAmount } from '../registry';

export const smbcCardCsvProvider: CsvProvider = {
  id: 'B',
  label: '銀行・カード明細',
  detect(_headerLine, secondLine) {
    if (!secondLine || secondLine.length < 6) return 0;
    return /^\d{4}\/\d{2}\/\d{2}$/.test(secondLine[0]) ? 1 : 0;
  },
  parse(rows): NormalizedTx[] {
    const transactions: NormalizedTx[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 3) continue;

      const date = normalizeDate(row[0] ?? '');
      const description = row[1]?.trim();
      let amountStr = row[2]?.trim();

      if (!amountStr && row.length > 5) {
        amountStr = row[5]?.trim();
      }

      const amount = normalizeExpenseAmount(amountStr ?? '');

      if (!date || !description || amount === null) continue;

      transactions.push({
        date,
        amount,
        description,
        provider: 'B',
        raw: row,
      });
    }

    return transactions;
  },
};
