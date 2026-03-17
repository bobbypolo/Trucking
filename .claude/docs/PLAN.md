# Plan: Full-Scale Production Remediation (Remaining)

## Goal

Complete the production remediation of LoadPilot. Phases 0-1 and Phase 2 server-side are done. Remaining work: Phase 2 frontend cutover, Phase 3 UX, Phase 4 feature reality, Phase 5 hardening.

## Completed (Not in Scope)

Phases 0-1 complete: RTM, storage inventory, feature disposition, storageService split, tenant isolation fixes, rate limiting, mock data removal, API health monitor, migration infrastructure. Phase 2 server: 5 migrations (017-021), 9 route domains with full CRUD, column allowlist security.

## Phase 2 (Remaining): Frontend Persistence Cutover

### STORY-012: Frontend Cutover — Quotes
**Phase**: 2 | **Component**: services/storage/quotes.ts, components/QuoteManager.tsx

Replace localStorage reads/writes with API calls to `/api/quotes`. Apply 4-phase dual-write cutover ending at Phase D.

**Done When**:
- R-S12-01: `grep -rn 'localStorage.*quotes' services/` returns 0 matches
- R-S12-02: `STORAGE_KEY_QUOTES` constant removed from codebase
- R-S12-03: QuoteManager fetches from GET /api/quotes and renders server data
- R-S12-04: Quote create/update calls POST/PATCH /api/quotes
- R-S12-05: Frontend test confirms no localStorage usage for quotes

### STORY-013: Frontend Cutover — Leads
**Phase**: 2 | **Component**: services/storage/leads.ts

Same pattern as STORY-012 for leads. Replace localStorage with `/api/leads`.

**Done When**:
- R-S13-01: `grep -rn 'localStorage.*leads' services/` returns 0 matches
- R-S13-02: `STORAGE_KEY_LEADS` constant removed from codebase
- R-S13-03: Lead CRUD uses API endpoints

### STORY-014: Frontend Cutover — Bookings
**Phase**: 2 | **Component**: services/storage/bookings.ts

Same pattern for bookings. Replace localStorage with `/api/bookings`.

**Done When**:
- R-S14-01: `grep -rn 'localStorage.*bookings' services/` returns 0 matches
- R-S14-02: `STORAGE_KEY_BOOKINGS` constant removed from codebase
- R-S14-03: Booking CRUD uses API endpoints

### STORY-015: Frontend Cutover — Messages & Threads
**Phase**: 2 | **Component**: services/storage/messages.ts

Replace localStorage with server-authoritative messaging via existing `/api/messages` route. Remove fire-and-forget pattern.

**Done When**:
- R-S15-01: `STORAGE_KEY_MESSAGES` and `STORAGE_KEY_THREADS` removed
- R-S15-02: Every message write confirms server acknowledgment or shows error
- R-S15-03: No fire-and-forget API sync pattern remains

### STORY-016: Frontend Cutover — Calls, Tasks, Work Items
**Phase**: 2 | **Component**: services/storage/calls.ts, services/storage/tasks.ts

Replace localStorage with `/api/call-sessions`, `/api/tasks`, `/api/work-items`.

**Done When**:
- R-S16-01: `STORAGE_KEY_CALLS`, `STORAGE_KEY_TASKS`, `STORAGE_KEY_WORK_ITEMS` removed
- R-S16-02: All three entities use server API for CRUD
- R-S16-03: No DEMO_MODE seed data for these entities

### STORY-017: Frontend Cutover — Crisis, KCI Requests, Service Tickets
**Phase**: 2 | **Component**: services/storage/recovery.ts

Replace localStorage with `/api/crisis-actions`, `/api/kci-requests`, `/api/service-tickets`.

**Done When**:
- R-S17-01: `STORAGE_KEY_CRISIS`, `STORAGE_KEY_REQUESTS`, `STORAGE_KEY_SERVICE_TICKETS` removed
- R-S17-02: Crisis actions and KCI requests use server API
- R-S17-03: Append-only audit trails preserved server-side

### STORY-018: Frontend Cutover — Contacts & Providers
**Phase**: 2 | **Component**: services/storage/directory.ts

Replace localStorage with `/api/contacts`, `/api/providers`.

