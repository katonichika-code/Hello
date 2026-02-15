import { useState, useRef } from 'react';
import { db } from '../db/database';
import type { DbTransaction, DbSettings, DbBudget, DbMerchantMapping } from '../db/database';

interface BackupData {
  version: number;
  exportedAt: string;
  transactions: DbTransaction[];
  settings: DbSettings[];
  budgets: DbBudget[];
  merchant_map: DbMerchantMapping[];
}

interface BackupRestoreProps {
  onRestore: () => void;
}

export function BackupRestore({ onRestore }: BackupRestoreProps) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      const [transactions, settings, budgets, merchantMap] = await Promise.all([
        db.transactions.toArray(),
        db.settings.toArray(),
        db.budgets.toArray(),
        db.merchant_map.toArray(),
      ]);

      const backup: BackupData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        transactions,
        settings,
        budgets,
        merchant_map: merchantMap,
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kakeibo-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setStatus({ type: 'ok', msg: `${transactions.length}件の取引をエクスポートしました` });
    } catch (err) {
      setStatus({ type: 'err', msg: err instanceof Error ? err.message : 'エクスポート失敗' });
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setStatus(null);

    try {
      const text = await file.text();
      let data: BackupData;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('JSONの形式が不正です');
      }

      // Basic structure validation
      if (!data.version || !Array.isArray(data.transactions)) {
        throw new Error('バックアップファイルの形式が不正です');
      }

      // Validate transaction fields
      for (const t of data.transactions) {
        if (!t.id || !t.date || typeof t.amount !== 'number' || !t.hash) {
          throw new Error(`不正な取引データがあります (id: ${t.id || 'missing'})`);
        }
      }

      // Import settings (overwrite)
      if (Array.isArray(data.settings) && data.settings.length > 0) {
        await db.settings.put(data.settings[0]);
      }

      // Import budgets (clear + replace)
      if (Array.isArray(data.budgets) && data.budgets.length > 0) {
        await db.budgets.clear();
        await db.budgets.bulkAdd(data.budgets);
      }

      // Import merchant_map (clear + replace)
      if (Array.isArray(data.merchant_map) && data.merchant_map.length > 0) {
        await db.merchant_map.clear();
        await db.merchant_map.bulkAdd(data.merchant_map);
      }

      // Import transactions (dedup by hash)
      let imported = 0;
      let skipped = 0;
      if (data.transactions.length > 0) {
        const existingHashes = new Set(
          (await db.transactions.orderBy('hash').keys()) as string[],
        );

        const toInsert: DbTransaction[] = [];
        for (const t of data.transactions) {
          if (existingHashes.has(t.hash)) {
            skipped++;
          } else {
            existingHashes.add(t.hash);
            // Ensure monthKey is present
            toInsert.push({ ...t, monthKey: t.monthKey || t.date.slice(0, 7) });
            imported++;
          }
        }

        if (toInsert.length > 0) {
          await db.transactions.bulkAdd(toInsert);
        }
      }

      setStatus({
        type: 'ok',
        msg: `復元完了: 取引 ${imported}件追加, ${skipped}件スキップ (重複)`,
      });
      onRestore();
    } catch (err) {
      setStatus({ type: 'err', msg: err instanceof Error ? err.message : '復元失敗' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (!expanded) {
    return (
      <div className="backup-section">
        <button className="btn-backup-toggle" onClick={() => setExpanded(true)}>
          Advanced / Backup
        </button>
      </div>
    );
  }

  return (
    <div className="backup-section backup-expanded">
      <h4>
        Backup
        <button className="btn-backup-close" onClick={() => { setExpanded(false); setStatus(null); }}>
          &times;
        </button>
      </h4>

      <div className="backup-actions">
        <button className="btn-export" onClick={handleExport}>
          JSON エクスポート
        </button>

        <label className="btn-import">
          JSON インポート
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
            }}
            disabled={importing}
          />
        </label>
      </div>

      {importing && <p className="backup-status">読み込み中...</p>}
      {status && (
        <p className={`backup-status ${status.type === 'err' ? 'error' : 'success'}`}>
          {status.msg}
        </p>
      )}
    </div>
  );
}
