import { useState, useMemo, lazy, Suspense } from 'react';
import type { Transaction } from '../../db/repo';
import { TransactionList } from '../../components/TransactionList';
import { CsvImport } from '../../components/CsvImport';
import { UncategorizedInbox } from '../../components/UncategorizedInbox';
import { BackupRestore } from '../../components/BackupRestore';
import { MonthlyTrendChart } from '../components/MonthlyTrendChart';

const jpyFmt = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' });
const formatJPY = (n: number) => jpyFmt.format(n);

const LazySankey = lazy(() =>
  import('../../components/SankeyDiagram').then((m) => ({ default: m.SankeyDiagram })),
);

export interface AnalyticsScreenProps {
  transactions: Transaction[];
  onRefresh: () => void;
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="collapsible-section">
      <div className="collapsible-header" onClick={() => setOpen(!open)}>
        <h3>{title}</h3>
        <span className={`collapsible-chevron ${open ? 'open' : ''}`}>&#9660;</span>
      </div>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

export function AnalyticsScreen({ transactions, onRefresh }: AnalyticsScreenProps) {
  const income = useMemo(
    () => transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0),
    [transactions],
  );
  const expenseTotal = useMemo(
    () => transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0),
    [transactions],
  );
  const net = income - expenseTotal;

  return (
    <div className="screen-content analytics-screen">
      {/* Income / Expense / Net summary */}
      <div className="analytics-summary-cards">
        <div className="analytics-card">
          <div className="analytics-card-label">収入</div>
          <div className="analytics-card-value income">{formatJPY(income)}</div>
        </div>
        <div className="analytics-card">
          <div className="analytics-card-label">支出</div>
          <div className="analytics-card-value expense">{formatJPY(expenseTotal)}</div>
        </div>
        <div className="analytics-card">
          <div className="analytics-card-label">ネット</div>
          <div className={`analytics-card-value ${net >= 0 ? 'income' : 'expense'}`}>{formatJPY(net)}</div>
        </div>
      </div>

      {/* Uncategorized Inbox — shows only when there are uncategorized items */}
      <UncategorizedInbox transactions={transactions} onUpdate={onRefresh} />

      <MonthlyTrendChart />

      {/* Sankey flow diagram — lazy loaded, collapsed by default */}
      <CollapsibleSection title="支出フロー">
        <Suspense fallback={<p className="no-data">読み込み中...</p>}>
          <LazySankey transactions={transactions} />
        </Suspense>
      </CollapsibleSection>

      {/* CSV Import */}
      <CollapsibleSection title="CSV インポート">
        <CsvImport onImportComplete={onRefresh} />
      </CollapsibleSection>

      {/* Full transaction list with inline editing */}
      <CollapsibleSection title="取引一覧">
        <TransactionList transactions={transactions} onUpdate={onRefresh} />
      </CollapsibleSection>

      {/* Backup / Restore (collapsible) */}
      <BackupRestore onRestore={onRefresh} />
    </div>
  );
}
