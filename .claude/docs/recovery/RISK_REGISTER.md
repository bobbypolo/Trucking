# Risk Register

> Generated: 2026-03-07 | Story: R-P0-04
> Source: Cross-referenced from RECOVERY_SCOPE.md, MOCK_INVENTORY.md, SYSTEM_OF_RECORD_MATRIX.md, STATE_MACHINES.md, API_CONTRACT_CATALOG.md, SCHEMA_INVENTORY.md

## Legend

| Column | Description |
|--------|-------------|
| ID | Unique risk identifier |
| Severity | Critical / High / Medium / Low |
| Category | Security, Data Integrity, Architecture, Operations, Financial |
| Description | What could go wrong |
| Evidence | Where the issue was found (doc reference + file:line) |
| Owner | Role responsible for mitigation |
| Mitigation Plan | Specific recovery phase and action |
| Status | Open / In-Progress / Mitigated |

---

## Critical Risks (Release Blockers)

### RISK-001: Unauthenticated API Routes

| Field | Value |
|-------|-------|
| **Severity** | Critical |
| **Category** | Security |
| **Description** | 43 of 61 API routes lack `authenticateToken` middleware. Any unauthenticated client can read/write loads, invoices, settlements, incidents, messages, and financial records. |
| **Evidence** | API_CONTRACT_CATALOG.md Blocker Statistics: AUTH-MISSING = 43 routes. Examples: PATCH /api/loads/:id/status (route 16), POST /api/accounting/invoices (route 36), POST /api/accounting/settlements (route 41). |
| **Owner** | Backend Lead |
| **Mitigation Plan** | Phase 1 (R-P1-02): Add `authenticateToken` middleware to all 43 unprotected routes. Apply as Express router-level middleware to catch all `/api/*` routes, then whitelist `/api/health` and `/api/auth/login`. |
| **Status** | Open |

### RISK-002: Missing Tenant Isolation

| Field | Value |
|-------|-------|
| **Severity** | Critical |
| **Category** | Security |
| **Description** | 40 routes have no `company_id` filtering. 8 authenticated routes accept `:companyId` as a URL parameter instead of deriving it from the auth token, allowing cross-tenant data access. |
| **Evidence** | API_CONTRACT_CATALOG.md: TENANT-MISSING = 40, TENANT-LEAK = 8. SYSTEM_OF_RECORD_MATRIX.md Cross-Cutting Concerns: "Most MySQL tables have a company_id FK, but the server routes do not consistently filter by the authenticated user company." |
| **Owner** | Backend Lead |
| **Mitigation Plan** | Phase 1 (R-P1-02): Create tenant isolation middleware that injects `req.user.companyId` into all queries. Phase 2 (R-P2-01): Migrate all `:companyId` URL params to auth-derived values. |
| **Status** | Open |

### RISK-003: No State Machine Enforcement

| Field | Value |
|-------|-------|
| **Severity** | Critical |
| **Category** | Data Integrity |
| **Description** | The `PATCH /api/loads/:id/status` route accepts ANY status string and writes it directly to MySQL without validation. Loads can jump from `planned` to `settled` or enter invalid states. The client-side storageService writes status changes directly to localStorage, bypassing the server entirely. |
| **Evidence** | STATE_MACHINES.md: "zero server-side state machine enforcement." server/index.ts line 666: `UPDATE loads SET status = ? WHERE id = ?`. Schema ENUM has 12 values; types.ts has 15 values (mismatch). |
| **Owner** | Backend Lead |
| **Mitigation Plan** | Phase 2 (R-P2-01): Implement server-side load state machine with transition table validation. Phase 2 (R-P2-02): Implement settlement state machine. Remove client-side status writes. Reconcile ENUM mismatch via migration. |
| **Status** | Open |

### RISK-004: localStorage as Primary Data Store

| Field | Value |
|-------|-------|
| **Severity** | Critical |
| **Category** | Data Integrity |
| **Description** | storageService.ts (1,796 lines) uses 17 localStorage keys as the primary data store. The client writes to localStorage first, then attempts API sync. Failed API calls leave localStorage as the only data copy. Data is lost on browser clear, stale across tabs, and has no tenant isolation. |
| **Evidence** | MOCK_INVENTORY.md: 24 unique localStorage keys across 4 service files. RECOVERY_SCOPE.md: storageService classified as IN-REPLACE. SYSTEM_OF_RECORD_MATRIX.md Sec. 4: loads have "localStorage shadow." |
| **Owner** | Frontend Lead |
| **Mitigation Plan** | Phase 2 (R-P2-01): Replace storageService with API client module. Remove all `localStorage.setItem`/`getItem` calls from services. Phase 2 tests verify zero localStorage access in production code paths. |
| **Status** | Open |

### RISK-005: Mock Data Seeded on Every Login

