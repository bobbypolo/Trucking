# LoadPilot Full QA Audit — 2026-03-22

## Executive Summary

**Overall System Completeness: ~35% functional as an integrated product**

- Backend API: 177+ endpoints across 30 route files, ~70% functional
- Frontend UI Design: ~90% polished (professional dark theme, consistent UX)
- Frontend-Backend Integration: ~25% functional
- Demo Readiness: NOT READY

**Root Causes**: 8 missing database tables, 16 auth-less API functions, no auth readiness gate, 42 hardcoded fake values, 18+ non-functional buttons

---

## 1. MISSING DATABASE TABLES

8 tables are referenced in backend code (`server/routes/clients.ts` lines 283-600) but have NO migration file creating them. These cause 9 API endpoints to return HTTP 500 "Database error".

| #   | Missing Table         | Referenced In  | Purpose                                          |
| --- | --------------------- | -------------- | ------------------------------------------------ |
| 1   | `parties`             | clients.ts:289 | Core party registry (shippers, brokers, vendors) |
| 2   | `party_contacts`      | clients.ts:295 | Contact info per party                           |
| 3   | `party_documents`     | clients.ts:299 | Documents attached to parties                    |
| 4   | `rate_rows`           | clients.ts:307 | Rate card pricing rows                           |
| 5   | `rate_tiers`          | clients.ts:511 | Tiered volume pricing                            |
| 6   | `constraint_sets`     | clients.ts:354 | Business rule sets per party                     |
| 7   | `constraint_rules`    | clients.ts:549 | Individual constraint rules                      |
| 8   | `party_catalog_links` | clients.ts:383 | Party-to-catalog item mapping                    |

### Schema Conflicts (Duplicate Migrations)

5 tables are created in baseline migration 001 AND recreated in later migrations with different schemas:

| Table        | First Created    | Recreated In                  | Conflict                                                       |
| ------------ | ---------------- | ----------------------------- | -------------------------------------------------------------- |
| `quotes`     | 001_baseline.sql | 017_quotes_leads_bookings.sql | Different columns (lead_id vs customer_id, missing created_by) |
| `leads`      | 001_baseline.sql | 017_quotes_leads_bookings.sql | Missing status, source, equipment_needed fields                |
| `bookings`   | 001_baseline.sql | 017_quotes_leads_bookings.sql | Different date field names                                     |
| `messages`   | 001_baseline.sql | 018_messages_threads.sql      | 018 may overwrite company_id added in 003                      |
| `work_items` | 001_baseline.sql | 019_tasks_workitems.sql       | Different status enum values                                   |

### Affected API Endpoints

| Endpoint               | HTTP Status | Root Cause                             |
| ---------------------- | ----------- | -------------------------------------- |
| `/api/quotes`          | 500         | Schema conflict (migration 001 vs 017) |
| `/api/leads`           | 500         | Schema conflict (migration 001 vs 017) |
| `/api/bookings`        | 500         | Schema conflict (migration 001 vs 017) |
| `/api/kci-requests`    | 500         | Likely schema mismatch                 |
| `/api/work-items`      | 500         | Schema conflict (migration 001 vs 019) |
| `/api/dashboard/cards` | 500         | Unknown table issue                    |
| `/api/providers`       | 500         | Missing `parties` table subsystem      |
| `/api/contacts`        | 500         | Missing `parties` table subsystem      |
| `/api/safety/vendors`  | 500         | Missing related table                  |

---

## 2. COMPLETE API ENDPOINT CATALOG

**Total: 177+ endpoints across 30 route files**

### Working Endpoints (200 with valid token)

| Endpoint                         | Response | Notes                           |
| -------------------------------- | -------- | ------------------------------- |
| `GET /api/health`                | 200      | MySQL connected, Firebase ready |
| `GET /api/users/me`              | 200      | Full user object returned       |
| `GET /api/loads`                 | 200 `[]` | Works, just no data             |
| `GET /api/exceptions`            | 200 `[]` | Works with filters              |
| `GET /api/incidents`             | 200      | Works                           |
| `GET /api/safety/expiring-certs` | 200 `[]` | Works                           |
| `GET /api/audit`                 | 200      | Works with pagination           |
| `GET /api/accounting/accounts`   | 200 `[]` | GL chart of accounts            |
| `GET /api/accounting/invoices`   | 200 `[]` | AR invoices                     |
| `GET /api/messages`              | 200      | Works                           |

