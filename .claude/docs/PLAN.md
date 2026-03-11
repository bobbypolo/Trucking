# Local Auth & Schema Enablement Sprint

> Current status (2026-03-11): Local auth/runtime enablement sprint is functionally closed.
> Live local auth/runtime validation completed: Phases 3, 5, and 6 are now proven locally with real Firebase Email/Password auth, backend Firebase Admin credentials, local MySQL, and browser login evidence.
> Residual caveat: `exception_management.sql` still emits non-blocking parse warnings in the migration runner and should be cleaned up as hardening work before broader rollout confidence claims.

## Goal

Unblock local authenticated validation by standing up a complete local MySQL schema (baseline + all migrations + missing accounting/IFTA tables), linking SQL users to Firebase UIDs, verifying Firebase Admin token verification end-to-end, confirming Firestore optionality, validating frontend-to-backend auth flow, and running a full Stage 1 validation pass with real auth (not demo mode). This is a focused addendum plan that does NOT replace the broader production-readiness structure.

## Hard Prerequisites (Phase 0 — Local Environment Provisioning)

**These MUST be true before any phase can begin. If any fail, stop and fix before proceeding.**

| Prerequisite | Check | How to Fix |
|---|---|---|
| Dev Firebase project confirmed | `FIREBASE_PROJECT_ID` in `server/.env` is a real project ID | Create project at console.firebase.google.com |
| Firebase Web App created | `VITE_FIREBASE_API_KEY` in `.env` is not empty/placeholder | Add Web App in Firebase Console → Project Settings |
| Frontend VITE_FIREBASE_* available | All 7 `VITE_FIREBASE_*` vars populated in `.env` | Copy from Firebase Console Web App config |
| Backend Admin credentials available | `server/serviceAccount.json` exists OR `GOOGLE_APPLICATION_CREDENTIALS` set | Download from Firebase Console → Service Accounts |
| Local MySQL running and accessible | `mysql -u"$DB_USER" -p"$DB_PASSWORD" -h"$DB_HOST" -e "SELECT 1"` returns OK | Start MySQL service, verify credentials in `server/.env` |
| DB_NAME database exists | `mysql ... -e "USE trucklogix"` returns OK | `CREATE DATABASE IF NOT EXISTS trucklogix;` |
| Backend boots | `cd server && npx tsx index.ts` starts without crash | Fix any missing deps or env errors |
| Frontend boots | `npm run dev` starts Vite without crash | Fix any missing deps or env errors |
| DEMO_MODE off | `.env` has real `VITE_FIREBASE_API_KEY` (not empty) | Fill in from Firebase Console |

**Verification**: Run all checks in sequence. All must pass. If any prerequisite is missing, the sprint will fail for setup reasons, not implementation defects.

## Scope & Change Policy

- **No broad product refactors** — keep changes focused on auth/schema enablement
- **Prefer additive migrations and validation tests** — minimize production code changes
- **Production code changes allowed** only if required to fix auth/schema/runtime blockers discovered during validation
- **Settlement naming conflict** may require repository compatibility code or route changes if pure DDL is insufficient — this is permitted

## System Context

### Files Read

| File | Key Findings |
|------|-------------|
| `server/schema.sql` | 20 tables defined (companies, users, customers, customer_contracts, equipment, loads, load_legs, expenses, issues, incidents, incident_actions, emergency_charges, compliance_records, training_courses, driver_time_logs, dispatch_events, messages, leads, quotes, bookings, work_items). ALTER TABLE adds operating_mode, primary_workspace, duty_mode, assigned_capabilities. |
| `server/migrations/001_baseline.sql` | Full schema copy with firebase_uid already in users table. Creates all 20 base tables + indexes. |
| `server/migrations/002_load_status_normalization.sql` | Normalizes loads.status ENUM from 12 PascalCase to 8 lowercase canonical values. |
| `server/migrations/003_operational_entities.sql` | Adds company_id to incidents/messages, creates call_sessions table. |
| `server/migrations/008_settlements.sql` | Creates `settlements` and `settlement_detail_lines` tables (NOT `driver_settlements`/`settlement_lines` which routes use). |
| `server/migrations/010_add_firebase_uid_to_users.sql` | ADD COLUMN IF NOT EXISTS firebase_uid + UNIQUE KEY. Idempotent — safe if baseline already includes it. |
| `server/middleware/requireAuth.ts` | Firebase Admin `verifyIdToken` + `resolveSqlPrincipalByFirebaseUid(uid)` -> populates `req.user` with `{id, uid, tenantId, companyId, role, email, firebaseUid}`. Checks `isFirebaseInitialized()` first. |
| `server/lib/sql-auth.ts` | `resolveSqlPrincipalByFirebaseUid()` queries `SELECT ... FROM users WHERE firebase_uid = ?`. `linkSqlUserToFirebaseUid()` updates by email match. `mapRowToPrincipal()` maps `company_id` to both `tenantId` and `companyId`. |
| `server/auth.ts` | Firebase Admin init from `serviceAccount.json` or env vars. `verifyFirebaseToken` middleware (legacy, duplicates requireAuth logic). |
| `server/routes/users.ts` | `/api/auth/login` verifies Firebase token, resolves SQL principal, auto-links by email if missing. Uses `loadCompanyConfig()` which reads from Firestore with try/catch fallback to null. |
| `services/authService.ts` | Frontend: `signInWithEmailAndPassword` -> `getIdToken` -> `POST /auth/login`. DEMO_MODE fallback when Firebase creds missing. |
| `services/firebase.ts` | `DEMO_MODE = import.meta.env.DEV && !firebaseConfig.apiKey`. Firebase init skipped in demo mode. |
| `server/firestore.ts` | Firestore init with Proxy fallback if Firebase Admin not configured. Throws descriptive error on use. |
| `server/db.ts` | mysql2/promise pool. Reads DB_HOST, DB_USER, DB_PASSWORD, DB_NAME from env. |
| `server/lib/env.ts` | `validateEnv()` requires DB_HOST, DB_USER, DB_PASSWORD, DB_NAME + one of FIREBASE_PROJECT_ID or GOOGLE_APPLICATION_CREDENTIALS. |
| `server/index.ts` | 16 route modules mounted. No Firebase init here (done in auth.ts at import time). |
| `server/routes/accounting.ts` | References MANY tables not in any migration: gl_accounts, journal_entries, journal_lines, ar_invoices, ar_invoice_lines, ap_bills, ap_bill_lines, driver_settlements, settlement_lines, document_vault, ifta_trips_audit, mileage_jurisdiction, fuel_ledger, ifta_trip_evidence, adjustment_entries, sync_qb_log. |
| `server/upgrade_financial_ledger.js` | Creates gl_accounts, journal_entries, journal_lines, ar_invoices, ap_bills, fuel_ledger, driver_settlements. Seeds chart of accounts. |
| `server/upgrade_accounting_v3.js` | Creates ar_invoice_lines, ap_bill_lines, settlement_lines, mileage_jurisdiction, document_vault, sync_qb_log, adjustment_entries. |
| `server/upgrade_ifta_intelligence.js` | Creates ifta_trip_evidence, ifta_trips_audit. |
| `server/scripts/backfill_firebase_uid.cjs` | Lists all Firebase users by email, matches to SQL users, updates firebase_uid. Requires Firebase Admin + MySQL. |