| Field | Value |
|-------|-------|
| **Severity** | Critical |
| **Category** | Data Integrity |
| **Description** | App.tsx calls `seedDatabase()`, `seedSafetyData(true)`, and `seedIncidents()` on every user login, overwriting real data with hardcoded mock entities. IntelligenceHub.tsx calls `seedMockData()` on mount. Production users would see fake data mixed with real data. |
| **Evidence** | MOCK_INVENTORY.md Sec. 6: Seed Call Chain shows App.tsx lines 80-90 and IntelligenceHub.tsx line 798. Total: 50+ mock entities seeded per login. |
| **Owner** | Frontend Lead |
| **Mitigation Plan** | Phase 2 (R-P2-01): Remove `seedDatabase()`, `seedSafetyData()`, `seedIncidents()` calls from App.tsx. Delete mockDataService.ts entirely. Remove `seedMockData()` call from IntelligenceHub.tsx. |
| **Status** | Open |

### RISK-006: Dual-Write Divergence (Firestore + MySQL)

| Field | Value |
|-------|-------|
| **Severity** | Critical |
| **Category** | Data Integrity |
| **Description** | Companies and users are written to BOTH Firestore and MySQL. Login reads from Firestore, list queries read from MySQL. No transaction spans both stores. If one write fails and the other succeeds, data diverges silently. |
| **Evidence** | SYSTEM_OF_RECORD_MATRIX.md Sec. 1: companies (MySQL + Firestore dual-write), users (Firestore primary + MySQL secondary). Cross-Cutting Concerns: "Data divergence if one write succeeds and the other fails." |
| **Owner** | Backend Lead |
| **Mitigation Plan** | Phase 1 (R-P1-03): Designate MySQL as single SOR for users. Phase 2: Eliminate Firestore profile reads from client. Keep Firestore for Firebase Auth identity only. |
| **Status** | Open |

---

## High Risks

### RISK-007: 16 Code-Only Tables Without DDL

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Category** | Architecture |
| **Description** | 16 tables referenced in server/index.ts have no CREATE TABLE statement in any SQL file. They were created manually or via untracked scripts. Schema cannot be reproduced from source control alone. |
| **Evidence** | SCHEMA_INVENTORY.md Appendix A: Tables A1-A24 (parties, party_contacts, gl_accounts, journal_entries, ar_invoices, ap_bills, driver_settlements, document_vault, etc.). |
| **Owner** | Backend Lead |
| **Mitigation Plan** | Phase 1 (R-P1-01): Create DDL migration scripts for all 16 code-only tables. Add to versioned migration system. Verify against running database. |
| **Status** | Open |

### RISK-008: Server Monolith (1,762-line index.ts)

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Category** | Architecture |
| **Description** | All 61 API routes, middleware, error handling, and database logic exist in a single server/index.ts file. Impossible to test routes in isolation. Merge conflicts guaranteed when multiple developers work on different features. |
| **Evidence** | RECOVERY_SCOPE.md Sec. 3: server/index.ts classified as IN-REFACTOR (1,762 lines, 61 routes). API_CONTRACT_CATALOG.md: all 61 routes traced to single file. |
| **Owner** | Backend Lead |
| **Mitigation Plan** | Phase 2 (R-P2-01): Decompose into route modules (loads.routes.ts, accounting.routes.ts, etc.). Extract middleware (auth, tenant, validation) into separate files. Target: no file > 300 lines. |
| **Status** | Open |

### RISK-009: No Test Suite Exists

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Category** | Operations |
| **Description** | The project has zero tests. No Vitest, Jest, or any test runner is configured. No unit tests, integration tests, or e2e tests exist. Changes cannot be validated automatically. |
| **Evidence** | package.json: no test framework in devDependencies. No test scripts in package.json. No `__tests__` or `*.test.*` files found. TypeScript type-check (`npx tsc --noEmit`) has 50+ errors. |
| **Owner** | QA Lead |
| **Mitigation Plan** | Phase 1 (R-P1-01): Install Vitest, configure for both frontend and server. Write trivial passing test to prove framework. See TEST_STRATEGY.md for full plan. |
| **Status** | Open |

### RISK-010: TypeScript Type Errors (50+)

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Category** | Architecture |
| **Description** | 50+ TypeScript compile errors across frontend services. 73 explicit `: any` annotations in server/index.ts alone. 13 empty catch blocks silently swallow errors. Type safety is effectively disabled. |
| **Evidence** | RECOVERY_SCOPE.md: "50+ compile errors across frontend services." "73 `: any` in server/index.ts alone." "13 empty catch blocks across services." |
| **Owner** | Frontend Lead + Backend Lead |
| **Mitigation Plan** | Phase 1 (R-P1-01): Fix critical type errors blocking compilation. Phase 2+: Eliminate `: any` usage. Phase 5 (Stabilize): Replace empty catch blocks with structured error handling. |
| **Status** | Open |

