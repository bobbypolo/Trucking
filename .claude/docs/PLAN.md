# Plan: LoadPilot Orchestrator QA Master Plan

## Goal

Complete production hardening of LoadPilot by migrating all remaining localStorage domains to server-authoritative APIs, stripping DEMO_MODE from UI components, fixing all 401 TypeScript errors, wiring file upload to a proper Express route, implementing bundle splitting improvements, and establishing CI guardrails. Every feature story includes Playwright MCP orchestrator verification as a mandatory DoD checkbox. Each phase concludes with a holistic Orchestrator Sign-off story.

## System Context

| Dimension         | Current State                                                         |
| ----------------- | --------------------------------------------------------------------- |
| Tests             | 4,862 total (3,070 FE + 1,792 BE), all passing                       |
| FE Coverage       | 82.5% stmts / 75.7% branches / 76.0% funcs / 83.6% lines            |
| BE Coverage       | 78.0% stmts / 75.5% branches / 80.0% funcs / 78.4% lines            |
| TypeScript Errors | 401 total (400 in test files, 1 in vite.config.ts)                    |
| Server Routes     | 26 route modules mounted                                              |
| Frontend          | 50+ components, React.lazy already applied to 22 components in App.tsx |
| Lazy Loading      | Already implemented via React.lazy + Suspense; 7 Suspense fallback={null} need skeleton |
| Bundle            | AccountingPortal 462KB, index 493KB; manualChunks: vendor/maps/pdf/charts/capture |

### Discovery Evidence

```
# localStorage in services/ (non-test files)
grep -rn 'localStorage' services/ --include='*.ts' | grep -v __tests__ | grep -v '.test.'
  services/storageService.ts:161:    const data = localStorage.getItem(STORAGE_KEY_INCIDENTS());
  services/storageService.ts:616:      localStorage.setItem(STORAGE_KEY_INCIDENTS(), ...
  services/storageService.ts:662:  localStorage.setItem(STORAGE_KEY_INCIDENTS(), ...
  services/storageService.ts:697:  localStorage.setItem(STORAGE_KEY_INCIDENTS(), ...
  services/storageService.ts:735:    localStorage.setItem(STORAGE_KEY_INCIDENTS(), ...
  services/storage/vault.ts:16:    const data = localStorage.getItem(STORAGE_KEY_VAULT_DOCS());
  services/storage/vault.ts:28:  localStorage.setItem(STORAGE_KEY_VAULT_DOCS(), ...
  services/storage/notifications.ts:15:    const data = localStorage.getItem(STORAGE_KEY_NOTIFICATION_JOBS());
  services/storage/notifications.ts:27:  localStorage.setItem(STORAGE_KEY_NOTIFICATION_JOBS(), ...
  services/storage/core.ts:35-45: (6 localStorage calls in migrateKey)
  services/safetyService.ts:29-125: (11 localStorage calls across 6 keys)
  services/brokerService.ts:9,73: (3 localStorage calls)
  services/authService.ts:395,441,444: (3 localStorage calls for COMPANIES_KEY)

# DEMO_MODE in production code (non-test files)
grep -rn 'DEMO_MODE' services/ components/ App.tsx --include='*.ts' --include='*.tsx' | grep -v __tests__
  App.tsx:190:import { DEMO_MODE } from "./services/firebase";
  App.tsx:284:    if (features.seedSystem && DEMO_MODE) {
  App.tsx:293:        if (DEMO_MODE && l.length > 0) await seedIncidents(l);
  services/firebase.ts:23:export const DEMO_MODE = ...  (6 references)
  services/authService.ts:96,510,636,873: (4 DEMO_MODE conditional blocks)
  services/ocrService.ts:17: if (!DEMO_MODE) { throw ... }
  components/SafetyView.tsx:80,182: (import + seedIncidents call)
  components/Settlements.tsx:45,116,205: (import + deductions + PDF URL)

# TypeScript errors breakdown
npx tsc --noEmit 2>&1 | grep 'src/__tests__' | wc -l   => 400
npx tsc --noEmit 2>&1 | grep 'vite.config.ts' | wc -l  => 1
# Total: 401 errors (400 test files + 1 vite.config.ts)

# Existing server routes (no vault/notification/safety routes exist)
ls server/routes/  => 26 files (no vault*.ts, no notification*.ts, no safety*.ts)

# React.lazy already in App.tsx
grep -c 'React.lazy' App.tsx  => 22 components already lazy
# Eagerly imported components (still static imports)
grep '^import.*from.*components/' App.tsx  =>
  ErrorBoundary, ConnectionBanner, Toast, LoadList, Intelligence,
  Settlements, LoadSetupModal, LoadingSkeleton, GoogleMapsAPITester, CommandCenterView

# Existing document infrastructure (server-side)
server/services/document.service.ts     => StorageAdapter, validateFile, upload, compensating txn
server/services/document-state-machine.ts => DocumentStatus enum + transitions
server/schemas/document.schema.ts        => ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, sanitizeFilename
server/repositories/document.repository.ts => MySQL CRUD for documents table
server/migrations/005_documents_table.sql  => documents table exists
# NO server/routes/documents.ts exists — upload route not wired
```

### Remaining localStorage Domains (5)

| Domain          | File                         | localStorage Calls | Server Route Exists |
| --------------- | ---------------------------- | ------------------ | ------------------- |
| Vault Docs      | services/storage/vault.ts    | 3 (get/set/set)    | No (need new route) |
| Notifications   | services/storage/notifications.ts | 2 (get/set)    | No (need new route) |
| Incidents       | services/storageService.ts   | 5 (get + 4 set)    | Yes (/api/incidents)|
| Safety (6 keys) | services/safetyService.ts    | 11 calls           | No (need new route) |
| Brokers         | services/brokerService.ts    | 3 (get/set/set)    | Yes (/api/clients)  |
| Companies       | services/authService.ts      | 3 (get/set/set)    | Yes (/api/companies)|

Also: `services/storage/core.ts` has 6 calls (tenant key migration helper) and `services/storage/migrationService.ts` has 10 calls (one-shot migration utility). These become dead code once all domains use API.

### DEMO_MODE Locations (production code only)

| File                      | References | Usage                                    |
| ------------------------- | ---------- | ---------------------------------------- |
| services/firebase.ts      | 6          | Definition + production guard + init     |
| services/authService.ts   | 5          | onAuthStateChanged, signOut, signup, login |
| services/ocrService.ts    | 2          | Demo extraction vs server endpoint       |
| components/SafetyView.tsx | 2          | seedIncidents call                       |
| components/Settlements.tsx| 3          | Demo deductions, demo PDF URL            |
| App.tsx                   | 2          | seedSystem + seedIncidents calls         |

### Completed Stories (from previous plan)

