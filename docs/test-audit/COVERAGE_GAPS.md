# Coverage Gap Analysis

**Agent**: 10 (E2E Governance)
**Date**: 2026-03-17
**Source**: Istanbul coverage reports from `coverage/` and `server/coverage/`

---

## Current State vs Targets

### Backend (server/)

| Metric | Current | Target | Gap | Status |
|---|---|---|---|---|
| Statements | 77.53% | 90% | -12.47% | BELOW TARGET |
| Branches | 68.53% | 85% | -16.47% | BELOW TARGET |
| Functions | 82.16% | 90% | -7.84% | BELOW TARGET |
| Lines | 78.06% | 90% | -11.94% | BELOW TARGET |

### Frontend (src/)

| Metric | Current | Target | Gap | Status |
|---|---|---|---|---|
| Statements | 29.92% | 80% | -50.08% | CRITICAL GAP |
| Branches | 23.73% | 70% | -46.27% | CRITICAL GAP |
| Functions | 20.90% | 75% | -54.10% | CRITICAL GAP |
| Lines | 31.66% | 80% | -48.34% | CRITICAL GAP |

---

## Backend Coverage by Module

| Module | Stmts | Branches | Funcs | Lines | Priority |
|---|---|---|---|---|---|
| `server/` (root: index.ts, db.ts) | 25.95% | 10.00% | 20.00% | 27.96% | P1 - Critical |
| `server/__tests__/helpers/` | 36.36% | 14.28% | 30.00% | 37.14% | P3 - Low (test helpers) |
| `server/errors/` | 100% | 100% | 100% | 100% | Done |
| `server/lib/` | 85.89% | 58.92% | 80.48% | 85.40% | P2 - Branch gap |
| `server/middleware/` | 95.33% | 88.00% | 95.83% | 95.86% | Done (above target) |
| `server/repositories/` | 94.91% | 88.48% | 100% | 96.12% | Done (above target) |
| `server/routes/` | 72.96% | 63.23% | 80.76% | 73.12% | P1 - Largest gap |
| `server/schemas/` | 96.42% | 93.33% | 100% | 96.29% | Done (above target) |
| `server/services/` | 97.48% | 89.06% | 97.82% | 97.72% | Done (above target) |

### Backend Gap Analysis

**Highest-priority gaps** (most impact on overall numbers):

1. **`server/routes/`** (72.96% stmts, 63.23% branches): Contains 1,365 statements, the largest module. Needs ~232 more statements covered and ~115 more branches. Routes like `loads.ts`, `accounting.ts`, `dispatch.ts`, `users.ts` are the biggest files.

2. **`server/` root** (25.95% stmts): `index.ts` and `db.ts` startup/config code. Only 131 statements total -- small absolute impact but very low percentage.

3. **`server/lib/`** (85.89% stmts, 58.92% branches): Branch coverage is the weak point. The `lib/` module has 241 branches with only 142 covered. Likely `migrator.ts`, `db-helpers.ts`, or logger conditional paths.

---

## Frontend Coverage by Module

| Module | Stmts | Branches | Funcs | Lines | Priority |
|---|---|---|---|---|---|
| Root (App.tsx, types.ts) | 100% | 100% | 100% | 100% | Done |
| `components/` | 46.47% | 37.89% | 30.97% | 47.23% | P1 - Largest gap |
| `components/ui/` | 53.57% | 50.00% | 55.00% | 57.77% | P2 - Medium gap |
| `data/` | 100% | 100% | 100% | 100% | Done |
| `fixtures/` | 0% | 0% | 0% | 0% | N/A (test data) |
| `services/` | 12.12% | 1.47% | 3.10% | 13.55% | P1 - Critical |
| `services/storage/` | 35.26% | 25.78% | 32.14% | 37.74% | P1 - Critical |

### Frontend Gap Analysis

**Critical gaps** (driving the overall low percentages):

1. **`services/`** (12.12% stmts, 1.47% branches): Contains 1,188 statements with only 144 covered. This is the biggest single contributor to the frontend coverage deficit. Files like `authService.ts`, `storageService.ts`, `brokerService.ts`, `safetyService.ts` are mostly untested.

2. **`components/`** (46.47% stmts, 37.89% branches): Contains 1,065 statements. Many components have no tests at all. The largest components (`Dashboard.tsx`, `LoadBoardEnhanced.tsx`, `AccountingPortal.tsx`, etc.) are partially covered by source-inspection tests that do not count as real coverage.

3. **`services/storage/`** (35.26% stmts, 25.78% branches): The migrated API storage layer. 346 statements. `quotes.ts`, `leads.ts`, `bookings.ts`, `messages.ts`, `calls.ts`, `tasks.ts` need API integration tests.

---

## Agent Ownership Map

Each coverage gap is assigned to the agent best positioned to fill it.

### Backend Gaps