### Data Flow Diagram

```
LOCAL AUTH CHAIN (target state):

Frontend:
  firebase.ts → DEMO_MODE=false (VITE_FIREBASE_API_KEY present)
  authService.ts → signInWithEmailAndPassword(auth, email, pw)
    → getIdToken(fbUser) → _idToken stored
    → POST /auth/login { email, firebaseUid } + Authorization: Bearer <idToken>
      ↓
Backend:
  server/routes/users.ts → /api/auth/login handler
    → getBearerToken(req) → token
    → admin.auth().verifyIdToken(token) → decodedToken { uid, email }
    → resolveSqlPrincipalByFirebaseUid(decodedToken.uid) → principal
      → SELECT id, company_id, email, role, firebase_uid FROM users WHERE firebase_uid = ?
    → if !principal && email: linkSqlUserToFirebaseUid(email, uid) → auto-link attempt
    → loadCompanyConfig(principal.companyId) → Firestore doc (optional, try/catch → null)
    → res.json({ user, company })

Protected Routes:
  → requireAuth middleware
    → verifyIdToken(token) → decodedToken
    → resolveSqlPrincipalByFirebaseUid(uid) → principal
    → req.user = { id, uid, tenantId, companyId, role, email, firebaseUid }

DB RESTORE CHAIN:
  schema.sql → 20 base tables
  migrations 001-003 → baseline, status normalization, operational entities
  migrations 004-010 → version columns, dispatch events, idempotency, docs, legs, OCR, settlements, adjustments, firebase_uid
  upgrade_financial_ledger.js → GL tables + driver_settlements
  upgrade_accounting_v3.js → invoice/bill lines, settlement_lines, document_vault, etc.
  upgrade_ifta_intelligence.js → ifta_trip_evidence, ifta_trips_audit
```

### Existing Patterns

- Firebase Admin init: `server/auth.ts` tries serviceAccount.json first, then env vars
- Firestore fallback: `server/firestore.ts` uses Proxy pattern — throws descriptive error on method call, does not crash at import
- Firestore in routes: `users.ts` wraps Firestore in try/catch returning null; `clients.ts` has Firestore in a try/catch route handler
- SQL auth: `sql-auth.ts` is the canonical module for user/company SQL operations
- Schema: `schema.sql` is the master schema file; `001_baseline.sql` is a migration copy of it
- Missing tables: accounting routes reference 16 tables that only exist via ad-hoc upgrade scripts (not formal migrations)

### Blast Radius Assessment

| Area | Impact |
|------|--------|
| New migration files | Additive only — CREATE TABLE IF NOT EXISTS for missing accounting/IFTA tables |
| server/.env | Verification only — no changes to env structure |
| server/scripts/backfill_firebase_uid.cjs | Run existing script — no code changes |
| server/routes/users.ts | Verification only — no code changes needed |
| server/middleware/requireAuth.ts | Verification only — no code changes needed |
| Frontend services/ | Verification only — no code changes needed |

---

## Phase 1: Database Baseline, Migrations, and Route Compatibility (foundation)

**Phase Type**: `foundation`

### Route → Table Dependency Audit (required first step)

Before creating any migrations, generate a route → service → table dependency map. For each missing table:

| Classification | Definition | Action |
|---|---|---|
| **required-now** | Table is hit by login, load lifecycle, dispatch, or settlement flows | Create migration immediately |
| **reachable-but-deferrable** | Table is referenced by a route but not on the current critical path (e.g., IFTA admin, QuickBooks sync) | Create migration but mark as non-blocking |
| **dead/legacy** | Table reference exists but route is unreachable from current UI or is disabled | Skip — do not create migration |