These stories are DONE and excluded from this plan:
- STORY-012 through STORY-019: Phase 2 Frontend Cutover (quotes, leads, bookings, messages, calls/tasks/workitems, crisis/kci/service-tickets, contacts/providers, DEMO_MODE seed removal)
- STORY-020: Replace "Authority" jargon (0 matches confirmed)
- STORY-021: Replace browser dialogs (0 alert/confirm/prompt in components)
- STORY-024: ConnectionBanner wired in App.tsx
- STORY-025: Equipment PATCH endpoint implemented
- STORY-027: Customer soft delete/archive implemented
- STORY-028: Password reset flow implemented
- STORY-029: Endpoint hardening (IFTA bounds + AI payload limits)
- STORY-031: "Real-Time" / "Live Track" labels removed (0 matches confirmed)

---

## Phase 1: localStorage Migration + DEMO_MODE Cleanup

**Objective**: Migrate the 5 remaining localStorage domains to server-authoritative APIs. Strip all DEMO_MODE flags from React components, pushing branching logic into the service layer. The UI must render only what services provide.

### Done When
- R-P1-51: `grep -rn 'localStorage' services/ --include='*.ts' | grep -v __tests__ | grep -v '.test.' | grep -v 'getItem("token")' | grep -v firebase | grep -v config` returns 0 matches
- R-P1-52: `grep -rn 'DEMO_MODE' components/ App.tsx --include='*.tsx'` returns 0 matches
- R-P1-49: `npx vitest run` passes with >= 3,070 tests
- R-P1-50: `cd server && npx vitest run` passes with >= 1,792 tests
- R-P1-08: Cross-tenant GET on any new safety route rejects with 404

### Testing Strategy

| What | Type | Real/Mock | Detail |
| ---- | ---- | --------- | ------ |
| Backend safety routes | Unit | Real + Mock | Mock DB pool; assert response.status === 200 and JSON array length >= 0 |
| Frontend service migration | Unit | Real + Mock | Mock fetch; assert fetch called with `/api/safety/quizzes` and auth header |
| Route mounting + auth | Integration | Real + Mock | assert response.status === 401 when no auth token provided |
| Cross-tenant isolation | Negative | Real + Mock | assert response.status === 404 for Tenant B accessing Tenant A data |
| Missing auth token | Negative | Real | assert response.status === 401 for unauthenticated request |

### STORY-101: Backend — Safety Domain API Routes
**Requirement IDs**: R-P1-01 through R-P1-08
**Agent**: Backend
**Parallel Group**: 1A

Create new Express route module `server/routes/safety.ts` with CRUD endpoints for all 6 safety sub-domains. Create migration `024_safety_domain.sql` with tables for `safety_quizzes`, `safety_quiz_results`, `safety_maintenance`, `safety_service_tickets`, `safety_vendors`, `safety_activity_log`.

**Done When**:
- R-P1-01: `GET /api/safety/quizzes` returns 200 with JSON array for authenticated tenant
- R-P1-02: `POST /api/safety/quizzes` creates a quiz and returns 201
- R-P1-03: `GET /api/safety/maintenance` returns 200 with JSON array
- R-P1-04: `POST /api/safety/maintenance` creates record and returns 201
- R-P1-05: `GET /api/safety/vendors` returns 200 with JSON array
- R-P1-06: `POST /api/safety/vendors` creates vendor and returns 201
- R-P1-07: `GET /api/safety/activity` returns 200 with JSON array (max 50 entries)
- R-P1-08: Cross-tenant GET request returns 404

**Testing Strategy**:
- Unit: Mock DB pool, verify SQL parameterization, test column allowlist — REAL business logic, MOCK database
- Integration: Verify route mounting, auth middleware enforcement, 401 without token
- Negative: Missing required fields return 400, invalid tenant returns 404

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| server/migrations/024_safety_domain.sql | Create | server/__tests__/routes/safety.test.ts |
| server/routes/safety.ts | Create | server/__tests__/routes/safety.test.ts |
| server/index.ts | Edit (mount route) | server/__tests__/routes/safety.test.ts |

**Orchestrator MCP Verification**: Navigate to `/api/safety/quizzes` without auth token, verify 401. With auth, verify 200 + JSON array.

---

### STORY-102: Backend — Vault Documents API Route
**Requirement IDs**: R-P1-09 through R-P1-12
**Agent**: Backend
**Parallel Group**: 1A

Create `server/routes/vault-docs.ts` with CRUD + file upload via Multer. Reuse `document.service.ts` StorageAdapter pattern. Create migration `025_vault_docs.sql`.

**Done When**:
- R-P1-09: `GET /api/vault-docs` returns 200 with JSON array for authenticated tenant
- R-P1-10: `POST /api/vault-docs` with multipart file creates document and returns 201
- R-P1-11: File > 10MB returns 413
- R-P1-12: Invalid MIME type returns 400

**Testing Strategy**:
- Unit: Mock StorageAdapter, verify file validation logic — REAL validation, MOCK storage
- Integration: Verify Multer middleware processes multipart forms correctly
- Negative: Oversized file, wrong MIME type, missing auth token

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| server/migrations/025_vault_docs.sql | Create | server/__tests__/routes/vault-docs.test.ts |
| server/routes/vault-docs.ts | Create | server/__tests__/routes/vault-docs.test.ts |
| server/index.ts | Edit (mount route) | server/__tests__/routes/vault-docs.test.ts |

**Orchestrator MCP Verification**: POST oversized file to `/api/vault-docs`, verify 413 response.

---

### STORY-103: Backend — Notification Jobs API Route
**Requirement IDs**: R-P1-13 through R-P1-15
**Agent**: Backend
**Parallel Group**: 1A

Create `server/routes/notification-jobs.ts` with GET/POST. Create migration `026_notification_jobs.sql`.

**Done When**:
- R-P1-13: `GET /api/notification-jobs` returns 200 with JSON array for authenticated tenant
- R-P1-14: `POST /api/notification-jobs` creates job and returns 201
- R-P1-15: Cross-tenant access returns 404

**Testing Strategy**:
- Unit: Mock DB, verify parameterized queries — REAL business logic, MOCK database
- Negative: Missing required fields return 400

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| server/migrations/026_notification_jobs.sql | Create | server/__tests__/routes/notification-jobs.test.ts |
| server/routes/notification-jobs.ts | Create | server/__tests__/routes/notification-jobs.test.ts |
| server/index.ts | Edit (mount route) | server/__tests__/routes/notification-jobs.test.ts |

**Orchestrator MCP Verification**: Create notification job via POST, verify it appears in GET response.

---

### STORY-104: Frontend — Migrate safetyService to API
**Requirement IDs**: R-P1-16 through R-P1-20
**Agent**: Frontend
**Parallel Group**: 1B (depends on STORY-101)

Rewrite `services/safetyService.ts` to fetch from `/api/safety/*` endpoints. Remove all 6 localStorage key constants and all `localStorage.getItem`/`setItem` calls. Replace `safeParse()` with async API fetches.

