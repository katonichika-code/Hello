# Kakeibo - Personal Finance App

A local-only personal expense tracking application with CSV import and Sankey diagram visualization.

## Features

- CSV import for card transactions
- Manual cash expense entry
- Transaction list with inline category editing
- Month-based filtering
- Sankey diagram showing money flow (Account -> Category)
- All data stored locally in SQLite

## Requirements

- Node.js 18+
- npm

## Installation

```bash
npm install
```

## Running the App

```bash
npm run dev
```

This starts both:
- **Frontend**: http://localhost:5173
- **API Server**: http://localhost:8787

## CSV Format

The app accepts CSV files with these columns:

| Column | Format | Description |
|--------|--------|-------------|
| date | YYYY-MM-DD | Transaction date |
| amount | Integer | Expense amount (positive number) |
| description | Text | Transaction description |

Example CSV:
```csv
date,amount,description
2024-01-15,1500,Grocery store
2024-01-16,800,Coffee shop
2024-01-17,3000,Restaurant
```

## Usage

1. **Import CSV**: Click "Choose File" in the Import CSV section and select a CSV file
2. **Add Manual Entry**: Fill out the form to add cash expenses
3. **Edit Categories**: Click on any category in the transaction list to edit it
4. **Filter by Month**: Use the dropdown to filter transactions by month
5. **View Sankey**: The diagram shows money flow from accounts to categories

## Architecture

```
├── src/                    # Frontend (React + TypeScript)
│   ├── api/client.ts       # API client
│   ├── components/         # React components
│   └── App.tsx             # Main app
├── server/                 # Backend (Express + TypeScript)
│   ├── src/
│   │   ├── index.ts        # API server
│   │   └── db.ts           # SQLite database
│   └── prisma/
│       └── dev.db          # SQLite database file
└── package.json
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| GET | /transactions | Get all transactions (optional: ?month=YYYY-MM) |
| POST | /transactions | Create single transaction |
| POST | /transactions/bulk | Bulk create transactions |
| PATCH | /transactions/:id | Update transaction category |

## Tech Stack

- **Frontend**: React, TypeScript, Vite, d3-sankey, PapaParse
- **Backend**: Node.js, Express, TypeScript
- **Database**: SQLite (via better-sqlite3)