### Broken Endpoints (500 Database Error)

| Endpoint                   | Error          | Fix Needed            |
| -------------------------- | -------------- | --------------------- |
| `GET /api/quotes`          | Database error | Fix schema conflict   |
| `GET /api/leads`           | Database error | Fix schema conflict   |
| `GET /api/bookings`        | Database error | Fix schema conflict   |
| `GET /api/kci-requests`    | Database error | Fix schema mismatch   |
| `GET /api/work-items`      | Database error | Fix schema conflict   |
| `GET /api/dashboard/cards` | Database error | Investigate           |
| `GET /api/providers`       | Database error | Create parties tables |
| `GET /api/contacts`        | Database error | Create parties tables |
| `GET /api/safety/vendors`  | Database error | Investigate           |

### Missing Routes (404)

| Endpoint                   | Issue                                  |
| -------------------------- | -------------------------------------- |
| `GET /api/companies/{id}`  | Company record doesn't exist in DB     |
| `GET /api/dispatch/events` | Route not registered (path mismatch)   |
| `GET /api/equipment`       | Route not registered (needs companyId) |

### Route File Summary

| Route File           | Endpoints | Status                   |
| -------------------- | --------- | ------------------------ |
| users.ts             | 5         | Working                  |
| loads.ts             | 5         | Working                  |
| dispatch.ts          | 6         | Partial (path issues)    |
| accounting.ts        | 22        | Working                  |
| safety.ts            | 15        | Partial (FMCSA mock)     |
| clients.ts           | 9         | Broken (missing tables)  |
| equipment.ts         | 3         | Working                  |
| contracts.ts         | 2         | Working                  |
| ai.ts                | 5         | External (Gemini)        |
| exceptions.ts        | 5         | Working                  |
| incidents.ts         | 4         | Working                  |
| messages.ts          | 3         | Working                  |
| quotes.ts            | 5         | Broken (schema)          |
| bookings.ts          | 4         | Broken (schema)          |
| leads.ts             | 5         | Broken (schema)          |
| contacts.ts          | 4         | Broken (missing table)   |
| providers.ts         | 4         | Broken (missing table)   |
| tasks.ts             | 6         | Broken (schema)          |
| notification-jobs.ts | 4         | Working                  |
| documents.ts         | 3         | Working                  |
| vault-docs.ts        | 3         | Working                  |
| call-sessions.ts     | 4         | Working                  |
| compliance.ts        | 1         | Working                  |
| kci-requests.ts      | 3         | Broken (schema)          |
| crisis-actions.ts    | 3         | Working                  |
| service-tickets.ts   | 3         | Working                  |
| tracking.ts          | 2         | Working                  |
| weather.ts           | 1         | Working (Azure fallback) |
| metrics.ts           | 1         | Working (admin only)     |
| health.ts            | 1         | Working (no auth)        |

---

## 3. ALL HARDCODED/FAKE DATA

**Total: 42 instances across 12 components**

### CRITICAL (Shown to users as real data)