**Done When**:
- R-P1-16: `grep -rn 'localStorage' services/safetyService.ts` returns 0 matches
- R-P1-17: `grep -rn 'QUIZZES_KEY\|QUIZ_RESULTS_KEY\|MAINTENANCE_KEY\|TICKETS_KEY\|VENDORS_KEY\|SAFETY_ACTIVITY_KEY' services/safetyService.ts` returns 0 matches
- R-P1-18: All safetyService functions are async and fetch from API
- R-P1-19: `getEquipment` and `getComplianceRecords` use `getAuthHeaders()` instead of `localStorage.getItem("token")`
- R-P1-20: Existing safetyService tests pass with updated mocks

**Testing Strategy**:
- Unit: Mock fetch, verify correct API URL and auth headers — REAL function signatures, MOCK HTTP
- Integration: Verify SafetyView renders data from API response
- Negative: API 500 returns empty arrays (graceful degradation)

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| services/safetyService.ts | Edit (full rewrite to API) | src/__tests__/services/safetyService.test.ts |
| src/__tests__/services/safetyService.enhanced.test.ts | Edit (update mocks) | (self) |

**Orchestrator MCP Verification**: Navigate to Safety tab, verify data loads from API (no localStorage keys in Application panel).

---

### STORY-105: Frontend — Migrate vault.ts to API
**Requirement IDs**: R-P1-21 through R-P1-23
**Agent**: Frontend
**Parallel Group**: 1B (depends on STORY-102)

Rewrite `services/storage/vault.ts` to use `/api/vault-docs` endpoints.

**Done When**:
- R-P1-21: `grep -rn 'localStorage' services/storage/vault.ts` returns 0 matches
- R-P1-22: `STORAGE_KEY_VAULT_DOCS` constant removed
- R-P1-23: `uploadVaultDoc` calls POST /api/vault-docs with multipart form data

**Testing Strategy**:
- Unit: Mock fetch, verify multipart form construction — REAL function signatures, MOCK HTTP
- Negative: Upload failure shows error to caller

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| services/storage/vault.ts | Edit (rewrite to API) | src/__tests__/services/vault.test.ts |
| services/storage/index.ts | Edit (remove STORAGE_KEY_VAULT_DOCS export) | src/__tests__/services/vault.test.ts |

**Orchestrator MCP Verification**: Navigate to FileVault, verify document list loads from API.

---

### STORY-106: Frontend — Migrate notifications.ts to API
**Requirement IDs**: R-P1-24 through R-P1-26
**Agent**: Frontend
**Parallel Group**: 1B (depends on STORY-103)

Rewrite `services/storage/notifications.ts` to use `/api/notification-jobs` endpoints. Remove dual-write pattern.

**Done When**:
- R-P1-24: `grep -rn 'localStorage' services/storage/notifications.ts` returns 0 matches
- R-P1-25: `STORAGE_KEY_NOTIFICATION_JOBS` constant removed
- R-P1-26: `saveNotificationJob` is async and returns server response (no fire-and-forget)

**Testing Strategy**:
- Unit: Mock fetch, verify POST body format — REAL function signatures, MOCK HTTP
- Negative: API failure propagates error to caller

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| services/storage/notifications.ts | Edit (rewrite to API) | src/__tests__/services/notifications.test.ts |
| services/storage/index.ts | Edit (remove STORAGE_KEY_NOTIFICATION_JOBS export) | src/__tests__/services/notifications.test.ts |

**Orchestrator MCP Verification**: Create notification job, verify it persists after page refresh.

---

### STORY-107: Frontend — Migrate incidents localStorage to API-only
**Requirement IDs**: R-P1-27 through R-P1-29
**Agent**: Frontend
**Parallel Group**: 1B

Remove all `localStorage.getItem/setItem` calls from `services/storageService.ts` incident functions. The `/api/incidents` route already exists — make it the sole source of truth.

**Done When**:
- R-P1-27: `grep -rn 'localStorage.*STORAGE_KEY_INCIDENTS\|STORAGE_KEY_INCIDENTS.*localStorage' services/storageService.ts` returns 0 matches
- R-P1-28: `getIncidents` is async and fetches from `/api/incidents` exclusively
- R-P1-29: `seedIncidents` function body remains empty (no-op kept for backward compat)

**Testing Strategy**:
- Unit: Mock fetch, verify all incident CRUD uses API — REAL function signatures, MOCK HTTP
- Negative: API down returns empty array, does not fall back to localStorage

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| services/storageService.ts | Edit (remove localStorage from incident functions) | src/__tests__/services/storageService.test.ts |

**Orchestrator MCP Verification**: Create incident via UI, verify it appears in `/api/incidents` response.

---

### STORY-108: Frontend — Migrate brokerService localStorage to API-only
**Requirement IDs**: R-P1-30 through R-P1-32
**Agent**: Frontend
**Parallel Group**: 1B

Remove `getRawBrokers` localStorage fallback from `services/brokerService.ts`. The `/api/clients` route already handles broker CRUD.

**Done When**:
- R-P1-30: `grep -rn 'localStorage' services/brokerService.ts` returns 0 matches
- R-P1-31: `BROKERS_KEY` constant removed
- R-P1-32: `saveBroker` does not write to localStorage (API-only)

**Testing Strategy**:
- Unit: Mock fetch, verify no localStorage calls — REAL function signatures, MOCK HTTP
- Negative: API failure in `getBrokers` returns empty array (no localStorage fallback)

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| services/brokerService.ts | Edit (remove localStorage) | src/__tests__/services/brokerService.test.ts |

**Orchestrator MCP Verification**: Navigate to Broker Network, verify list loads from API.

---

### STORY-109: Frontend — Migrate authService companies localStorage to API-only
**Requirement IDs**: R-P1-33 through R-P1-35
**Agent**: Frontend
**Parallel Group**: 1B

Remove `COMPANIES_KEY` and `safeParseCompanies()` localStorage usage from `services/authService.ts`. The `/api/companies/:id` route exists.

**Done When**:
- R-P1-33: `grep -rn 'COMPANIES_KEY' services/authService.ts` returns 0 matches
- R-P1-34: `grep -rn 'localStorage.*companies\|companies.*localStorage' services/authService.ts` returns 0 matches
- R-P1-35: `getStoredCompanies()` fetches from API or returns from in-memory cache

**Testing Strategy**:
- Unit: Mock fetch, verify API call for companies — REAL function signatures, MOCK HTTP
- Negative: API failure returns empty array

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| services/authService.ts | Edit (remove localStorage for companies) | src/__tests__/services/authService.test.ts |

**Orchestrator MCP Verification**: Login, verify company data loads from API.

---

### STORY-110: Remove Dead localStorage Infrastructure
**Requirement IDs**: R-P1-36 through R-P1-38
**Agent**: Frontend
**Parallel Group**: 1C (depends on STORY-104 through STORY-109)

Remove `services/storage/core.ts` (tenant key migration helper) and `services/storage/migrationService.ts` since all domains now use API. Update `services/storage/index.ts` barrel exports.

