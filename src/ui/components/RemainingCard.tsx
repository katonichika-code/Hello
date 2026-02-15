const jpyFmt = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' });
const formatJPY = (n: number) => jpyFmt.format(n);

interface RemainingCardProps {
  remaining: number;
  totalExpenses: number;
  disposable: number;  // income - fixed - savings
}

export function RemainingCard({ remaining, totalExpenses, disposable }: RemainingCardProps) {
  const pct = disposable > 0 ? Math.max(0, remaining / disposable) * 100 : 0;
  const isOver = remaining < 0;

  return (
    <div className={`remaining-card ${isOver ? 'overspent' : ''}`}>
      <div className="remaining-label">自由に使っていい残り</div>
      <div className="remaining-amount">{formatJPY(remaining)}</div>
      <div className="remaining-bar-track">
        <div
          className="remaining-bar-fill"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className="remaining-detail">
        支出 {formatJPY(totalExpenses)} / 予算 {formatJPY(disposable)}
      </div>
    </div>
  );
}