| File/Module | Gap Type | Assigned Agent | Priority |
|---|---|---|---|
| `server/routes/loads.ts` | Stmts + Branches | Agent 2 (Load Lifecycle) | P1 |
| `server/routes/accounting.ts` | Stmts + Branches | Agent 4 (Accounting) | P1 |
| `server/routes/dispatch.ts` | Stmts + Branches | Agent 3 (Dispatch/Assignment) | P1 |
| `server/routes/users.ts` | Stmts + Branches | Agent 5 (Users/Admin) | P1 |
| `server/routes/equipment.ts` | Stmts + Branches | Agent 6 (Equipment/Compliance) | P2 |
| `server/routes/clients.ts` | Stmts + Branches | Agent 7 (Clients/Contacts) | P2 |
| `server/routes/incidents.ts` | Stmts + Branches | Agent 6 (Equipment/Compliance) | P2 |
| `server/routes/compliance.ts` | Stmts + Branches | Agent 6 (Equipment/Compliance) | P2 |
| `server/routes/contracts.ts` | Stmts + Branches | Agent 7 (Clients/Contacts) | P2 |
| `server/routes/exceptions.ts` | Stmts + Branches | Agent 8 (Exceptions/Comms) | P2 |
| `server/routes/messages.ts` | Stmts + Branches | Agent 8 (Exceptions/Comms) | P3 |
| `server/routes/call-sessions.ts` | Stmts + Branches | Agent 8 (Exceptions/Comms) | P3 |
| `server/routes/tracking.ts` | Stmts + Branches | Agent 3 (Dispatch/Assignment) | P3 |
| `server/routes/ai.ts` | Stmts + Branches | Agent 9 (AI/Scanner) | P3 |
| `server/routes/weather.ts` | Stmts + Branches | Agent 9 (AI/Scanner) | P3 |
| `server/lib/` (branch gap) | Branches | Agent 1 (Infrastructure) | P2 |
| `server/` root (index.ts, db.ts) | Stmts + Branches | Agent 1 (Infrastructure) | P3 |

### Frontend Gaps

| File/Module | Gap Type | Assigned Agent | Priority |
|---|---|---|---|
| `services/authService.ts` | Stmts + Branches + Funcs | Agent 1 (Infrastructure) | P1 |
| `services/storageService.ts` | Stmts + Branches + Funcs | Agent 1 (Infrastructure) | P1 |
| `services/brokerService.ts` | Stmts + Branches + Funcs | Agent 7 (Clients/Contacts) | P1 |
| `services/safetyService.ts` | Stmts + Branches + Funcs | Agent 6 (Equipment/Compliance) | P2 |
| `services/storage/quotes.ts` | Stmts + Branches + Funcs | Agent 4 (Accounting) | P1 |
| `services/storage/leads.ts` | Stmts + Branches + Funcs | Agent 7 (Clients/Contacts) | P2 |
| `services/storage/bookings.ts` | Stmts + Branches + Funcs | Agent 2 (Load Lifecycle) | P1 |
| `services/storage/messages.ts` | Stmts + Branches + Funcs | Agent 8 (Exceptions/Comms) | P2 |
| `services/storage/calls.ts` | Stmts + Branches + Funcs | Agent 8 (Exceptions/Comms) | P2 |
| `services/storage/tasks.ts` | Stmts + Branches + Funcs | Agent 8 (Exceptions/Comms) | P3 |
| `components/Dashboard.tsx` | Stmts + Branches + Funcs | Agent 2 (Load Lifecycle) | P1 |
| `components/LoadBoardEnhanced.tsx` | Stmts + Branches + Funcs | Agent 2 (Load Lifecycle) | P1 |
| `components/AccountingPortal.tsx` | Stmts + Branches + Funcs | Agent 4 (Accounting) | P1 |
| `components/EditLoadForm.tsx` | Stmts + Branches + Funcs | Agent 2 (Load Lifecycle) | P2 |
| `components/DriverMobileHome.tsx` | Stmts + Branches + Funcs | Agent 3 (Dispatch/Assignment) | P2 |
| `components/QuoteManager.tsx` | Stmts + Branches + Funcs | Agent 4 (Accounting) | P2 |
| `components/SafetyView.tsx` | Stmts + Branches + Funcs | Agent 6 (Equipment/Compliance) | P2 |
| `components/BrokerManager.tsx` | Stmts + Branches + Funcs | Agent 7 (Clients/Contacts) | P2 |
| `components/CommandCenterView.tsx` | Stmts + Branches + Funcs | Agent 3 (Dispatch/Assignment) | P3 |
| `components/GlobalMapViewEnhanced.tsx` | Stmts + Branches + Funcs | Agent 3 (Dispatch/Assignment) | P3 |
| `components/Settlements.tsx` | Stmts + Branches + Funcs | Agent 4 (Accounting) | P2 |
| `components/Scanner.tsx` | Stmts + Branches + Funcs | Agent 9 (AI/Scanner) | P2 |
| `components/ui/ConfirmDialog.tsx` | Stmts + Branches + Funcs | Agent 1 (Infrastructure) | P3 |
| `components/ui/ErrorState.tsx` | Stmts + Branches + Funcs | Agent 1 (Infrastructure) | P3 |