**Done When**:
- R-P1-36: `services/storage/core.ts` deleted or contains no localStorage calls
- R-P1-37: `services/storage/migrationService.ts` deleted or is a no-op
- R-P1-38: `grep -rn 'getTenantKey\|migrateKey' services/` returns 0 matches (excluding test files)

**Testing Strategy**:
- Unit: Verify no imports of deleted modules break — REAL import resolution
- Regression: Full `npx vitest run` passes

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| services/storage/core.ts | Delete or empty | src/__tests__/services/core.test.ts |
| services/storage/migrationService.ts | Delete or empty | src/__tests__/services/migrationService.test.ts |
| services/storage/index.ts | Edit (remove exports) | (covered by regression) |

**Orchestrator MCP Verification**: Run `grep -rn 'localStorage' services/ --include='*.ts' | grep -v __tests__ | grep -v '.test.'` and verify 0 matches in non-config files.

---

### STORY-111: Strip DEMO_MODE from React Components
**Requirement IDs**: R-P1-39 through R-P1-44
**Agent**: Frontend
**Parallel Group**: 1C

Remove all DEMO_MODE imports and conditional blocks from `SafetyView.tsx`, `Settlements.tsx`, and `App.tsx`. The service layer handles all branching — the UI renders what it receives.

**Done When**:
- R-P1-39: `grep -rn 'DEMO_MODE' components/SafetyView.tsx` returns 0 matches
- R-P1-40: `grep -rn 'DEMO_MODE' components/Settlements.tsx` returns 0 matches
- R-P1-41: `grep -rn 'DEMO_MODE' App.tsx` returns 0 matches
- R-P1-42: `grep -rn 'seedIncidents' App.tsx` returns 0 matches (import and call removed)
- R-P1-43: Settlements deductions come from API or service layer, not hardcoded array
- R-P1-44: `grep -rn 'DEMO_MODE' components/ --include='*.tsx'` returns 0 matches

**Testing Strategy**:
- Unit: SafetyView renders without DEMO_MODE import — REAL render, MOCK services
- Unit: Settlements renders deductions from props/service, not hardcoded — REAL render, MOCK services
- Regression: All existing component tests pass

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| components/SafetyView.tsx | Edit (remove DEMO_MODE import + seedIncidents call) | src/__tests__/components/SafetyView.test.ts |
| components/Settlements.tsx | Edit (remove DEMO_MODE conditional, fetch deductions from service) | src/__tests__/components/Settlements.test.ts |
| App.tsx | Edit (remove DEMO_MODE import, seedSystem, seedIncidents) | src/__tests__/App.test.ts |

**Orchestrator MCP Verification**: Navigate to Safety tab and Settlements — verify both render without DEMO_MODE. Check `grep -rn 'DEMO_MODE' components/ --include='*.tsx'` returns 0.

---

### STORY-112: Push DEMO_MODE Branching into Service Layer
**Requirement IDs**: R-P1-45 through R-P1-48
**Agent**: Frontend
**Parallel Group**: 1C

Ensure `authService.ts` and `ocrService.ts` keep their DEMO_MODE branching (this is correct — service layer owns the decision). Clean up: `ocrService.ts` demo mode should return a proper error or delegate to server, not return fake data.

**Done When**:
- R-P1-45: `services/firebase.ts` still exports `DEMO_MODE` (definition stays)
- R-P1-46: `services/authService.ts` DEMO_MODE usage is limited to auth initialization (no UI branching leaked)
- R-P1-47: `services/ocrService.ts` demo mode throws or returns empty result (no fake load data)
- R-P1-48: `grep -rn 'DEMO_MODE' services/ocrService.ts | grep -v import` shows only error/throw paths

**Testing Strategy**:
- Unit: ocrService in demo mode throws clear error — REAL function call, MOCK firebase
- Unit: authService demo mode skips Firebase init — REAL branching, MOCK firebase

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| services/ocrService.ts | Edit (remove demo data, throw in both modes) | src/__tests__/services/ocrService.test.ts |
| services/authService.ts | Edit (verify no UI-facing DEMO_MODE leaks) | src/__tests__/services/authService.test.ts |

**Orchestrator MCP Verification**: Import check — `grep -rn 'import.*DEMO_MODE' components/ App.tsx` returns 0 matches.

---

### STORY-113: Phase 1 Final Orchestrator Sign-off
**Requirement IDs**: R-P1-49 through R-P1-54
**Agent**: Orchestrator (Playwright MCP)
**Parallel Group**: 1D (depends on all Phase 1 stories)

Holistic cross-feature exploratory testing of the entire localStorage migration and DEMO_MODE cleanup.

**Done When**:
- R-P1-49: `npx vitest run` — all frontend tests pass (>= 3,070 baseline)
- R-P1-50: `cd server && npx vitest run` — all backend tests pass (>= 1,792 baseline)
- R-P1-51: `grep -rn 'localStorage' services/ --include='*.ts' | grep -v __tests__ | grep -v '.test.' | grep -v 'getItem("token")' | grep -v firebase | grep -v config` returns 0 matches
- R-P1-52: `grep -rn 'DEMO_MODE' components/ App.tsx --include='*.tsx'` returns 0 matches
- R-P1-53: `npm run build` succeeds with no errors
- R-P1-54: Playwright MCP: Navigate to Dashboard, Safety, Settlements, Broker Network, FileVault — all load data from server, no localStorage artifacts in Application tab

**Verification Commands**:
```bash
npx vitest run 2>&1 | tail -5
cd server && npx vitest run 2>&1 | tail -5
grep -rn 'localStorage' services/ --include='*.ts' | grep -v __tests__ | grep -v '.test.' | grep -v 'getItem("token")' | grep -v firebase | grep -v config | wc -l
grep -rn 'DEMO_MODE' components/ App.tsx --include='*.tsx' | wc -l
npm run build 2>&1 | tail -10
```

**Testing Strategy**: Full regression + manual Playwright MCP browser verification of 5 key pages.

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| (no code changes) | Verification only | (existing test suites) |

---

## Phase 2: UX Polish

**Objective**: Standardize loading/error/empty states, add form validation, and improve Suspense fallbacks from `null` to proper skeletons.

### Done When
- R-P2-09: `grep -rn 'fallback={null}' App.tsx` returns 0 matches
- R-P2-12: `npx vitest run` passes with >= 3,070 tests
- R-P2-06: Email fields reject invalid format (e.g., "not-an-email") on blur and show `Invalid email` inline error
- R-P2-03: AccountingPortal renders ErrorState with retry button when API returns 500

### Testing Strategy

| What | Type | Real/Mock | Detail |
| ---- | ---- | --------- | ------ |
| Loading skeleton render | Unit | Real + Mock | Render component with loading state; assert screen.getByTestId('loading-skeleton') is in DOM |
| Error state render | Unit | Real + Mock | Render component with API error; assert screen.getByText('Retry') is visible |
| Email validation | Unit | Real | Enter "not-an-email", trigger blur; assert screen.getByText(/invalid email/i) is visible |
| Required field rejection | Negative | Real | Submit form with empty required fields; assert error count > 0 |