| Component            | Line(s) | Hardcoded Value                | Pretending To Be                                        |
| -------------------- | ------- | ------------------------------ | ------------------------------------------------------- |
| SafetyView.tsx       | 1037    | `85`                           | Winter Operations quiz completion %                     |
| SafetyView.tsx       | 1044    | `42`                           | Hazmat Handling quiz completion %                       |
| SafetyView.tsx       | 1051    | `98`                           | Pre-Trip Inspection quiz completion %                   |
| SafetyView.tsx       | 1106    | `"95%"`                        | David Miller's test score                               |
| SafetyView.tsx       | 1112    | `"100%"`                       | John Smith's test score                                 |
| SafetyView.tsx       | 1118    | `"65%"`                        | Robert Wilson's test score                              |
| SafetyView.tsx       | 1085    | `"324 Certified Units"`        | Fleet certification count                               |
| SafetyView.tsx       | 1159    | `"75"`                         | Minimum Safety Score setting                            |
| SafetyView.tsx       | 1169    | `"90 Days"`                    | Maintenance Interval setting                            |
| SafetyView.tsx       | 1281-82 | `"Unit 101"`, `"Unit 102"`     | Equipment unit dropdown options                         |
| AccountingPortal.tsx | 335     | `"14"`                         | Pending documents count                                 |
| AccountingPortal.tsx | 343     | `"$2,840"`                     | IFTA Liability amount                                   |
| AccountingPortal.tsx | 1112    | `"42.5 hrs"`                   | Time saved by automation                                |
| AccountingPortal.tsx | 1118    | `"14"`                         | Active automation triggers                              |
| AccountingPortal.tsx | 123-148 | 3 rule objects                 | Automation rules (Fuel Match, Auto-IFTA, POD Auto-File) |
| AccountingPortal.tsx | 169-176 | `matched: 12, orphaned: 2`     | Fuel receipt matching results (setTimeout mock)         |
| ExceptionConsole.tsx | 430     | `"SLA: 24m Left"`              | SLA deadline remaining                                  |
| ExceptionConsole.tsx | 525     | `"01:42:00"`                   | Exception elapsed time                                  |
| ExceptionConsole.tsx | 571     | `"Average Resolution: 1h 14m"` | Fleet resolution metric                                 |

### HIGH (Fake operational data)

| Component           | Line(s) | Hardcoded Value                                                                         | Pretending To Be        |
| ------------------- | ------- | --------------------------------------------------------------------------------------- | ----------------------- |
| IntelligenceHub.tsx | 1603-14 | `"John Doe"`, `"Global Logistics"`, `loadCount: 45`, `onTime: "98%"`, `revenue: 125000` | Driver/customer stats   |
| IntelligenceHub.tsx | 1618-20 | `"D-101" Trucker Tom`                                                                   | Incoming call source    |
| IntelligenceHub.tsx | 1702-15 | `"D-5501" Mike Thompson`, `"B-2209" Choptank Logistics`, `"P-9901" Blue Star Towing`    | Call queue callers      |
| IntelligenceHub.tsx | 515-523 | `"CS-9901"`, `"D-12" Mark Stevens`                                                      | Active call session     |
| IntelligenceHub.tsx | 1413    | `eta: "45-60 mins"`                                                                     | Roadside assistance ETA |
| IntelligenceHub.tsx | 1236    | `"888-555-0000"`                                                                        | Default phone fallback  |
| IntelligenceHub.tsx | 1242    | `"800-SAFE-KCI"`                                                                        | Safety team phone       |
| LoadGantt.tsx       | 86-91   | `"04:00 AM"`, `"ETA: 06:30 PM"`                                                         | Load milestone times    |
| QuoteManager.tsx    | 1189    | `"Acme Global Logistics"`                                                               | Customer name           |
| QuoteManager.tsx    | 1209    | `"3125550199"`                                                                          | Phone number            |

### MEDIUM (Defaults/placeholders)

| Component              | Line(s) | Hardcoded Value                                        | Pretending To Be             |
| ---------------------- | ------- | ------------------------------------------------------ | ---------------------------- |
| NetworkPortal.tsx      | 1246-47 | `"NEW CONTACT"`, `"PENDING@MAIL.COM"`, `"000-000-000"` | Contact form defaults        |
| Auth.tsx               | 377     | `dailyCost: 45`                                        | Equipment daily cost         |
| AccountingView.tsx     | 72      | Mock trend calculation                                 | Revenue trend data           |
| AccountingPortal.tsx   | 1032    | `"1 hour ago"`                                         | Activity timestamp           |
| AccountingPortal.tsx   | 971     | `"5000"`                                               | Repair Expense chart account |
| IntelligenceHub.tsx    | 57-60   | `seedMockData()`                                       | Dev-only data seeder         |
| DriverMobileHome.tsx   | 150     | Comment: "Mock Change Requests & Docs for MVP"         | Unimplemented features       |
| DispatcherTimeline.tsx | 88-90   | Comment: "Mock location text"                          | Missing geocoding            |

