import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Transaction, ApiSettings, ApiBudget } from '../../db/repo';
import { getSettings, getBudgets, copyBudgetsFromPrevMonth } from '../../db/repo';
import { db } from '../../db/database';
import {
  remainingFreeToSpend,
  totalExpenses,
  categoryRemaining,
} from '../../domain/computations';
import type { Settings, Budget } from '../../domain/types';
import { RemainingCard } from '../components/RemainingCard';
import { SpendingPaceChart } from '../components/SpendingPaceChart';
import { BudgetCard } from '../components/BudgetCard';
import { ProjectionCard } from '../components/ProjectionCard';
import { QuickEntry } from '../components/QuickEntry';
import {
  isConnected,
  requestAccessToken,
  syncGmail,
} from '../../api/gmailSync';

export interface HomeScreenProps {
  transactions: Transaction[];
  selectedMonth: string;
  onRefresh: () => Promise<void> | void;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`Sync timeout after ${Math.floor(timeoutMs / 1000)} seconds`));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

function toDomainSettings(api: ApiSettings): Settings {
  return {
    monthlyIncome: api.monthly_income,
    fixedCostTotal: api.fixed_cost_total,
    monthlySavingsTarget: api.monthly_savings_target,
  };
}

function toDomainBudget(api: ApiBudget): Budget {
  return {
    id: api.id,
    month: api.month,
    category: api.category,
    limitAmount: api.limit_amount,
    pinned: api.pinned === 1,
    displayOrder: api.display_order,
    wallet: api.wallet || 'personal',
  };
}