### STORY-201: Standardize Loading/Error/Empty States
**Requirement IDs**: R-P2-01 through R-P2-04
**Agent**: Frontend

Apply `LoadingSkeleton` and `ErrorState` to AccountingPortal, SafetyView, BrokerManager, and Settlements. These components currently show no loading indicator.

**Done When**:
- R-P2-01: AccountingPortal shows `LoadingSkeleton` while data loads
- R-P2-02: SafetyView shows `LoadingSkeleton` during initial fetch
- R-P2-03: API errors in AccountingPortal show `ErrorState` with retry button
- R-P2-04: API errors in SafetyView show `ErrorState` with retry button

**Testing Strategy**:
- Unit: Render component with loading state, assert LoadingSkeleton visible — REAL render, MOCK slow API
- Unit: Render component with error state, assert ErrorState visible — REAL render, MOCK failed API
- Negative: Error state retry re-fetches data

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| components/AccountingPortal.tsx | Edit (add loading/error states) | src/__tests__/components/AccountingPortal.test.tsx |
| components/SafetyView.tsx | Edit (add loading/error states) | src/__tests__/components/SafetyView.test.tsx |
| components/BrokerManager.tsx | Edit (add loading/error states) | src/__tests__/components/BrokerManager.test.tsx |
| components/Settlements.tsx | Edit (add loading/error states) | src/__tests__/components/Settlements.test.tsx |

**Orchestrator MCP Verification**: Navigate to AccountingPortal with slow network throttling, verify skeleton appears before data.

---

### STORY-202: Form Validation & Autocomplete
**Requirement IDs**: R-P2-05 through R-P2-08
**Agent**: Frontend

Add required field indicators, inline validation, and autocomplete attributes to Auth, CompanyProfile, and load creation forms.

**Done When**:
- R-P2-05: Required fields show red asterisk or "Required" label
- R-P2-06: Email fields validate format on blur and show inline error
- R-P2-07: All password inputs have `autocomplete="current-password"` or `autocomplete="new-password"`
- R-P2-08: MC/DOT fields in CompanyProfile show format hint ("e.g., MC-123456")

**Testing Strategy**:
- Unit: Render form, leave required field blank, assert error visible — REAL render, REAL validation
- Unit: Enter invalid email, trigger blur, assert format error — REAL render, REAL validation
- Accessibility: Verify `aria-required="true"` on required inputs

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| components/Auth.tsx | Edit (add autocomplete, validation) | src/__tests__/components/Auth.test.tsx |
| components/CompanyProfile.tsx | Edit (add required indicators, MC/DOT hints) | src/__tests__/components/CompanyProfile.test.tsx |
| components/EditLoadForm.tsx | Edit (add required field indicators) | src/__tests__/components/EditLoadForm.test.tsx |

**Orchestrator MCP Verification**: Navigate to signup form, submit with empty fields, verify validation messages appear.

---

### STORY-203: Improve Suspense Fallbacks
**Requirement IDs**: R-P2-09 through R-P2-11
**Agent**: Frontend

Replace 7 `<Suspense fallback={null}>` instances in App.tsx with `<Suspense fallback={<LoadingSkeleton variant="card" count={3} />}>` or appropriate skeleton variant.

**Done When**:
- R-P2-09: `grep -rn 'fallback={null}' App.tsx` returns 0 matches
- R-P2-10: Every `<Suspense>` in App.tsx has a `LoadingSkeleton` fallback
- R-P2-11: `npm run build` succeeds (no new bundle size regression)

**Testing Strategy**:
- Unit: Render App with lazy component not yet loaded, assert LoadingSkeleton is in the DOM — REAL render
- Regression: Full frontend test suite passes

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| App.tsx | Edit (replace 7 fallback={null} with LoadingSkeleton) | src/__tests__/App.test.ts |

**Orchestrator MCP Verification**: Navigate to a lazy-loaded route (e.g., Accounting), verify skeleton flashes before content.

---

### STORY-204: Phase 2 Final Orchestrator Sign-off
**Requirement IDs**: R-P2-12 through R-P2-15
**Agent**: Orchestrator (Playwright MCP)

**Done When**:
- R-P2-12: `npx vitest run` — all frontend tests pass (>= 3,070 baseline)
- R-P2-13: `grep -rn 'fallback={null}' App.tsx` returns 0 matches
- R-P2-14: Playwright MCP: Navigate to Auth signup, leave email blank, submit — validation error visible
- R-P2-15: Playwright MCP: Navigate to AccountingPortal — skeleton appears before data loads

**Verification Commands**:
```bash
npx vitest run 2>&1 | tail -5
grep -rn 'fallback={null}' App.tsx | wc -l
npm run build 2>&1 | tail -10
```

**Testing Strategy**: Full frontend regression + Playwright MCP verification of 3 key UX flows.

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| (no code changes) | Verification only | (existing test suites) |

---

## Phase 3: Feature Implementation

**Objective**: Wire file upload to a proper Express route with Multer and strict validation. Remove unimplemented features that show fake success.

### Done When
- R-P3-01: `POST /api/documents` accepts multipart/form-data with file field and returns 201
- R-P3-02: File > 10MB rejects with 413 JSON error body
- R-P3-03: Invalid MIME type (e.g., .exe) rejects with 400 JSON error body
- R-P3-13: `npx vitest run` passes with all tests green
- R-P3-14: `cd server && npx vitest run` passes with all tests green

### Testing Strategy

| What | Type | Real/Mock | Detail |
| ---- | ---- | --------- | ------ |
| File upload via Multer | Integration | Real + Mock | POST multipart; assert response.status === 201 and body.documentId is defined |
| Oversized file rejection | Negative | Real + Mock | POST 10.1MB file; assert response.status === 413 |
| Bad MIME type rejection | Negative | Real + Mock | POST .exe file; assert response.status === 400 |
| Path traversal sanitization | Unit | Real | assert sanitizeFilename('../../../etc/passwd') does not contain '..' |

### STORY-301: Wire File Upload Express Route
**Requirement IDs**: R-P3-01 through R-P3-07
**Agent**: Backend + Frontend

Create `server/routes/documents.ts` that uses the existing `document.service.ts` + `document.schema.ts` + `document.repository.ts`. Add Multer middleware for multipart parsing. Wire FileVault component to use the new endpoint.

**Done When**:
- R-P3-01: `POST /api/documents` accepts multipart/form-data with file field
- R-P3-02: File > 10MB returns 413 with JSON error body
- R-P3-03: Invalid MIME type (not pdf/jpeg/png/tiff) returns 400 with JSON error body
- R-P3-04: Path traversal filename (`../../../etc/passwd`) is sanitized by `sanitizeFilename()`
- R-P3-05: `GET /api/documents` returns document list for authenticated tenant
- R-P3-06: `GET /api/documents/:id/download` returns signed URL
- R-P3-07: Cross-tenant document access returns 404

