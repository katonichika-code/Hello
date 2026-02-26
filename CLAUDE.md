# CLAUDE.md — Kakeibo AI Assistant Guidelines

## What This App Is

**Kakeibo** is a personal finance PWA that answers one question: "How much can I freely spend this month?"

It bridges the gap between card usage and statement confirmation by pulling SMBC Vpass email notifications via Gmail API, giving near-real-time spend tracking without manual entry.

## Architecture: Fully Serverless

```
iPhone Safari (HTTPS)
  ├── React 19 + Vite 7 + TypeScript
  ├── Dexie 4 / IndexedDB (all data in browser)
  ├── Google Identity Services (OAuth, browser-only)
  ├── Gmail API (direct from browser)
  └── Static hosting (Cloudflare Pages / Vercel)
```

**There is no server.** No Express, no SQLite, no backend. All data lives in the browser's IndexedDB via Dexie. OAuth tokens are held in memory only (not persisted). This means zero hosting cost, zero ops burden, full offline support.

## Project Structure

```
src/
  domain/           # Pure functions — NO React, NO DB, NO IO
    computations.ts # Definition A, category breakdown, projections
    types.ts        # Domain types (Settings, Budget, Transaction, etc.)
  db/               # Dexie/IndexedDB persistence
    database.ts     # Schema (v4: transactions, settings, budgets, merchant_map, gmail_sync)
    repo.ts         # CRUD operations (replaces old HTTP client)
  api/              # Categorization, parsing, external integrations
    categorizer.ts  # Rule-based auto-categorizer (1000+ Japanese keywords)
    categorizationAdapter.ts  # 3-layer: learned → rule → fallback
    merchantKey.ts  # Stable merchant key derivation
    csvParser.ts    # CSV import (Shift_JIS/UTF-8, SMBC format)
    gmailSync.ts    # [Phase 1] GIS OAuth + Gmail API + SMBC parser
  ui/               # App shell and screens
    AppShell.tsx    # 3-screen horizontal swipe (Shared / Home / Analytics)
    screens/        # HomeScreen, SharedScreen, AnalyticsScreen
    components/     # RemainingCard, BudgetCard, QuickEntry, ProjectionCard, etc.
  components/       # Shared components
    SankeyDiagram.tsx, CsvImport.tsx, TransactionList.tsx, etc.
  scripts/          # Dev tools (csv-check, domain-test, rule-eval)
public/             # PWA assets (manifest, service worker, icons)
```

## Quick Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (Vite, port 5173)
npm run dev:lan      # Dev server accessible on LAN (for iPhone testing)
npm run build        # Type-check + production build
npm run lint         # ESLint
npm run test:domain  # Domain computation tests
npm run csvcheck     # CSV parser verification
npm run ruleeval -- --file <csv>  # Categorization coverage analysis
```

## Core Formula (Definition A)

```
Remaining Free-to-Spend =
  monthly_income − fixed_cost_total − monthly_savings_target − SUM(month expenses)
```

This is THE number. Everything in the app serves this calculation.

## Key Conventions

- Expenses are **negative** amounts, income is **positive**
- Hash = SHA-256 of `date + amount + description` (for dedup)
- CSV imports: account = "card"; manual entries: account = "cash"; Gmail: source = "gmail"
- `isPending = 1` for unconfirmed transactions (Gmail notifications)
- Wallet: "personal" (default) or "shared" (couple shared expenses)
- Categories are Japanese: 食費, 交通費, 日用品, 娯楽, サブスク, 医療, その他, 未分類
- UI labels are in Japanese; dev docs in English

## Database (Dexie v4)

Tables: `transactions`, `settings`, `budgets`, `merchant_map`, `gmail_sync`

Key indexes on transactions: `monthKey`, `[monthKey+wallet]`, `&hash` (unique), `isPending`

## Do's

- Keep domain logic pure (no React, no DB imports in computations.ts)
- Run `npm run build` before committing (catches type errors)
- Keep UI mobile-first (iPhone Safari is the primary target)
- Test with `npm run test:domain` after changing computations
- Respect the 3-layer categorization: learned → rule → fallback

## Don'ts

- Don't add a server/backend — this is intentionally serverless
- Don't store OAuth tokens in IndexedDB (memory only)
- Don't break the Definition A formula
- Don't put admin/management UI on the Home screen (it's value-first)
- Don't categorize department stores (intentionally excluded — ambiguous)

## Roadmap Status

- [x] Phase 0: Branch cleanup, dead code removal, Dexie v4 schema
- [ ] Phase 1: Gmail sync (GIS + Gmail API + SMBC parser)
- [ ] Phase 2: UI/UX redesign (Airbnb-like)
- [ ] Phase 3: Visualization (plan vs actual, asset projection charts)
- [ ] Phase 4: PWA deploy + quality gates
