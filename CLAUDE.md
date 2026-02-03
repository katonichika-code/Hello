# CLAUDE.md - AI Assistant Guidelines for Kakeibo

This file provides guidance for AI assistants working with this repository.

## Repository Overview

- **Repository**: Kakeibo (Personal Finance App)
- **Owner**: katonichika-code
- **Status**: MVP complete

## Project Structure

```
Hello/
├── src/                      # Frontend (React + TypeScript)
│   ├── api/
│   │   ├── client.ts         # API client for backend communication
│   │   └── csvParser.ts      # CSV format detection & parsing (A/B formats)
│   ├── components/
│   │   ├── CsvImport.tsx     # CSV file import with preflight preview
│   │   ├── ManualEntry.tsx   # Manual cash entry form
│   │   ├── MonthFilter.tsx   # Month selection filter
│   │   ├── SankeyDiagram.tsx # d3-sankey visualization
│   │   └── TransactionList.tsx # Transaction table with inline editing
│   ├── scripts/
│   │   └── csv-check.ts      # CSV parser verification script
│   ├── App.tsx               # Main application component
│   ├── App.css               # Application styles
│   ├── index.css             # Global styles
│   └── main.tsx              # Entry point
├── server/                   # Backend (Express + TypeScript)
│   ├── src/
│   │   ├── index.ts          # Express server with API endpoints
│   │   └── db.ts             # SQLite database setup and helpers
│   ├── scripts/
│   │   └── smoke-test.ts     # API smoke tests
│   ├── prisma/
│   │   └── dev.db            # SQLite database file (auto-created)
│   └── tsconfig.json         # TypeScript config for server
├── package.json              # Dependencies and scripts
├── vite.config.ts            # Vite configuration
├── tsconfig.json             # TypeScript config for frontend
├── README.md                 # User documentation
└── CLAUDE.md                 # AI assistant guidelines (this file)
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

# Run API smoke tests (requires API server running)
npm run smoke

# Run CSV parser verification
npm run csvcheck

# Build for production
npm run build
```

## Ports

- Frontend: http://localhost:5173
- API Server: http://localhost:8787

## Architecture

### Frontend
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **CSV Parsing**: Custom parser with encoding-japanese (Shift_JIS support)
- **Visualization**: d3-sankey

### Backend
- **Framework**: Express.js + TypeScript
- **Database**: SQLite via better-sqlite3
- **Runner**: tsx (TypeScript execution)

### Data Flow
1. Frontend sends requests to API at localhost:8787
2. API interacts with SQLite database
3. All data stored locally in `server/prisma/dev.db`

## Database Schema

**Transaction Table:**
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (cuid) |
| date | TEXT | YYYY-MM-DD format |
| amount | INTEGER | JPY, negative for expenses |
| category | TEXT | User-defined category |
| account | TEXT | "card" or "cash" |
| description | TEXT | Transaction description |
| hash | TEXT | Unique SHA-256 for deduplication |
| createdAt | TEXT | ISO timestamp |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| GET | /transactions | Get all (optional ?month=YYYY-MM) |
| POST | /transactions | Create single transaction |
| POST | /transactions/bulk | Bulk import transactions |
| PATCH | /transactions/:id | Update category only |

## AI Assistant Instructions

### When Modifying This Project

1. **Read existing code** before making changes
2. **Maintain the architecture**: Frontend calls API, API accesses DB
3. **Keep it simple**: This is an MVP, avoid over-engineering
4. **Test locally**: Always verify with `npm run dev`

### Key Conventions

- Expenses are stored as **negative** amounts
- Hash is SHA-256 of `date + positive_amount + description` (always use positive amount for hash)
- CSV imports use account "card", manual entries use "cash"
- Default category is "Uncategorized"
- Server imports use `.js` extension (NodeNext module resolution)

### CSV Import Formats

**Format A (Standard):**
- Header row: `date,amount,description`
- Date format: `YYYY-MM-DD`

**Format B (Japanese Bank/Card):**
- First row is metadata (customer info) - **NEVER store or display**
- Data rows from row 2: `YYYY/MM/DD,merchant,amount,...`
- Supports Shift_JIS/CP932 encoding

### Do's
- Follow existing code patterns
- Keep TypeScript types consistent
- Update README.md for user-facing changes
- Update CLAUDE.md for structural changes

### Don'ts
- Don't add cloud services or authentication
- Don't change the database schema without updating all related code
- Don't introduce new frameworks unnecessarily
- Don't remove the local-only architecture

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