**Testing Strategy**:
- Unit: Test document.service.ts validateFile with oversized/wrong-type files — REAL validation, MOCK storage
- Integration: POST with Multer via supertest, verify file saved — REAL middleware, MOCK storage adapter
- Negative: 10.1MB file returns 413, `.exe` file returns 400, `../path` sanitized
- Playwright MCP: Upload valid file, verify success; upload oversized file, verify 413 error

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| server/routes/documents.ts | Create (Multer + document.service) | server/__tests__/routes/documents.test.ts |
| server/index.ts | Edit (mount /api/documents route) | server/__tests__/routes/documents.test.ts |
| components/FileVault.tsx | Edit (wire to POST /api/documents) | src/__tests__/components/FileVault.test.tsx |
| services/storage/vault.ts | Edit (update upload to use /api/documents) | src/__tests__/services/vault.test.ts |

**Orchestrator MCP Verification**: Upload a 1KB PDF via FileVault UI — verify 201 success. Upload a 15MB file — verify rejection message. Upload an .exe — verify rejection message.

---

### STORY-302: Remove Unimplemented Features
**Requirement IDs**: R-P3-08 through R-P3-12
**Agent**: Frontend + Backend

Hide QB Sync section from AccountingPortal. Ensure IFTA filing returns 501. Remove WebSocket tracking stubs. Remove "coming soon" language.

**Done When**:
- R-P3-08: QB Sync section not rendered in AccountingPortal
- R-P3-09: `POST /api/accounting/sync-qb` returns 501
- R-P3-10: `grep -rn 'coming soon' components/ --include='*.tsx' -i` returns 0 matches
- R-P3-11: `grep -rn 'Sync queued' server/routes/` returns 0 matches
- R-P3-12: No button in UI triggers a fake success toast for unimplemented features

**Testing Strategy**:
- Unit: Render AccountingPortal, assert QB Sync section not in DOM — REAL render, MOCK data
- Integration: POST to sync-qb, verify 501 — REAL HTTP, MOCK DB

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| components/AccountingPortal.tsx | Edit (hide QB Sync section) | src/__tests__/components/AccountingPortal.test.tsx |
| server/routes/accounting.ts | Edit (verify 501 on sync-qb) | server/__tests__/routes/accounting.test.ts |

**Orchestrator MCP Verification**: Navigate to AccountingPortal, verify QB Sync button is absent.

---

### STORY-303: Phase 3 Final Orchestrator Sign-off
**Requirement IDs**: R-P3-13 through R-P3-17
**Agent**: Orchestrator (Playwright MCP)

**Done When**:
- R-P3-13: `npx vitest run` — all frontend tests pass
- R-P3-14: `cd server && npx vitest run` — all backend tests pass
- R-P3-15: Playwright MCP: Upload 1KB PDF to FileVault, verify success response
- R-P3-16: Playwright MCP: Upload 15MB file, verify 413 rejection
- R-P3-17: Playwright MCP: Navigate to AccountingPortal, verify no QB Sync section

**Verification Commands**:
```bash
npx vitest run 2>&1 | tail -5
cd server && npx vitest run 2>&1 | tail -5
npm run build 2>&1 | tail -10
```

**Testing Strategy**: Full regression + Playwright MCP upload happy/unhappy path verification.

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| (no code changes) | Verification only | (existing test suites) |

---

## Phase 4: Hardening

**Objective**: Fix all 401 TypeScript errors, add forbidden pattern CI guard for localStorage regressions, and reduce bundle chunk sizes below 250KB per lazy route.

### Done When
- R-P4-15: `npx tsc --noEmit 2>&1 | grep -c 'error TS'` returns 0
- R-P4-12: `npm run build` shows no single chunk file > 250KB (excluding shared vendor chunks)
- R-P4-09: Forbidden pattern guard rejects `localStorage.setItem("loadpilot_test", "value")` in any service file
- R-P4-17: `npx vitest run` passes with all tests green

### Testing Strategy

| What | Type | Real/Mock | Detail |
| ---- | ---- | --------- | ------ |
| TypeScript compilation | Build | Real | assert `npx tsc --noEmit` exit code === 0 |
| Bundle chunk sizes | Build | Real | assert all chunk files < 250KB in build output |
| Forbidden pattern guard | CI Guard | Real | assert test fails when localStorage.setItem added to service file |
| localStorage regression rejection | Negative | Real | assert forbidden-patterns.test.ts rejects localStorage in services/ |

### STORY-401: Fix TypeScript Errors — Test Files (Batch 1: services)
**Requirement IDs**: R-P4-01 through R-P4-03
**Agent**: SDET
**Parallel Group**: 4A

Fix TypeScript errors in `src/__tests__/services/*.test.ts` files. Primary issues: incorrect mock type definitions, missing type annotations on vi.fn() return values, incorrect parameter types for mocked functions.

**Done When**:
- R-P4-01: `npx tsc --noEmit 2>&1 | grep 'src/__tests__/services/' | wc -l` returns 0
- R-P4-02: All fixed test files still pass when run via `npx vitest run`
- R-P4-03: No `as any` casts added to silence errors (fix the actual type)