**Done When**:
- R-S18-01: `STORAGE_KEY_CONTACTS`, `STORAGE_KEY_PROVIDERS` removed
- R-S18-02: No DEMO_MODE seed data (Titan Recovery, Rapid Tire, John Dispatcher, Sarah Broker removed)
- R-S18-03: `grep -rn 'Titan Recovery\|Rapid Tire\|555-0199\|555-0288' services/` returns 0

### STORY-019: Remove All DEMO_MODE Seed Data
**Phase**: 2 | **Component**: services/storageService.ts, services/storage/*.ts

Remove all `DEMO_MODE` seed injection blocks from production code.

**Done When**:
- R-S19-01: `grep -rn 'DEMO_MODE.*return.*\[' services/` returns 0
- R-S19-02: `grep -rn 'DEMO_MODE.*setItem' services/` returns 0
- R-S19-03: `grep -rn 'inc-desc-001\|CALL-INT-101\|WI-5001' services/` returns 0
- R-S19-04: seedIncidents function is a no-op
- R-S19-05: All existing tests still pass

## Phase 3: UX Reality Conversion

### STORY-020: Replace All "Authority" Jargon
**Phase**: 3 | **Component**: components/

Replace 45+ "Authority" jargon instances with plain trucking language per replacement table in audit.

**Done When**:
- R-S20-01: `grep -ri "Authority" components/ --include="*.tsx"` returns 0 matches
- R-S20-02: `grep -rn "Emergency Sign Out" App.tsx` returns 0
- R-S20-03: Login/signup flows use plain language ("Sign In", "Create Account")
- R-S20-04: All replacements match the table in the audit findings

### STORY-021: Replace All Browser Dialogs
**Phase**: 3 | **Component**: components/

Replace 26 native alert/confirm/prompt calls with ConfirmDialog, InputDialog, and toast components.

**Done When**:
- R-S21-01: `grep -rn 'alert(' components/ --include="*.tsx" | grep -v __tests__` returns 0
- R-S21-02: `grep -rn 'window.confirm(' components/ --include="*.tsx" | grep -v __tests__` returns 0
- R-S21-03: `grep -rn 'prompt(' components/ --include="*.tsx" | grep -v __tests__` returns 0
- R-S21-04: ConfirmDialog component exists with cancel/confirm buttons
- R-S21-05: Breakdown flow uses styled modal sequence

### STORY-022: Standardize Loading/Error/Empty States
**Phase**: 3 | **Component**: components/

Add LoadingSkeleton, ErrorState components. Apply to all async data views.

**Done When**:
- R-S22-01: LoadingSkeleton component exists with card, table, list variants
- R-S22-02: ErrorState component exists with retry button
- R-S22-03: Dashboard, QuoteManager, AccountingPortal show skeleton while loading
- R-S22-04: API errors show ErrorState with retry (not empty screen)

### STORY-023: Form Validation & Autocomplete
**Phase**: 3 | **Component**: components/

Add required field indicators, inline validation, autocomplete attributes.

**Done When**:
- R-S23-01: Required fields show red asterisk or "Required" label
- R-S23-02: Email fields validate format on blur
- R-S23-03: All password inputs have `autocomplete` attribute
- R-S23-04: MC/DOT fields show format hints

### STORY-024: Connection Status Banner in App
**Phase**: 3 | **Component**: App.tsx, components/ui/ConnectionBanner.tsx

Wire ConnectionBanner (already created) into App.tsx with retry.

**Done When**:
- R-S24-01: Banner appears within 30s of API becoming unreachable
- R-S24-02: Banner auto-clears when /api/health returns 200
- R-S24-03: Retry button calls refreshData()
- R-S24-04: Banner renders above all content (sticky top, z-index 100)

## Phase 4: Feature Reality Sweep

### STORY-025: Implement Equipment PATCH Endpoint
**Phase**: 4 | **Component**: server/routes/equipment.ts

Add `PATCH /api/equipment/:id` with role check (admin, dispatcher, safety_manager).

**Done When**:
- R-S25-01: PATCH endpoint updates status, maintenance_date, mileage, notes
- R-S25-02: Cross-tenant update returns 404
- R-S25-03: Unauthorized role (driver) returns 403
- R-S25-04: Existing equipment GET tests still pass

### STORY-026: Implement File Upload
**Phase**: 4 | **Component**: server/routes/uploads.ts

Add multipart upload with Firebase Storage, signed download URLs.

**Done When**:
- R-S26-01: Upload works end-to-end with progress
- R-S26-02: Size > 10MB rejected with 413
- R-S26-03: Invalid MIME type rejected with 400
- R-S26-04: Cross-tenant file access returns 404
- R-S26-05: Content-Disposition header set to attachment

### STORY-027: Customer Soft Delete/Archive
**Phase**: 4 | **Component**: server/routes/clients.ts

Add `PATCH /api/clients/:id/archive` with archived_at column.

**Done When**:
- R-S27-01: Archive endpoint sets archived_at timestamp
- R-S27-02: Archived customers hidden from default views
- R-S27-03: Un-archive endpoint exists
- R-S27-04: Unauthorized role returns 403

### STORY-028: Password Reset Flow
**Phase**: 4 | **Component**: server/routes/users.ts, components/Auth.tsx

Server-proxied password reset via Firebase Admin SDK.

**Done When**:
- R-S28-01: "Forgot Password?" link visible on login page
- R-S28-02: POST /api/auth/reset-password rate limited at 3/15min
- R-S28-03: Always returns 200 (no account enumeration)
- R-S28-04: Works on mobile viewport

### STORY-029: Endpoint Hardening
**Phase**: 4 | **Component**: server/routes/accounting.ts, server/routes/ai.ts

IFTA pings bounds check, AI payload limit already reduced to 5MB.

**Done When**:
- R-S29-01: pings array > 10,000 returns 400
- R-S29-02: AI payload > 5MB returns 413 (already done)
- R-S29-03: AI with invalid MIME type returns 400
- R-S29-04: Each boundary has a test

### STORY-030: Remove Unimplemented Features
**Phase**: 4 | **Component**: components/, server/routes/

Hide QB Sync, IFTA filing, WebSocket tracking, driver certs, load templates.

**Done When**:
- R-S30-01: QB Sync section hidden from AccountingPortal
- R-S30-02: `POST /api/accounting/sync-qb` returns 501
- R-S30-03: `grep -rn "Sync queued" server/routes/` returns 0
- R-S30-04: No "coming soon" or fake success in production UI

### STORY-031: Relabel Tracking Honestly
**Phase**: 4 | **Component**: components/

Remove "Real-Time", "Live Track", "Live Asset" claims.

**Done When**:
- R-S31-01: `grep -rn "Real-Time\|Live Track\|Live Asset" components/ --include="*.tsx"` returns 0
- R-S31-02: Tracking functionality still works (polling-based)

## Phase 5: Hardening & Release

### STORY-032: Bundle Code Splitting
**Phase**: 5 | **Component**: vite.config.ts

Add manual chunks and React.lazy for heavy routes.

**Done When**:
- R-S32-01: No single chunk > 500KB gzipped
- R-S32-02: Login route < 150KB JS gzipped
- R-S32-03: npm run build shows no chunk size warnings

### STORY-033: Fix TypeScript Errors
**Phase**: 5 | **Component**: tests, scripts

Fix Mock type casts and module resolution.

**Done When**:
- R-S33-01: `npx tsc --noEmit` returns 0 errors (frontend)
- R-S33-02: `cd server && npx tsc --noEmit` returns 0 errors

### STORY-034: Forbidden Pattern CI Guard
**Phase**: 5 | **Component**: server/__tests__/

CI test scanning for localStorage-as-SoR, browser dialogs, hardcoded mocks.

**Done When**:
- R-S34-01: CI test scans for all forbidden patterns
- R-S34-02: Adding forbidden pattern to component fails test

### STORY-035: Operational Readiness
**Phase**: 5 | **Component**: server/routes/health.ts, docs/

Enhanced health check, rollback docs, ops readiness checklist.

**Done When**:
- R-S35-01: GET /api/health returns dependency status
- R-S35-02: Rollback procedure documented
- R-S35-03: Ops readiness checklist complete

### STORY-036: Regression + Release Evidence
**Phase**: 5 | **Component**: docs/

Full regression, release evidence, go/no-go.

**Done When**:
- R-S36-01: Server tests >= 1,268 baseline
- R-S36-02: Frontend tests >= 549 baseline
- R-S36-03: TypeScript 0 errors
- R-S36-04: Forbidden pattern scan passes
- R-S36-05: Release evidence document generated