### RISK-011: Ad-Hoc Database Migrations

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Category** | Operations |
| **Description** | 6 `upgrade_*.js` scripts and 2 `migrate_*.js` scripts use raw SQL with hardcoded credentials. No version tracking, no rollback capability, no ordering guarantee. Some scripts hardcode localhost/root with empty password. |
| **Evidence** | server/upgrade_financial_ledger.js: `host: 'localhost', user: 'root', password: ''`. server/upgrade_unified_network.js: same hardcoded credentials. No migration version table or runner. |
| **Owner** | Backend Lead |
| **Mitigation Plan** | Phase 1: Adopt versioned migration framework (see MIGRATION_STRATEGY.md). Retire all upgrade_*.js scripts. Add migration version tracking table. |
| **Status** | Open |

### RISK-012: Financial Data Integrity

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Category** | Financial |
| **Description** | Journal entries have no immutability guard (UPDATE/DELETE allowed). No balanced-entry validation (sum debits must equal sum credits). Invoices and settlements auto-post GL entries on create but no re-posting guard exists, allowing duplicate GL postings. |
| **Evidence** | SYSTEM_OF_RECORD_MATRIX.md Sec. 6: journal_entries "Add immutability guard (no UPDATE/DELETE); add reversing entry pattern." journal_lines "Add balanced-entry validation (sum debits = sum credits)." ar_invoices/driver_settlements "prevent re-posting." |
| **Owner** | Backend Lead |
| **Mitigation Plan** | Phase 4 (Financial): Add journal immutability trigger. Add balanced-entry check constraint. Add idempotency key to prevent duplicate GL postings. Implement reversing entry pattern for corrections. |
| **Status** | Open |

---

## Medium Risks

### RISK-013: IntelligenceHub Monolith (181KB)

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Category** | Architecture |
| **Description** | IntelligenceHub.tsx is a 181KB single-file component. It imports seedMockData, directly accesses localStorage (lines 428, 1970, 1973, 1979), manages 30+ state variables, and contains business logic mixed with UI rendering. |
| **Evidence** | RECOVERY_SCOPE.md: IntelligenceHub.tsx classified as IN with note "181KB monolith - needs decomposition. Imports seedMockData." MOCK_INVENTORY.md Sec. 1.5: Direct localStorage access in lines 428, 1970, 1973, 1979. |
| **Owner** | Frontend Lead |
| **Mitigation Plan** | Phase 3 (Integration): Decompose IntelligenceHub into sub-components (TriageQueue, CallManager, ProviderNetwork, TaskBoard). Extract business logic to hooks. Remove direct localStorage access. |
| **Status** | Open |

### RISK-014: Hardcoded OCR Mock Returns

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Category** | Data Integrity |
| **Description** | ocrService.ts returns hardcoded mock load data instead of calling the real AI (Gemini) service. The Scanner component appears functional but always returns the same fake load (LD-XXXX, $1850, APM Terminals). |
| **Evidence** | MOCK_INVENTORY.md Sec. 5.1: ocrService.ts line 22 - mockLoad with hardcoded values. RECOVERY_SCOPE.md: ocrService classified as IN-REPLACE. |
| **Owner** | Backend Lead |
| **Mitigation Plan** | Phase 3: Replace mock OCR with actual Gemini AI service call. Add error handling for AI service failures. Validate extracted fields before returning. |
| **Status** | Open |

### RISK-015: Duplicate Equipment Route

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Category** | Architecture |
| **Description** | `GET /api/equipment/:companyId` is registered twice in server/index.ts (lines 317 and 634). The second registration overwrites the first, with different RBAC checks. |
| **Evidence** | API_CONTRACT_CATALOG.md Sec. 5: Route 11 flagged as DUPLICATE ROUTE (line 634). |
| **Owner** | Backend Lead |
| **Mitigation Plan** | Phase 2: Remove duplicate route during server decomposition. Keep the route with correct RBAC (admin/dispatcher/safety_manager bypass). |
| **Status** | Open |

### RISK-016: types.ts LoadStatus Mismatch

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Category** | Data Integrity |
| **Description** | types.ts defines 15 LoadStatus values. schema.sql ENUM defines 12 values. The names differ (e.g., "In-Transit" vs no hyphen, "Unassigned" exists only in types.ts, "Departed"/"Arrived"/"Docked"/"Unloaded" exist only in schema). No single source of truth for valid states. |
| **Evidence** | STATE_MACHINES.md status comparison table. SCHEMA_INVENTORY.md Sec. 6: loads table status ENUM. |
| **Owner** | Backend Lead + Frontend Lead |
| **Mitigation Plan** | Phase 2 (R-P2-01): Reconcile to 9 canonical states per STATE_MACHINES.md. Write migration SQL to remap existing data. Update both schema.sql ENUM and types.ts. |
| **Status** | Open |