**Testing Strategy**:
- Compile check: `npx tsc --noEmit` succeeds for service test files
- Regression: All tests still pass

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| src/__tests__/services/*.test.ts | Edit (fix type errors) | (self — test files) |

**Orchestrator MCP Verification**: Run `npx tsc --noEmit 2>&1 | grep 'src/__tests__/services/' | wc -l` and verify 0.

---

### STORY-402: Fix TypeScript Errors — Test Files (Batch 2: components)
**Requirement IDs**: R-P4-04 through R-P4-06
**Agent**: SDET
**Parallel Group**: 4A

Fix TypeScript errors in `src/__tests__/components/*.test.tsx` files.

**Done When**:
- R-P4-04: `npx tsc --noEmit 2>&1 | grep 'src/__tests__/components/' | wc -l` returns 0
- R-P4-05: All fixed test files still pass when run via `npx vitest run`
- R-P4-06: No `as any` casts added to silence errors

**Testing Strategy**:
- Compile check: `npx tsc --noEmit` succeeds for component test files
- Regression: All tests still pass

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| src/__tests__/components/*.test.tsx | Edit (fix type errors) | (self — test files) |

**Orchestrator MCP Verification**: Run `npx tsc --noEmit 2>&1 | grep 'src/__tests__/components/' | wc -l` and verify 0.

---

### STORY-403: Fix TypeScript Error — vite.config.ts
**Requirement IDs**: R-P4-07
**Agent**: Frontend
**Parallel Group**: 4A

Fix the `allowedHosts: true` type error in `vite.config.ts`. The type expects `true | string[]` but TypeScript infers `boolean`.

**Done When**:
- R-P4-07: `npx tsc --noEmit 2>&1 | grep 'vite.config.ts' | wc -l` returns 0

**Testing Strategy**:
- Compile check: `npx tsc --noEmit` succeeds for vite.config.ts
- Regression: `npm run build` succeeds

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| vite.config.ts | Edit (fix allowedHosts type) | (build verification) |

**Orchestrator MCP Verification**: `npx tsc --noEmit 2>&1 | grep 'vite.config.ts' | wc -l` returns 0.

---

### STORY-404: Forbidden Pattern CI Guard — localStorage Regression
**Requirement IDs**: R-P4-08 through R-P4-10
**Agent**: SDET

Extend `server/__tests__/integration/forbidden-patterns.test.ts` to scan for localStorage-as-SoR regressions in services (excluding test files, config, and auth token reads).

**Done When**:
- R-P4-08: Test scans `services/**/*.ts` (excluding `__tests__`) for `localStorage.getItem` / `localStorage.setItem` outside of auth token reads
- R-P4-09: Adding `localStorage.setItem("loadpilot_test", "value")` to any service file causes the test to fail
- R-P4-10: Existing tests in forbidden-patterns.test.ts still pass

**Testing Strategy**:
- Self-test: Temporarily add a localStorage call to a service file, verify test fails, then revert

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| server/__tests__/integration/forbidden-patterns.test.ts | Edit (add localStorage guard section) | (self — test file) |

**Orchestrator MCP Verification**: Run `cd server && npx vitest run __tests__/integration/forbidden-patterns.test.ts` and verify all pass.

---

### STORY-405: Bundle Splitting — Reduce Chunk Sizes
**Requirement IDs**: R-P4-11 through R-P4-14
**Agent**: Frontend

Optimize bundle splitting in `vite.config.ts`. Add eagerly imported heavy components (LoadList, Intelligence, Settlements, CommandCenterView, LoadSetupModal, GoogleMapsAPITester) to React.lazy. Ensure `Suspense fallback={null}` replaced in STORY-203. Target: no single route chunk > 250KB uncompressed.

**Done When**:
- R-P4-11: `LoadList`, `Intelligence`, `Settlements`, `CommandCenterView` converted to React.lazy imports in App.tsx
- R-P4-12: `npm run build 2>&1 | grep 'kB'` shows no single chunk file > 250KB (excluding vendor/maps/pdf/charts/capture which are shared)
- R-P4-13: `grep -c '^import.*from.*components/' App.tsx` shows only ErrorBoundary, ConnectionBanner, Toast, LoadingSkeleton as eager imports (UI shell components)
- R-P4-14: Application loads and all routes render correctly after splitting

**Testing Strategy**:
- Build check: `npm run build` succeeds, chunk sizes verified
- Regression: All frontend tests pass
- Smoke: Navigate to each converted component, verify it renders

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| App.tsx | Edit (convert 6 eager imports to React.lazy) | src/__tests__/App.test.ts |
| vite.config.ts | Edit (refine manualChunks if needed) | (build verification) |

**Orchestrator MCP Verification**: Run `npm run build` and verify no chunk > 250KB. Navigate to Dashboard, Load Board, Settlements — all render.

---

### STORY-406: Phase 4 Final Orchestrator Sign-off
**Requirement IDs**: R-P4-15 through R-P4-20
**Agent**: Orchestrator (Playwright MCP)

**Done When**:
- R-P4-15: `npx tsc --noEmit 2>&1 | grep -c 'error TS'` returns 0
- R-P4-16: `cd server && npx tsc --noEmit` returns 0 errors
- R-P4-17: `npx vitest run` — all frontend tests pass
- R-P4-18: `cd server && npx vitest run` — all backend tests pass
- R-P4-19: `npm run build` succeeds with no chunk > 250KB (excluding shared vendor chunks)
- R-P4-20: Playwright MCP: Full navigation sweep — Dashboard, Load Board, Accounting, Safety, Settlements, Broker Network, FileVault — all render

**Verification Commands**:
```bash
npx tsc --noEmit 2>&1 | grep -c 'error TS' || echo "0"
cd server && npx tsc --noEmit 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
cd server && npx vitest run 2>&1 | tail -5
npm run build 2>&1 | tail -15
```

**Testing Strategy**: Full TypeScript compilation + full test regression + build verification + Playwright MCP navigation sweep.

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| (no code changes) | Verification only | (existing test suites) |

---

## Phase 5: Release Readiness

**Objective**: Operational readiness documentation, full regression, release evidence generation.

### Done When
- R-P5-07: `npx tsc --noEmit` returns 0 errors (frontend)
- R-P5-08: `cd server && npx tsc --noEmit` returns 0 errors (backend)
- R-P5-10: `grep -rn 'localStorage' services/ --include='*.ts' | grep -v __tests__ | grep -v '.test.' | grep -v config | grep -v firebase | wc -l` returns 0
- R-P5-12: `docs/release/evidence.md` generates with test counts, coverage, and GO decision
- R-P5-01: `GET /api/health` rejects with error status when DB is down

### Testing Strategy

| What | Type | Real/Mock | Detail |
| ---- | ---- | --------- | ------ |
| Health endpoint schema | Unit | Real + Mock | assert response.body has keys: mysql, firebase, uptime |
| Health endpoint DB down | Negative | Real + Mock | Mock dead pool; assert response.body.mysql === 'disconnected' |
| Full regression | Regression | Real | assert FE tests >= 3,070 and BE tests >= 1,792 all passing |
| Release evidence | Documentation | N/A | assert docs/release/evidence.md exists and contains GO decision |

### STORY-501: Operational Readiness
**Requirement IDs**: R-P5-01 through R-P5-04
**Agent**: Backend + Librarian

Enhanced health check endpoint. Rollback documentation. Ops readiness checklist.

**Done When**:
- R-P5-01: `GET /api/health` returns `{ status: "ok", mysql: "connected", firebase: "ready", uptime: <seconds> }`
- R-P5-02: `docs/ops/rollback-procedure.md` exists with step-by-step instructions
- R-P5-03: `docs/ops/readiness-checklist.md` exists with deploy prerequisites
- R-P5-04: Health endpoint has a test verifying JSON schema

**Testing Strategy**:
- Unit: Mock DB pool status, verify health JSON shape — REAL endpoint, MOCK pool
- Integration: Hit /api/health, verify 200 + JSON

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| server/routes/health.ts | Edit (add dependency status) | server/__tests__/routes/health.test.ts |
| docs/ops/rollback-procedure.md | Create | (documentation) |
| docs/ops/readiness-checklist.md | Create | (documentation) |

**Orchestrator MCP Verification**: GET /api/health, verify JSON contains mysql/firebase/uptime keys.

---

### STORY-502: Full Regression + Release Evidence
**Requirement IDs**: R-P5-05 through R-P5-12
**Agent**: Orchestrator (Playwright MCP)

Full regression run. Generate release evidence document.

**Done When**:
- R-P5-05: `cd server && npx vitest run` — tests >= 1,792 baseline, all passing
- R-P5-06: `npx vitest run` — tests >= 3,070 baseline, all passing
- R-P5-07: `npx tsc --noEmit` — 0 errors (frontend)
- R-P5-08: `cd server && npx tsc --noEmit` — 0 errors (backend)
- R-P5-09: `npm run build` — succeeds, no warnings
- R-P5-10: `grep -rn 'localStorage' services/ --include='*.ts' | grep -v __tests__ | grep -v '.test.' | grep -v config | grep -v firebase | wc -l` returns 0
- R-P5-11: `grep -rn 'DEMO_MODE' components/ App.tsx --include='*.tsx' | wc -l` returns 0
- R-P5-12: `docs/release/evidence.md` generated with test counts, coverage percentages, TS error count, chunk sizes, and sign-off timestamp

**Verification Commands**:
```bash
cd server && npx vitest run 2>&1 | tail -5
npx vitest run 2>&1 | tail -5
npx tsc --noEmit 2>&1 | tail -3
cd server && npx tsc --noEmit 2>&1 | tail -3
npm run build 2>&1 | tail -15
grep -rn 'localStorage' services/ --include='*.ts' | grep -v __tests__ | grep -v '.test.' | grep -v config | grep -v firebase | wc -l
grep -rn 'DEMO_MODE' components/ App.tsx --include='*.tsx' | wc -l
```

**Testing Strategy**: Full test suite regression, TypeScript compilation, build verification, forbidden pattern scan, Playwright MCP full navigation sweep of all 15 pages.

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| docs/release/evidence.md | Create | (documentation) |

---

### STORY-503: Phase 5 Final Orchestrator Sign-off (Go/No-Go)
**Requirement IDs**: R-P5-13 through R-P5-18
**Agent**: Orchestrator (Playwright MCP)

The final go/no-go gate. Playwright MCP performs a full exploratory sweep of every major page.

**Done When**:
- R-P5-13: Playwright MCP: Login flow succeeds
- R-P5-14: Playwright MCP: Navigate all 15 pages — Dashboard, Load Board, Calendar, Dispatch Timeline, Accounting, Safety, Settlements, Broker Network, FileVault, Scanner, Intelligence, Operations Center, Analytics, Driver Mobile, Booking Portal — all render without errors
- R-P5-15: Playwright MCP: Console log shows 0 uncaught exceptions
- R-P5-16: All verification commands from STORY-502 re-confirmed
- R-P5-17: No critical/high severity regressions detected
- R-P5-18: `docs/release/evidence.md` updated with final timestamp and GO decision

**Verification Commands**:
```bash
npx vitest run 2>&1 | tail -5
cd server && npx vitest run 2>&1 | tail -5
npx tsc --noEmit 2>&1 | tail -3
npm run build 2>&1 | tail -15
```

**Testing Strategy**: Full Playwright MCP exploratory navigation + console error monitoring + final regression confirmation.

**Changes**:

| File | Action | Test File |
| ---- | ------ | --------- |
| docs/release/evidence.md | Edit (add final GO/NO-GO) | (documentation) |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Safety domain migration breaks SafetyView rendering | Medium | High | Backend route + frontend rewrite are in separate parallel groups; integration tested in STORY-113 sign-off |
| TypeScript error fixes break passing tests | Medium | Medium | Run full vitest after each batch of fixes; no `as any` casts allowed |
| Bundle splitting causes runtime import errors | Low | High | Smoke test every lazy route in STORY-405; build + navigate verification |
| DEMO_MODE removal breaks dev environment | Low | Medium | DEMO_MODE stays in firebase.ts/authService.ts (service layer); only stripped from UI |
| 3 new migrations (024-026) conflict with production data | Low | High | Migrations are additive (CREATE TABLE); no ALTER on existing tables |
| Multer upload route exposes file system paths | Low | Critical | document.service.ts sanitizeFilename already handles path traversal; tested in STORY-301 |

## Rollback Notes

- **Phase 1**: If localStorage migration causes data loss, revert the feature branch. Server routes are additive (new tables), so rollback only requires reverting frontend service rewrites.
- **Phase 2**: UX-only changes; safe to revert individual component files.
- **Phase 3**: Document upload route is new; revert route + mount in index.ts. FileVault falls back to existing vault.ts behavior.
- **Phase 4**: TypeScript fixes are non-functional; revert if any tests break. Bundle splitting revert = restore eager imports in App.tsx.
- **Phase 5**: Documentation-only; nothing to revert.

## Parallel Execution Map

```
Phase 1:
  Group 1A (Backend, parallel):  STORY-101, STORY-102, STORY-103
  Group 1B (Frontend, parallel): STORY-104*, STORY-105*, STORY-106*, STORY-107, STORY-108, STORY-109
  Group 1C (Frontend, parallel): STORY-110**, STORY-111, STORY-112
  Group 1D (Orchestrator):       STORY-113***
  * depends on corresponding 1A story
  ** depends on all 1B stories
  *** depends on all 1C stories

