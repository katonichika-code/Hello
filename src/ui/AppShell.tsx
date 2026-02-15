import { useState, useRef, useEffect, useCallback } from 'react';
import { getTransactions, getSettings, getBudgets, type Transaction } from '../db/repo';
import { ensureDefaults } from '../db/database';
import { currentMonth } from '../domain/computations';
import { HomeScreen } from './screens/HomeScreen';
import { SharedScreen } from './screens/SharedScreen';
import { AnalyticsScreen } from './screens/AnalyticsScreen';
import { OnboardingStepper } from './components/OnboardingStepper';
import { PageDots } from './components/PageDots';

const SCREEN_LABELS = ['共有', 'ホーム', '分析'] as const;
const HOME_INDEX = 1;

export function AppShell() {
  const [activeScreen, setActiveScreen] = useState(HOME_INDEX);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [storagePersisted, setStoragePersisted] = useState<boolean | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Check if onboarding is needed — user cannot derive value without essentials
  useEffect(() => {
    (async () => {
      try {
        await ensureDefaults();
        const month = currentMonth();
        const [settings, personalBudgets, sharedBudgets] = await Promise.all([
          getSettings(),
          getBudgets(month, 'personal'),
          getBudgets(month, 'shared'),
        ]);

        // Readable intent: each condition independently prevents meaningful usage
        const settingsIncomplete = settings.monthly_income <= 0;
        const hasPersonalBudgets = personalBudgets.some((b) => b.pinned === 1);
        const hasSharedBudgets = sharedBudgets.some((b) => b.pinned === 1);
        const noBudgetsAtAll = !hasPersonalBudgets && !hasSharedBudgets;

        // Trigger: settings missing OR no budgets in either wallet
        const needsOnboarding = settingsIncomplete || noBudgetsAtAll;
        setShowOnboarding(needsOnboarding);
      } catch {
        // Don't block app
      } finally {
        setOnboardingChecked(true);
      }
    })();
  }, []);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    fetchTransactions();
  };

  // Request persistent storage (iOS Safari evicts non-persistent IndexedDB)
  useEffect(() => {
    (async () => {
      if (navigator.storage?.persist) {
        const granted = await navigator.storage.persist();
        setStoragePersisted(granted);
        if (import.meta.env.DEV) {
          console.log(`[Kakeibo] storage.persist() → ${granted}`);
        }
      }
    })();
  }, []);

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

  // Generate month options (12 months back)
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    months.push(`${y}-${m}`);
  }

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="shell-header">
        <span className="screen-label">{SCREEN_LABELS[activeScreen]}</span>
        <select
          className="month-select"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        >
          {months.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </header>

      {/* Storage hint — only if persist denied and not installed as PWA */}
      {storagePersisted === false && !window.matchMedia('(display-mode: standalone)').matches && (
        <div className="persist-hint" onClick={() => setStoragePersisted(null)}>
          ホーム画面に追加するとデータが安全に保持されます
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
    </div>
  );
}
