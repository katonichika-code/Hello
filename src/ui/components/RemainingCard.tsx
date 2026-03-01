import { useMemo, useState } from 'react';

const jpyFmt = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' });
const formatJPY = (n: number) => jpyFmt.format(n);

type HeroTone = 'positive' | 'warning' | 'danger';

interface RemainingCardProps {
  selectedMonth: string;
  remaining: number;
  totalExpenses: number;
  disposable: number;
  pendingExpenses?: number;
  monthlyIncome: number;
  fixedCostTotal: number;
  monthlySavingsTarget: number;
}

export function RemainingCard({
  selectedMonth,
  remaining,
  totalExpenses,
  disposable,
  pendingExpenses = 0,
  monthlyIncome,
  fixedCostTotal,
  monthlySavingsTarget,
}: RemainingCardProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const remainingRatio = disposable > 0 ? remaining / disposable : -1;
  const spentRatio = disposable > 0 ? totalExpenses / disposable : 1;
  const progressWidth = Math.max(0, Math.min(spentRatio * 100, 100));

  const tone = useMemo<HeroTone>(() => {
    if (remainingRatio > 0.4) return 'positive';
    if (remainingRatio >= 0.15) return 'warning';
    return 'danger';
  }, [remainingRatio]);

  const feedback = useMemo(() => {
    if (remaining < 0) return '予算オーバーです';
    if (remainingRatio > 0.4) return 'いい感じ！このペースなら月末まで余裕があります';
    if (remainingRatio >= 0.15) return 'ペース注意。少し意識して過ごしましょう';
    return '使いすぎかも。今月の残りを確認しましょう';
  }, [remaining, remainingRatio]);

  const nowMonth = `${Number(selectedMonth.split('-')[1])}月`;

  const dailyBudget = useMemo(() => {
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const remainingDays = lastDay - today.getDate() + 1;
    return remaining > 0 ? Math.floor(remaining / remainingDays) : 0;
  }, [remaining]);

  return (
    <section className={`hero-card hero-card--${tone}`}>
      <div className="hero-card-top">
        <div className="hero-label">今月つかえる残り</div>
        <div className="hero-month">{nowMonth}</div>
      </div>

      <div className={`hero-number hero-number-${tone}`}>{formatJPY(remaining)}</div>

      {remaining > 0 && (
        <div className="hero-daily-budget">今日から月末まで、1日あたり {formatJPY(dailyBudget)} 使えます</div>
      )}

      <div className="hero-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressWidth)}>
        <div className={`hero-progress-fill hero-progress-fill-${tone}`} style={{ width: `${progressWidth}%` }} />
      </div>

      <button className="hero-breakdown-toggle" type="button" onClick={() => setShowBreakdown((prev) => !prev)}>
        {showBreakdown ? '内訳を閉じる' : '内訳を表示'}
      </button>

      {showBreakdown && (
        <div className="hero-breakdown">
          <div className="hero-breakdown-row"><span>収入</span><span>{formatJPY(monthlyIncome)}</span></div>
          <div className="hero-breakdown-row"><span>固定費</span><span>-{formatJPY(fixedCostTotal)}</span></div>
          <div className="hero-breakdown-row"><span>貯蓄目標</span><span>-{formatJPY(monthlySavingsTarget)}</span></div>
          <div className="hero-breakdown-row"><span>今月の支出</span><span>-{formatJPY(totalExpenses)}</span></div>
          {pendingExpenses > 0 && (
            <div className="hero-breakdown-row hero-pending">
              <span>うち未確定</span>
              <span>{formatJPY(pendingExpenses)}</span>
            </div>
          )}
        </div>
      )}

      <div className={`hero-feedback hero-feedback-${tone}`}>💬 {feedback}</div>
    </section>
  );
}
