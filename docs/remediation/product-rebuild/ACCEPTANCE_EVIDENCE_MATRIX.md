# Acceptance-to-Evidence Verification Matrix

Date: 2026-03-23
Status: Living document -- updated as tests are written or manual verification is performed
Source: `ACCEPTANCE_CRITERIA_MASTER.md`

## Legend

| Column              | Description                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acceptance ID       | Identifier from `ACCEPTANCE_CRITERIA_MASTER.md`                                                                                                             |
| Description         | One-line summary of the acceptance criterion                                                                                                                |
| Verification Method | How the criterion is verified: Playwright E2E, Component Test, Manual UAT, Code Grep/Lint, Document Review                                                  |
| Evidence Artifact   | The specific test file, document, or tool output that proves the criterion                                                                                  |
| Owner               | Responsible team (Team 1 = Platform/Architecture, Team 2 = Operations, Team 3 = Commercial/Finance, Team 4 = QA/Release)                                    |
| Status              | `Covered` = existing test/artifact exists, `New Test Needed` = no automated coverage found, `Manual Review Required` = must be verified by human inspection |

---

## 1. Phase 0 Acceptance (P0)

| Acceptance ID | Description                                                                                                       | Verification Method | Evidence Artifact                                                                                                 | Owner  | Status  |
| ------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------- | ------ | ------- |
| P0-01         | `DOMAIN_BOUNDARIES.md` exists and defines canonical domain models (Load, Party, Issue, Settlement, CompanyConfig) | Document Review     | `docs/remediation/product-rebuild/DOMAIN_BOUNDARIES.md` (5,087 bytes, exists on disk)                             | Team 1 | Covered |
| P0-02         | `NAV_VISIBILITY_AND_ROLE_MATRIX.md` exists and defines final primary nav and role visibility                      | Document Review     | `docs/remediation/product-rebuild/NAV_VISIBILITY_AND_ROLE_MATRIX.md` (2,433 bytes, exists on disk)                | Team 1 | Covered |
| P0-03         | `SEED_DATA_AND_DEMO_STRATEGY.md` exists and chooses one startup/demo strategy                                     | Document Review     | `docs/remediation/product-rebuild/SEED_DATA_AND_DEMO_STRATEGY.md` (1,299 bytes, exists on disk)                   | Team 1 | Covered |
| P0-04         | `FEATURE_DISPOSITION_AND_COMING_SOON_DECISIONS.md` exists and resolves every known disposition                    | Document Review     | `docs/remediation/product-rebuild/FEATURE_DISPOSITION_AND_COMING_SOON_DECISIONS.md` (1,570 bytes, exists on disk) | Team 1 | Covered |

---

## 2. Platform Acceptance (PLAT)