---

## 4. NON-FUNCTIONAL BUTTONS

**Total: 18+ buttons that render but do nothing**

### CRITICAL (Core features broken)

| Component          | Line    | Button Text        | Expected Behavior         | Actual             |
| ------------------ | ------- | ------------------ | ------------------------- | ------------------ |
| LoadDetailView.tsx | 238-243 | "Print BOL"        | Generate/print BOL PDF    | NO onClick handler |
| LoadDetailView.tsx | 238-243 | "Carrier Rates"    | Show carrier rate cards   | NO onClick handler |
| LoadDetailView.tsx | 238-243 | "Load Stops"       | View/manage stop sequence | NO onClick handler |
| LoadDetailView.tsx | 238-243 | "Documents"        | View attached documents   | NO onClick handler |
| LoadDetailView.tsx | 238-243 | "Show Route"       | Display route on map      | NO onClick handler |
| LoadDetailView.tsx | 238-243 | "Audit Logs"       | View load change history  | NO onClick handler |
| LoadDetailView.tsx | 251     | Lock/Unlock toggle | Toggle load editability   | NO onClick handler |
| LoadDetailView.tsx | 464     | "+ Add Pickup"     | Add pickup location       | NO onClick handler |
| LoadDetailView.tsx | 467     | "+ Add Drop"       | Add dropoff location      | NO onClick handler |
| LoadDetailView.tsx | 248     | "Tag for Action"   | Flag load for action      | NO onClick handler |

### MEDIUM (Secondary features)

| Component            | Line     | Button Text         | Expected Behavior           | Actual             |
| -------------------- | -------- | ------------------- | --------------------------- | ------------------ |
| AccountingPortal.tsx | 381      | "View All Loads"    | Navigate to load list       | NO onClick handler |
| AccountingPortal.tsx | 1097     | "Create New Rule"   | Create automation rule      | NO onClick handler |
| AccountingPortal.tsx | 619, 757 | More options (dots) | Context menu for line items | NO onClick handler |
| SafetyView.tsx       | 743      | "Service"           | View/schedule service       | NO onClick handler |
| SafetyView.tsx       | 746      | "History"           | View service history        | NO onClick handler |
| SafetyView.tsx       | 850      | "View Financials"   | Show financial summary      | NO onClick handler |
| SafetyView.tsx       | 1087     | "Manage"            | Open management panel       | NO onClick handler |
| Settlements.tsx      | 433      | Chevron expand      | Toggle row expansion        | NO onClick handler |

---

## 5. AUTH & RACE CONDITION ISSUES

### The Core Problem

Firebase token takes 100-500ms to hydrate after login. Components fire API calls before token is available. No retry logic exists.

### Token Lifecycle Gap

```
T=0ms    User clicks "Sign In"
T=50ms   Firebase auth succeeds
T=52ms   onAuthStateChanged fires, _idToken set
T=53ms   App.tsx sets user state, renders child components
T=60ms   AccountingPortal mounts, useEffect fires loadData()
T=62ms   loadData() calls getGLAccounts() via financialService.ts
T=63ms   financialService.ts calls raw fetch() with NO auth header
T=70ms   Server returns 401 Unauthorized
T=71ms   Error caught silently — user sees blank page
```

### Bug 1: financialService.ts Missing Auth Headers (16 functions)

**File**: `services/financialService.ts`
**Impact**: ALL accounting API calls fail with 401

Every function uses raw `fetch()` instead of `apiFetch()` from `api.ts`:

