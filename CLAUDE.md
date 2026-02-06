# CLAUDE.md - AI Assistant Guidelines for Kakeibo

This file provides guidance for AI assistants working with this repository.

## Repository Overview

- **Repository**: Kakeibo (Personal Finance App)
- **Owner**: katonichika-code
- **Status**: MVP complete
- **Language**: Japanese UI with English developer documentation

## Project Structure

```
Hello/
├── src/                        # Frontend (React + TypeScript)
│   ├── api/
│   │   ├── client.ts           # API client for backend communication
│   │   ├── csvParser.ts        # CSV format detection & parsing (A/B formats)
│   │   └── categorizer.ts      # Rule-based auto-categorizer (1000+ keywords)
│   ├── components/
│   │   ├── CsvImport.tsx       # CSV file import with preflight preview
│   │   ├── ManualEntry.tsx     # Manual cash entry form
│   │   ├── MonthFilter.tsx     # Month selection filter
│   │   ├── SankeyDiagram.tsx   # d3-sankey visualization
│   │   └── TransactionList.tsx # Transaction table with inline editing
│   ├── scripts/
│   │   ├── csv-check.ts        # CSV parser verification script
│   │   └── rule-eval.ts        # Categorization rule evaluation & coverage
│   ├── App.tsx                 # Main application component
│   ├── App.css                 # Application styles
│   ├── index.css               # Global styles
│   └── main.tsx                # Entry point
├── server/                     # Backend (Express + TypeScript)
│   ├── src/
│   │   ├── index.ts            # Express server with API endpoints
│   │   └── db.ts               # SQLite database setup and helpers
│   ├── scripts/
│   │   └── smoke-test.ts       # API smoke tests
│   ├── prisma/
│   │   ├── schema.prisma       # Prisma schema (declared, not actively used)
│   │   └── dev.db              # SQLite database file (auto-created)
│   └── tsconfig.json           # TypeScript config for server
├── package.json                # Dependencies and scripts
├── vite.config.ts              # Vite configuration
├── index.html                  # HTML entry point
├── tsconfig.json               # Root TypeScript config (references app/node)
├── tsconfig.app.json           # TypeScript config for frontend source
├── tsconfig.node.json          # TypeScript config for Vite/build tools
├── eslint.config.js            # ESLint flat config
├── README.md                   # User documentation
└── CLAUDE.md                   # AI assistant guidelines (this file)
```

## Quick Commands

```bash
# Install dependencies
npm install

# Run both frontend and backend
npm run dev

# Run frontend only
npm run dev:web

# Run backend only
npm run dev:api

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Run API smoke tests (requires API server running on port 8787)
npm run smoke

# Run CSV parser verification
npm run csvcheck

# Run categorization rule evaluation (requires a CSV file)
npm run ruleeval -- --file <path-to-csv>

# Build for production
npm run build
```

## Ports

- Frontend: http://localhost:5173
- API Server: http://localhost:8787

## Architecture

### Frontend
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **State Management**: React hooks (no external state library)
- **CSV Parsing**: Custom parser using papaparse + encoding-japanese (Shift_JIS support)
- **Categorization**: Rule-based engine with 1000+ Japanese merchant keywords
- **Visualization**: d3-sankey for account→category flow diagrams
- **Styling**: Plain CSS (no CSS-in-JS or utility frameworks), responsive via flexbox + media queries

### Backend
- **Framework**: Express 5 + TypeScript
- **Database**: SQLite via better-sqlite3 (WAL mode enabled)
- **Runner**: tsx (TypeScript execution with watch mode in dev)
- **ID Generation**: Custom cuid-like format (`c<timestamp><random>`)

### Data Flow
1. Frontend sends requests to API at localhost:8787
2. API interacts with SQLite database at `server/prisma/dev.db`
3. All data stored locally — no cloud services

## Database Schema

**Transaction Table:**
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (cuid-like) |
| date | TEXT | YYYY-MM-DD format |
| amount | INTEGER | JPY, negative for expenses |
| category | TEXT | User-defined or auto-categorized |
| account | TEXT | "card" or "cash" |
| description | TEXT | Transaction description |
| hash | TEXT | Unique SHA-256 for deduplication |
| createdAt | TEXT | ISO timestamp (default: now) |