This audit MUST produce a written artifact (comment block in the migration files or a separate audit table) so the decision is reviewable.

### Settlement Naming Conflict — Explicit Decision Required

Routes use `driver_settlements`/`settlement_lines`. Migration 008 creates `settlements`/`settlement_detail_lines`. Resolution options:
1. **Both coexist** (different schemas, different purposes) — document why
2. **Route code updated** to use migration 008 naming — requires production code change (permitted under scope policy)
3. **SQL views/aliases** — CREATE VIEW settlement_lines AS SELECT ... FROM settlement_detail_lines
4. **Repository compatibility layer** — adapter functions in sql-auth or new module

Choose one and document the decision in the migration file header.

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `server/migrations/011_accounting_financial_ledger.sql` | Formal migration: CREATE TABLE IF NOT EXISTS for gl_accounts, journal_entries, journal_lines, ar_invoices, ap_bills, fuel_ledger, driver_settlements. Consolidates upgrade_financial_ledger.js into migration format. Seeds default chart of accounts. | `server/__tests__/migrations/011_accounting_tables.test.ts` | integration |
| ADD | `server/migrations/012_accounting_v3_extensions.sql` | Formal migration: CREATE TABLE IF NOT EXISTS for ar_invoice_lines, ap_bill_lines, settlement_lines, mileage_jurisdiction, document_vault, sync_qb_log, adjustment_entries. Consolidates upgrade_accounting_v3.js. | `server/__tests__/migrations/012_accounting_v3.test.ts` | integration |
| ADD | `server/migrations/013_ifta_intelligence.sql` | Formal migration: CREATE TABLE IF NOT EXISTS for ifta_trip_evidence, ifta_trips_audit. Consolidates upgrade_ifta_intelligence.js. Adds tenant_id columns missing from originals. | `server/__tests__/migrations/013_ifta.test.ts` | integration |
| ADD | `server/scripts/apply-migrations.sh` | Shell script to apply schema.sql + migrations 001-013 in order. Reads DB credentials from server/.env. Idempotent (IF NOT EXISTS throughout). | N/A | manual |
| ADD | `server/__tests__/migrations/011_accounting_tables.test.ts` | Validates gl_accounts, journal_entries, journal_lines, ar_invoices, ap_bills, fuel_ledger, driver_settlements tables exist and have expected columns after migration. | N/A | N/A |
| ADD | `server/__tests__/migrations/012_accounting_v3.test.ts` | Validates ar_invoice_lines, ap_bill_lines, settlement_lines, mileage_jurisdiction, document_vault, sync_qb_log, adjustment_entries exist. | N/A | N/A |
| ADD | `server/__tests__/migrations/013_ifta.test.ts` | Validates ifta_trip_evidence, ifta_trips_audit exist with tenant_id. | N/A | N/A |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| `server/scripts/apply-migrations.sh` | Shell script infrastructure — executes SQL files | Manual execution + migration integration tests verify table existence post-run |
| `server/__tests__/migrations/*.test.ts` | ARE test files | Self-verifying |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `011_accounting_financial_ledger.sql` | SQL DDL | MySQL connection | 7 tables created (gl_accounts, journal_entries, journal_lines, ar_invoices, ap_bills, fuel_ledger, driver_settlements) + COA seed data | Error if MySQL unavailable or syntax error | apply-migrations.sh | MySQL DDL engine |
| `012_accounting_v3_extensions.sql` | SQL DDL | MySQL connection (requires 011 tables for FKs) | 7 tables created (ar_invoice_lines, ap_bill_lines, settlement_lines, mileage_jurisdiction, document_vault, sync_qb_log, adjustment_entries) | Error if parent tables missing | apply-migrations.sh (after 011) | MySQL DDL engine |
| `013_ifta_intelligence.sql` | SQL DDL | MySQL connection | 2 tables created (ifta_trip_evidence, ifta_trips_audit) with tenant_id | Error if MySQL unavailable | apply-migrations.sh (after 012) | MySQL DDL engine |
| `apply-migrations.sh` | `bash server/scripts/apply-migrations.sh` | server/.env for DB credentials | All tables created, exit 0 on success | exit 1 with error message on failure | Manual invocation | mysql CLI client |

### Data Flow

