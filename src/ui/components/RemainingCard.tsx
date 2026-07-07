import { useMemo } from 'react';

const jpyFmt = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' });
const formatJPY = (n: number) => jpyFmt.format(n);

type HeroTone = 'positive' | 'warning' | 'danger';

interface RemainingCardProps {
  selectedMonth: string;
  remaining: number;
  totalExpenses: number;
  disposable: number;
  dailyAmount: number;
  daysRemaining: number;
  dangerCategories: string[];
}

export function RemainingCard({
  selectedMonth,
  remaining,
  totalExpenses,
  disposable,
  dailyAmount,
  daysRemaining,
  dangerCategories,
}: RemainingCardProps) {
  const spentRatio = disposable > 0 ? totalExpenses / disposable : 1;
  const progressWidth = Math.max(0, Math.min(spentRatio * 100, 100));

  const tone = useMemo<HeroTone>(() => {
    if (remaining < 0) return 'danger';
    if (spentRatio <= 0.6) return 'positive';
    if (spentRatio <= 0.85) return 'warning';
    return 'danger';
  }, [remaining, spentRatio]);

  const feedback = useMemo(() => {
    if (remaining < 0) {
      return `残り${daysRemaining}日、1日${formatJPY(Math.abs(dailyAmount))}抑えると月末±0`;
    }
    if (spentRatio <= 0.6) return 'いいペースです';
    if (spentRatio <= 0.85) return '少しペース注意';
    return '月末までの使い方を絞りましょう';
  }, [dailyAmount, daysRemaining, remaining, spentRatio]);

  const nowMonth = `${Number(selectedMonth.split('-')[1])}月`;
  return (
    <section className={`hero-card hero-card--${tone}`}>
      <div className="hero-card-top">
        <div className="hero-label">今月つかえる残り</div>
        <div className="hero-month">{nowMonth}</div>
      </div>

      <div className={`hero-number hero-number-${tone}`}>{formatJPY(remaining)}</div>

      <div className="hero-daily-budget">1日あたり {formatJPY(dailyAmount)}</div>

      <div className="hero-spend-row">
        <span>今月使った額 {formatJPY(totalExpenses)}</span>
        <span>自由予算 {formatJPY(disposable)}</span>
      </div>
      <div className="hero-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressWidth)}>
        <div className={`hero-progress-fill hero-progress-fill-${tone}`} style={{ width: `${progressWidth}%` }} />
      </div>

      <div className="hero-danger-chips" aria-label="危険カテゴリ">
        {dangerCategories.length > 0 ? dangerCategories.map((category) => (
          <span className="hero-danger-chip" key={category}>注意: {category}</span>
        )) : <span className="hero-danger-chip hero-danger-chip-safe">危険カテゴリなし</span>}
      </div>

      <div className={`hero-feedback hero-feedback-${tone}`}>💬 {feedback}</div>
    </section>
  );
}