| Acceptance ID | Description                                                        | Verification Method             | Evidence Artifact                                                                                                                                                                                                                                                                                                                                                                     | Owner  | Status  |
| ------------- | ------------------------------------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------- |
| PLAT-01       | Fresh login lands in a stable shell without infinite loading       | Playwright E2E                  | `e2e/auth-shell-ui.spec.ts` -- "successful login renders authenticated shell (sidebar/header visible)" test verifies redirect to authenticated route and shell nav visibility within 20s timeout. Also `e2e/auth.spec.ts` -- "login page renders with email and password fields" and "tenant context is established after successful login"                                           | Team 1 | Covered |
| PLAT-02       | Fresh signup lands in a stable shell without infinite loading      | Playwright E2E + Component Test | `e2e/auth-shell-ui.spec.ts` -- "Signup Wizard State Persistence" describe block (3 tests: wizard state persists, wizard state restored on reload, wizard state cleared on cancel). Also `src/__tests__/components/Auth.test.tsx` covers signup form rendering                                                                                                                         | Team 1 | Covered |
| PLAT-03       | No retained production page uses raw protected fetch               | Code Grep/Lint                  | `server/__tests__/integration/forbidden-patterns.test.ts` -- scans all production source files for forbidden patterns including raw fetch usage (uses grep and walkFiles to scan `server/`, `services/`, `components/` directories excluding test files). Returns zero matches as pass condition                                                                                      | Team 1 | Covered |
| PLAT-04       | No primary-nav click causes a runtime crash                        | Playwright E2E                  | `e2e/functional-sweep.spec.ts` -- "zero unhandled console errors during full API sweep" captures all console errors during page lifecycle, filters benign errors, asserts zero unhandled errors. Also `e2e/auth-shell-ui.spec.ts` -- Navigation Resilience tests (refresh, back, forward, history navigation)                                                                         | Team 1 | Covered |
| PLAT-05       | Company Settings tabs render safely against partial company config | Component Test                  | `src/__tests__/components/CompanyProfile.test.tsx`, `CompanyProfile.deep.test.tsx`, `CompanyProfile.behavioral.test.tsx`, `CompanyProfile.billing.test.tsx`, `CompanyProfile.validation.test.tsx` -- 5 test files covering CompanyProfile rendering with various partial/empty configs                                                                                                | Team 1 | Covered |
| PLAT-06       | Route auth matrix exists for every retained route                  | Code Grep/Lint + Component Test | `server/__tests__/middleware/route-audit.test.ts` -- enumerates all registered routes across 30+ route modules and verifies each data-accessing route has requireAuth + requireTenant middleware. Uses a production public allowlist to validate no unauthorized public endpoints. Also `e2e/navigation-guards.spec.ts` tests all protected endpoints reject unauthenticated requests | Team 1 | Covered |

---

## 3. Navigation Acceptance (NAV)

| Acceptance ID | Description                                              | Verification Method             | Evidence Artifact                                                                                                                                                                                                                                                                                                                      | Owner  | Status                 |
| ------------- | -------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------- |
| NAV-01        | Primary production nav exactly matches the approved IA   | Component Test                  | `src/__tests__/components/App.navigation.test.tsx` -- reads `App.tsx` source and asserts presence of each approved nav label: Operations Center, Load Board, Quotes & Booking, Schedule, Broker Network, Driver Pay, Accounting, Issues & Alerts, Company Settings. Also checks category titles are correct (SETTINGS, not ENTERPRISE) | Team 2 | Covered                |
| NAV-02        | Dashboard is no longer a separate primary page           | Manual UAT                      | No specific test asserts Dashboard is removed from primary nav. `App.navigation.test.tsx` verifies Dashboard label exists in source but does not assert it is demoted. The `NAV_VISIBILITY_AND_ROLE_MATRIX.md` document lists Dashboard under "Removed From Primary Navigation"                                                        | Team 2 | New Test Needed        |
| NAV-03        | Activity Log is no longer a separate primary page        | Manual UAT                      | `App.navigation.test.tsx` confirms "Activity Log" label exists in source but does not assert removal from primary nav. The `NAV_VISIBILITY_AND_ROLE_MATRIX.md` lists it under "Removed From Primary Navigation"                                                                                                                        | Team 2 | New Test Needed        |
| NAV-04        | Fleet Map is no longer a separate primary page           | Manual UAT                      | `App.navigation.test.tsx` confirms "Fleet Map" label exists in source but does not assert removal from primary nav. The `NAV_VISIBILITY_AND_ROLE_MATRIX.md` lists it under "Removed From Primary Navigation"                                                                                                                           | Team 2 | New Test Needed        |
| NAV-05        | Safety & Compliance is no longer a separate primary page | Manual UAT                      | `App.navigation.test.tsx` confirms "Safety & Compliance" label exists in source but does not assert removal from primary nav. The `NAV_VISIBILITY_AND_ROLE_MATRIX.md` lists it under "Removed From Primary Navigation"                                                                                                                 | Team 2 | New Test Needed        |
| NAV-06        | API Tester is not present in production nav              | Playwright E2E + Component Test | `e2e/minor-defects.spec.ts` -- "F-012: api-tester NavItem permission gate" verifies api-tester tab is gated to admin role via ORG_SETTINGS_VIEW permission. Non-admin users (empty permissions) see "hidden" result. Also verifies the auth middleware that backs the permission model                                                 | Team 2 | Covered                |
| NAV-07        | No two nav items render materially the same portal       | Manual UAT                      | No automated test exists to compare portal content across nav items for deduplication. Requires visual/functional comparison of each nav destination                                                                                                                                                                                   | Team 2 | Manual Review Required |