```
apply-migrations.sh execution:
  1. Read DB credentials from server/.env (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME)
  2. Execute schema.sql → 20 base tables + indexes
  3. Execute 001_baseline.sql → idempotent (IF NOT EXISTS)
     ERROR: MySQL connection failure → exit 1 with error
  4. Execute 002-010 in order → status normalization, operational entities, etc.
     ERROR: Duplicate column/index → suppressed by IF NOT EXISTS / IF EXISTS checks
  5. Execute 011 → accounting financial ledger tables + COA seed
  6. Execute 012 → accounting V3 extension tables (FKs to 011 tables)
     ERROR: Missing parent table → exit 1 (must run 011 first)
  7. Execute 013 → IFTA intelligence tables
  8. Verify: SELECT COUNT(*) from each critical table → 0 (empty but created)

Settlement naming:
  - Migration 008 creates: settlements, settlement_detail_lines
  - Routes use: driver_settlements, settlement_lines
  - Resolution: Migration 011 creates driver_settlements (from upgrade_financial_ledger.js)
  - Resolution: Migration 012 creates settlement_lines (from upgrade_accounting_v3.js)
  - Both naming conventions will coexist; routes use driver_settlements/settlement_lines
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Accounting table existence after migration | integration | Real | Must verify actual MySQL DDL succeeds — mock cannot validate SQL syntax | `server/__tests__/migrations/011_accounting_tables.test.ts` |
| V3 extension table existence | integration | Real | FK constraints require real tables | `server/__tests__/migrations/012_accounting_v3.test.ts` |
| IFTA table existence with tenant_id | integration | Real | Column structure verification | `server/__tests__/migrations/013_ifta.test.ts` |
| Accounting route smoke (no missing-table 500s) | integration | Real | End-to-end validation that routes can execute queries against real tables | Manual: start server, hit health endpoint |

### Done When

- R-P1-01: `server/migrations/011_accounting_financial_ledger.sql` creates gl_accounts, journal_entries, journal_lines, ar_invoices, ap_bills, fuel_ledger, and driver_settlements tables with CREATE TABLE IF NOT EXISTS, verified by integration test querying INFORMATION_SCHEMA.TABLES
- R-P1-02: `server/migrations/012_accounting_v3_extensions.sql` creates ar_invoice_lines, ap_bill_lines, settlement_lines, mileage_jurisdiction, document_vault, sync_qb_log, and adjustment_entries tables, verified by integration test
- R-P1-03: `server/migrations/013_ifta_intelligence.sql` creates ifta_trip_evidence and ifta_trips_audit tables with tenant_id column present, verified by integration test querying INFORMATION_SCHEMA.COLUMNS
- R-P1-04: `server/scripts/apply-migrations.sh` executes schema.sql and all migrations 001-013 sequentially, exits 0 with zero SQL errors on a fresh database
- R-P1-05: `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='trucklogix' AND TABLE_NAME IN ('driver_settlements','settlements')` returns exactly 2 rows, and `SHOW CREATE TABLE settlement_lines` contains a FOREIGN KEY referencing driver_settlements(id)
- R-P1-06: Server starts without missing-table errors after full migration run, verified by `GET /api/health` returning 200
- R-P1-07: Active route smoke test: `GET /api/loads`, `GET /api/accounting/accounts`, `GET /api/users/me` each return non-500 status (may be 401 for auth-required routes — but NOT 500 from missing tables). Zero "Table doesn't exist" errors in server stdout during smoke
- R-P1-08: Route → table dependency audit artifact exists (comment block or doc) classifying each missing table as required-now / reachable-but-deferrable / dead-legacy, with justification

### Verification Command

```bash
cd server && mysql -u"$DB_USER" -p"$DB_PASSWORD" -h"$DB_HOST" "$DB_NAME" -e "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='trucklogix' AND TABLE_NAME IN ('gl_accounts','journal_entries','journal_lines','ar_invoices','ap_bills','fuel_ledger','driver_settlements','ar_invoice_lines','ap_bill_lines','settlement_lines','mileage_jurisdiction','document_vault','sync_qb_log','adjustment_entries','ifta_trip_evidence','ifta_trips_audit') ORDER BY TABLE_NAME;" 2>&1 && echo "PASS: All 16 accounting/IFTA tables exist"
```

---

## Phase 2: Firebase UID Linkage (foundation)

**Phase Type**: `foundation`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `server/scripts/backfill_firebase_uid.cjs` | Add summary output validation: script must exit 0 and print JSON summary with updated + alreadyLinked counts. No logic changes needed — verify existing script works against local DB. | `server/__tests__/scripts/backfill-firebase-uid.test.ts` | integration |
| ADD | `server/__tests__/scripts/backfill-firebase-uid.test.ts` | Integration test: verify backfill script connects to local DB, processes users, outputs valid JSON summary. Verify at least one user has non-null firebase_uid after run. Verify no duplicate UIDs. | N/A | N/A |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| `server/__tests__/scripts/backfill-firebase-uid.test.ts` | IS the test file | Self-verifying |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `backfill_firebase_uid.cjs` | `node server/scripts/backfill_firebase_uid.cjs` | MySQL connection (server/.env), Firebase Admin (serviceAccount.json or env) | JSON summary: `{updated, alreadyLinked, missingFirebaseUser, total}`, exit 0 | exit 1 if Firebase Admin init fails or MySQL connection fails | Manual invocation | `admin.auth().listUsers()`, `mysql2.query()` |

### Data Flow

```
backfill_firebase_uid.cjs execution:
  1. Init Firebase Admin (serviceAccount.json or env vars)
     ERROR: no credentials → prints warning, returns empty map, exit 0 (no updates)
  2. List all Firebase users → Map<email, uid>
  3. Connect to MySQL, SELECT id, email, firebase_uid FROM users
  4. For each row where firebase_uid IS NULL:
     a. Look up email in Firebase map
     b. If found: UPDATE users SET firebase_uid = ? WHERE id = ?
     c. If not found: increment missingFirebaseUser counter
  5. Print JSON summary
  6. Close connection

Uniqueness guarantee:
  - Migration 010 adds UNIQUE KEY uq_users_firebase_uid
  - Backfill script processes one user per firebase_uid (email match)
  - Duplicate UIDs would cause MySQL unique constraint violation → caught as error
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Backfill script execution | integration | Real | Must verify against real MySQL + Firebase Admin | `server/__tests__/scripts/backfill-firebase-uid.test.ts` |
| firebase_uid uniqueness | integration | Real | Unique constraint is a DB-level guarantee — needs real DB | `server/__tests__/scripts/backfill-firebase-uid.test.ts` |
| Post-backfill principal resolution | integration | Real | Verify resolveSqlPrincipalByFirebaseUid returns non-null for linked users | `server/__tests__/scripts/backfill-firebase-uid.test.ts` |

### Done When

