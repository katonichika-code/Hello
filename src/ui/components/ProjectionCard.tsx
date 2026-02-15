import { useState, useMemo } from 'react';
import type { Transaction } from '../../domain/types';

const jpyFmt = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' });
const formatJPY = (n: number) => jpyFmt.format(n);

const HORIZONS = [
  { months: 3, label: '3ヶ月' },
  { months: 6, label: '6ヶ月' },
  { months: 12, label: '1年' },
] as const;

interface ProjectionCardProps {
  /** All transactions for the selected month (both wallets) */
  transactions: Transaction[];
}

export function ProjectionCard({ transactions }: ProjectionCardProps) {
  const [open, setOpen] = useState(false);

  // Combined net: income - |expenses| across all wallets
  const { income, expenseAbs, net } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    for (const t of transactions) {
      if (t.amount > 0) inc += t.amount;
      else exp += Math.abs(t.amount);
    }
    return { income: inc, expenseAbs: exp, net: inc - exp };
  }, [transactions]);

  const hasData = income > 0 || expenseAbs > 0;

  // Projections: currentSavings = 0, projected = 0 + net * N
  const projections = HORIZONS.map((h) => ({
    ...h,
    projected: net * h.months,
  }));

  return (
    <div className="projection-card">
      <div className="projection-header" onClick={() => setOpen(!open)}>
        <div className="projection-title">将来の見通し</div>
        <span className={`collapsible-chevron ${open ? 'open' : ''}`}>&#9660;</span>
      </div>

      {open && (
        <div className="projection-body">
          {!hasData ? (
            <div className="projection-empty">
              <div className="projection-empty-text">まだペースが算出できません</div>
              <div className="projection-empty-hint">支出を追加するかCSVをインポートしてください</div>
            </div>
          ) : (
            <>
              {/* Current month net */}
              <div className="projection-current">
                <div className="projection-current-label">今月の収支</div>
                <div className={`projection-current-value ${net >= 0 ? 'positive' : 'negative'}`}>
                  {formatJPY(net)}
                </div>
                <div className="projection-breakdown">
                  収入 {formatJPY(income)} / 支出 {formatJPY(expenseAbs)}
                </div>
              </div>

              {/* Projection bars */}
              <div className="projection-horizons">
                {projections.map((p) => {
                  const isPositive = p.projected >= 0;
                  return (
                    <div key={p.months} className="projection-row">
                      <span className="projection-label">{p.label}</span>
                      <div className="projection-bar-track">
                        <div
                          className={`projection-bar-fill ${isPositive ? 'positive' : 'negative'}`}
                          style={{
                            width: `${Math.min(Math.abs(p.projected) / (Math.max(income, expenseAbs, 1) * 12) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <span className={`projection-value ${isPositive ? 'positive' : 'negative'}`}>
                        {formatJPY(p.projected)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="projection-note">
                今月のペースが続いた場合の目安です
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
