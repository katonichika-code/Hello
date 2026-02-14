import type { Transaction } from '../../api/client';

export interface SharedScreenProps {
  transactions: Transaction[];
}

/** Shared wallet screen placeholder — will be filled in Slice 5 */
export function SharedScreen({ transactions }: SharedScreenProps) {
  const shared = transactions.filter((t) => t.wallet === 'shared');
  return (
    <div className="screen-content">
      <p className="no-data">
        共有ウォレット ({shared.length}件)
      </p>
    </div>
  );
}