- R-P2-01: `node server/scripts/backfill_firebase_uid.cjs` exits 0 and prints valid JSON containing `{updated, alreadyLinked, missingFirebaseUser, total}` keys
- R-P2-02: After backfill, `SELECT COUNT(*) FROM users WHERE firebase_uid IS NOT NULL` returns a value greater than 0
- R-P2-03: After backfill, `SELECT firebase_uid, COUNT(*) as cnt FROM users WHERE firebase_uid IS NOT NULL GROUP BY firebase_uid HAVING cnt > 1` returns zero rows (no duplicate UIDs)
- R-P2-04: After backfill, `resolveSqlPrincipalByFirebaseUid(uid)` returns a non-null SqlPrincipal for at least one real dev user's firebase_uid
- R-P2-05: The specific dev login user (the user you will use for Phase 5 frontend login) has a populated firebase_uid, verified by `SELECT id, email, firebase_uid FROM users WHERE email = '<dev_login_email>'` returning non-null firebase_uid

### Verification Command

```bash
cd server && node scripts/backfill_firebase_uid.cjs 2>&1 && mysql -u"$DB_USER" -p"$DB_PASSWORD" -h"$DB_HOST" "$DB_NAME" -e "SELECT COUNT(*) as linked_users FROM users WHERE firebase_uid IS NOT NULL; SELECT firebase_uid, COUNT(*) as cnt FROM users WHERE firebase_uid IS NOT NULL GROUP BY firebase_uid HAVING cnt > 1;" 2>&1
```

---

## Phase 3: Firebase Backend Functional Validation (module)

**Phase Type**: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `server/__tests__/integration/firebase-auth-chain.test.ts` | Integration test suite: (1) Firebase Admin initializes without "Could not load default credentials" error; (2) real Firebase ID token accepted by verifyIdToken; (3) invalid/expired token returns proper error; (4) resolveSqlPrincipalByFirebaseUid returns user with company/tenant/role for a linked UID; (5) duplicate UID insert fails cleanly; (6) missing UID returns null (not crash); (7) protected route returns 200 with valid token; (8) no-token returns 401; (9) Firestore-unavailable does not block login. | N/A | N/A |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| `server/__tests__/integration/firebase-auth-chain.test.ts` | IS the test file | Self-verifying |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `admin.auth().verifyIdToken(token)` | Firebase Admin SDK | Valid Firebase ID token string | `DecodedIdToken { uid, email, ... }` | `auth/argument-error` if malformed, `auth/id-token-expired` if expired, `auth/id-token-revoked` if revoked | requireAuth middleware, /api/auth/login | Firebase Auth servers |
| `resolveSqlPrincipalByFirebaseUid(uid)` | `(firebaseUid: string) => Promise<SqlPrincipal \| null>` | Firebase UID string | `SqlPrincipal { id, tenantId, companyId, role, email, firebaseUid }` or null | Throws on DB connection error | requireAuth middleware, /api/auth/login | MySQL pool.query |
| `requireAuth` middleware | `(req, res, next) => Promise<void>` | Express Request with Authorization header | Populates `req.user` and calls `next()` | 500 if Firebase not initialized; 401 if no token; 401 if invalid token; 500 if SQL resolution fails; 401 if no linked account | All protected route handlers | `admin.auth().verifyIdToken`, `resolveSqlPrincipalByFirebaseUid` |

### Data Flow

