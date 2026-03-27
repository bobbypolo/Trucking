# Demo Seed Runbook — LoadPilot (DisbatchMe)

Date: 2026-03-26
Author: Builder 01 (post-audit remediation)

---

## Purpose

This runbook documents how to seed a demo tenant with realistic trucking business data so that dashboards, the load board, accounting views, and the incident console render with meaningful content during a sales or QA demo.

All seeded data is clearly identifiable as demo data: the tenant company is named "Demo Freight Co" and every seeded record ID is prefixed with `DEMO-`.

---

## Prerequisites

### 1. Environment Variables

The following environment variables must be present in your `.env` file at the project root:

```
DB_HOST=<your MySQL host>
DB_USER=<your MySQL user>
DB_PASSWORD=<your MySQL password>
DB_NAME=<your database name>
```

For Cloud SQL (Unix socket):
```
DB_SOCKET_PATH=/cloudsql/<project>:<region>:<instance>
DB_USER=...
DB_PASSWORD=...
DB_NAME=...
```

Firebase credentials are **not** needed by the seed script itself — only by the running server.

### 2. Database Migrations

All 39 migrations must have been applied before running the seed script. The seed script inserts into tables created by migrations 001 through 038. Run migrations with:

```bash
node server/scripts/apply-all-migrations.cjs
```

Verify the tables exist:
- `companies`, `users`, `customers`, `loads`, `load_legs`
- `incidents`, `parties`
- `gl_accounts`, `journal_entries`, `journal_lines`
- `ar_invoices`, `ar_invoice_lines`, `ap_bills`, `ap_bill_lines`

### 3. Node.js Dependencies

```bash
cd server && npm install
```

---

## Running the Seed Script

### Standard run (from project root)

```bash
npx ts-node server/scripts/seed-demo.ts
```

### Dry run (preview SQL without writing)

```bash
npx ts-node server/scripts/seed-demo.ts --dry-run
```

Dry run prints every SQL statement and its parameters to stdout without executing any of them. Use this to verify the script's intent before committing to a database write.

### Override the demo company ID

If you want to seed into a specific existing company row (for example, to link to an existing Firebase auth user), set `DEMO_COMPANY_ID`:

```bash
DEMO_COMPANY_ID=your-existing-company-uuid npx ts-node server/scripts/seed-demo.ts
```

Note: if the company does not exist yet, the script creates it. If it already exists, `INSERT IGNORE` skips the creation row without error.

### Expected output (successful run)

```
[HH:MM:SS] === LoadPilot Demo Seed Script ===
[HH:MM:SS] Demo tenant ID: DEMO-COMPANY-001
[HH:MM:SS] Seed data version: 1.0.0
[HH:MM:SS] Connected to database.
[HH:MM:SS] Seeding company: Demo Freight Co (DEMO-COMPANY-001)
[HH:MM:SS] Seeding user: Alex Rivera (admin)
...
[HH:MM:SS] --- Verification ---
[HH:MM:SS]   PASS  companies: found 1 (expected >= 1)
[HH:MM:SS]   PASS  users: found 4 (expected >= 4)
[HH:MM:SS]   PASS  customers: found 4 (expected >= 4)
[HH:MM:SS]   PASS  parties: found 2 (expected >= 2)
[HH:MM:SS]   PASS  loads: found 11 (expected >= 11)
[HH:MM:SS]   PASS  load_legs: found 22 (expected >= 22)
[HH:MM:SS]   PASS  incidents: found 5 (expected >= 5)
[HH:MM:SS]   PASS  gl_accounts: found 5 (expected >= 5)
[HH:MM:SS]   PASS  ar_invoices: found 5 (expected >= 5)
[HH:MM:SS]   PASS  ap_bills: found 5 (expected >= 5)
[HH:MM:SS]   PASS  journal_entries: found 10 (expected >= 10)
[HH:MM:SS] All verification checks passed.
[HH:MM:SS] === Seed complete. N SQL statements executed. ===
```