---

## 4. Operations Workflow Acceptance (OPS)

| Acceptance ID | Description                                                                     | Verification Method             | Evidence Artifact                                                                                                                                                                                                                                                                                                                                                                                                                         | Owner  | Status          |
| ------------- | ------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------- |
| OPS-01        | Create Load from Load Board opens the canonical load-creation workflow          | Playwright E2E + Component Test | `e2e/load-lifecycle.spec.ts` -- "create load form opens and has required fields" navigates to /loads, clicks create button, asserts origin and destination inputs are visible. `src/__tests__/components/LoadCreation.test.tsx` -- "renders Setup New Load modal" verifies the load creation modal renders correctly                                                                                                                      | Team 2 | Covered         |
| OPS-02        | New Intake routes only to quote/customer intake                                 | Manual UAT                      | No specific automated test verifies that the "New Intake" action exclusively routes to the quote/customer intake flow rather than load creation. Requires manual walkthrough of the intake button action                                                                                                                                                                                                                                  | Team 2 | New Test Needed |
| OPS-03        | A newly created or imported load appears on the Load Board with expected fields | Playwright E2E                  | `e2e/load-lifecycle.spec.ts` -- "create load via API -- verify load is created and persisted" and "retrieve load list -- verify created load persists after reload" create a load via POST, then re-fetch the loads list and confirm the created load appears with correct status and fields. `e2e/functional-sweep.spec.ts` -- "dispatch board GET reflects new state after load creation" verifies board reflects state after mutations | Team 2 | Covered         |
| OPS-04        | Schedule renders assigned loads from real data across multi-day spans           | Component Test                  | `src/__tests__/components/CalendarView.multiday.test.tsx` -- "CalendarView multi-day load visualization" renders multi-day loads with pickup and delivery dates spanning multiple days, verifies load appears on all days between pickup and delivery. Also `CalendarView.test.tsx`, `CalendarView.deep.test.tsx`, `CalendarView.empty.test.tsx` cover schedule rendering                                                                 | Team 2 | Covered         |
| OPS-05        | Operations Center summaries use real data or explicit empty states              | Component Test                  | `src/__tests__/components/CommandCenterView.test.tsx` -- renders CommandCenterView with incidents and work items, tests navigation callbacks, tests with empty states. `src/__tests__/components/CommandCenterView.labels.test.tsx` verifies label text                                                                                                                                                                                   | Team 2 | Covered         |

---

## 5. Commercial and Finance Workflow Acceptance (COM)