---

## E2E Coverage Gaps

### Existing E2E Spec Coverage (28 spec files)

| Spec File | Covers | Auth Tests | CRUD Tests | UI Tests |
|---|---|---|---|---|
| `load-lifecycle.spec.ts` | Load CRUD, status transitions | Yes | Yes (authed) | Yes (skipped) |
| `accounting-financials.spec.ts` | Accounting auth enforcement | Yes | No | No |
| `settlement.spec.ts` | Settlement auth, immutability | Yes | No | Yes (skipped) |
| `users-admin.spec.ts` | User API auth enforcement | Yes | No | No |
| `assignment-status.spec.ts` | Status transitions | Yes | Yes (authed) | No |
| `auth.spec.ts` | Auth flows | Yes | No | Yes (skipped) |
| Others (22 files) | Various auth/UI checks | Mixed | Limited | Mostly skipped |

### Missing E2E Canonical Journeys

| Journey | Status | Gap Description |
|---|---|---|
| **Full Load Lifecycle** (create->assign->dispatch->transit->deliver->complete) | Partial | Only create/retrieve/status-update covered. No full 8-state walk-through. |
| **Accounting Flow** (invoice->approve->payment->reconcile) | Missing | Only auth enforcement tested. No CRUD with real auth. |
| **Driver Workflow** (login->view assignments->start route->update status) | Missing | No driver-role E2E tests exist. |
| **Admin User Management** (create user->assign role->modify) | Missing | Only auth enforcement tested. No CRUD with real auth. |
| **Quote-to-Load** (create quote->approve->convert to load->dispatch) | Missing | No quote E2E tests exist at all. |

---

## Recommendations

### Quick Wins (Largest Coverage Impact)

1. **Frontend `services/` module**: Writing integration tests for `authService.ts`, `storageService.ts`, and `brokerService.ts` would cover ~500+ statements (lifting frontend from 29.9% toward 50%+).

2. **Backend `server/routes/`**: Adding route-level integration tests for uncovered routes in `loads.ts`, `accounting.ts`, `dispatch.ts` would cover ~300+ statements (lifting backend from 77.5% toward 85%+).

3. **E2E canonical journeys**: Adding authenticated CRUD E2E tests for the 5 missing journeys would validate the full stack end-to-end.

### Structural Improvements

1. **Recategorize source-inspection tests**: Move ~243 source-inspection tests to a separate `lint-guards/` test suite so coverage reports are not inflated by non-behavioral tests.

2. **Add `--coverage` to CI**: Run both frontend and backend coverage in CI with minimum thresholds to prevent regression.

3. **Track E2E coverage separately**: E2E tests do not contribute to istanbul line coverage. Track E2E journey completeness as a separate metric.

---

## E2E/Component Test Deduplication Analysis

### Overlapping Assertions

| Assertion | Component Test | E2E Test | Owner Recommendation |
|---|---|---|---|
| Load creation form renders | `LoadCreation.test.tsx` (mocked) | `load-lifecycle-ui.spec.ts` (real UI) | E2E owns rendering; component owns prop validation |
| Auth enforcement on /api/loads | N/A | `load-lifecycle.spec.ts` + `load-lifecycle-ui.spec.ts` | Deduplicate: `load-lifecycle-ui.spec.ts` repeats auth checks already in `load-lifecycle.spec.ts` |
| Auth enforcement on /api/accounting/* | N/A | `accounting-financials.spec.ts` + `settlement.spec.ts` | Deduplicate: both test the same endpoint auth rejection |
| Auth enforcement on /api/users/* | N/A | `users-admin.spec.ts` + `users-admin-ui.spec.ts` | Deduplicate: `users-admin-ui.spec.ts` repeats API checks |
| Settlement immutability | N/A | `settlement.spec.ts` (contract-only assertions) | Replace contract-only tests with authenticated CRUD tests |
| Status transition rules | N/A | `assignment-status.spec.ts` (in-memory) | Replace in-memory state machine assertions with API round-trips |
| Health check endpoint | N/A | `load-lifecycle.spec.ts` + `load-lifecycle-ui.spec.ts` + `dashboard-ui.spec.ts` | Keep in one spec only |

### Deduplication Recommendations

1. **Consolidate auth enforcement tests**: Currently 6+ E2E spec files each independently test that `/api/*` endpoints return 401 without auth. Consolidate into a single `auth-enforcement.spec.ts` that systematically tests all endpoints.

2. **Remove contract-only E2E tests**: Tests like "settlement workflow states are ordered: draft -> review -> posted" (in `settlement.spec.ts`) that assert on in-memory arrays are not E2E tests. Move to unit test files.

3. **Separate API tests from UI tests**: Current specs mix API-level (`request.get(...)`) and browser-level (`page.goto(...)`) tests. Split into `*.api.spec.ts` and `*.ui.spec.ts` for clarity.

4. **Component tests own**: prop validation, error states, conditional rendering, accessibility.
5. **E2E tests own**: full user journeys, auth enforcement, data persistence, cross-page navigation.