Exit code `0` means success. Exit code `1` means failure — check the error output.

### Idempotency

Running the seed script a second time is safe. Every insert uses `INSERT IGNORE`, which skips rows whose primary key already exists. The data will not be duplicated.

---

## What Gets Created

| Entity type | Count | Details |
|---|---|---|
| Company | 1 | "Demo Freight Co" (Austin, TX) |
| Users | 4 | 1 admin, 2 drivers, 1 dispatcher |
| Customers | 4 | 2 direct shippers, 2 freight brokers |
| Parties | 2 | 2 carrier vendors (for the Broker Network) |
| Loads | 11 | Spread across all status values (see table below) |
| Load legs | 22 | 2 stops per load (Pickup + Dropoff) |
| Incidents | 5 | Breakdown, Reefer Temp, HOS Risk, Cargo Issue, Weather |
| GL accounts | 5 | AR (1200), AP (2000), Revenue (4000), Carrier Cost (6100), Fuel (6200) |
| AR invoices | 5 | Paid (×3), Sent (×1), Overdue (×1) |
| AP bills | 5 | Paid (×2), Approved (×1), Pending (×1), Overdue (×1) |
| Journal entries | 10 | Auto-posted: 5 from invoices, 5 from bills |
| Journal lines | 20 | Debit/credit pairs for each journal entry |

### Load status distribution

| Status | Count | Loads |
|---|---|---|
| `completed` | 3 | DEMO-2026-0001, 0002, 0009, 0010 (4 total) |
| `delivered` | 1 | DEMO-2026-0003 |
| `in_transit` | 1 | DEMO-2026-0004 |
| `dispatched` | 1 | DEMO-2026-0005 |
| `planned` | 2 | DEMO-2026-0006, 0007 |
| `draft` | 1 | DEMO-2026-0008 |
| `cancelled` | 1 | DEMO-2026-0011 |

### Geographic coverage

Loads cover realistic US trucking lanes:
- Texas triangle: Houston ↔ Dallas ↔ San Antonio
- Gulf Coast: New Orleans → Memphis, Mobile → Nashville
- Mid-South: McAllen TX → Chicago IL (produce run)
- Southeast: New Orleans → Birmingham AL (steel)
- Midwest: Chicago → Detroit (pharma, planned)
- Central: Dallas → Oklahoma City, Dallas → Tulsa

---

## Linking a Firebase User to the Demo Tenant

The seed script creates MySQL records only. To log in through the app UI as the demo admin, you need a Firebase Auth user linked to the demo company. Two approaches:

**Option A — Use an existing Firebase user:**
```bash
DEMO_COMPANY_ID=<existing-company-id> npx ts-node server/scripts/seed-demo.ts
```
This seeds all data under an existing company that is already linked to a Firebase user.

**Option B — Create a Firebase user for the demo company:**
1. In the Firebase console, create a new user: `demo@demofreightco.example.com`
2. Run the backfill script to link the Firebase UID to the MySQL user:
   ```bash
   node server/scripts/backfill_firebase_uid.cjs
   ```
3. Or manually update: `UPDATE users SET firebase_uid = '<uid>' WHERE email = 'alex.rivera@demofreightco.example.com'`

---

## Demo Navigation Guide

Once the seed data is loaded, visit these pages to see populated data.

### Pages to show in a demo

