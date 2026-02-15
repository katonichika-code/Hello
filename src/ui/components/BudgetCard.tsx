import type { BudgetStatus } from '../../domain/types';

const jpyFmt = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' });
const formatJPY = (n: number) => jpyFmt.format(n);

interface BudgetCardProps {
  status: BudgetStatus;
}

export function BudgetCard({ status }: BudgetCardProps) {
  const pct = status.budgeted > 0
    ? Math.min((status.spent / status.budgeted) * 100, 100)
    : 0;
  const isOver = status.remaining < 0;

  return (
    <div className={`budget-card ${isOver ? 'over' : ''}`}>
      <div className="budget-header">
        <span className="budget-category">{status.category}</span>
        <span className={`budget-remaining ${isOver ? 'negative' : ''}`}>
          {isOver ? '' : '残 '}{formatJPY(status.remaining)}
        </span>
      </div>
      <div className="budget-bar-track">
        <div
          className={`budget-bar-fill ${isOver ? 'over' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="budget-detail">
        {formatJPY(status.spent)} / {formatJPY(status.budgeted)}
      </div>
    </div>
  );
}
