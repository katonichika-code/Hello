import { useState } from 'react';
import { requestAccessToken, syncGmail, type SyncResult } from '../../api/gmailSync';
import { updateSettings } from '../../db/repo';

interface OnboardingModalProps {
  onComplete: () => void;
}

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [fixedCostTotal, setFixedCostTotal] = useState('');
  const [monthlySavingsTarget, setMonthlySavingsTarget] = useState('');
  const [savingStep1, setSavingStep1] = useState(false);
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [gmailResult, setGmailResult] = useState<SyncResult | null>(null);
  const [gmailError, setGmailError] = useState('');

  const income = parseInt(monthlyIncome, 10) || 0;
  const fixed = parseInt(fixedCostTotal, 10) || 0;
  const savings = parseInt(monthlySavingsTarget, 10) || 0;
  const available = income - fixed - savings;

  const completeOnboarding = () => {
    localStorage.setItem('onboarding_completed', 'true');
    onComplete();
  };

  const handleSaveStep1 = async () => {
    setSavingStep1(true);
    try {
      await updateSettings({
        monthly_income: income,
        fixed_cost_total: fixed,
        monthly_savings_target: savings,
      });
      setStep(1);
    } finally {
      setSavingStep1(false);
    }
  };

  const handleConnectGmail = async () => {
    setGmailSyncing(true);
    setGmailError('');
    try {
      await requestAccessToken();
      const result = await syncGmail();
      setGmailResult(result);
      setStep(2);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gmail連携に失敗しました';
      setGmailError(message);
    } finally {
      setGmailSyncing(false);
    }
  };

  return (
    <div className="onboarding-modal" role="dialog" aria-modal="true" aria-label="初期設定">
      {step === 0 && (
        <div className="onboarding-step">
          <div className="onboarding-icon" aria-hidden>💰</div>
          <h2 className="onboarding-title">月収と固定費を教えてください</h2>

          <div className="onboarding-input-group">
            <label className="onboarding-label" htmlFor="monthly-income">月収（手取り）</label>
            <input
              id="monthly-income"
              className="onboarding-input"
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={monthlyIncome}
              onChange={(e) => setMonthlyIncome(e.target.value)}
            />
          </div>

          <div className="onboarding-input-group">
            <label className="onboarding-label" htmlFor="fixed-cost-total">固定費の合計（家賃・光熱費など）</label>
            <input
              id="fixed-cost-total"
              className="onboarding-input"
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={fixedCostTotal}
              onChange={(e) => setFixedCostTotal(e.target.value)}
            />
          </div>

          <div className="onboarding-input-group">
            <label className="onboarding-label" htmlFor="savings-target">毎月の貯蓄目標</label>
            <input
              id="savings-target"
              className="onboarding-input"
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={monthlySavingsTarget}
              onChange={(e) => setMonthlySavingsTarget(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="onboarding-btn-primary"
            onClick={handleSaveStep1}
            disabled={income <= 0 || savingStep1}
          >
            {savingStep1 ? '保存中…' : '次へ →'}
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="onboarding-step">
          <div className="onboarding-icon" aria-hidden>📧</div>
          <h2 className="onboarding-title">カード利用通知を自動取り込み</h2>
          <p className="onboarding-copy">
            SMBCカードのVpass通知メールを
            <br />
            読み取って、支出を自動記録します。
          </p>
          <p className="onboarding-copy">
            • 読み取り専用（メールの変更なし）
            <br />
            • データはこの端末にのみ保存
          </p>

          <button type="button" className="onboarding-btn-primary" onClick={handleConnectGmail} disabled={gmailSyncing}>
            {gmailSyncing ? '接続中…' : 'Gmailを接続する'}
          </button>
          <button type="button" className="onboarding-btn-skip" onClick={() => setStep(2)}>
            あとで設定する
          </button>
          {gmailError && <p className="onboarding-error">{gmailError}</p>}
        </div>
      )}

      {step === 2 && (
        <div className="onboarding-step">
          <div className="onboarding-icon" aria-hidden>✅</div>
          <h2 className="onboarding-title">準備ができました！</h2>
          <p className="onboarding-summary-main">使える残り</p>
          <p className="onboarding-summary-amount">¥ {available.toLocaleString('ja-JP')}</p>
          <p className="onboarding-copy">
            月収 ¥{income.toLocaleString('ja-JP')}
            <br />
            − 固定費 ¥{fixed.toLocaleString('ja-JP')}
            <br />
            − 貯蓄 ¥{savings.toLocaleString('ja-JP')}
            <br />
            = 使える額 ¥{available.toLocaleString('ja-JP')}
          </p>
          {gmailResult && (
            <p className="onboarding-copy">
              Gmail connected: {gmailResult.newTransactions}件の取引を取り込みました
            </p>
          )}
          <button type="button" className="onboarding-btn-primary" onClick={completeOnboarding}>
            はじめる
          </button>
        </div>
      )}

      <div className="onboarding-dots" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className={`onboarding-dot ${step === i ? 'active' : ''}`} />
        ))}
      </div>
    </div>
  );
}
