import type { Transaction } from '../../api/client';

export interface AnalyticsScreenProps {
  transactions: Transaction[];
  onRefresh: () => void;
}

/** Analytics screen placeholder — Sankey + list will be reattached in Slice 6 */
export function AnalyticsScreen({ transactions }: AnalyticsScreenProps) {
  return (
    <div className="screen-content">
      <p className="no-data">
        分析画面を準備中... ({transactions.length}件の取引)
      </p>
    </div>
  );
}