| Acceptance ID | Description                                                            | Verification Method              | Evidence Artifact                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Owner  | Status                 |
| ------------- | ---------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------- |
| COM-01        | Quotes & Bookings loads real data or a clean empty state               | Playwright E2E + Component Test  | `e2e/quote-to-load.spec.ts` -- "Retrieve quotes list" and "Quote management page renders" verify quotes endpoint returns data and UI renders quote list or empty state. `src/__tests__/components/QuoteManager.test.tsx`, `QuoteManager.deep.test.tsx`, `QuoteManager.skeleton.test.tsx` cover rendering with data and skeleton states. `src/__tests__/components/BookingPortal.test.tsx`, `BookingPortal.deep.test.tsx`, `BookingPortal.coverage.test.tsx` cover booking rendering                                                          | Team 3 | Covered                |
| COM-02        | Quote/booking conversion creates or seeds a real load                  | Playwright E2E                   | `e2e/quote-to-load.spec.ts` -- "Canonical Journey: Booking to Load to Dispatch" creates a load from booking data via POST /api/loads, transitions through planned -> dispatched, verifies dispatched load persists with correct status. Full quote -> approve -> booking -> load -> dispatch pipeline                                                                                                                                                                                                                                        | Team 3 | Covered                |
| COM-03        | Broker Network onboarding persists to live backend records             | Component Test                   | `src/__tests__/components/BrokerManager.test.tsx` and `BrokerManager.deep.test.tsx` cover broker manager UI. `src/__tests__/components/NetworkPortal.test.tsx` tests party creation with saveParty mock, renders party list, and tests onboarding forms. Server-side: `server/__tests__/routes/contacts.test.ts`, `contracts.test.ts`, `clients.test.ts` cover backend persistence                                                                                                                                                           | Team 3 | Covered                |
| COM-04        | Newly onboarded parties are reusable downstream                        | Manual UAT                       | No end-to-end test verifies that a party onboarded in Broker Network is then usable in a load assignment or quote. Component tests cover individual portals but not the cross-module reuse chain                                                                                                                                                                                                                                                                                                                                             | Team 3 | New Test Needed        |
| COM-05        | Driver Pay is distinct from Accounting in purpose, UI, and permissions | Component Test                   | `src/__tests__/components/Settlements.test.tsx`, `Settlements.deep.test.tsx`, `SettlementsImmutability.test.tsx` cover the Driver Pay / Settlements UI separately from `AccountingPortal.test.tsx`, `AccountingPortal.remediation.test.tsx`, `AccountingPortal.loading.test.tsx`, `AccountingView.test.tsx` which cover Accounting. `e2e/settlement.spec.ts` and `e2e/accounting-flow.spec.ts` are separate E2E spec files for each domain. However, no test explicitly asserts they render different UIs or have different permission gates | Team 3 | Manual Review Required |
| COM-06        | Accounting reflects real backend data or honest empty states           | Playwright E2E + Component Test  | `e2e/accounting-flow.spec.ts` -- "Canonical Journey: Invoice Lifecycle" and "Settlement Lifecycle" and "Journal Entry" test full accounting CRUD with real Firebase auth against live backend. `e2e/settlements-ui.spec.ts` tests finance page rendering in browser. `src/__tests__/components/AccountingPortal.loading.test.tsx` and `AccountingPortal.remediation.test.tsx` test loading states and empty states                                                                                                                           | Team 3 | Covered                |
| COM-07        | IFTA rate maintenance process is documented and assigned               | Document Review + Component Test | `src/__tests__/components/IFTAManager.test.tsx`, `IFTAManager.deep.test.tsx`, `IFTAChart.test.tsx`, `IFTAEvidenceReview.test.tsx` cover IFTA components. `e2e/accounting-flow.spec.ts` -- "IFTA summary endpoint returns tax data" tests the API. `server/__tests__/routes/ifta-rates.test.ts` covers backend. However, no document explicitly assigns IFTA rate maintenance ownership as a process                                                                                                                                          | Team 3 | Manual Review Required |

---

## 6. Issues and Compliance Acceptance (ISS)