- `getGLAccounts()` (line 7)
- `getLoadProfitLoss()` (line 16)
- `createARInvoice()` (line 21)
- `createAPBill()` (line 30)
- `createJournalEntry()` (line 39)
- `getSettlements()` (line 48)
- `createSettlement()` (line 59)
- `getInvoices()` (line 75)
- `getBills()` (line 84)
- `getVaultDocs()` (line 93)
- `getIFTASummary()` (line 115)
- `getMileageEntries()` (line 124)
- `postIFTAToLedger()` (line 138)
- `getIFTAEvidence()` (line 146)
- `analyzeIFTA()` (line 151)
- `lockIFTATrip()` (line 160)

**Fix**: Replace all with `apiFetch()` or add `Authorization: Bearer ${token}` headers.

### Bug 2: No Auth Readiness Gate in App.tsx

**File**: `App.tsx` lines 239-336
**Impact**: Child components mount and fire API calls before user auth is confirmed

App.tsx renders lazy components immediately when `user` state is set, without waiting for initial data load to complete.

**Fix**: Add `isAuthReady` state gate.

### Bug 3: Components Fire API Calls on Mount Without Auth Check

| Component            | useEffect Pattern                         | Has Auth Guard | Fails on Load |
| -------------------- | ----------------------------------------- | -------------- | ------------- |
| LoadDetailView.tsx   | `useEffect(() => loadVault(), [])`        | NO             | YES           |
| AccountingPortal.tsx | `useEffect(() => loadData(), [loadData])` | NO             | YES           |
| AuditLogs.tsx        | `useEffect(() => fetchAudit(), [])`       | NO             | YES           |
| CompanyProfile.tsx   | `useEffect(() => getCompany(), [user])`   | Partial        | Sometimes     |

### Bug 4: getCurrentUser() Returns Null Synchronously

**File**: `services/authService.ts:396`
**Impact**: Components using `getCurrentUser()` at render time get null before auth completes

Components affected: LoadDetailView (line 95), LoadList (line 29), Settlements

**Fix**: Create `useCurrentUser()` hook that subscribes to auth state changes.

### Bug 5: storageService.ts Uses Raw fetch() with Manual Auth

**File**: `services/storageService.ts` lines 245-300
**Impact**: Inconsistent auth handling, no session-expired event dispatch

Functions `getDispatchEvents()` and `getTimeLogs()` manually inject auth headers and check for 401/403 instead of using `apiFetch()`.

### Bug 6: No 401 Retry Logic

**File**: `services/api.ts:43-48`
**Impact**: When token expires mid-session, requests fail permanently

Current behavior: Dispatches `auth:session-expired` CustomEvent and throws. No token refresh + retry.

### Bug 7: Company Record Missing (404)

The logged-in user's company (`5f44e58d-d638-4c39-9c3c-c2737ef7f07b`) returns 404 from `/api/companies/{id}`. This breaks Company Settings (infinite spinner) and any feature that depends on company config.

---

## 6. PAGE-BY-PAGE IMPLEMENTATION STATUS

| Page                 | Completion | Data Source | Key Issue                                  |
| -------------------- | ---------- | ----------- | ------------------------------------------ |
| Auth (Login/Signup)  | 95%        | API         | Works                                      |
| Dashboard            | 85%        | API         | Missing charts                             |
| Load Board           | 90%        | Props       | +New button broken                         |
| Load Detail View     | 80%        | API         | 10 non-functional buttons                  |
| Load Creation/Edit   | 75%        | API         | Utilities menu dead                        |
| Issues & Alerts      | 90%        | API         | Works well                                 |
| Reports/Analytics    | 70%        | Calculated  | No charts, no drill-down                   |
| Quotes & Booking     | 85%        | API         | **500 errors** (missing tables)            |
| Fleet Map            | 60%        | Props       | No Google Maps key, no real-time GPS       |
| Schedule/Calendar    | 80%        | Props       | No multi-day loads                         |
| Broker Network       | 80%        | API         | **500 errors** (missing tables)            |
| Accounting (10 tabs) | 80%        | API         | Auth bug, automation mocked, GL incomplete |
| Safety & Compliance  | 85%        | API         | FMCSA mock, hardcoded scores               |
| Activity Log         | 90%        | API         | Auth race condition on first load          |
| Company Settings     | 80%        | API         | **Infinite spinner** (company 404)         |
| IntelligenceHub      | 70%        | API         | Reports stub, heavy mock data              |
| Command Center       | 75%        | API         | Incident detail incomplete                 |
| Settlements          | 85%        | API         | No batch/reports                           |
| API Tester           | 50%        | External    | Dev tool only                              |

