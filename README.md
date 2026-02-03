# Kakeibo - Personal Finance App

A local-only personal expense tracking application with CSV import and Sankey diagram visualization.

## Quick Start

### Requirements

- **Node.js 18+** (check with `node -v`)
- npm (comes with Node.js)

### Install & Run

```bash
# 1. Install dependencies
npm install

# 2. Start the app (frontend + API)
npm run dev
```

Open http://localhost:5173 in your browser.

### Verify Installation

Run the smoke test to verify the API is working:

```bash
# In a separate terminal (while npm run dev is running)
npm run smoke
```

Expected output:
```
✓ GET /health returns ok:true
✓ GET /transactions returns array
✓ POST /transactions creates transaction
...
Passed: 7, Failed: 0
```

## Features

- CSV import for card transactions (with duplicate detection)
- Manual cash expense entry
- Transaction list with inline category editing
- Month-based filtering
- Sankey diagram showing money flow (Account → Category)
- All data stored locally in SQLite

## CSV Formats

The app supports two CSV formats with automatic detection.

### Format A: Standard CSV

| Column | Format | Example |
|--------|--------|---------|
| date | YYYY-MM-DD | 2024-01-15 |
| amount | Positive integer | 1500 |
| description | Text | Grocery store |

**Example:**
```csv
date,amount,description
2024-01-15,1500,Grocery store
2024-01-16,800,Coffee shop
2024-01-17,3000,Restaurant
```

### Format B: Japanese Bank/Card CSV

Supports CSV exports from Japanese banks and credit card companies.

- **Encoding**: UTF-8 or Shift_JIS (CP932) - auto-detected
- **First row**: Metadata (customer info) - **automatically ignored, never stored**
- **Data rows**: 7 columns starting from row 2

| Column | Content | Example |
|--------|---------|---------|
| 1 | Date (YYYY/MM/DD) | 2025/12/01 |
| 2 | Merchant name | セブン－イレブン |
| 3 | Amount | 159 |
| 4-7 | Other fields | (ignored) |

**Example** (first row is metadata, masked for privacy):
```csv
CUSTOMER_NAME,****-****-****-1234,VISA
2025/12/01,セブン－イレブン,159,１,１,159,
2025/12/02,スターバックス,550,１,１,550,
2025/12/03,ローソン,298,１,１,298,
```

**Important notes:**
- The metadata row (customer name, card number) is **never stored or displayed**
- Amounts are converted to negative (expenses) automatically
- Duplicate detection uses SHA-256 hash of `date + amount + description`
- All imports are assigned account = "card", category = "Uncategorized"

### Preflight Preview

When you select a CSV file, the app shows:
1. Detected format (Standard or Japanese Bank/Card)
2. Number of transactions to import
3. Preview of first 3 transactions

Click "Import" to proceed or "Cancel" to select a different file.

## Usage

1. **Import CSV**: Click "Choose File" and select a CSV file
2. **Add Cash Entry**: Use the form on the left to add manual cash expenses
3. **Edit Categories**: Click any category in the table to edit inline
4. **Filter by Month**: Use the dropdown to filter transactions
5. **View Sankey**: The diagram updates automatically based on filtered data

## Troubleshooting

### Port already in use

If port 5173 or 8787 is in use:

```bash
# Find and kill process on port 8787 (API)
lsof -i :8787 | grep LISTEN | awk '{print $2}' | xargs kill

# Find and kill process on port 5173 (Frontend)
lsof -i :5173 | grep LISTEN | awk '{print $2}' | xargs kill
```

### API server not starting

Check for errors:
```bash
npm run dev:api
```

If you see database errors, delete and recreate:
```bash
rm -f server/prisma/dev.db server/prisma/dev.db-*
npm run dev:api
```

### TypeScript errors

Run type check:
```bash
npx tsc --noEmit
```

### CSV import not working

**For Format A (Standard):**
1. Header row with exact names: `date,amount,description`
2. Date format: `YYYY-MM-DD` (e.g., `2024-01-15`)
3. Amount: positive integer (no decimals, no currency symbols)

**For Format B (Japanese Bank):**
1. First row should be metadata (will be ignored)
2. Data rows start from row 2
3. Date format: `YYYY/MM/DD` in column 1
4. Merchant name in column 2
5. Amount in column 3

Run the CSV parser check to verify parsing logic:
```bash
npm run csvcheck
```

### Smoke test failing

Ensure the API server is running first:
```bash
# Terminal 1
npm run dev:api

# Terminal 2
npm run smoke
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both frontend and API |
| `npm run dev:web` | Start frontend only (port 5173) |
| `npm run dev:api` | Start API only (port 8787) |
| `npm run smoke` | Run API smoke tests |
| `npm run csvcheck` | Verify CSV parser (both formats) |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |

## Architecture

```
├── src/                      # Frontend (React + TypeScript + Vite)
│   ├── api/
│   │   ├── client.ts         # API client
│   │   └── csvParser.ts      # CSV format detection & parsing
│   ├── components/           # React components
│   ├── scripts/
│   │   └── csv-check.ts      # CSV parser verification
│   └── App.tsx               # Main app
├── server/                   # Backend (Express + TypeScript)
│   ├── src/
│   │   ├── index.ts          # API server
│   │   └── db.ts             # SQLite database
│   ├── scripts/
│   │   └── smoke-test.ts     # API smoke tests
│   └── prisma/
│       └── dev.db            # SQLite database file (auto-created)
└── package.json
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check → `{ ok: true }` |
| GET | /transactions | Get all (optional: `?month=YYYY-MM`) |
| POST | /transactions | Create single transaction |
| POST | /transactions/bulk | Bulk import → `{ inserted, skipped }` |
| PATCH | /transactions/:id | Update category only |

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, d3-sankey, PapaParse
- **Backend**: Node.js, Express 5, TypeScript, tsx
- **Database**: SQLite via better-sqlite3