```
Firebase Admin Init (server startup):
  server/auth.ts imported → tries serviceAccount.json
    → SUCCESS: admin.initializeApp with cert
    → FALLBACK: env vars GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_PROJECT_ID
    → FAIL: authReady = false, all protected routes return 500
  ERROR: missing serviceAccount.json AND no env vars → backend rejects all auth

Token Verification Flow:
  Client sends: Authorization: Bearer <firebase-id-token>
    → requireAuth extracts token
    → admin.auth().verifyIdToken(token) → decodedToken
      ERROR: malformed → AuthError "Invalid or expired authentication token"
      ERROR: expired → AuthError "Invalid or expired authentication token"
    → resolveSqlPrincipalByFirebaseUid(decodedToken.uid) → principal
      ERROR: DB down → InternalError "Failed to resolve authenticated user from SQL"
      ERROR: no matching firebase_uid → AuthError "Identity verified but no linked account"
    → req.user populated → next()

Firestore Optionality:
  /api/auth/login → loadCompanyConfig(companyId)
    → try: db.collection("companies").doc(companyId).get()
    → catch: return null (Firestore unavailable is non-fatal)
  Login succeeds with user data even if company config is null
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Firebase Admin initialization | integration | Real | Must verify actual Firebase credentials are valid | `server/__tests__/integration/firebase-auth-chain.test.ts` |
| Token verification (valid) | integration | Real | Must verify real token against Firebase servers | `server/__tests__/integration/firebase-auth-chain.test.ts` |
| Token verification (invalid) | integration | Real | Must verify Firebase rejects tampered tokens | `server/__tests__/integration/firebase-auth-chain.test.ts` |
| SQL principal resolution | integration | Real | Must hit real DB with real firebase_uid | `server/__tests__/integration/firebase-auth-chain.test.ts` |
| Protected route 200/401 | integration | Real | End-to-end auth chain validation | `server/__tests__/integration/firebase-auth-chain.test.ts` |
| Firestore-down login | integration | Real | Verify login succeeds when Firestore proxy throws | `server/__tests__/integration/firebase-auth-chain.test.ts` |

### Done When

- R-P3-01: Firebase Admin initializes successfully from serviceAccount.json or env vars, confirmed by `admin.app()` not throwing and `admin.auth()` returning a valid Auth instance
- R-P3-02: `admin.auth().verifyIdToken(validToken)` returns a DecodedIdToken with non-empty uid and email fields
- R-P3-03: `admin.auth().verifyIdToken("invalid-token")` throws an error containing "Decoding Firebase ID token failed" or equivalent auth error message
- R-P3-04: `resolveSqlPrincipalByFirebaseUid(knownUid)` returns a SqlPrincipal with non-empty id, tenantId, companyId, role, and email for a user linked in Phase 2
- R-P3-05: `resolveSqlPrincipalByFirebaseUid("nonexistent-uid")` returns null without throwing
- R-P3-06: HTTP request to a protected route with valid Bearer token returns 200; same route with no token returns 401; same route with invalid token returns 401
- R-P3-07: `/api/auth/login` with valid Firebase token succeeds and returns `{user, company}` even when Firestore is unreachable (company field may be null)

### Verification Command

```bash
cd server && npx vitest run __tests__/integration/firebase-auth-chain.test.ts --reporter=verbose 2>&1 | tail -30
```

---

## Phase 4: Firestore Posture Verification (module)

**Phase Type**: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `server/__tests__/integration/firestore-optionality.test.ts` | Integration test: (1) Login-critical flow (/api/auth/login) succeeds when Firestore is unavailable (proxy throws); (2) User registration (/api/auth/register) via upsertSqlUser succeeds even if mirrorUserToFirestore fails (logged warning, no error propagation); (3) Company config lookup returns null gracefully when Firestore down. | N/A | N/A |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| `server/__tests__/integration/firestore-optionality.test.ts` | IS the test file | Self-verifying |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `mirrorUserToFirestore(input)` | `(input: UserWriteInput) => Promise<void>` | UserWriteInput object | void (fire-and-forget with warning on failure) | Never throws — catches internally, logs warning via logger.warn | /api/auth/register, /api/users POST | `db.collection("users").doc(id).set()` |
| `loadCompanyConfig(companyId)` | `(companyId: string) => Promise<object \| null>` | Company ID string | Firestore document data or null | Never throws — catches internally, returns null | /api/auth/login | `db.collection("companies").doc(id).get()` |

### Data Flow

```
Firestore Failure Paths:

1. Login (/api/auth/login):
   → verifyIdToken → resolveSqlPrincipal → OK
   → loadCompanyConfig(companyId) → Firestore throws → catch → return null
   → res.json({ user: sqlUser, company: null })
   → LOGIN SUCCEEDS (company config is optional enrichment)

2. Registration (/api/auth/register):
   → upsertSqlUser(input) → SQL INSERT/UPDATE → OK
   → mirrorUserToFirestore(input) → Firestore throws → catch → logger.warn
   → REGISTRATION SUCCEEDS (Firestore mirror is best-effort)

3. User Sync (/api/users POST):
   → upsertSqlUser(input) → OK
   → mirrorUserToFirestore(input) → Firestore throws → catch → logger.warn
   → SYNC SUCCEEDS

Rule: No login-critical or request-critical path depends on Firestore success.
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Login with Firestore down | integration | Real + Mock | Real MySQL + Firestore proxy throws — verify error handling path | `server/__tests__/integration/firestore-optionality.test.ts` |
| Registration with Firestore down | unit | Mock | Mock Firestore proxy and pool — verify mirrorUserToFirestore catch block logs and does not throw | `server/__tests__/integration/firestore-optionality.test.ts` |
| Company config fallback | unit | Mock | Mock Firestore — verify loadCompanyConfig returns null on error | `server/__tests__/integration/firestore-optionality.test.ts` |

### Done When

- R-P4-01: `/api/auth/login` with valid Firebase token returns 200 with `{user, company}` where company is null when Firestore is unreachable, confirmed by integration test
- R-P4-02: `mirrorUserToFirestore()` logs a warning via `logger.warn` containing "Firestore user mirror failed" when Firestore throws, and does not propagate the error to the caller
- R-P4-03: `loadCompanyConfig()` returns null (not throws) when `db.collection("companies").doc().get()` throws, confirmed by test asserting return value is null

### Verification Command

```bash
cd server && npx vitest run __tests__/integration/firestore-optionality.test.ts --reporter=verbose 2>&1 | tail -20
```

---

## Phase 5: Frontend Auth Verification (integration)

**Phase Type**: `integration`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `server/__tests__/integration/frontend-auth-flow.test.ts` | Integration test: (1) Verify .env has VITE_FIREBASE_API_KEY set (not placeholder); (2) DEMO_MODE evaluates to false when VITE_FIREBASE_API_KEY is present; (3) Frontend login function calls signInWithEmailAndPassword and receives valid credentials; (4) POST /auth/login with real token returns 200 with user object containing id, companyId, role, email; (5) GET /api/users/me with token returns authenticated user profile; (6) No 401 or 500 on first protected API call after login. | N/A | N/A |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| `server/__tests__/integration/frontend-auth-flow.test.ts` | IS the test file | Self-verifying |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| Frontend `login(email, password)` | `(email: string, password?: string) => Promise<User \| null>` | Email + password strings | User object with id, companyId, role, email, name | Returns null on failure; logs error to console | App.tsx auth flow | `signInWithEmailAndPassword`, `getIdToken`, `fetch(/auth/login)` |
| `POST /api/auth/login` | HTTP POST | `{email, firebaseUid}` + Bearer token | `{user: {id, companyId, email, role, ...}, company: {...} \| null}` | 401 if no/invalid token; 404 if no SQL user; 500 if Firebase Admin not configured | Frontend login flow | `verifyIdToken`, `resolveSqlPrincipalByFirebaseUid`, `loadCompanyConfig` |
| `GET /api/users/me` | HTTP GET | Bearer token in Authorization header | User object from SQL | 401 if not authenticated; 404 if user not found; 500 on DB error | Frontend session hydration | `requireAuth`, `findSqlUserById` |