**Indexes:**
- `idx_transactions_date` on `date` column (for month filtering)

## API Endpoints

| Method | Endpoint | Description | Key Behavior |
|--------|----------|-------------|--------------|
| GET | /health | Health check | Returns `{ok: true}` |
| GET | /transactions | Get all (optional `?month=YYYY-MM`) | Returns `Transaction[]` |
| POST | /transactions | Create single transaction | Returns 409 on duplicate hash |
| POST | /transactions/bulk | Bulk import transactions | Returns `{inserted, skipped}` counts |
| PATCH | /transactions/:id | Update category only | Returns 404 if not found |

## Categorization System

The auto-categorizer (`src/api/categorizer.ts`) assigns categories to transactions based on merchant description matching.

**Categories (8 fixed):**
- 食費 (Food), 交通費 (Transport), 日用品 (Daily necessities), 娯楽 (Entertainment)
- サブスク (Subscriptions), 医療 (Medical), その他 (Other), 未分類 (Uncategorized)

**How it works:**
1. `normalize(text)` converts full-width to half-width, trims, and folds case
2. Rules match via keyword arrays and regex patterns
3. First matching rule wins; fallback is 未分類 (Uncategorized)
4. Department stores are **intentionally excluded** (ambiguous purchases)

**Used in:**
- CSV import preflight (predicted categories shown before import)
- Manual entry (category suggestion from description)
- Rule evaluation script for coverage analysis

## Testing

There is no formal test runner (no Jest/Vitest). Testing is done via custom scripts:

| Script | Command | Requires |
|--------|---------|----------|
| API smoke tests | `npm run smoke` | API server running on port 8787 |
| CSV parser verification | `npm run csvcheck` | Nothing (self-contained) |
| Rule evaluation | `npm run ruleeval -- --file <csv>` | A CSV file to analyze |

The smoke test suite covers: health check, CRUD operations, bulk import, duplicate detection, and month filtering.

## AI Assistant Instructions

### When Modifying This Project

1. **Read existing code** before making changes
2. **Maintain the architecture**: Frontend calls API, API accesses DB
3. **Keep it simple**: This is an MVP, avoid over-engineering
4. **Type check**: Run `npx tsc --noEmit` after changes
5. **Smoke test**: Run `npm run smoke` (with API running) to verify API changes

### Key Conventions

- Expenses are stored as **negative** amounts
- Hash is SHA-256 of `date + positive_amount + description` (always use positive amount for hash)
- CSV imports use account `"card"`, manual entries use `"cash"`
- Default category is `"Uncategorized"` (English) — the Japanese UI displays 未分類
- Server imports use `.js` extension (NodeNext module resolution)
- UI labels are in Japanese (e.g., "カード" for card, "現金" for cash)
- Uncategorized transactions are visually highlighted in yellow/gold in the UI
- Color coding: red for expenses, green for income

### CSV Import Formats

**Format A (Standard):**
- Header row: `date,amount,description`
- Date format: `YYYY-MM-DD`

**Format B (Japanese Bank/Card):**
- First row is metadata (customer info) — **NEVER store or display**
- Data rows from row 2: `YYYY/MM/DD,merchant,amount,...`
- Amount column is position 3 or 6
- Supports Shift_JIS/CP932 encoding (auto-detected)

### Do's
- Follow existing code patterns
- Keep TypeScript types consistent
- Update README.md for user-facing changes
- Update CLAUDE.md for structural changes
- Run `npx tsc --noEmit` to verify type safety

### Don'ts
- Don't add cloud services or authentication
- Don't change the database schema without updating all related code
- Don't introduce new frameworks unnecessarily
- Don't remove the local-only architecture
- Don't categorize department store transactions (intentional design decision)

## Troubleshooting

### API not responding
Check if port 8787 is in use:
```bash
lsof -i :8787
```

### Database issues
Delete and recreate:
```bash
rm server/prisma/dev.db
npm run dev:api  # Will recreate on startup
```

### TypeScript errors
```bash
npx tsc --noEmit
```

### Lint errors
```bash
npm run lint
```