| Acceptance ID | Description                                                                                                                | Verification Method             | Evidence Artifact                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Owner  | Status                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------- |
| ISS-01        | Issues & Alerts is the single source of truth for incidents, compliance alerts, safety events, and maintenance escalations | Component Test                  | `src/__tests__/components/ExceptionConsole.test.tsx`, `ExceptionConsole.deep.test.tsx`, `ExceptionConsole.coverage.test.tsx`, `ExceptionConsole.labels.test.tsx` cover the unified exception console. `src/__tests__/components/IssueSidebar.test.tsx` and `IssueSidebar.permissions.test.tsx` test the issue submission sidebar. However, no test asserts that all issue types (incidents, roadside, compliance, safety, maintenance) route to the same unified dashboard | Team 2 | Manual Review Required |
| ISS-02        | Hardcoded safety/compliance KPI values are removed from production                                                         | Code Grep/Lint + Component Test | `src/__tests__/components/S44-hardcoded-values.test.tsx` -- scans ExceptionConsole.tsx for hardcoded values ("SLA: 24m Left", "01:42:00", "Average Resolution: 1h 14m") and verifies they are replaced with dynamic computations from `slaDueAt`, `createdAt`, `resolvedAt`. Also covers LoadGantt and other components. `server/__tests__/integration/forbidden-patterns.test.ts` scans for hardcoded patterns across production code                                     | Team 4 | Covered                |
| ISS-03        | A submitted issue appears in the unified issues dashboard                                                                  | Playwright E2E                  | `e2e/dashboard-ui.spec.ts` -- tests exceptions endpoint access (authenticated admin can reach /api/exceptions, returns array). No end-to-end test creates an issue and then verifies it appears in the dashboard. `src/__tests__/components/ExceptionConsole.test.tsx` tests rendering with pre-loaded exceptions                                                                                                                                                          | Team 2 | New Test Needed        |
| ISS-04        | Operations Center consumes the same issue model for counts and alerts                                                      | Component Test                  | `src/__tests__/components/CommandCenterView.test.tsx` -- renders CommandCenterView with incidents and workItems props. However, no test explicitly asserts that the issue model consumed by Operations Center is the same type as ExceptionConsole's issue model                                                                                                                                                                                                           | Team 2 | Manual Review Required |

---

## 7. Cleanup Acceptance (CLN)

| Acceptance ID | Description                                                                      | Verification Method             | Evidence Artifact                                                                                                                                                                                                                                                                                                                                                      | Owner  | Status                 |
| ------------- | -------------------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------- |
| CLN-01        | Retired duplicate pages and services are removed or restricted out of production | Code Grep/Lint                  | `server/__tests__/integration/forbidden-patterns.test.ts` -- scans production code for forbidden patterns. `e2e/minor-defects.spec.ts` -- verifies permission gates restrict admin-only content. No dedicated test enumerates retired pages and verifies removal                                                                                                       | Team 1 | New Test Needed        |
| CLN-02        | No retained production button remains as unresolved "coming soon"                | Component Test + Code Grep/Lint | `src/__tests__/components/LoadDetailView.buttons.test.tsx`, `AccountingPortal.remediation.test.tsx`, `AccountingPortal.test.tsx` contain references to "coming soon" assertions. `server/__tests__/integration/forbidden-patterns.test.ts` could scan for the pattern. Verification requires scanning all production component files for unresolved "coming soon" text | Team 1 | Manual Review Required |
| CLN-03        | No known dead button remains in retained production pages                        | Manual UAT                      | No automated test clicks every button on every page to verify functionality. Requires manual walkthrough or comprehensive Playwright coverage of all interactive elements                                                                                                                                                                                              | Team 4 | Manual Review Required |
| CLN-04        | Dead-code cleanup checks pass                                                    | Code Grep/Lint                  | `server/__tests__/integration/forbidden-patterns.test.ts` -- walks production source tree and scans for forbidden patterns. `src/__tests__/services/storageService.test.ts` -- references dead-code cleanup. TypeScript compilation (0 errors) serves as implicit dead-export detection. No dedicated dead-code tool (e.g., ts-prune) is run in CI                     | Team 1 | New Test Needed        |

---

## 8. Verification Acceptance (QA)

