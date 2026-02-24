import { useState } from 'react';
import type { Budget, AppSettings } from '../api/client';
import {
  createBudget,
  deleteBudget,
  putSettings,
  type BudgetInput,
} from '../api/client';
import { CATEGORIES } from '../api/categorizer';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SettingsSheetProps {
  budgets: Budget[];
  settings: AppSettings;
  onClose: () => void;
  onRefresh: () => void;
  onOpenCsvImport: () => void;
  onOpenSankey: () => void;
  onSettingsChange: (s: AppSettings) => void;
}

// ─── Gmail section (stub — infrastructure not yet implemented) ─────────────────

function GmailSection() {
  return (
    <section className="settings-section">
      <h3 className="settings-section-title">Gmail 連携</h3>
      <div className="settings-row">
        <div>
          <p className="settings-row-label">Gmail アカウント</p>
          <p className="settings-row-sub text-muted text-sm">未接続</p>
        </div>
        <button className="btn btn-primary" disabled style={{ opacity: 0.5 }}>
          接続する
        </button>
      </div>
      <div className="settings-row" style={{ marginTop: 8 }}>
        <div>
          <p className="settings-row-label">手動同期</p>
          <p className="settings-row-sub text-muted text-sm">最終同期: —</p>
        </div>
        <button className="btn btn-secondary" disabled style={{ opacity: 0.5 }}>
          今すぐ同期
        </button>
      </div>
      <p className="settings-disclosure text-xs text-muted">
        Gmailの閲覧権限のみを使用します。メール送信・削除は一切行いません。
        同期処理は端末上でのみ実行され、サードパーティへのデータ送信は行いません。
      </p>
    </section>
  );
}

// ─── Monthly budget / metric settings ─────────────────────────────────────────

function MetricSection({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (s: AppSettings) => Promise<void>;
}) {
  const [budget, setBudget] = useState(settings['monthlyBudget'] ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onChange({ ...settings, monthlyBudget: budget });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-section">
      <h3 className="settings-section-title">月間予算</h3>
      <div className="form-group">
        <label className="form-label">月間予算 (円)</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="form-control"
            type="number"
            min="0"
            placeholder="例: 200000"
            value={budget}
            onChange={e => setBudget(e.target.value)}
          />
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ whiteSpace: 'nowrap' }}
          >
            {saving ? '保存中' : '保存'}
          </button>
        </div>
        <p className="text-xs text-muted" style={{ marginTop: 4 }}>
          ホーム画面「自由に使っていい残り」の計算に使用します
        </p>
      </div>
    </section>
  );
}

// ─── Category budget CRUD ─────────────────────────────────────────────────────

function BudgetSection({
  budgets,
  onRefresh,
}: {
  budgets: Budget[];
  onRefresh: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{ category: string; monthlyLimit: string }>({
    category: '',
    monthlyLimit: '',
  });
  const [saving, setSaving] = useState(false);

  const categoryList = Object.values(CATEGORIES).filter(c => c !== CATEGORIES.UNCATEGORIZED);

  async function handleAdd() {
    if (!form.category || !form.monthlyLimit) return;
    setSaving(true);
    try {
      const input: BudgetInput = {
        name: form.category,
        category: form.category,
        monthlyLimit: parseInt(form.monthlyLimit, 10),
      };
      await createBudget(input);
      setForm({ category: '', monthlyLimit: '' });
      setAdding(false);
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteBudget(id);
    onRefresh();
  }

  return (
    <section className="settings-section">
      <div className="section-hd">
        <h3 className="settings-section-title" style={{ margin: 0 }}>
          カテゴリ予算
        </h3>
        <button
          className="btn btn-ghost"
          onClick={() => setAdding(a => !a)}
        >
          {adding ? 'キャンセル' : '＋ 追加'}
        </button>
      </div>

      {adding && (
        <div className="card budget-add-form">
          <div className="form-group">
            <label className="form-label">カテゴリ *</label>
            <select
              className="form-control"
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            >
              <option value="">選択してください</option>
              {categoryList.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginTop: 8 }}>
            <label className="form-label">月間上限 (円) *</label>
            <input
              className="form-control"
              type="number"
              min="1"
              placeholder="例: 30000"
              value={form.monthlyLimit}
              onChange={e => setForm(f => ({ ...f, monthlyLimit: e.target.value }))}
            />
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: 12, width: '100%' }}
            onClick={handleAdd}
            disabled={saving || !form.category || !form.monthlyLimit}
          >
            {saving ? '保存中…' : '追加'}
          </button>
        </div>
      )}

      {budgets.length === 0 && !adding && (
        <p className="text-sm text-muted" style={{ marginTop: 8 }}>
          カテゴリ予算はまだありません
        </p>
      )}

      <div className="budget-list">
        {budgets.map(b => (
          <div key={b.id} className="budget-list-row">
            <div>
              <p className="fw-medium">{b.name || b.category}</p>
              <p className="text-sm text-sub">
                {b.category} · {b.monthlyLimit.toLocaleString('ja-JP')} 円/月
              </p>
            </div>
            <button
              className="btn btn-danger"
              onClick={() => handleDelete(b.id)}
              aria-label={`${b.name}を削除`}
            >
              削除
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Tools section ─────────────────────────────────────────────────────────────

function ToolsSection({
  onOpenCsvImport,
  onOpenSankey,
}: {
  onOpenCsvImport: () => void;
  onOpenSankey: () => void;
}) {
  return (
    <section className="settings-section">
      <h3 className="settings-section-title">ツール</h3>
      <div className="tools-list">
        <button
          className="settings-row settings-row-btn"
          onClick={onOpenCsvImport}
        >
          <div>
            <p className="settings-row-label">CSV 取り込み</p>
            <p className="settings-row-sub text-muted text-sm">
              銀行・カードの明細を読み込む
            </p>
          </div>
          <span className="settings-row-arrow">›</span>
        </button>
        <button
          className="settings-row settings-row-btn"
          onClick={onOpenSankey}
        >
          <div>
            <p className="settings-row-label">収支フロー図</p>
            <p className="settings-row-sub text-muted text-sm">
              サンキーダイアグラムで確認
            </p>
          </div>
          <span className="settings-row-arrow">›</span>
        </button>
      </div>
    </section>
  );
}

// ─── SettingsSheet ────────────────────────────────────────────────────────────

export function SettingsSheet({
  budgets,
  settings,
  onClose,
  onRefresh,
  onOpenCsvImport,
  onOpenSankey,
  onSettingsChange,
}: SettingsSheetProps) {
  async function handleSettingsSave(newSettings: AppSettings) {
    const saved = await putSettings(newSettings);
    onSettingsChange(saved);
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div
        className="settings-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="設定"
      >
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2 className="sheet-title">設定</h2>
          <button className="btn btn-ghost" onClick={onClose}>
            閉じる
          </button>
        </div>
        <div className="settings-sheet-body">
          <GmailSection />
          <MetricSection settings={settings} onChange={handleSettingsSave} />
          <BudgetSection budgets={budgets} onRefresh={onRefresh} />
          <ToolsSection
            onOpenCsvImport={onOpenCsvImport}
            onOpenSankey={onOpenSankey}
          />
          <section className="settings-section">
            <button
              className="btn btn-danger"
              style={{ width: '100%', opacity: 0.5 }}
              disabled
            >
              ログアウト（未実装）
            </button>
          </section>
        </div>
      </div>
    </>
  );
}