Phase 2:
  Group 2A (Frontend, parallel): STORY-201, STORY-202, STORY-203
  Group 2B (Orchestrator):       STORY-204

Phase 3:
  Group 3A (Backend+Frontend):   STORY-301, STORY-302
  Group 3B (Orchestrator):       STORY-303

Phase 4:
  Group 4A (SDET+Frontend, parallel): STORY-401, STORY-402, STORY-403, STORY-404, STORY-405
  Group 4B (Orchestrator):             STORY-406

Phase 5:
  Group 5A: STORY-501
  Group 5B: STORY-502 (depends on 5A)
  Group 5C: STORY-503 (depends on 5B)
```

## Story-Level DoD Checklist (applies to every story)

Every feature story must satisfy ALL of these before marking complete:

- [ ] All unit/integration tests pass (`npx vitest run` or `cd server && npx vitest run`)
- [ ] No new TypeScript errors introduced (`npx tsc --noEmit`)
- [ ] Build succeeds (`npm run build`)
- [ ] R-PN-NN requirement IDs present in test file comments
- [ ] **Orchestrator MCP Verification Passed** (Playwright browser verification as specified per story)

## Summary

| Phase | Stories | New Tests (est.) | Key Deliverable |
| ----- | ------- | ---------------- | --------------- |
| 1     | 13      | ~120             | All localStorage migrated to API; DEMO_MODE out of UI |
| 2     | 4       | ~30              | Loading/error states, form validation, Suspense fallbacks |
| 3     | 3       | ~40              | File upload wired with Multer; unimplemented features hidden |
| 4     | 6       | ~20              | 0 TypeScript errors; CI guard; chunks < 250KB |
| 5     | 3       | ~5               | Ops readiness docs; release evidence; GO/NO-GO |
| **Total** | **29** | **~215** | **Production-hardened, server-authoritative LoadPilot** |