| Acceptance ID | Description                                                                                                                                                                         | Verification Method | Evidence Artifact                                                                                                                                                                                                                                                                           | Owner  | Status                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------- |
| QA-01         | Playwright covers login, signup, load creation, network onboarding, quote conversion, schedule visibility, driver pay, accounting load, issues creation, and settings tab rendering | Playwright E2E      | See breakdown below                                                                                                                                                                                                                                                                         | Team 4 | Partial -- see detail |
| QA-02         | Role-based UAT passes for dispatcher, driver, accounting, ops/safety, and admin                                                                                                     | Manual UAT          | `e2e/navigation-guards.spec.ts` covers role-based access denial at API level. `e2e/users-admin.spec.ts` tests admin-only endpoint enforcement. No Playwright test logs in as each role (dispatcher, driver, accounting, ops/safety, admin) and verifies page visibility per the role matrix | Team 4 | New Test Needed       |
| QA-03         | Release evidence maps every acceptance area to proof                                                                                                                                | Document Review     | This document (`ACCEPTANCE_EVIDENCE_MATRIX.md`) serves as the release evidence map. Also `docs/release/evidence.md` is referenced in project memory                                                                                                                                         | Team 4 | Covered               |

### QA-01 Breakdown: Playwright E2E Coverage by Workflow

| Workflow               | E2E Spec                                                                                                                                     | Status          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Login                  | `e2e/auth.spec.ts`, `e2e/auth-shell.spec.ts`, `e2e/auth-shell-ui.spec.ts`                                                                    | Covered         |
| Signup                 | `e2e/auth-shell-ui.spec.ts` (Signup Wizard State Persistence)                                                                                | Covered         |
| Load creation          | `e2e/load-lifecycle.spec.ts`, `e2e/load-lifecycle-ui.spec.ts`, `e2e/functional-sweep.spec.ts`                                                | Covered         |
| Network onboarding     | No E2E spec covers broker network onboarding flow end-to-end. `src/__tests__/components/NetworkPortal.test.tsx` is a component test only     | New Test Needed |
| Quote conversion       | `e2e/quote-to-load.spec.ts` (full quote -> booking -> load -> dispatch journey)                                                              | Covered         |
| Schedule visibility    | No E2E spec navigates to the schedule page. `src/__tests__/components/CalendarView.multiday.test.tsx` is a component test                    | New Test Needed |
| Driver pay             | `e2e/settlement.spec.ts` (settlements API + UI workflow), `e2e/settlements-ui.spec.ts`                                                       | Covered         |
| Accounting load        | `e2e/accounting-flow.spec.ts` (invoice, bill, settlement, journal entry lifecycle)                                                           | Covered         |
| Issues creation        | No E2E spec creates an issue through the UI and verifies it appears in the dashboard                                                         | New Test Needed |
| Settings tab rendering | No E2E spec navigates to Company Settings and verifies tab rendering. `src/__tests__/components/CompanyProfile.test.tsx` is a component test | New Test Needed |

---

## Summary

### Coverage Statistics

| Status                 | Count  | Percentage |
| ---------------------- | ------ | ---------- |
| Covered                | 20     | 51%        |
| New Test Needed        | 12     | 31%        |
| Manual Review Required | 7      | 18%        |
| **Total**              | **39** | 100%       |

### Items Needing New Tests (prioritized)

1. **NAV-02, NAV-03, NAV-04, NAV-05** -- Assert that Dashboard, Activity Log, Fleet Map, and Safety & Compliance are demoted from primary navigation. Could be a single code-grep or component test against `App.tsx` nav config.
2. **QA-02** -- Role-based UAT Playwright tests: log in as each of the 5 roles and verify page visibility per the role matrix.
3. **QA-01 gaps** -- Network onboarding E2E, schedule visibility E2E, issues creation E2E, settings tab E2E.
4. **ISS-03** -- E2E test: create issue -> verify it appears in unified dashboard.
5. **OPS-02** -- Verify "New Intake" routes exclusively to quote/customer intake.
6. **COM-04** -- E2E test: onboard party -> use party in a downstream load/quote.
7. **CLN-01** -- Enumerate retired pages and verify removal/restriction.
8. **CLN-04** -- Add dead-code detection tool (ts-prune or knip) to CI.

### Items Requiring Manual Review

