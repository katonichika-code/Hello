import { useState, lazy, Suspense } from 'react';
import type { Transaction } from '../../db/repo';
import { TransactionList } from '../../components/TransactionList';
import { CsvImport } from '../../components/CsvImport';
import { UncategorizedInbox } from '../../components/UncategorizedInbox';
import { BackupRestore } from '../../components/BackupRestore';

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
  return (
    <div className="screen-content analytics-screen">
      {/* Uncategorized Inbox — shows only when there are uncategorized items */}
      <UncategorizedInbox transactions={transactions} onUpdate={onRefresh} />

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
