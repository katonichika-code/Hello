import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { BudgetCard } from '../components/BudgetCard';
import { ProjectionCard } from '../components/ProjectionCard';
import { QuickEntry } from '../components/QuickEntry';
import {
  isConnected,
  requestAccessToken,
  revokeAccessToken,
  syncGmail,
  type SyncResult,
} from '../../api/gmailSync';

export interface HomeScreenProps {
  transactions: Transaction[];
  selectedMonth: string;
  onRefresh: () => void;
}

interface SyncUiError {
  message: string;
  type: 'auth' | 'network' | 'timeout' | 'parse' | 'db' | 'unknown';
  timestamp: string;
}

function classifySyncError(message: string): SyncUiError['type'] {
  const text = message.toLowerCase();
  if (text.includes('oauth') || text.includes('auth') || text.includes('token') || text.includes('google identity')) return 'auth';
  if (text.includes('timeout')) return 'timeout';
  if (text.includes('gmail api') || text.includes('network') || text.includes('fetch')) return 'network';
  if (text.includes('parse') || text.includes('extract text body') || text.includes('vpass format')) return 'parse';
  if (text.includes('db ') || text.includes('dexie') || text.includes('indexeddb')) return 'db';
  return 'unknown';
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
  const [showSettings, setShowSettings] = useState(false);

  const [formIncome, setFormIncome] = useState('');
  const [formFixed, setFormFixed] = useState('');
  const [formSavings, setFormSavings] = useState('');

  const [gmailConnected, setGmailConnected] = useState(isConnected());
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [gmailError, setGmailError] = useState<SyncUiError | null>(null);
  const [gmailWarnings, setGmailWarnings] = useState<string[]>([]);
  const [gmailProgress, setGmailProgress] = useState('');
  const [gmailStatus, setGmailStatus] = useState<SyncResult | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

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

  useEffect(() => { loadSettings(); }, [loadSettings]);
  useEffect(() => { loadBudgets(); }, [loadBudgets]);
  useEffect(() => {
    loadGmailSyncMeta();
  }, [loadGmailSyncMeta]);

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

  const [copyResult, setCopyResult] = useState<string | null>(null);
  const handleCopyBudgets = async () => {
    try {
      const result = await copyBudgetsFromPrevMonth(selectedMonth, 'personal');
      if (result.created === 0 && result.updated === 0) {
        setCopyResult('前月の予算がありません');
      } else {
        setCopyResult(`${result.created}件作成, ${result.updated}件更新`);
      }
      loadBudgets();
    } catch {
      setCopyResult('コピー失敗');
    }
  };

  const handleGmailSync = async () => {
    try {
      setGmailSyncing(true);
      setGmailError(null);
      setGmailWarnings([]);
      setGmailStatus(null);
      setGmailProgress('認証中…');

      if (!isConnected()) {
        await requestAccessToken();
      }
      setGmailConnected(isConnected());
      setGmailProgress('認証完了、メール取得中…');

      const result = await withTimeout(
        syncGmail({
          onProgress: (progress) => setGmailProgress(progress.message),
        }),
        30_000,
      );

      setGmailStatus(result);
      setGmailWarnings(result.errors);
      setGmailProgress(`同期完了：新規${result.newTransactions}件、重複${result.duplicatesSkipped}件`);
      await loadGmailSyncMeta();
      await onRefresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gmail同期に失敗しました';
      const syncError: SyncUiError = {
        message,
        type: classifySyncError(message),
        timestamp: new Date().toISOString(),
      };
      setGmailError(syncError);
      setGmailProgress(`同期失敗：${message}`);
      setGmailConnected(isConnected());
      console.error('[Gmail Sync Error]', err);
    } finally {
      setGmailSyncing(false);
    }
  };

  return (
    <div className="screen-content home-screen">
      <div className="gmail-sync-card">
        <div className="gmail-sync-header">
          <div>
            <div className="gmail-sync-title">Gmail同期</div>
            <div className="gmail-sync-meta">
              接続: {gmailConnected ? '接続済み' : '未接続'}
              {lastSyncAt ? ` / 前回: ${new Date(lastSyncAt).toLocaleString('ja-JP')}` : ' / 前回: 未同期'}
            </div>
            {gmailProgress && <div className="gmail-sync-progress">{gmailProgress}</div>}
            {gmailStatus && (
              <div className="gmail-sync-meta">
                新規 {gmailStatus.newTransactions}件 / 重複スキップ {gmailStatus.duplicatesSkipped}件
              </div>
            )}
          </div>
          <button className="gmail-sync-btn" onClick={handleGmailSync} disabled={gmailSyncing}>
            {gmailSyncing ? '同期中...' : 'Gmail同期'}
          </button>
        </div>

        {gmailError && (
          <div className="gmail-sync-error-banner" role="alert">
            <div className="gmail-sync-error-title">同期失敗：{gmailError.message}</div>
            <div className="gmail-sync-error-meta">種別: {gmailError.type}</div>
            <div className="gmail-sync-error-meta">時刻: {new Date(gmailError.timestamp).toLocaleString('ja-JP')}</div>
          </div>
        )}

        {gmailWarnings.length > 0 && (
          <div className="gmail-sync-warning-banner">
            <div className="gmail-sync-warning-title">同期中の警告</div>
            <ul>
              {gmailWarnings.map((warning, idx) => (
                <li key={`${warning}-${idx}`}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {gmailConnected && (
          <button
            className="gmail-revoke-btn"
            onClick={() => {
              revokeAccessToken();
              setGmailConnected(false);
            }}
            type="button"
          >
            接続解除
          </button>
        )}
      </div>

      {needsSetup ? (
        <div className="setup-prompt" onClick={() => setShowSettings(true)}>
          <div className="setup-title">はじめに設定</div>
          <div className="setup-desc">月収・固定費・貯蓄目標を入力してください</div>
        </div>
      ) : (
        <RemainingCard
          remaining={remaining}
          totalExpenses={expenses}
          disposable={disposable}
          pendingExpenses={pendingExpenses}
        />
      )}

      {showSettings && (
        <div className="settings-panel">
          <h3>月次設定</h3>
          <label>
            月収 (円)
            <input
              type="number"
              inputMode="numeric"
              value={formIncome || settings.monthlyIncome || ''}
              onChange={(e) => setFormIncome(e.target.value)}
            />
          </label>
          <label>
            固定費 合計 (円)
            <input
              type="number"
              inputMode="numeric"
              value={formFixed || settings.fixedCostTotal || ''}
              onChange={(e) => setFormFixed(e.target.value)}
            />
          </label>
          <label>
            貯蓄目標 (円)
            <input
              type="number"
              inputMode="numeric"
              value={formSavings || settings.monthlySavingsTarget || ''}
              onChange={(e) => setFormSavings(e.target.value)}
            />
          </label>
          <div className="settings-actions">
            <button
              className="btn-save"
              onClick={async () => {
                const { updateSettings } = await import('../../db/repo');
                await updateSettings({
                  monthly_income: parseInt(formIncome, 10) || settings.monthlyIncome,
                  fixed_cost_total: parseInt(formFixed, 10) || settings.fixedCostTotal,
                  monthly_savings_target: parseInt(formSavings, 10) || settings.monthlySavingsTarget,
                });
                await loadSettings();
                setShowSettings(false);
              }}
            >
              保存
            </button>
            <button className="btn-cancel-settings" onClick={() => setShowSettings(false)}>
              キャンセル
            </button>
          </div>
        </div>
      )}

      {!showSettings && !needsSetup && (
        <button
          className="settings-gear"
          onClick={() => {
            setFormIncome(String(settings.monthlyIncome));
            setFormFixed(String(settings.fixedCostTotal));
            setFormSavings(String(settings.monthlySavingsTarget));
            setShowSettings(true);
          }}
        >
          ⚙ 設定
        </button>
      )}

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

      <QuickEntry onSaved={onRefresh} />

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
    </div>
  );
}