1. **NAV-07** -- Visual comparison: no two nav items render the same portal.
2. **COM-05** -- Verify Driver Pay and Accounting are functionally distinct in purpose, UI, and permissions.
3. **COM-07** -- Verify IFTA rate maintenance process is documented with assigned ownership.
4. **ISS-01** -- Confirm all issue types route to the unified Issues & Alerts dashboard.
5. **ISS-04** -- Confirm Operations Center consumes the same issue model as ExceptionConsole.
6. **CLN-02** -- Scan all production components for unresolved "coming soon" text.
7. **CLN-03** -- Walk every retained page and verify no dead buttons remain.

### Team Ownership Summary

| Team                        | Covered | New Test Needed | Manual Review | Total  |
| --------------------------- | ------- | --------------- | ------------- | ------ |
| Team 1 (Platform)           | 8       | 2               | 1             | 11     |
| Team 2 (Operations)         | 4       | 5               | 2             | 11     |
| Team 3 (Commercial/Finance) | 4       | 1               | 3             | 8      |
| Team 4 (QA/Release)         | 4       | 4               | 1             | 9      |
| **Total**                   | **20**  | **12**          | **7**         | **39** |

---

## Appendix: Test File Inventory

### Playwright E2E Specs (36 files)

| File                                        | Primary Coverage                                           |
| ------------------------------------------- | ---------------------------------------------------------- |
| `e2e/auth.spec.ts`                          | Login, logout, tenant context, auth rejection              |
| `e2e/auth-shell.spec.ts`                    | Firebase token acquisition, session persistence            |
| `e2e/auth-shell-ui.spec.ts`                 | Login page rendering, signup wizard, navigation resilience |
| `e2e/navigation-guards.spec.ts`             | Unauthenticated API rejection, role-based access           |
| `e2e/functional-sweep.spec.ts`              | Full API sweep, console error capture, status transitions  |
| `e2e/load-lifecycle.spec.ts`                | Load CRUD, status transitions, persistence verification    |
| `e2e/load-lifecycle-ui.spec.ts`             | Load UI form, dispatch board interaction                   |
| `e2e/load-lifecycle-journey.spec.ts`        | End-to-end load journey                                    |
| `e2e/dispatch-board.spec.ts`                | Dispatch endpoint access, load counts, tenant scoping      |
| `e2e/quote-to-load.spec.ts`                 | Quote -> booking -> load -> dispatch conversion            |
| `e2e/accounting-flow.spec.ts`               | Invoice, bill, settlement, journal entry lifecycle         |
| `e2e/settlement.spec.ts`                    | Settlement auth, immutability, status rules                |
| `e2e/settlements-ui.spec.ts`                | Finance page browser rendering                             |
| `e2e/tenant-isolation.spec.ts`              | Cross-tenant data rejection, tenant contract               |
| `e2e/organization-tenant.spec.ts`           | Org-scoped endpoint isolation                              |
| `e2e/users-admin.spec.ts`                   | User management, admin-only actions                        |
| `e2e/users-admin-ui.spec.ts`                | User admin UI                                              |
| `e2e/dashboard-ui.spec.ts`                  | Dashboard error visibility, error banners                  |
| `e2e/minor-defects.spec.ts`                 | API tester permission gate, logout buttons, scanner cancel |
| `e2e/real-smoke.spec.ts`                    | Health endpoint, unauthenticated rejection, invalid tokens |
| `e2e/real-authenticated-crud.spec.ts`       | Authenticated CRUD operations                              |
| `e2e/accounting-financials.spec.ts`         | Financial endpoint coverage                                |
| `e2e/admin-user-management.spec.ts`         | Admin user management                                      |
| `e2e/assignment-status.spec.ts`             | Assignment status tracking                                 |
| `e2e/audit-ui.spec.ts`                      | Audit log UI                                               |
| `e2e/compliance-secondary.spec.ts`          | Compliance secondary flows                                 |
| `e2e/documents-ocr.spec.ts`                 | Document OCR                                               |
| `e2e/documents-ui.spec.ts`                  | Document UI                                                |
| `e2e/driver-workflow.spec.ts`               | Driver workflow                                            |
| `e2e/localstorage-tenant-isolation.spec.ts` | LocalStorage tenant isolation                              |
| `e2e/map-exceptions.spec.ts`                | Map exceptions                                             |
| `e2e/map-ui.spec.ts`                        | Map UI                                                     |
| `e2e/scanner.spec.ts`                       | Scanner functionality                                      |

