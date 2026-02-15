import type { Transaction } from '../../db/repo';
import { SankeyDiagram } from '../../components/SankeyDiagram';
import { TransactionList } from '../../components/TransactionList';
import { CsvImport } from '../../components/CsvImport';
import { UncategorizedInbox } from '../../components/UncategorizedInbox';
import { BackupRestore } from '../../components/BackupRestore';

export interface AnalyticsScreenProps {
  transactions: Transaction[];
  onRefresh: () => void;
}

export function AnalyticsScreen({ transactions, onRefresh }: AnalyticsScreenProps) {
  return (
    <div className="screen-content analytics-screen">
      {/* Uncategorized Inbox — shows only when there are uncategorized items */}
      <UncategorizedInbox transactions={transactions} onUpdate={onRefresh} />

      {/* Sankey flow diagram */}
      <SankeyDiagram transactions={transactions} />

      {/* CSV Import */}
      <CsvImport onImportComplete={onRefresh} />

      {/* Full transaction list with inline editing */}
      <div className="transactions-section">
        <h3>取引一覧</h3>
        <TransactionList transactions={transactions} onUpdate={onRefresh} />
      </div>

      {/* Backup / Restore (collapsible) */}
      <BackupRestore onRestore={onRefresh} />
    </div>
  );
}