### RISK-017: Missing RBAC Beyond Admin Bypass

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Category** | Security |
| **Description** | The 22-value role ENUM provides granular roles (ACCOUNTING_AR, ACCOUNTING_AP, PAYROLL_SETTLEMENTS, etc.) but route handlers only check for `admin` bypass. No role-based access control enforces that, for example, a driver cannot create invoices or a dispatcher cannot approve settlements. |
| **Evidence** | SCHEMA_INVENTORY.md Sec. 2: users table role ENUM has 22 values. API_CONTRACT_CATALOG.md: RBAC Check column shows only "Admin bypass" or "None" for all routes. |
| **Owner** | Backend Lead |
| **Mitigation Plan** | Phase 3+: Implement role-permission matrix. Add RBAC middleware that checks required permissions per route. Start with financial routes (accounting, settlements) in Phase 4. |
| **Status** | Open |

### RISK-018: No Optimistic Locking on Loads

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Category** | Data Integrity |
| **Description** | Load saves use REPLACE INTO which performs full row overwrite without version checking. Two dispatchers editing the same load simultaneously will silently overwrite each other's changes. |
| **Evidence** | SYSTEM_OF_RECORD_MATRIX.md Sec. 4: loads "REPLACE INTO allows full row overwrite without optimistic locking." |
| **Owner** | Backend Lead |
| **Mitigation Plan** | Phase 2: Add version column to loads table. Check version in UPDATE WHERE clause. Return HTTP 409 Conflict on version mismatch. |
| **Status** | Open |

---

## Low Risks

### RISK-019: localStorage Auth Token Storage

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Category** | Security |
| **Description** | Auth tokens stored in localStorage (key: `token`) rather than httpOnly cookies. Vulnerable to XSS token theft. Currently mitigated by same-origin policy but remains a security best practice gap. |
| **Evidence** | MOCK_INVENTORY.md Sec. 1.5: Direct `localStorage.getItem('token')` in safetyService.ts (lines 34, 46) and IntelligenceHub.tsx (line 428). |
| **Owner** | Backend Lead |
| **Mitigation Plan** | Phase 5 (Stabilize): Migrate to httpOnly cookie-based auth. Set Secure and SameSite flags. |
| **Status** | Open |

### RISK-020: Missing Training Course Routes

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Category** | Architecture |
| **Description** | `training_courses` table exists in schema.sql with DDL but no API routes are implemented. Table is orphaned. |
| **Evidence** | SCHEMA_INVENTORY.md Sec. 14: training_courses "Table defined but no API routes exist." SYSTEM_OF_RECORD_MATRIX.md Sec. 8: "Implement or defer to Phase 6." |
| **Owner** | Backend Lead |
| **Mitigation Plan** | Phase 6 (Deploy): Evaluate need. Implement CRUD routes if required for MVP, otherwise document as post-launch feature. |
| **Status** | Open |

### RISK-021: Seed Scripts with Hardcoded Credentials

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Category** | Security |
| **Description** | 10+ seed scripts (seed_*.cjs, seed_*.js) in the project root and server/ directory contain hardcoded database credentials (root/empty password). While these are development-only tools, they could leak credential patterns. |
| **Evidence** | seed_cjs.cjs, seed_local_db.cjs, server/seed_breakdown_flow.cjs, etc. server/upgrade_financial_ledger.js: `user: 'root', password: ''`. |
| **Owner** | Backend Lead |
| **Mitigation Plan** | Phase 1: Migrate seed scripts to use .env configuration. Phase 5: Remove seed scripts from production builds. Add to .gitignore or move to dev-only directory. |
| **Status** | Open |

---

## Risk Summary

| Severity | Count | Release Blocking? |
|----------|-------|-------------------|
| Critical | 6 | Yes -- all must be mitigated before Release 1 |
| High | 6 | Yes -- all must be mitigated before Release 1 |
| Medium | 6 | Conditionally -- must be mitigated or accepted with documented workaround |
| Low | 3 | No -- can be deferred to post-Release 1 |
| **Total** | **21** | |

### Phase Mapping

| Phase | Risks Addressed |
|-------|-----------------|
| Phase 0 (Docs) | Risk identification and documentation (this document) |
| Phase 1 (Foundation) | RISK-001, RISK-002, RISK-006, RISK-007, RISK-009, RISK-010, RISK-011, RISK-021 |
| Phase 2 (Core Slice) | RISK-003, RISK-004, RISK-005, RISK-008, RISK-015, RISK-016, RISK-018 |
| Phase 3 (Integration) | RISK-013, RISK-014, RISK-017 |
| Phase 4 (Financial) | RISK-012 |
| Phase 5 (Stabilize) | RISK-010 (remaining), RISK-019 |
| Phase 6 (Deploy) | RISK-020 |
