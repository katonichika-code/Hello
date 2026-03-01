import { useEffect, useState, useCallback } from 'react';
import { db } from '../../db/database';
import { getSettings, reclassifyUncategorized, updateSettings } from '../../db/repo';
import { BackupRestore } from '../../components/BackupRestore';
import {
  isConnected,
  requestAccessToken,
  revokeAccessToken,
  syncGmail,
  type SyncResult,
} from '../../api/gmailSync';

interface SettingsScreenProps {
  onClose: () => void;
  onRefresh: () => Promise<void> | void;
  onGoAnalytics: () => void;
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

export function SettingsScreen({ onClose, onRefresh, onGoAnalytics }: SettingsScreenProps) {
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [fixedCostTotal, setFixedCostTotal] = useState('');
  const [monthlySavingsTarget, setMonthlySavingsTarget] = useState('');
  const [storagePersisted, setStoragePersisted] = useState<boolean | null>(null);

  const [gmailConnected, setGmailConnected] = useState(isConnected());
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [gmailError, setGmailError] = useState<SyncUiError | null>(null);
  const [gmailWarnings, setGmailWarnings] = useState<string[]>([]);
  const [gmailProgress, setGmailProgress] = useState('');
  const [gmailStatus, setGmailStatus] = useState<SyncResult | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    const s = await getSettings();
    setMonthlyIncome(String(s.monthly_income || ''));
    setFixedCostTotal(String(s.fixed_cost_total || ''));
    setMonthlySavingsTarget(String(s.monthly_savings_target || ''));
  }, []);

  const loadSyncMeta = useCallback(async () => {
    const sync = await db.gmail_sync.get(1);
    setLastSyncAt(sync?.last_sync_at ?? null);
  }, []);

  useEffect(() => {
    void loadSettings();
    void loadSyncMeta();
  }, [loadSettings, loadSyncMeta]);

  useEffect(() => {
    (async () => {
      if (navigator.storage?.persisted) {
        setStoragePersisted(await navigator.storage.persisted());
      }
    })();
  }, []);

  const handleSaveSettings = async () => {
    await updateSettings({
      monthly_income: parseInt(monthlyIncome, 10) || 0,
      fixed_cost_total: parseInt(fixedCostTotal, 10) || 0,
      monthly_savings_target: parseInt(monthlySavingsTarget, 10) || 0,
    });
    await onRefresh();
  };


  const handleReclassifyUncategorized = async () => {
    const count = await reclassifyUncategorized();
    if (count > 0) {
      window.alert(`${count}件の取引を再分類しました`);
    } else {
      window.alert('再分類する取引はありません');
    }
    await onRefresh();
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
        120_000,
      );

      setGmailStatus(result);
      setGmailWarnings(result.errors);
      setGmailProgress(`同期完了：新規${result.newTransactions}件、重複${result.duplicatesSkipped}件`);
      await loadSyncMeta();
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
    } finally {
      setGmailSyncing(false);
    }
  };

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true">
      <div className="settings-screen">
        <div className="settings-screen-header">
          <h2>設定</h2>
          <button type="button" className="settings-close-btn" onClick={onClose}>×</button>
        </div>

        <section className="settings-section-card">
          <h3>Gmail同期</h3>
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
          <div className="settings-inline-actions">
            <button className="gmail-sync-btn" onClick={handleGmailSync} disabled={gmailSyncing}>
              {gmailSyncing ? '同期中...' : 'Gmail同期'}
            </button>
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
        </section>

        <section className="settings-section-card">
          <h3>月次設定</h3>
          <label>
            月収 (円)
            <input type="number" inputMode="numeric" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} />
          </label>
          <label>
            固定費 合計 (円)
            <input type="number" inputMode="numeric" value={fixedCostTotal} onChange={(e) => setFixedCostTotal(e.target.value)} />
          </label>
          <label>
            貯蓄目標 (円)
            <input type="number" inputMode="numeric" value={monthlySavingsTarget} onChange={(e) => setMonthlySavingsTarget(e.target.value)} />
          </label>
          <button className="btn-save" type="button" onClick={handleSaveSettings}>保存</button>
        </section>

        <section className="settings-section-card">
          <h3>データ管理</h3>
          <button type="button" className="sync-inline-btn" onClick={onGoAnalytics}>CSV インポートを開く</button>
          <button type="button" className="sync-inline-btn" onClick={handleReclassifyUncategorized}>未分類を再分類</button>
          <BackupRestore onRestore={() => void onRefresh()} />
        </section>

        <section className="settings-section-card">
          <h3>アプリ情報</h3>
          <p>すべてのデータはこの端末にのみ保存されています</p>
          <p>Storage: {storagePersisted === null ? '確認中' : storagePersisted ? '永続化済み' : '未永続化'}</p>
          <p>Version: {import.meta.env.VITE_APP_VERSION || 'dev'}</p>
        </section>
      </div>
    </div>
  );
}
