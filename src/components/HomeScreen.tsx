import { useState, useMemo } from 'react';
import type { Transaction, Budget, AppSettings } from '../api/client';
import { ManualEntry } from './ManualEntry';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface HomeScreenProps {
  transactions: Transaction[];
  budgets: Budget[];
  settings: AppSettings;
  selectedMonth: string;
  loading: boolean;
  onMonthChange: (month: string) => void;
  onOpenSettings: () => void;
  onSeeAll: () => void;
  onRefresh: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmt(amount: number): string {
  return '¥' + Math.abs(amount).toLocaleString('ja-JP');
}

/** Build list of recent months for the selector (current + 11 prior) */
function buildMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    options.push({ value, label });
  }
  return options;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function MonthSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const months = buildMonthOptions();
  return (
    <select
      className="month-selector"
      value={value}
      onChange={e => onChange(e.target.value)}
      aria-label="対象月"
    >
      <option value="">全期間</option>
      {months.map(m => (
        <option key={m.value} value={m.value}>{m.label}</option>
      ))}
    </select>
  );
}

function HeroCard({
  heroValue,
  heroLabel,
  monthlyBudget,
}: {
  heroValue: number;
  heroLabel: string;
  monthlyBudget: number;
}) {
  const isNegative = heroValue < 0;
  return (
    <div className={`hero-card${isNegative ? ' hero-negative' : ''}`}>
      <p className="hero-label">{heroLabel}</p>
      <p className="hero-amount">{fmt(heroValue)}</p>
      {monthlyBudget > 0 && (
        <p className="hero-sub">予算 {fmt(monthlyBudget)} / 月</p>
      )}
    </div>
  );
}

function PendingBanner({
  count,
  amount,
}: {
  count: number;
  amount: number;
}) {
  return (
    <div className="pending-banner">
      <span className="pending-dot" />
      <span>
        未確定（通知ベース）{count}件・{fmt(amount)}
      </span>
    </div>
  );
}

function KpiRow({
  income,
  expenses,
  net,
}: {
  income: number;
  expenses: number;
  net: number;
}) {
  return (
    <div className="kpi-row">
      <div className="kpi-chip">
        <span className="kpi-label">収入</span>
        <span className="kpi-value text-income">{fmt(income)}</span>
      </div>
      <div className="kpi-divider" />
      <div className="kpi-chip">
        <span className="kpi-label">支出</span>
        <span className="kpi-value text-expense">{fmt(expenses)}</span>
      </div>
      <div className="kpi-divider" />
      <div className="kpi-chip">
        <span className="kpi-label">ネット</span>
        <span className={`kpi-value ${net >= 0 ? 'text-income' : 'text-expense'}`}>{fmt(net)}</span>
      </div>
    </div>
  );
}