### Data Flow

```
Frontend Login (real auth, DEMO_MODE=false):
  1. User enters email + password in login form
  2. authService.login(email, password)
     → signInWithEmailAndPassword(auth, email, password)
       ERROR: auth/user-not-found → catch → return null
       ERROR: auth/wrong-password → catch → return null
     → getIdToken(fbUser) → idToken
     → fetch(API_URL + "/auth/login", { Authorization: Bearer idToken, body: {email, firebaseUid} })
       → Backend verifies token, resolves SQL user, returns {user, company}
       ERROR: 401 → try hydrateSessionFromApi()
       ERROR: 404 → return null
     → _sessionCache = data.user
     → notifyUserChange(data.user)
     → return data.user

  3. App.tsx receives user → renders authenticated shell
  4. Components call API with getAuthHeaders() → Bearer token attached
     → requireAuth middleware validates → req.user populated → route handler executes
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Env var presence (VITE_FIREBASE_API_KEY) | integration | Real | Must verify actual .env file has non-placeholder value | `server/__tests__/integration/frontend-auth-flow.test.ts` |
| Login endpoint with real token | integration | Real | End-to-end validation of the full auth chain | `server/__tests__/integration/frontend-auth-flow.test.ts` |
| Protected route access after login | integration | Real | Verify token-based access works for subsequent requests | `server/__tests__/integration/frontend-auth-flow.test.ts` |
| DEMO_MODE is off | integration | Real | Verify frontend will use real Firebase auth path | `server/__tests__/integration/frontend-auth-flow.test.ts` |

### Done When

- R-P5-01: `.env` file contains a VITE_FIREBASE_API_KEY value that is not empty and not a placeholder string ("your_api_key_here"), verified by integration test reading the file
- R-P5-02: DEMO_MODE evaluates to false when VITE_FIREBASE_API_KEY is present in .env, verified by checking `import.meta.env.DEV && !firebaseConfig.apiKey` logic
- R-P5-03: `POST /api/auth/login` with a real Firebase ID token returns 200 with a response body containing `user.id`, `user.companyId`, `user.role`, and `user.email` fields
- R-P5-04: `GET /api/users/me` with the same Bearer token returns 200 with the authenticated user profile matching the login response user.id
- R-P5-05: No 401 or 500 status codes occur on the first protected API call after successful login, verified by the integration test making a GET request to `/api/users/me` after login
- R-P5-06: Full chain proven end-to-end: login screen uses real Firebase Auth path (not DEMO_MODE) → Firebase sign-in returns real token → backend `/auth/login` accepts token → backend resolves SQL principal by firebase_uid → protected shell loads → first protected API call returns 200 → invalid credentials do NOT enter authenticated shell
- R-P5-07: DEMO_MODE remains off throughout the entire test run — no test falls back to localStorage-based demo auth

### Verification Command

```bash
cd server && npx vitest run __tests__/integration/frontend-auth-flow.test.ts --reporter=verbose 2>&1 | tail -20
```

---

## Phase 6: Local Stage 1 Rerun — Full Validated Evidence (integration)

**Phase Type**: `integration`

**This is NOT a vague "retest things." It is an explicit evidence-producing validation pass.**

Stage 1 Rerun must produce evidence for each of:
1. **Environment status rerun** — MySQL connected, Firebase Admin ready, DEMO_MODE off, all prerequisites still hold
2. **Auth rerun** — real Firebase login, real token, real SQL principal resolution, real req.user
3. **First protected route rerun** — GET /api/users/me returns 200 with real user data
4. **First release-critical workflow probe** — at least one load/dispatch/accounting route returns 200 (not 500)
5. **Updated evidence docs** — test output captured, verification-log.jsonl updated

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `server/__tests__/integration/stage1-rerun.test.ts` | Comprehensive Stage 1 validation suite that runs only after Phases 1-5 pass: (1) Environment status check (MySQL connected, Firebase Admin ready, DEMO_MODE off); (2) Real login via Firebase signInWithEmailAndPassword + POST /auth/login; (3) Protected route access (GET /api/users/me returns 200 with user data); (4) First release-critical workflow path (GET /api/loads or equivalent route returns 200, not 500 from missing tables); (5) Accounting route smoke (GET /api/accounting/accounts returns 200 or empty array, not 500). | N/A | N/A |

### Untested Files

| File | Reason | Tested Via |
|------|--------|------------|
| `server/__tests__/integration/stage1-rerun.test.ts` | IS the test file | Self-verifying |

### Interface Contracts

N/A — This phase is a validation gate. It consumes interfaces defined in Phases 1-5 and validates them end-to-end. No new interfaces are introduced.

### Data Flow

```
Stage 1 Rerun Validation:
  1. Environment checks:
     → MySQL pool.query("SELECT 1") → OK
       ERROR: connection refused → FAIL "MySQL not running"
     → admin.app() → OK
       ERROR: throws → FAIL "Firebase Admin not initialized"
     → DEMO_MODE check → must be false
       ERROR: true → FAIL "Running in demo mode"

  2. Real login:
     → signInWithEmailAndPassword(email, password) → fbUser
       ERROR: auth error → FAIL "Firebase login failed"
     → getIdToken(fbUser) → token
     → POST /auth/login with token → {user, company}
       ERROR: 401/404/500 → FAIL "Backend login failed"

  3. Protected route:
     → GET /api/users/me with Bearer token → 200 {user}
       ERROR: 401 → FAIL "Token not accepted by middleware"
       ERROR: 500 → FAIL "Server error on protected route"

  4. Release-critical workflow:
     → GET /api/loads (or equivalent) with token → 200
       ERROR: 500 → FAIL "Missing table or schema error"

  5. Accounting smoke:
     → GET /api/accounting/accounts with token → 200 (empty array OK)
       ERROR: 500 → FAIL "Accounting tables missing"
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Environment readiness | integration | Real | Must verify actual MySQL + Firebase + env state | `server/__tests__/integration/stage1-rerun.test.ts` |
| Real login flow | integration | Real | End-to-end Firebase auth with real credentials | `server/__tests__/integration/stage1-rerun.test.ts` |
| Protected route access | integration | Real | Verify full auth chain with real token | `server/__tests__/integration/stage1-rerun.test.ts` |
| Release-critical route smoke | integration | Real | Verify no missing-table 500s on key routes | `server/__tests__/integration/stage1-rerun.test.ts` |