---

## 7. REMEDIATION PRIORITY

### P0 — Fix Before Any Demo (blocks all workflows)

| #   | Issue                                         | Fix                                                                                                       | Effort  |
| --- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------- |
| 1   | **financialService.ts missing auth headers**  | Replace 16 raw fetch() calls with apiFetch()                                                              | 1 hour  |
| 2   | **Auth readiness gate in App.tsx**            | Add isAuthReady state, don't render children until token confirmed                                        | 1 hour  |
| 3   | **Create migration 027 for parties tables**   | CREATE TABLE for all 8 missing tables                                                                     | 2 hours |
| 4   | **Fix schema conflicts (migrations 017-019)** | Reconcile duplicate table definitions with baseline                                                       | 2 hours |
| 5   | **Company record creation**                   | Ensure signup flow creates company in MySQL (not just Firestore)                                          | 1 hour  |
| 6   | **Remove hardcoded fake numbers**             | Replace Safety scores (85%, 92%, 124 days) and Accounting KPIs ($2,840, 14) with API data or honest zeros | 2 hours |

### P1 — Fix Before POC Demo

| #   | Issue                                       | Fix                                                   | Effort  |
| --- | ------------------------------------------- | ----------------------------------------------------- | ------- |
| 7   | Wire LoadDetailView button onClick handlers | Connect Print BOL, Lock, Add Pickup/Drop, Utilities   | 4 hours |
| 8   | Replace IntelligenceHub mock data           | Remove hardcoded callers, stats, phone numbers        | 2 hours |
| 9   | Fix AccountingPortal automation mock        | Remove setTimeout fake matching results               | 1 hour  |
| 10  | Add useCurrentUser() hook                   | Replace synchronous getCurrentUser() calls            | 1 hour  |
| 11  | Add 401 retry logic in api.ts               | Token refresh + single retry on 401                   | 2 hours |
| 12  | Wire remaining non-functional buttons       | AccountingPortal (3), SafetyView (4), Settlements (1) | 3 hours |

### P2 — Before Production

| #   | Issue                             | Fix                                 | Effort      |
| --- | --------------------------------- | ----------------------------------- | ----------- |
| 13  | Google Maps API key configuration | Set VITE_GOOGLE_MAPS_API_KEY        | Config only |
| 14  | Real FMCSA integration            | Replace mock service with live API  | 4 hours     |
| 15  | GL reconciliation & period close  | Build missing accounting features   | 2 days      |
| 16  | Email/SMS notifications           | Replace console.log stubs           | 1 day       |
| 17  | QuickBooks sync                   | Replace 501 stub                    | 2 days      |
| 18  | Real-time GPS/ELD tracking        | Replace static props with WebSocket | 3 days      |
| 19  | Payment processing (Stripe)       | Not yet started                     | 3 days      |

---

## 8. CONSOLE ERROR SUMMARY

120 errors in a single navigation session:

| Error Type | Count | Root Cause                                  |
| ---------- | ----- | ------------------------------------------- |
| HTTP 500   | 41    | Missing database tables / schema mismatches |
| HTTP 403   | 26    | Permission errors (tenant/role mismatch)    |
| HTTP 400   | 21    | Malformed API requests                      |
| HTTP 401   | 20    | Auth token race condition                   |
| HTTP 404   | 11    | Missing routes or data records              |

---

_Generated by 6 parallel QA agents on 2026-03-22. Based on Playwright navigation of every page + code analysis of all 59 components, 30 route files, and 26 migration files._
