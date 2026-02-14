import type { Transaction } from '../../api/client';

export interface HomeScreenProps {
  transactions: Transaction[];
  selectedMonth: string;
  onRefresh: () => void;
}

/** Home screen placeholder — will be filled in Slice 4 */
export function HomeScreen({ transactions }: HomeScreenProps) {
  return (
    <div className="screen-content">
      <p className="no-data">
        ホーム画面を準備中... ({transactions.length}件の取引)
      </p>
    </div>
  );
}