### Done When

- R-P6-01: MySQL pool connects successfully, verified by `SELECT 1` returning without error
- R-P6-02: Firebase Admin is initialized, verified by `admin.app()` not throwing
- R-P6-03: DEMO_MODE is false (not running in fallback demo shell)
- R-P6-04: Real login via Firebase signInWithEmailAndPassword + POST /api/auth/login returns 200 with user object containing non-empty id and companyId
- R-P6-05: GET /api/users/me with the login token returns 200 with matching user.id
- R-P6-06: At least one release-critical route (loads list or equivalent) returns 200 (not 500) with the authenticated token
- R-P6-07: GET /api/accounting/accounts returns 200 (may be empty array) confirming accounting tables exist and are queryable

### Verification Command

```bash
cd server && npx vitest run __tests__/integration/stage1-rerun.test.ts --reporter=verbose 2>&1 | tail -40
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Firebase serviceAccount.json missing on local machine | Medium | High | Phase 3 tests explicitly check for Firebase Admin init; clear error message guides developer to download from Firebase Console. Documented in PROJECT_BRIEF.md env setup section. |
| Migration 011 driver_settlements conflicts with migration 008 settlements | Medium | Medium | Both use CREATE TABLE IF NOT EXISTS. driver_settlements and settlements are DIFFERENT tables with different schemas. Routes use driver_settlements. Both can coexist. |
| No Firebase users exist to backfill UIDs | Medium | High | Phase 2 test checks COUNT > 0. If no Firebase users match, manual user creation in Firebase Console is required first. Script output clearly reports missingFirebaseUser count. |
| upgrade_*.js scripts have slightly different column definitions than migration versions | Low | Medium | Migrations use IF NOT EXISTS — if tables were already created by upgrade scripts, migration is a no-op. Column mismatches caught by integration tests checking INFORMATION_SCHEMA. |
| Frontend VITE_FIREBASE_* env vars are placeholders | Medium | High | Phase 5 explicitly validates env values are not placeholder strings. Clear error guides developer to fill in .env. |
| Firestore proxy throws unexpectedly in non-wrapped code paths | Low | Medium | Discovery found only 2 route files use Firestore, both wrapped in try/catch. Phase 4 tests validate this pattern holds. |

## Dependencies

### Internal

- `server/schema.sql` — base schema (no changes needed)
- `server/migrations/001-010` — existing migrations (no changes needed)
- `server/auth.ts` — Firebase Admin initialization (no changes needed)
- `server/middleware/requireAuth.ts` — auth middleware (no changes needed)
- `server/lib/sql-auth.ts` — SQL principal resolution (no changes needed)
- `server/routes/users.ts` — login endpoint (no changes needed)
- `services/authService.ts` — frontend auth service (no changes needed)
- `services/firebase.ts` — Firebase config and DEMO_MODE (no changes needed)

### External

- `firebase-admin` — Firebase Admin SDK for token verification and user listing
- `mysql2/promise` — MySQL database driver
- `server/serviceAccount.json` — Firebase service account credentials (gitignored, must exist locally)
- `.env` — VITE_FIREBASE_* credentials, DB_HOST/USER/PASSWORD/NAME

## Rollback Plan

All changes are additive:
1. Migration files (011-013): CREATE TABLE IF NOT EXISTS — safe to re-run, safe to skip. To rollback: run DROP TABLE statements in reverse order.
2. Test files: additive only — can be deleted without affecting production code.
3. apply-migrations.sh: utility script — can be deleted.
4. Production code changes (if any) are limited to auth/schema/runtime blocker fixes discovered during validation.
5. If Phase 2 backfill creates incorrect UIDs: `UPDATE users SET firebase_uid = NULL WHERE firebase_uid IS NOT NULL` to reset.

## Open Questions

None — all critical investigation questions were resolved during discovery:
1. Settlement naming conflict: both tables coexist (driver_settlements for routes, settlements for migration 008)
2. Missing table source: traced to upgrade_*.js scripts, now consolidated into proper migrations
3. Firestore optionality: confirmed wrapped in try/catch in both route files that use it
4. DEMO_MODE behavior: confirmed driven by VITE_FIREBASE_API_KEY presence