function BudgetStrip({
  budgets,
  transactions,
  onEdit,
}: {
  budgets: Budget[];
  transactions: Transaction[];
  onEdit: () => void;
}) {
  const spendByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of transactions) {
      if (t.amount < 0 && !t.isPending) {
        map[t.category] = (map[t.category] ?? 0) + Math.abs(t.amount);
      }
    }
    return map;
  }, [transactions]);

  return (
    <section className="budget-strip-section">
      <div className="section-hd">
        <h2>予算</h2>
        <button className="btn btn-ghost" onClick={onEdit}>編集</button>
      </div>
      <div className="budget-strip">
        {budgets.map(b => {
          const spent = spendByCategory[b.category] ?? 0;
          const pct = Math.min(100, (spent / b.monthlyLimit) * 100);
          const over = spent > b.monthlyLimit;
          return (
            <div key={b.id} className="budget-chip">
              <div className="budget-chip-head">
                <span className="budget-chip-name">{b.name || b.category}</span>
                <span className={`budget-chip-pct ${over ? 'text-expense' : 'text-sub'}`}>
                  {Math.round(pct)}%
                </span>
              </div>
              <div className="budget-bar-track">
                <div
                  className={`budget-bar-fill${over ? ' budget-bar-over' : ''}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="budget-chip-amounts">
                <span className={over ? 'text-expense' : ''}>{fmt(spent)}</span>
                <span className="text-muted"> / {fmt(b.monthlyLimit)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TransactionRow({ t }: { t: Transaction }) {
  const isExpense = t.amount < 0;
  const dateLabel = t.date.slice(5).replace('-', '/'); // MM/DD
  return (
    <div className={`tx-row${t.isPending ? ' tx-pending' : ''}`}>
      <div className="tx-row-left">
        <p className="tx-desc">{t.description}</p>
        <p className="tx-meta text-sm text-sub">
          {dateLabel}・{t.category}
          {t.isPending ? <span className="pending-tag">未確定</span> : null}
        </p>
      </div>
      <p className={`tx-amount ${isExpense ? 'text-expense' : 'text-income'}`}>
        {isExpense ? '−' : '+'}{fmt(t.amount)}
      </p>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="empty-state">
      <p className="empty-icon">📭</p>
      <p className="empty-title">まだ取引がありません</p>
      <p className="empty-sub text-sub text-sm">支出を追加するか、CSVを取り込んでください</p>
      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onAdd}>
        支出を追加
      </button>
    </div>
  );
}

// Thin wrapper so ManualEntry can be rendered as a bottom sheet
function ManualEntrySheet({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: () => void;
}) {
  // ManualEntry doesn't have a modal prop, so we wrap it in a sheet overlay
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="bottom-sheet" role="dialog" aria-modal="true" aria-label="支出を追加">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2 className="sheet-title">支出を追加</h2>
          <button className="btn btn-ghost" onClick={onClose}>閉じる</button>
        </div>
        <div className="sheet-body">
          <ManualEntry onEntryComplete={onComplete} />
        </div>
      </div>
    </>
  );
}

// ─── HomeScreen ────────────────────────────────────────────────────────────────

export function HomeScreen({
  transactions,
  budgets,
  settings,
  selectedMonth,
  loading,
  onMonthChange,
  onOpenSettings,
  onSeeAll,
  onRefresh,
}: HomeScreenProps) {
  const [entryOpen, setEntryOpen] = useState(false);

  // Split confirmed vs pending
  const confirmed = useMemo(() => transactions.filter(t => !t.isPending), [transactions]);
  const pendingItems = useMemo(() => transactions.filter(t => t.isPending), [transactions]);

  // KPI calculation (confirmed only)
  const income = useMemo(
    () => confirmed.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0),
    [confirmed],
  );
  const expenses = useMemo(
    () => confirmed.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0),
    [confirmed],
  );
  const net = income - expenses;

  // Hero metric: monthlyBudget - expenses; fallback to net
  const monthlyBudget = parseInt(settings['monthlyBudget'] ?? '0', 10) || 0;
  const heroValue = monthlyBudget > 0 ? monthlyBudget - expenses : net;
  const heroLabel = monthlyBudget > 0 ? '自由に使っていい残り' : '今月の収支';

  const pendingAmount = useMemo(
    () => pendingItems.reduce((s, t) => s + Math.abs(t.amount), 0),
    [pendingItems],
  );

  // Recent 5 transactions (newest first)
  const recent = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    [transactions],
  );

  function handleEntryComplete() {
    setEntryOpen(false);
    onRefresh();
  }

  return (
    <div className="home-screen">
      {/* ── Header ── */}
      <header className="home-header">
        <MonthSelector value={selectedMonth} onChange={onMonthChange} />
        <button className="btn btn-ghost settings-btn" onClick={onOpenSettings}>
          設定
        </button>
      </header>

      <div className="home-body">
        {loading ? (
          <div className="loading-state">読み込み中…</div>
        ) : (
          <>
            {/* ── Hero ── */}
            <HeroCard heroValue={heroValue} heroLabel={heroLabel} monthlyBudget={monthlyBudget} />

            {/* ── Pending ── */}
            {pendingItems.length > 0 && (
              <PendingBanner count={pendingItems.length} amount={pendingAmount} />
            )}

            {/* ── KPI chips ── */}
            <KpiRow income={income} expenses={expenses} net={net} />

            {/* ── Budget strip ── */}
            {budgets.length > 0 && (
              <BudgetStrip
                budgets={budgets}
                transactions={transactions}
                onEdit={onOpenSettings}
              />
            )}

            {/* ── Recent transactions ── */}
            <section className="recent-section">
              <div className="section-hd">
                <h2>最近の取引</h2>
                {transactions.length > 0 && (
                  <button className="btn btn-ghost" onClick={onSeeAll}>
                    すべて見る
                  </button>
                )}
              </div>
              {transactions.length === 0 ? (
                <EmptyState onAdd={() => setEntryOpen(true)} />
              ) : (
                <div className="tx-list card">
                  {recent.map(t => <TransactionRow key={t.id} t={t} />)}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* ── FAB ── */}
      <button
        className="fab"
        onClick={() => setEntryOpen(true)}
        aria-label="支出を追加"
      >
        <span className="fab-plus">＋</span>
        <span>支出を追加</span>
      </button>

      {/* ── Manual entry sheet ── */}
      {entryOpen && (
        <ManualEntrySheet
          onClose={() => setEntryOpen(false)}
          onComplete={handleEntryComplete}
        />
      )}
    </div>
  );
}