| Page | URL | What to show |
|---|---|---|
| Dashboard | `/` | KPI cards with revenue, load counts, active alerts |
| Load Board | `/loads` | 11 loads across all statuses with real origin/destination cities |
| Schedule | `/schedule` | Calendar view with loads plotted by pickup date |
| Operations Center | `/operations` | Dispatched and in-transit loads visible in command center |
| Issues & Alerts | `/exceptions` | 5 incidents auto-linked as exceptions (Breakdown, HOS Risk, etc.) |
| Accounting — AR | `/accounting` (AR tab) | 5 invoices: Paid, Sent, Overdue states |
| Accounting — AP | `/accounting` (AP tab) | 5 bills: Paid, Approved, Pending, Overdue states |
| Accounting — GL | `/accounting` (GL tab) | 10 auto-posted journal entries from invoices and bills |
| Broker Network | `/network` | 4 customers (shippers + brokers) + 2 carrier parties |
| Reports | `/reports` | Completed loads available for P&L and IFTA reports |

### Suggested demo flow (10-minute walk)

1. **Load Board** — point to the status spread (completed, in-transit, dispatched, planned, draft)
2. **Load detail** — open DEMO-2026-0004 (in_transit) — shows realistic pick/drop stops, carrier rate, driver pay
3. **Schedule** — show calendar with loads plotted across March
4. **Issues & Alerts** — open the Breakdown incident (DEMO-INC-001) — shows recovery plan
5. **Accounting AR** — show INV-DEMO-2026-003 (Sent, $5,900 with detention) and INV-DEMO-2026-005 (Overdue)
6. **Accounting AP** — show BILL-DEMO-2026-003 (Pending) and BILL-DEMO-2026-005 (Overdue)
7. **Broker Network** — show the 2 brokers and 2 carriers, search and filter

---

## Known Limitations

### What the seed script does NOT create

- **Firebase Auth users** — must be created separately in the Firebase console
- **Equipment records** — the `equipment` table is not seeded; use the Equipment Registry UI to add trucks/trailers during the demo
- **GPS positions / ELD data** — the `gps_positions` and `geofence_events` tables are empty; real-time tracking requires ELD integration
- **IFTA trip evidence** — the IFTA module will show empty states; add fuel ledger entries manually if needed
- **Compliance records** — the `compliance_records` table is empty; Safety & Compliance will show blank driver records
- **Driver settlements** — no settlements are seeded; Settlements tab will show empty state

### Demo areas to avoid

| Area | Reason | Workaround |
|---|---|---|
| Safety & Compliance Overview | Hardcoded "13 Non-Compliant Drivers" KPI tile (open bug DB-1) | Skip or acknowledge it is placeholder |
| Fleet Map | Requires `VITE_GOOGLE_MAPS_API_KEY` | Configure API key or skip this page |
| Quotes & Booking | May return 403 if user role lacks permission (bug AT-1) | Skip or use an admin-role user |
| "Create New Rule" in Accounting Automation | Shows "coming soon" toast | Avoid clicking |
| "Carrier Rates" in Load Detail | Shows "coming soon" toast | Avoid clicking |

### Changing the demo data

All data definitions live in `server/scripts/seed-demo-data.json`. Edit that file to change names, amounts, dates, or routes — no code changes required. After editing, re-run the seed script. Because the script uses `INSERT IGNORE`, you must first delete the existing DEMO records before changed values will take effect:

```sql
DELETE FROM loads WHERE company_id = 'DEMO-COMPANY-001';
DELETE FROM customers WHERE company_id = 'DEMO-COMPANY-001';
-- etc.
```

Or drop and recreate the demo company entirely (cascades via FK ON DELETE CASCADE):

```sql
DELETE FROM companies WHERE id = 'DEMO-COMPANY-001';
```

Then re-run the seed script.

---

## Cleanup

To remove all demo data:

```sql
-- This cascades to: users, customers, loads, load_legs, incidents,
-- gl_accounts, journal_entries, journal_lines, ar_invoices, ar_invoice_lines,
-- ap_bills, ap_bill_lines, parties, and exceptions linked to demo loads.
DELETE FROM companies WHERE id = 'DEMO-COMPANY-001';
```

Verify cleanup:
```sql
SELECT COUNT(*) FROM loads WHERE company_id = 'DEMO-COMPANY-001';
-- Expected: 0
```
