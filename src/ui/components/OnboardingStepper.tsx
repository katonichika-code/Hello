import { useState } from 'react';
import { updateSettings, createBudget } from '../../db/repo';
import { getAllCategories } from '../../api/categorizer';

interface OnboardingStepperProps {
  onComplete: () => void;
}

const BUDGET_CATEGORIES = getAllCategories().filter((c) => c !== '未分類');

const DEFAULT_LIMITS: Record<string, number> = {
  '食費': 30000,
  '交通費': 10000,
  '日用品': 10000,
  '娯楽': 15000,
  'サブスク': 5000,
  '医療': 5000,
  'その他': 10000,
};

export function OnboardingStepper({ onComplete }: OnboardingStepperProps) {
  const [step, setStep] = useState(0);

  // Step 1: settings
  const [income, setIncome] = useState('');
  const [fixed, setFixed] = useState('');
  const [savings, setSavings] = useState('');

  // Step 2: personal budgets
  const [personalCats, setPersonalCats] = useState<Set<string>>(new Set());
  const [personalLimits, setPersonalLimits] = useState<Record<string, string>>({});

  // Step 3: shared budgets
  const [sharedCats, setSharedCats] = useState<Set<string>>(new Set());
  const [sharedLimits, setSharedLimits] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);

  const toggleCat = (set: Set<string>, cat: string) => {
    const next = new Set(set);
    if (next.has(cat)) next.delete(cat); else next.add(cat);
    return next;
  };

  const handleFinish = async (action: 'csv' | 'manual') => {
    setSaving(true);
    try {
      // Save settings
      await updateSettings({
        monthly_income: parseInt(income) || 0,
        fixed_cost_total: parseInt(fixed) || 0,
        monthly_savings_target: parseInt(savings) || 0,
      });

      // Save personal budgets
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      let order = 0;
      for (const cat of personalCats) {
        await createBudget({
          month,
          category: cat,
          limit_amount: parseInt(personalLimits[cat]) || DEFAULT_LIMITS[cat] || 10000,
          pinned: 1,
          display_order: order++,
          wallet: 'personal',
        });
      }

      // Save shared budgets
      order = 0;
      for (const cat of sharedCats) {
        await createBudget({
          month,
          category: cat,
          limit_amount: parseInt(sharedLimits[cat]) || DEFAULT_LIMITS[cat] || 10000,
          pinned: 1,
          display_order: order++,
          wallet: 'shared',
        });
      }

      onComplete();

      // If CSV, scroll to analytics (index 2) after a tick
      if (action === 'csv') {
        setTimeout(() => {
          const container = document.querySelector('.screen-container');
          if (container) {
            container.scrollTo({ left: container.clientWidth * 2, behavior: 'smooth' });
          }
        }, 100);
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const canAdvanceStep1 = parseInt(income) > 0;

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal">
        {/* Progress */}
        <div className="onboarding-progress">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`onboarding-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} />
          ))}
        </div>

        {/* Step 1: Settings */}
        {step === 0 && (
          <div className="onboarding-step">
            <h2>はじめに</h2>
            <p className="onboarding-desc">月次の基本情報を設定しましょう</p>
            <label className="onboarding-field">
              <span>月収 (円)</span>
              <input
                type="number" inputMode="numeric" placeholder="300000"
                value={income} onChange={(e) => setIncome(e.target.value)}
              />
            </label>
            <label className="onboarding-field">
              <span>固定費 合計 (円)</span>
              <input
                type="number" inputMode="numeric" placeholder="100000"
                value={fixed} onChange={(e) => setFixed(e.target.value)}
              />
            </label>
            <label className="onboarding-field">
              <span>貯蓄目標 (円)</span>
              <input
                type="number" inputMode="numeric" placeholder="50000"
                value={savings} onChange={(e) => setSavings(e.target.value)}
              />
            </label>
            <button
              className="onboarding-next"
              disabled={!canAdvanceStep1}
              onClick={() => setStep(1)}
            >
              次へ
            </button>
          </div>
        )}

        {/* Step 2: Personal budgets */}
        {step === 1 && (
          <div className="onboarding-step">
            <h2>個人の予算</h2>
            <p className="onboarding-desc">ホーム画面に表示するカテゴリを選択</p>
            <div className="onboarding-cats">
              {BUDGET_CATEGORIES.map((c) => (
                <div key={c} className={`onboarding-cat-row ${personalCats.has(c) ? 'selected' : ''}`}>
                  <button
                    className={`onboarding-cat-btn ${personalCats.has(c) ? 'selected' : ''}`}
                    onClick={() => setPersonalCats(toggleCat(personalCats, c))}
                  >
                    {c}
                  </button>
                  {personalCats.has(c) && (
                    <input
                      type="number" inputMode="numeric"
                      className="onboarding-limit-input"
                      placeholder={String(DEFAULT_LIMITS[c] || 10000)}
                      value={personalLimits[c] || ''}
                      onChange={(e) => setPersonalLimits({ ...personalLimits, [c]: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="onboarding-nav">
              <button className="onboarding-back" onClick={() => setStep(0)}>戻る</button>
              <button className="onboarding-next" onClick={() => setStep(2)}>次へ</button>
            </div>
          </div>
        )}

        {/* Step 3: Shared budgets */}
        {step === 2 && (
          <div className="onboarding-step">
            <h2>共有の予算</h2>
            <p className="onboarding-desc">パートナーとの共有カテゴリを選択</p>
            <div className="onboarding-cats">
              {BUDGET_CATEGORIES.map((c) => (
                <div key={c} className={`onboarding-cat-row ${sharedCats.has(c) ? 'selected' : ''}`}>
                  <button
                    className={`onboarding-cat-btn ${sharedCats.has(c) ? 'selected' : ''}`}
                    onClick={() => setSharedCats(toggleCat(sharedCats, c))}
                  >
                    {c}
                  </button>
                  {sharedCats.has(c) && (
                    <input
                      type="number" inputMode="numeric"
                      className="onboarding-limit-input"
                      placeholder={String(DEFAULT_LIMITS[c] || 10000)}
                      value={sharedLimits[c] || ''}
                      onChange={(e) => setSharedLimits({ ...sharedLimits, [c]: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="onboarding-nav">
              <button className="onboarding-back" onClick={() => setStep(1)}>戻る</button>
              <button className="onboarding-next" onClick={() => setStep(3)}>次へ</button>
            </div>
          </div>
        )}

        {/* Step 4: Action prompt */}
        {step === 3 && (
          <div className="onboarding-step">
            <h2>準備完了</h2>
            <p className="onboarding-desc">さっそく始めましょう</p>
            <div className="onboarding-actions">
              <button
                className="onboarding-action-btn primary"
                disabled={saving}
                onClick={() => handleFinish('manual')}
              >
                支出を追加する
              </button>
              <button
                className="onboarding-action-btn secondary"
                disabled={saving}
                onClick={() => handleFinish('csv')}
              >
                CSVをインポート
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