export function HomeScreen({ transactions, selectedMonth, onRefresh }: HomeScreenProps) {
  const [settings, setSettings] = useState<Settings>({
    monthlyIncome: 0, fixedCostTotal: 0, monthlySavingsTarget: 0,
  });
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const [copyResult, setCopyResult] = useState<string | null>(null);
  const [entryOpen, setEntryOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const touchStartY = useRef<number | null>(null);

  const loadGmailSyncMeta = useCallback(async () => {
    const sync = await db.gmail_sync.get(1);
    setLastSyncAt(sync?.last_sync_at ?? null);
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const s = await getSettings();
      setSettings(toDomainSettings(s));
    } catch {
      // use defaults
    }
  }, []);

  const loadBudgets = useCallback(async () => {
    try {
      const b = await getBudgets(selectedMonth, 'personal');
      setBudgets(b.filter((x) => x.pinned === 1).map(toDomainBudget));
    } catch {
      // use empty
    }
  }, [selectedMonth]);

  useEffect(() => { void loadSettings(); }, [loadSettings]);
  useEffect(() => { void loadBudgets(); }, [loadBudgets]);
  useEffect(() => {
    void loadGmailSyncMeta();
  }, [loadGmailSyncMeta]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 1600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const domainTxns = useMemo(() => transactions.map((t) => ({
    ...t,
    wallet: t.wallet || 'personal',
    source: t.source || 'csv',
  })), [transactions]);

  const disposable = useMemo(
    () => settings.monthlyIncome - settings.fixedCostTotal - settings.monthlySavingsTarget,
    [settings],
  );
  const remaining = useMemo(() => remainingFreeToSpend(settings, domainTxns), [settings, domainTxns]);
  const expenses = useMemo(() => totalExpenses(domainTxns), [domainTxns]);
  const pendingExpenses = useMemo(
    () => domainTxns
      .filter((t) => t.isPending === 1 && t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0),
    [domainTxns],
  );
  const budgetStatuses = useMemo(() => budgets.map((b) => categoryRemaining(b, domainTxns)), [budgets, domainTxns]);

  const recent = useMemo(() => transactions.slice(0, 5), [transactions]);

  const formatJPY = useMemo(() => {
    const fmt = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' });
    return (n: number) => fmt.format(n);
  }, []);

  const needsSetup = settings.monthlyIncome === 0;

  const handleCopyBudgets = async () => {
    try {
      const result = await copyBudgetsFromPrevMonth(selectedMonth, 'personal');
      if (result.created === 0 && result.updated === 0) {
        setCopyResult('前月の予算がありません');
      } else {
        setCopyResult(`${result.created}件作成, ${result.updated}件更新`);
      }
      void loadBudgets();
    } catch {
      setCopyResult('コピー失敗');
    }
  };

  const handleSyncAction = async () => {
    try {
      setGmailSyncing(true);
      setSyncMessage('');
      if (!isConnected()) {
        await requestAccessToken();
      }
      await withTimeout(syncGmail(), 120_000);
      await loadGmailSyncMeta();
      await onRefresh();
      setSyncMessage('同期しました');
    } catch (err) {
      const message = err instanceof Error ? err.message : '同期に失敗しました';
      setSyncMessage(message);
    } finally {
      setGmailSyncing(false);
    }
  };

  const syncLabel = lastSyncAt
    ? `最終同期: ${new Date(lastSyncAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    : 'Gmail未接続';

  return (
    <div className="screen-content home-screen">
      {needsSetup ? (
        <div className="setup-prompt">
          <div className="setup-title">はじめに設定</div>
          <div className="setup-desc">月収・固定費・貯蓄目標を入力してください</div>
        </div>
      ) : (
        <div className="hero-card-wrap">
          <RemainingCard
            selectedMonth={selectedMonth}
            remaining={remaining}
            totalExpenses={expenses}
            disposable={disposable}
            pendingExpenses={pendingExpenses}
            monthlyIncome={settings.monthlyIncome}
            fixedCostTotal={settings.fixedCostTotal}
            monthlySavingsTarget={settings.monthlySavingsTarget}
          />
        </div>
      )}

      {!needsSetup && <SpendingPaceChart selectedMonth={selectedMonth} spendableAmount={disposable} />}

      {!needsSetup && (
        <div className="sync-oneliner" aria-live="polite">
          <span>{syncLabel}</span>
          <button type="button" className="sync-inline-btn" onClick={handleSyncAction} disabled={gmailSyncing}>
            {gmailSyncing ? '同期中…' : lastSyncAt ? '同期' : '接続する'}
          </button>
        </div>
      )}

      {syncMessage && <div className="sync-inline-note">{syncMessage}</div>}

      {budgetStatuses.length > 0 && (
        <div className="budget-cards">
          {budgetStatuses.map((s) => (
            <BudgetCard key={s.category} status={s} />
          ))}
        </div>
      )}

      {budgetStatuses.length === 0 && !needsSetup && (
        <button className="copy-budgets-btn" onClick={handleCopyBudgets}>
          先月の予算をコピー
        </button>
      )}
      {copyResult && (
        <div className="copy-result" onClick={() => setCopyResult(null)}>{copyResult}</div>
      )}

      {!needsSetup && <ProjectionCard transactions={domainTxns} />}

      {recent.length > 0 && (
        <div className="recent-txns">
          <h4>最近の取引</h4>
          {recent.map((t) => (
            <div key={t.id} className="recent-row">
              <span className="recent-desc">{t.description}</span>
              <span className="recent-cat">{t.category}</span>
              <span className={`recent-amount ${t.amount < 0 ? 'expense' : 'income'}`}>
                {formatJPY(t.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      <button className="fab" onClick={() => setEntryOpen(true)} aria-label="取引を追加" type="button">+</button>

      {entryOpen && (
        <>
          <div className="bottom-sheet-backdrop" onClick={() => setEntryOpen(false)} />
          <div
            className="bottom-sheet"
            onTouchStart={(e) => {
              touchStartY.current = e.touches[0].clientY;
            }}
            onTouchEnd={(e) => {
              if (touchStartY.current === null) return;
              const deltaY = e.changedTouches[0].clientY - touchStartY.current;
              if (deltaY > 60) {
                setEntryOpen(false);
              }
              touchStartY.current = null;
            }}
          >
            <div className="bottom-sheet-handle" />
            <QuickEntry
              onSaved={onRefresh}
              onSuccess={() => {
                setEntryOpen(false);
                setToast('追加しました');
              }}
            />
          </div>
        </>
      )}

      {toast && <div className="quick-toast">{toast}</div>}
    </div>
  );
}
