import { useState, useRef, useEffect, useCallback } from 'react';
import { getTransactions, getSettings, type Transaction } from '../db/repo';
import { db, ensureDefaults } from '../db/database';
import { currentMonth } from '../domain/computations';
import { HomeScreen } from './screens/HomeScreen';
import { SharedScreen } from './screens/SharedScreen';
import { AnalyticsScreen } from './screens/AnalyticsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { OnboardingStepper } from './components/OnboardingStepper';
import { PageDots } from './components/PageDots';

const SCREEN_LABELS = ['共有', 'ホーム', '分析'] as const;
const HOME_INDEX = 1;

function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split('-').map(Number);
  const d = new Date(year, mon - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string): string {
  return `${Number(month.split('-')[1])}月`;
}

export function AppShell() {
  const [activeScreen, setActiveScreen] = useState(HOME_INDEX);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [storagePersisted, setStoragePersisted] = useState<boolean | null>(null);
  const [persistHintDismissed, setPersistHintDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;

    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (isStandaloneMode) return true;

    return localStorage.getItem('pwa-banner-dismissed') === 'true';
  });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showSettingsScreen, setShowSettingsScreen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Check if onboarding is needed — user cannot derive value without essentials
  useEffect(() => {
    (async () => {
      try {
        await ensureDefaults();
        const [settings, pinnedBudgetCount] = await Promise.all([
          getSettings(),
          db.budgets.where('pinned').equals(1).count(),
        ]);

        // Readable intent: each condition independently prevents meaningful usage.
        // NOTE: onboarding should not depend on *current month* budgets only, otherwise
        // users re-enter onboarding every month rollover despite existing data.
        const settingsIncomplete = settings.monthly_income <= 0;
        const noBudgetsAtAll = pinnedBudgetCount === 0;

        // Trigger: settings missing OR no budgets in either wallet
        const needsOnboarding = settingsIncomplete || noBudgetsAtAll;
        setShowOnboarding(needsOnboarding);
      } catch (error) {
        console.error('[Onboarding] Failed to evaluate onboarding state', error);
        // Avoid false onboarding trigger when query fails transiently.
        setShowOnboarding(false);
      } finally {
        setOnboardingChecked(true);
      }
    })();
  }, []);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    fetchTransactions();
  };

  // Storage status hint (persist() request is performed during app bootstrap in main.tsx)
  useEffect(() => {
    (async () => {
      if (navigator.storage?.persisted) {
        const persisted = await navigator.storage.persisted();
        setStoragePersisted(persisted);
      }
    })();
  }, []);

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const shouldShowPersistHint = storagePersisted === false && !persistHintDismissed && !isStandalone;

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      await ensureDefaults(); // guarantee settings row exists on first load
      const data = await getTransactions(selectedMonth);
      setTransactions(data);
    } catch {
      // Silent fail for now — screens handle empty state
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Scroll to Home on mount
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      const screenWidth = el.offsetWidth;
      el.scrollLeft = HOME_INDEX * screenWidth;
    }
  }, []);

  // Track active screen from scroll position
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const screenWidth = el.offsetWidth;
          if (screenWidth > 0) {
            const index = Math.round(el.scrollLeft / screenWidth);
            setActiveScreen(index);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToScreen = (index: number) => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ left: index * el.offsetWidth, behavior: 'smooth' });
    }
  };

  const homeHeader = activeScreen === HOME_INDEX;

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="shell-header">
        <div className="header-main">
          {!homeHeader && <span className="screen-label">{SCREEN_LABELS[activeScreen]}</span>}
          <div className="month-nav" aria-label="月の切り替え">
            <button
              type="button"
              className="month-nav-btn"
              aria-label="前の月"
              onClick={() => setSelectedMonth((prev) => shiftMonth(prev, -1))}
            >
              ‹
            </button>
            <span className={`month-display ${homeHeader ? 'home' : ''}`}>{monthLabel(selectedMonth)}</span>
            <button
              type="button"
              className="month-nav-btn"
              aria-label="次の月"
              onClick={() => setSelectedMonth((prev) => shiftMonth(prev, 1))}
            >
              ›
            </button>
          </div>
        </div>
        {homeHeader && (
          <button
            className="settings-icon-btn"
            type="button"
            onClick={() => setShowSettingsScreen(true)}
            aria-label="設定を開く"
          >
            ⚙️
          </button>
        )}
      </header>

      {/* Storage hint — only if persist denied and not installed as PWA */}
      {shouldShowPersistHint && (
        <div className="persist-hint">
          ホーム画面に追加するとデータが安全に保持されます
          <button
            type="button"
            className="persist-hint-dismiss"
            aria-label="閉じる"
            onClick={() => {
              localStorage.setItem('pwa-banner-dismissed', 'true');
              setPersistHintDismissed(true);
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Screens */}
      <div className="screen-container" ref={scrollRef}>
        <div className="screen">
          <SharedScreen transactions={transactions} selectedMonth={selectedMonth} onRefresh={fetchTransactions} />
        </div>
        <div className="screen">
          <HomeScreen
            transactions={transactions}
            selectedMonth={selectedMonth}
            onRefresh={fetchTransactions}
          />
        </div>
        <div className="screen">
          <AnalyticsScreen
            transactions={transactions}
            onRefresh={fetchTransactions}
          />
        </div>
      </div>

      {/* Page dots */}
      <PageDots
        count={SCREEN_LABELS.length}
        active={activeScreen}
        onSelect={scrollToScreen}
      />

      {/* Loading indicator */}
      {loading && <div className="loading-bar" />}

      {/* Onboarding stepper */}
      {onboardingChecked && showOnboarding && (
        <OnboardingStepper onComplete={handleOnboardingComplete} />
      )}

      {showSettingsScreen && (
        <SettingsScreen
          onClose={() => setShowSettingsScreen(false)}
          onRefresh={fetchTransactions}
          onGoAnalytics={() => {
            setShowSettingsScreen(false);
            scrollToScreen(2);
          }}
        />
      )}
    </div>
  );
}