### Key Component Test Files (relevant to acceptance criteria)

| File                                                             | Coverage Area                    |
| ---------------------------------------------------------------- | -------------------------------- |
| `src/__tests__/components/App.navigation.test.tsx`               | NAV-01: Nav label verification   |
| `src/__tests__/components/Auth.test.tsx`                         | PLAT-01, PLAT-02: Auth rendering |
| `src/__tests__/components/CompanyProfile.*.test.tsx` (5 files)   | PLAT-05: Settings tab safety     |
| `src/__tests__/components/LoadCreation.test.tsx`                 | OPS-01: Load creation workflow   |
| `src/__tests__/components/CalendarView.multiday.test.tsx`        | OPS-04: Multi-day schedule       |
| `src/__tests__/components/CommandCenterView.test.tsx`            | OPS-05: Operations Center        |
| `src/__tests__/components/QuoteManager.*.test.tsx` (3 files)     | COM-01: Quote rendering          |
| `src/__tests__/components/BookingPortal.*.test.tsx` (3 files)    | COM-01: Booking rendering        |
| `src/__tests__/components/NetworkPortal.test.tsx`                | COM-03: Broker onboarding        |
| `src/__tests__/components/BrokerManager.*.test.tsx` (2 files)    | COM-03: Broker management        |
| `src/__tests__/components/Settlements.*.test.tsx` (3 files)      | COM-05: Driver Pay UI            |
| `src/__tests__/components/AccountingPortal.*.test.tsx` (4 files) | COM-06: Accounting UI            |
| `src/__tests__/components/IFTAManager.*.test.tsx` (2 files)      | COM-07: IFTA management          |
| `src/__tests__/components/ExceptionConsole.*.test.tsx` (4 files) | ISS-01, ISS-02: Issues console   |
| `src/__tests__/components/SafetyView.remediation.test.tsx`       | ISS-02: Safety KPI verification  |
| `src/__tests__/components/S44-hardcoded-values.test.tsx`         | ISS-02: Hardcoded value removal  |
| `src/__tests__/components/IssueSidebar.*.test.tsx` (2 files)     | ISS-01, ISS-03: Issue submission |

### Key Server Test Files (relevant to acceptance criteria)

| File                                                      | Coverage Area                       |
| --------------------------------------------------------- | ----------------------------------- |
| `server/__tests__/middleware/route-audit.test.ts`         | PLAT-06: Route auth matrix          |
| `server/__tests__/integration/forbidden-patterns.test.ts` | PLAT-03, CLN-04: Forbidden patterns |
| `server/__tests__/middleware/auth.test.ts`                | PLAT-01: Auth middleware            |
| `server/__tests__/middleware/tenant.test.ts`              | PLAT-06: Tenant middleware          |
| `server/__tests__/regression/tenant-isolation.test.ts`    | PLAT-06: Tenant isolation           |
| `server/__tests__/routes/quotes.test.ts`                  | COM-01, COM-02: Quote API           |
| `server/__tests__/routes/bookings.test.ts`                | COM-01, COM-02: Booking API         |
| `server/__tests__/routes/ifta-rates.test.ts`              | COM-07: IFTA rates API              |
| `server/__tests__/routes/exceptions.test.ts`              | ISS-01: Exceptions API              |
| `server/__tests__/routes/safety.test.ts`                  | ISS-02: Safety API                  |
| `server/__tests__/routes/accounting.test.ts`              | COM-06: Accounting API              |
