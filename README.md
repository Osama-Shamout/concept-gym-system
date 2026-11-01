Osama Shamout © 2026
# The Concept - Gym Management System

A standalone single-page web application designed for managing gym memberships, monthly subscriptions, credit point allocation, and training appointments with Peak/Off-Peak rate calculations.

## Features

- **Dashboard**: High-level key performance indicators (Total members, active subscriptions, daily appointments, monthly revenue).
- **Member Management**: Full CRUD capabilities for gym members with interactive post-registration workflows.
- **Credit-Based Subscription Tracking**: Supports tier-based monthly subscriptions with dynamic credit deduction:
  - **Off-Peak hours** (11:00 AM – 4:00 PM): 1.0 point / session
  - **Peak hours** (6:00 AM – 9:30 AM & 4:30 PM – 8:30 PM): 1.5 points / session
- **Appointment Scheduling & Calendar**: Interactive monthly grid calendar with daily booking lists and automatic credit balance warnings.
- **Pay As You Go Session Bundles**: Track and consume prepaid training session packages.
- **Dynamic Price List Configurator**: Customize subscription and package pricing directly through the UI.
- **Custom Data Export**: Download filtered records into Excel (CSV) or trigger clean PDF/Print reports.
- **Local Persistence**: Full client-side data persistence using browser `localStorage`.

## Getting Started

### Quick Start
Since this application runs entirely in the browser, no backend server build steps are strictly necessary.

1. Clone or download this repository.
2. Ensure your logo file is placed under the `./assets/` directory:
   ```text
   assets/THE CONCEPT LOGO trace.png   ```
3. Open `index.html` in any modern browser.

## Desktop Edition (Electron + SQLite)

The `desktop-app/` folder holds an earlier offline desktop build of the same system. It stores its data in a local SQLite database instead of the browser.

- **Stack:** Electron 29, Node.js, SQLite (`sqlite3`)
- **Data model:** `members`, `appointments`, `finance`, `attendance`, `installments`
- **Features:** member CRUD, appointment booking, attendance logging, installment plans with payment tracking, financial reports
- **Architecture:** the renderer talks to the main process over IPC (`ipcRenderer.invoke`), and all database access stays in `main.js`

```bash
cd desktop-app
npm install
npm start
```

The database file (`gym_database.sqlite`) is created automatically on first run and is git-ignored, so no real member data is ever committed.
