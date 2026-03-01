import { useEffect, useMemo, useState } from 'react';
import { getMonthlySpendingTrend, type MonthlySpendingTrend } from '../../db/repo';

const jpyCompactFmt = new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY',
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 1,
});

function monthLabel(monthKey: string): string {
  const month = Number(monthKey.slice(5, 7));
  return `${month}月`;
}

function formatYAxis(value: number): string {
  if (value >= 10000) return `¥${Math.round(value / 1000)}k`;
  return `¥${value}`;
}

export function MonthlyTrendChart() {
  const [trend, setTrend] = useState<MonthlySpendingTrend[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const result = await getMonthlySpendingTrend(6);
      if (!cancelled) {
        setTrend(result);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const monthsWithSpending = useMemo(() => trend.filter((item) => item.spending > 0).length, [trend]);

  if (monthsWithSpending < 2) {
    return (
      <section className="trend-card" aria-label="月別推移">
        <h3 className="trend-title">月別推移</h3>
        <p className="no-data">2ヶ月以上のデータが蓄積されると、月別推移が表示されます</p>
      </section>
    );
  }

  const maxValue = Math.max(...trend.map((item) => Math.max(item.spending, item.budget)), 1000);
  const topTick = Math.ceil(maxValue / 10000) * 10000;
  const midTick = Math.round(topTick / 2);
  const budget = trend[0]?.budget ?? 0;
  const budgetTopPercent = 100 - (budget / topTick) * 100;

  return (
    <section className="trend-card" aria-label="月別推移">
      <h3 className="trend-title">月別推移</h3>
      <div className="trend-chart-wrap">
        <div className="trend-y-axis">
          <span>{formatYAxis(topTick)}</span>
          <span>{formatYAxis(midTick)}</span>
          <span>¥0</span>
        </div>

        <div className="trend-plot-area">
          <div className="trend-budget-line" style={{ top: `${budgetTopPercent}%` }}>
            <span className="trend-budget-label">予算ライン</span>
          </div>

          <div className="trend-bars">
            {trend.map((item) => {
              const barHeight = (item.spending / topTick) * 100;
              const isUnderBudget = item.spending <= item.budget;
              return (
                <div className="trend-bar-group" key={item.month}>
                  <div className="trend-bar-rail">
                    <div
                      className={`trend-bar ${isUnderBudget ? 'under' : 'over'}`}
                      style={{ height: `${Math.max(barHeight, 3)}%` }}
                      title={`${monthLabel(item.month)} ${jpyCompactFmt.format(item.spending)}`}
                    />
                  </div>
                  <span className="trend-month-label">{monthLabel(item.month)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
