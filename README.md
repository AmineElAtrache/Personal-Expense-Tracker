# Personal Expense Tracker

A full-stack web application for tracking personal expenses with offline capabilities.

<img width="1882" height="1043" alt="image" src="https://github.com/user-attachments/assets/dc5208d5-55e5-4e51-ac81-a2a27b0ffd2a" />


## Features

- Add, edit, delete expenses
- Categorize expenses (Food, Transport, Rent, Entertainment, Other)
- View daily, weekly, monthly summaries
- Offline-first design with IndexedDB storage
- Automatic sync when online
- Visual indicators for online/offline status
- Charts for spending by category

# Personal Expense Tracker

This repository contains a small personal expense tracker web app with offline-first behavior. It lets you add, edit, delete, and categorize expenses, view daily/weekly/monthly summaries, and keeps working while offline by using IndexedDB. When network access is restored the app attempts to sync local changes with a simple backend API.

## Quick features checklist

- [x] Add / Edit / Delete expenses
- [x] Categorize expenses (Food, Transport, Rent, Entertainment, Other)
- [x] Daily / Weekly / Monthly summaries
- [x] Offline-first storage (IndexedDB via `idb`)
- [x] Automatic sync when back online (basic POST/PUT/DELETE sync)
- [x] Pending-sync badge for local-only items
- [x] Spending chart (Chart.js)
- [ ] Authentication (future)
- [ ] Conflict resolution / merge strategy (future)

## Tech stack

- Frontend: React + Vite
- Charts: Chart.js (via `react-chartjs-2`)
- Local storage: IndexedDB (via `idb`)
- Backend: Node.js + Express (simple in-memory server for demo)

## Getting started (PowerShell)

1. Install dependencies

```powershell
npm install
```

2. Start the backend server (runs on http://localhost:3001)

```powershell
node server.js
```

3. In a second terminal, start the frontend dev server

```powershell
npm run dev
```

Notes:
- If you prefer to build a production bundle: `npm run build` then serve the `dist/` folder with a static server or integrate with `server.js`.

## How the app works

- Local storage: `src/db.js` contains small helper functions (initDB, addExpense, getExpenses, updateExpense, deleteExpense) built on top of `idb`. The app keeps a `synced` flag per expense to know if an item has been posted to the server.
- Sync strategy: when the app detects it is online it calls `syncExpenses()` which posts local non-synced items to the backend and then reloads from the server. This is simple (no conflict resolution) and intended for single-user demo usage.
- Date handling: expenses store a `date` string. The UI uses `new Date(exp.date)` to compute summaries (today/week/month). Be aware that interpreting plain `yyyy-mm-dd` strings can behave differently across environments — see `src/App.jsx` for a short note above the `getSummary` helper.

Note about server persistence:

- The demo server (`server.js`) persists expenses to `./data/expenses.json` (relative to the folder you run the server from). This means data saved to the server survives server restarts. If you start the server from the project root, the file will be `Personal Expense Tracker\data\expenses.json` on your machine.
- Running `npm run build` only builds the frontend (Vite) into `dist/` and does not delete or modify the `data/` folder or `expenses.json`.

## Project structure (high level)

- `src/App.jsx` — main React app, UI, sync logic, charts, and summaries
- `src/db.js`  — IndexedDB wrapper using `idb`
- `src/index.css` — global styles and app-specific styles
- `server.js` — small Express demo API (in-memory storage) used for sync
- `package.json` — scripts and dependencies

## Run & test checklist

1. Start `server.js`
2. Start the frontend dev server
3. Add a few expenses while online and verify they appear on the list and chart
4. Go offline (browser devtools > Network > Offline or disconnect), add an expense — it should show a "Pending" badge
5. Reconnect — the app should sync the pending expense to the server (check server logs or refresh)

## Reflection

Approach:
- Built a lightweight offline-first UI using React and IndexedDB. Kept the server intentionally simple to focus on client sync behavior and UX.

Challenges:
- Date parsing/timezones: using plain date strings can cause subtle cross-browser differences. For a production app I'd normalize dates or use a library such as `date-fns` or `luxon` and enforce ISO datetimes.
- Sync / conflict resolution: this demo uses a naive "post local unsynced items" approach. With multiple clients a real conflict resolution strategy (timestamps, vector clocks, or server-side authoritative merge) is required.

Future improvements:
- Add authentication and per-user storage
- Use a small server-side database (SQLite/Postgres) instead of in-memory storage
- Improve sync: batch operations, handle edits/deletes while offline more safely, and implement conflict resolution
- Add unit tests (especially for date/window logic and sync flows)
 - Train a small ML model for enhancements (optional):
	 -predict category from description/amount, detect anomalous spending, or suggest monthly budgets.
	 - Deliverables for this enhancement could include a Jupyter notebook or Python script that trains a lightweight model (scikit-learn or simple neural net), a small sample CSV of exported expenses
