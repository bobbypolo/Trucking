Plan: Production Hardening — From Demo-Grade to Pilot-Ready

Context

LoadPilot has a strong foundation: real backend boot path with env validation,
health checks, auth middleware, rate limiting, structured errors, graceful
shutdown. 169 backend test files, 211 frontend test files, 45 Playwright specs.
Frontend build passes. Backend deployment-readiness passes.

But trust risks remain that prevent production deployment with real tenants:
release truth (ports disagree, CI incomplete), data truth (20+ silent
stale-data fallbacks across 7 service files), tenant isolation gaps, identity
auto-provisioning, plaintext secrets, local-only document storage, dev/demo
surfaces in production bundle, and unfinished product surfaces.

This plan covers all three priority tiers:
- P0: Foundation trust (release, data, tenant, identity, secrets, storage)
- P1: Workflow trust (core E2E flows, dead affordances, observability, health)
- P2: Structural trust (monolith breakup, doc drift, rollout procedures)

Decisions (locked 2026-03-28):
- Ports: 5000 (Express) / 3101 (Vite dev), all configs aligned via env vars
- Data fallbacks: Remove ALL silent fallbacks — throw errors, let UI show error states
- Auto-provisioning: Feature flag ALLOW_AUTO_PROVISION, off by default in prod
- Object storage: Adapter interface + Firebase Storage adapter, keep disk for dev
- CI: Add build, migration validation, deployment-readiness, and smoke test
- Scope: All three tiers (P0 + P1 + P2)
- Auth harness: Firebase Auth Emulator is the required test harness (not "emulator or test project")
- Metrics: In-memory metrics are pilot-acceptable; plan documents the export path but does not implement external APM in this sprint
- Webhook logging: Redacted logging only (vehicleId, companyId, timestamp, provider — never api_token or webhook_secret)

Branch: ralph/production-hardening

Execution environment:
- All Verify: commands assume bash (Unix shell). Ralph agents run in bash
  regardless of the host OS. Commands use grep, wc, curl, jq, and standard
  Unix utilities. Windows-native execution is not expected.
- End-state claim: This plan brings the product from "demo-grade" to
  "deploy-ready for a controlled pilot with real tenants." It does NOT claim
  full production-grade SaaS maturity. Specifically, external APM/metrics
  export and multi-node staging soak testing are documented as future work
  (see Phase 13 S-13.2 and Phase 14 S-14.1). The plan is honest about
  where it stops.

---
## P0 — FOUNDATION TRUST
---

Phase 1: Release Truth — Port Canonicalization & CI Pipeline

Goal: One canonical runtime contract for ports/environment. CI blocks merges
unless build, typecheck, backend tests, migration validation, and smoke pass.

S-1.1: Canonicalize port configuration across all config files

Files: server/index.ts, vite.config.ts, playwright.config.ts, .env.example
Write scope: server/index.ts, vite.config.ts, playwright.config.ts, .env.example
Parallel group: config

Current state: Server defaults to 5000, Playwright waits on PORT ?? 5101,
Vite reads VITE_PORT || 3101 and VITE_BACKEND_PORT || PORT || 5000.

Target state:
- Express always uses PORT env var, default 5000
- Vite dev always uses VITE_PORT env var, default 3101
- Playwright webServer uses PORT ?? 5000 (not 5101)
- .env.example documents: PORT=5000, VITE_PORT=3101
- Remove all hardcoded 5101 references

Acceptance criteria:
- R-P1-01: PORT is the single source of truth for Express port
- R-P1-02: Playwright webServer health check URL uses PORT ?? 5000
- R-P1-03: Vite proxy target uses VITE_BACKEND_PORT || PORT || 5000 (already correct, verify no regression)
- R-P1-04: .env.example documents both PORT and VITE_PORT with defaults
- R-P1-05: No hardcoded 5101 anywhere in codebase (grep verification)

Verify:
  cmd: grep -r "5101" --include="*.ts" --include="*.yml" --include="*.json" . | grep -v node_modules | grep -v .claude
  expect: 0 matches
  cmd: PORT=5000 npm run server &; sleep 3; curl -s http://localhost:5000/api/health | jq .status
  expect: "ok"
  cmd: kill %1
  artifact: screenshot of .env.example showing PORT=5000, VITE_PORT=3101

S-1.2: Enhance CI pipeline to full release-gate quality

File: .github/workflows/ci.yml
Write scope: .github/workflows/ci.yml
Parallel group: config

Current state: CI only runs typecheck (frontend + server) and tests
(frontend + server unit, excluding integration). No build, no migration
validation, no smoke test.

Target state — add these jobs:

1. frontend-build job: npm run build — catches import errors, chunk size
   regressions, Vite config problems that typecheck misses.

2. migration-validation job: Node script that calls scanMigrationFiles()
   from server/lib/migrator.ts, verifies: all .sql files parse, no duplicate
   filenames, every file has -- UP and -- DOWN markers. No MySQL needed.

3. deployment-readiness job: Run the existing server deployment-readiness
   test suite (server/__tests__/deployment/).

4. smoke-test job: Uses GitHub Actions mysql:8.0 service container on
   port 3306. Starts Express server with test DB credentials. Hits
   GET /api/health. Verifies {"status":"ok","mysql":"connected"}.
   Exact service container config:
     services:
       mysql:
         image: mysql:8.0
         env:
           MYSQL_ROOT_PASSWORD: test
           MYSQL_DATABASE: loadpilot_test
         ports: ["3306:3306"]
         options: --health-cmd="mysqladmin ping" --health-interval=10s

Acceptance criteria:
- R-P1-06: CI runs npm run build and fails merge if build errors
- R-P1-07: CI validates migration file integrity (parse, markers, no filename dupes)
- R-P1-08: CI runs deployment-readiness test suite
- R-P1-09: CI starts real Express + MySQL, hits /api/health, verifies status:ok + mysql:connected
- R-P1-10: All 4 new CI jobs are required status checks for PR merge to main

Verify:
  cmd: Create test PR with deliberate build error (bad import) → CI must block merge
  cmd: Create test PR with migration missing -- DOWN marker → CI must block
  cmd: Verify smoke-test job logs show {"status":"ok","mysql":"connected"}
  artifact: CI run screenshot showing all 8 jobs (4 existing + 4 new) green

---

Phase 2: Data Truth — Remove ALL Silent Stale-Data Fallbacks

Goal: The app never silently substitutes stale cached data or empty arrays
for failed API responses. Every failure surfaces as an error the UI can
display. This covers ALL 20+ silent fallback patterns across 7 service files.

S-2.1: Remove all silent fallbacks in storageService.ts

File: services/storageService.ts
Write scope: services/storageService.ts
Parallel group: frontend-data-truth

Functions to fix:
- getLoads() (line 146): catches all errors, returns _cachedLoads → throw instead
- getDispatchEvents() (line 246): catches all errors, returns [] → throw instead
- getIncidents() (line 579): catches all errors, returns [] → throw instead
- createIncident() (line 607): swallows API error, returns false → throw instead
- saveIncident() (line 631): swallows API error, returns false → throw instead
- saveIncidentAction() (line 649): swallows API error silently → throw instead

Also: remove _cachedLoads in-memory cache entirely. getRawLoads() callers
must be migrated to use the async getLoads() path.

Acceptance criteria:
- R-P2-01: getLoads() throws on API failure (no cached fallback)
- R-P2-02: getDispatchEvents() throws on API failure (no empty array fallback)
- R-P2-03: getIncidents() throws on API failure (no empty array fallback)
- R-P2-04: createIncident() throws on API failure (no silent false return)
- R-P2-05: saveIncident() throws on API failure (no silent false return)
- R-P2-06: saveIncidentAction() throws on API failure
- R-P2-07: _cachedLoads removed or marked internal-only (never returned to callers on error)
- R-P2-08: All components calling these functions handle errors (show ErrorState or Toast)

Verify:
  cmd: grep -n "console.warn.*fallback\|console.warn.*API\|return \[\]" services/storageService.ts
  expect: 0 matches (except seedDemoLoads no-op which is acceptable)
  cmd: npx vitest run --reporter=verbose -- storageService
  expect: all tests pass, error-path tests confirm throws
  artifact: test output showing error-path coverage for each function

S-2.2: Remove all read fallbacks in authService.ts

File: services/authService.ts
Write scope: services/authService.ts
Parallel group: frontend-data-truth-auth-reads
Depends on: nothing

Functions to fix:
- getCompany() (line 550): catches API error, falls back to getStoredCompanies() → throw instead
- getCompanyUsers() (line 1038): catches API error, falls back to getStoredUsers() → throw instead
- onAuthStateChanged handler (line 248): session hydration catches error, falls back to
  getStoredUsers().find() → on hydration failure, set user to null and emit auth:session-failed event.
  Do NOT silently resolve to a cached user object.

Acceptance criteria:
- R-P2-09: getCompany() throws on API failure (no cache fallback)
- R-P2-10: getCompanyUsers() throws on API failure (no cache fallback)
- R-P2-11: Session hydration failure sets user to null (no silent cache lookup)
- R-P2-12: Session hydration failure emits event so UI can show re-login prompt

Verify:
  cmd: grep -n "getStoredCompanies\|getStoredUsers" services/authService.ts
  expect: only definition lines and explicit non-fallback usage remain
  cmd: npx vitest run --reporter=verbose -- authService
  expect: all tests pass
  artifact: test showing session hydration failure → user is null

S-2.3: Remove all write fallbacks in authService.ts

File: services/authService.ts
Write scope: services/authService.ts
Parallel group: frontend-data-truth-auth-writes
Depends on: S-2.2 (same file)

Functions to fix:
- updateCompany() (line 562): re-throws HTTP errors but swallows network errors,
  then mutates cache → throw ALL errors, only mutate cache after success
- updateUser() (line 587): same pattern → throw ALL errors, only mutate cache after success

Acceptance criteria:
- R-P2-13: updateCompany() throws on ALL errors (network and HTTP)
- R-P2-14: updateUser() throws on ALL errors (network and HTTP)
- R-P2-15: Client cache is never mutated unless the API call succeeded
- R-P2-16: Components calling these functions show error states on failure

Verify:
  cmd: npx vitest run --reporter=verbose -- authService
  expect: error-path tests confirm: mock network error → throw, cache unchanged
  artifact: test output showing cache-integrity assertions

S-2.4: Remove all silent fallbacks in brokerService.ts

File: services/brokerService.ts
Write scope: services/brokerService.ts
Parallel group: frontend-data-truth

Functions to fix:
- getBrokers() (line 26): catches API error, returns [] → throw instead
- saveBroker() (line 44): swallows save failure → throw instead
- getContracts() (line 72): catches API error, returns [] → throw instead
- saveContract() (line 86): swallows save failure → throw instead

Acceptance criteria:
- R-P2-17: getBrokers() throws on API failure
- R-P2-18: saveBroker() throws on API failure
- R-P2-19: getContracts() throws on API failure
- R-P2-20: saveContract() throws on API failure

Verify:
  cmd: grep -n "console.warn.*failed" services/brokerService.ts
  expect: 0 matches
  cmd: npx vitest run --reporter=verbose -- brokerService
  expect: all tests pass with error-path coverage
  artifact: test output showing error-path assertions for all 4 functions

S-2.5: Remove all silent fallbacks in storage sub-modules

Files: services/storage/calls.ts, services/storage/tasks.ts
Write scope: services/storage/calls.ts, services/storage/tasks.ts
Parallel group: frontend-data-truth

Functions to fix:
- getRawCalls() (calls.ts line 25): catches API error, returns [] → throw
- getRawTasks() (tasks.ts line 25): catches API error, returns [] → throw
- getRawWorkItems() (tasks.ts line 71): catches API error, returns [] → throw

Acceptance criteria:
- R-P2-21: getRawCalls() throws on API failure
- R-P2-22: getRawTasks() throws on API failure
- R-P2-23: getRawWorkItems() throws on API failure

Verify:
  cmd: grep -rn "return \[\]" services/storage/calls.ts services/storage/tasks.ts
  expect: 0 matches
  cmd: npx vitest run --reporter=verbose services/storage/__tests__/calls.test.ts services/storage/__tests__/tasks.test.ts
  expect: all tests pass
  artifact: test output showing error-path assertions for getRawCalls, getRawTasks, getRawWorkItems

---

Phase 3: Tenant Safety — Enforce company_id at Repository Layer

Goal: No tenant-scoped repository method can execute without an explicit
companyId parameter. Middleware is necessary but not sufficient.

S-3.1: Audit and enforce company_id in repository method signatures

Files: server/routes/*.ts, server/services/*.ts
Write scope: server/routes/*.ts (except tracking.ts), server/services/*.ts (except quickbooks.service.ts, secret-encryption.ts)
Parallel group: backend-tenant

Current: requireTenant middleware checks :companyId param and body.company_id,
but the real integration test confirms unfiltered queries return both tenants'
data. Isolation is "application responsibility."

Target:
1. Every function that queries a tenant-scoped table MUST accept
   companyId: string as a required parameter (not optional, not from closure).
2. Audit all route handlers for direct pool.query calls that touch tenant
   tables without WHERE company_id = ?.
3. Add a CI grep check (in ci.yml or as a pre-commit script):
   For each tenant table (loads, equipment, users, invoices, bills, settlements,
   documents, tracking_events, incidents, dispatch_events, call_sessions):
   any SELECT/UPDATE/DELETE on that table MUST include "company_id" in the
   same query string. Violations fail CI.
4. At least 5 new negative integration tests: query with wrong companyId → 0 rows.

Acceptance criteria:
- R-P3-01: Every repository function querying tenant tables has companyId as required param
- R-P3-02: No route handler passes companyId from an unvalidated source
- R-P3-03: 5+ negative integration tests: wrong companyId → 0 rows or 403
- R-P3-04: CI grep check fails on unscoped tenant-table queries (enforceable, not convention)

Verify:
  cmd: node scripts/check-tenant-scoping.js (new script that greps server/ for unscoped queries)
  expect: exit 0 (all queries scoped)
  cmd: cd server && npx vitest run --reporter=verbose -- tenant-isolation
  expect: all 5+ negative tests pass
  artifact: CI log showing tenant-scope check green

S-3.2: Harden webhook tenant resolution

File: server/routes/tracking.ts
Write scope: server/routes/tracking.ts (lines 400-430 only)
Parallel group: backend-tracking-webhook
Depends on: nothing

Current: GPS webhook stores events with company_id = "unresolved" when the
provided companyId doesn't match any tenant.

Target:
1. Reject webhooks with missing companyId → return 400 {"error": "company_id required"}
2. Reject webhooks with unknown companyId → return 400 {"error": "unknown company_id"}
3. Log rejected webhooks with REDACTED fields only: vehicleId, companyId,
   timestamp, provider_name. NEVER log api_token, webhook_secret, or full
   GPS coordinates (truncate to 2 decimal places for privacy).
4. Add metrics counter: tracking.webhook.rejected (by reason)
5. Remove "unresolved" company_id pattern entirely

Acceptance criteria:
- R-P3-05: Webhook with missing companyId returns 400
- R-P3-06: Webhook with unknown companyId returns 400
- R-P3-07: No rows in tracking tables have company_id = "unresolved"
- R-P3-08: Rejected webhook logs contain only redacted fields (no secrets, no raw coords)
- R-P3-09: Metrics counter incremented on rejection

Verify:
  cmd: curl -X POST localhost:5000/api/tracking/webhook -d '{"vehicleId":"V1","latitude":40.7,"longitude":-74.0}' → 400
  cmd: curl -X POST localhost:5000/api/tracking/webhook -d '{"vehicleId":"V1","companyId":"nonexistent","latitude":40.7,"longitude":-74.0}' → 400
  cmd: grep -n "unresolved" server/routes/tracking.ts → 0 matches
  cmd: cd server && npx vitest run --reporter=verbose -- tracking.webhook
  expect: all tests pass
  artifact: test output showing 400 responses and redacted log assertions

---

Phase 4: Identity & Dev Surface Hardening

Goal: Production does not auto-create tenants at login. Dev/demo surfaces
do not leak into production bundle.

S-4.1: Add ALLOW_AUTO_PROVISION feature flag

File: server/routes/users.ts, server/lib/env.ts
Write scope: server/routes/users.ts, server/lib/env.ts
Parallel group: backend-identity

Current: Any verified Firebase identity without a SQL profile auto-creates
a company + admin user at users.ts:282.

Target:
1. Read ALLOW_AUTO_PROVISION env var (default: "false")
2. When false and no SQL principal: return 403 with
   {"error": "Account not found. Please sign up or contact your administrator."}
3. When true: keep auto-provision but add structured audit log:
   {event: "auto_provision", firebaseUid, email, sourceIp, timestamp, newCompanyId, newUserId}
4. Document in server/lib/env.ts validation and .env.example

Acceptance criteria:
- R-P4-01: ALLOW_AUTO_PROVISION=false (default) → login without SQL profile returns 403
- R-P4-02: ALLOW_AUTO_PROVISION=true → auto-provision works as before
- R-P4-03: Auto-provision emits structured audit log with uid, email, IP, timestamp
- R-P4-04: server/lib/env.ts documents ALLOW_AUTO_PROVISION
- R-P4-05: Existing integration tests pass with ALLOW_AUTO_PROVISION=true

Verify:
  cmd: ALLOW_AUTO_PROVISION=false cd server && npx vitest run -- users.auto-provision
  expect: test shows 403 for unknown Firebase identity
  cmd: ALLOW_AUTO_PROVISION=true cd server && npx vitest run -- users.auto-provision
  expect: test shows successful provision + audit log entry
  artifact: test output showing both flag states

S-4.2: Audit and harden dev/demo surfaces for production trust

Files: services/firebase.ts, services/authService.ts, config/features.ts, services/mockDataService.ts
Write scope: services/firebase.ts, services/authService.ts, config/features.ts, services/mockDataService.ts
Parallel group: frontend-dev-surfaces
Depends on: S-2.2, S-2.3 (writes authService.ts — moves seedFixtures to dynamic import)

Current state:
- DEMO_MODE (firebase.ts:23): activates when DEV + no Firebase API key. Has production
  guard (throws if PROD && DEMO_MODE). This is reasonably safe.
- seedFixtures (authService.ts:29-100): hardcoded dev credentials. Object is always
  in the production bundle even though seedDatabase() is gated.
- seedDatabase() (authService.ts:1052): called from App.tsx:368 only when
  features.seedSystem is true. features.seedSystem = import.meta.env.DEV.
- mockDataService.ts: seedMockData tree-shakes to no-op in production.
- features.ts: 5 flags all gated by import.meta.env.DEV.

Target:
1. Move seedFixtures to a dev-only module (e.g., services/dev/seed-fixtures.ts)
   that is only imported when features.seedSystem is true. Use dynamic import
   so Vite tree-shakes it from production bundle.
2. Add build-time verification: after npm run build, grep dist/ for known
   seed strings ("admin@loadpilot.com", "User123", "seedDatabase"). If found,
   build fails.
3. Verify DEMO_MODE production guard with an explicit unit test.
4. Document dev/prod trust boundary in a code comment block at top of
   config/features.ts.

Acceptance criteria:
- R-P4-06: seedFixtures not present in production bundle (verified by build grep)
- R-P4-07: "admin@loadpilot.com" and "User123" not in dist/ after npm run build
- R-P4-08: DEMO_MODE production guard tested (import.meta.env.PROD + no API key → throws)
- R-P4-09: config/features.ts documents dev/prod trust boundary
- R-P4-10: seedDatabase() uses dynamic import for fixtures (tree-shakeable)

Verify:
  cmd: npm run build && grep -r "admin@loadpilot.com" dist/ && echo "FAIL: seed leaked" || echo "PASS: clean"
  expect: "PASS: clean"
  cmd: npm run build && grep -r "User123" dist/ && echo "FAIL: seed leaked" || echo "PASS: clean"
  expect: "PASS: clean"
  cmd: npx vitest run --reporter=verbose -- firebase.demo-mode
  expect: production guard test passes
  artifact: build output + grep results showing clean production bundle

---

Phase 5: Secret Encryption — Reusable Encryption Service

Goal: No production secret stored plaintext. Tracking provider credentials
encrypted at rest using the same pattern as QuickBooks tokens.

S-5.1: Extract reusable secret-encryption service

Files: server/services/quickbooks.service.ts, server/services/secret-encryption.ts (new)
Write scope: server/services/secret-encryption.ts, server/services/quickbooks.service.ts
Parallel group: backend-security

Current: AES-256-GCM encryption exists in quickbooks.service.ts:64-100 but
is private to that module.

Target:
1. Create server/services/secret-encryption.ts
2. Export: encryptSecret(plaintext: string): string and decryptSecret(ciphertext: string): string
3. Use SECRET_ENCRYPTION_KEY env var (fall back to QUICKBOOKS_TOKEN_ENCRYPTION_KEY for compat)
4. Refactor quickbooks.service.ts to import from shared module
5. Add to server/lib/env.ts: SECRET_ENCRYPTION_KEY documentation

Acceptance criteria:
- R-P5-01: secret-encryption.ts exports encryptSecret and decryptSecret
- R-P5-02: quickbooks.service.ts uses shared encryption (no local copy)
- R-P5-03: SECRET_ENCRYPTION_KEY documented in env.ts and .env.example
- R-P5-04: Unit tests verify encrypt→decrypt roundtrip, invalid key → throw, tampered ciphertext → throw

Verify:
  cmd: cd server && npx vitest run --reporter=verbose -- secret-encryption
  expect: roundtrip, bad-key, and tamper tests pass
  cmd: grep -n "encryptToken\|decryptToken" server/services/quickbooks.service.ts
  expect: only import lines, no local implementation
  artifact: test output

S-5.2: Encrypt tracking provider credentials at rest

File: server/routes/tracking.ts
Write scope: server/routes/tracking.ts (lines 510-540, 690-710), server/migrations/ (new migration)
Parallel group: backend-tracking-secrets
Depends on: S-5.1 (needs shared encryption service), S-3.2 (same file)

Target:
1. On INSERT/UPDATE: encrypt api_token and webhook_secret via encryptSecret() before storing
2. On SELECT for use (test endpoint): decrypt via decryptSecret() at point of use only
3. On SELECT for display (GET providers list): return masked value ("****" + last 4 chars)
4. New migration (043_encrypt_tracking_secrets.sql): reads existing plaintext values,
   encrypts them in-place. Idempotent (skip already-encrypted values by checking prefix).

Acceptance criteria:
- R-P5-05: New tracking configs store api_token encrypted
- R-P5-06: New tracking configs store webhook_secret encrypted
- R-P5-07: GET /api/tracking/providers returns masked secrets ("****1234"), not plaintext
- R-P5-08: POST /api/tracking/providers/:id/test decrypts at point of use
- R-P5-09: Migration 043 encrypts existing plaintext values

Verify:
  cmd: cd server && npx vitest run --reporter=verbose -- tracking.provider
  expect: tests confirm: insert → SELECT raw → value is ciphertext, GET endpoint → masked
  cmd: SELECT api_token FROM tracking_provider_configs LIMIT 1 (manual DB check)
  expect: base64-encoded ciphertext, not plaintext
  artifact: test output + manual DB query screenshot

---

Phase 6: Object Storage — Firebase Storage Adapter

Goal: Production documents in Firebase Storage with signed URLs,
tenant-aware paths, retention metadata. Disk adapter retained for dev.

S-6.1: Create Firebase Storage adapter and factory

Files: server/services/firebase-storage-adapter.ts (new), server/services/document.service.ts
Write scope: server/services/firebase-storage-adapter.ts, server/services/document.service.ts
Parallel group: backend-storage

Target:
1. Implement FirebaseStorageAdapter satisfying StorageAdapter interface
2. Tenant-aware paths: {companyId}/{documentType}/{filename}
3. Signed URLs with configurable expiration (default 1 hour)
4. Metadata: companyId, uploadedBy, contentType stored as custom metadata
5. Add createStorageAdapter() factory in document.service.ts:
   reads STORAGE_BACKEND env var ("firebase" | "disk", default "disk")

Acceptance criteria:
- R-P6-01: FirebaseStorageAdapter implements StorageAdapter interface
- R-P6-02: Upload paths are tenant-scoped: {companyId}/{type}/{file}
- R-P6-03: getSignedUrl returns time-limited Firebase Storage signed URL
- R-P6-04: STORAGE_BACKEND=firebase selects Firebase adapter
- R-P6-05: STORAGE_BACKEND=disk (default) selects disk adapter
- R-P6-06: createStorageAdapter() factory exported from document.service.ts

Verify:
  cmd: STORAGE_BACKEND=disk cd server && npx vitest run -- document.service
  expect: tests pass using disk adapter
  cmd: STORAGE_BACKEND=firebase cd server && npx vitest run -- firebase-storage
  expect: tests pass against Firebase Storage emulator
  artifact: test output for both adapters

S-6.2: Update documents route to use adapter factory

File: server/routes/documents.ts
Write scope: server/routes/documents.ts
Parallel group: backend-storage
Depends on: S-6.1

Current: const defaultStorageAdapter = createDiskStorageAdapter() hardcoded at line 39.

Target: Replace with createStorageAdapter() factory call. Add STORAGE_BACKEND
to .env.example.

Acceptance criteria:
- R-P6-07: documents.ts imports and uses createStorageAdapter() (not hardcoded disk)
- R-P6-08: .env.example documents STORAGE_BACKEND with description
- R-P6-09: All existing document tests pass with STORAGE_BACKEND=disk (default)

Verify:
  cmd: grep -n "createDiskStorageAdapter" server/routes/documents.ts
  expect: 0 matches (replaced by factory)
  cmd: cd server && npx vitest run --reporter=verbose -- documents
  expect: all tests pass
  artifact: test output

---
## P1 — WORKFLOW TRUST
---

Phase 7: Core Workflow E2E — Login/Session Lifecycle

Goal: Login, session refresh, session expiry, and logout work E2E.

S-7.1: E2E test for login → session → expiry → re-login flow

File: e2e/auth-lifecycle.spec.ts (new)
Write scope: e2e/auth-lifecycle.spec.ts
Parallel group: e2e-specs
Auth harness: Firebase Auth Emulator (FIREBASE_AUTH_EMULATOR_HOST=localhost:9099)

Acceptance criteria:
- R-P7-01: Test covers: login → verify session token → navigate protected route → force token expiry → SessionExpiredModal appears → re-login succeeds
- R-P7-02: Test runs against Firebase Auth Emulator (required, not optional)
- R-P7-03: Test fails if any step produces a console error (console.error listener)

Verify:
  cmd: FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 npx playwright test e2e/auth-lifecycle.spec.ts
  expect: all tests pass
  artifact: Playwright HTML report

---

Phase 8: Core Workflow E2E — Quote-to-Booking-to-Load

Goal: Quote → booking → load creation flow works E2E.

S-8.1: Strengthen existing quote-to-load E2E spec

File: e2e/quote-to-load.spec.ts (exists — strengthen, not create)
Write scope: e2e/quote-to-load.spec.ts
Parallel group: e2e-specs

Current: Existing spec covers quote creation → approval → booking → load
conversion. May not verify all data integrity assertions.

Target: Review and strengthen:
1. Verify quote status transitions: draft → quoted → booked
2. Verify booking record links back to quote ID
3. Verify load record links back to booking ID and has correct initial status
4. Add console.error listener to fail on any backend errors

Acceptance criteria:
- R-P8-01: Quote creation → status "quoted" verified
- R-P8-02: Booking conversion → booking.quoteId matches original quote
- R-P8-03: Load conversion → load appears on board with correct status and booking link
- R-P8-04: No console errors during entire flow

Verify:
  cmd: npx playwright test e2e/quote-to-load.spec.ts --reporter=list
  expect: all tests pass
  artifact: Playwright HTML report

---

Phase 9: Core Workflow E2E — Load Dispatch & Status Changes

Goal: Load status machine transitions verified E2E.

S-9.1: Strengthen existing load lifecycle E2E spec

File: e2e/load-lifecycle.spec.ts (exists — strengthen, not create)
Write scope: e2e/load-lifecycle.spec.ts
Parallel group: e2e-specs

Current: Existing spec covers load creation, retrieval, update, persistence,
and auth enforcement. May not cover full 8-state lifecycle.

Target: Ensure coverage of:
1. Full 8-state lifecycle: DRAFT → POSTED → ASSIGNED → DISPATCHED → IN_TRANSIT → DELIVERED → COMPLETED → ARCHIVED
2. Invalid transition rejection (e.g., DRAFT → DELIVERED)
3. Each transition creates dispatch_event record (verified via API)
4. Status changes visible in UI load detail view

Acceptance criteria:
- R-P9-01: Full 8-state lifecycle traversed in one test
- R-P9-02: Invalid transition returns 400/422 with descriptive error
- R-P9-03: dispatch_events table has one record per transition (verified via API)
- R-P9-04: UI load detail shows correct status after each transition

Verify:
  cmd: npx playwright test e2e/load-lifecycle.spec.ts --reporter=list
  expect: all tests pass
  artifact: Playwright HTML report

---

Phase 10: Core Workflow E2E — Document Upload/Download

Goal: Document lifecycle works E2E with tenant isolation.

S-10.1: E2E test for document lifecycle

File: e2e/document-lifecycle.spec.ts (new)
Write scope: e2e/document-lifecycle.spec.ts
Parallel group: e2e-specs

Acceptance criteria:
- R-P10-01: Upload document via API → verify stored (response includes document ID + URL)
- R-P10-02: Download document → content matches original upload (byte comparison)
- R-P10-03: Document metadata (type, companyId, status) correctly persisted (verified via GET)
- R-P10-04: User from company B cannot access company A document (returns 403)

Verify:
  cmd: npx playwright test e2e/document-lifecycle.spec.ts --reporter=list
  expect: all tests pass including cross-tenant denial
  artifact: Playwright HTML report showing 4 passed tests

---

Phase 11: Core Workflow E2E — Settlement Posting

Goal: Settlement creation and immutability verified E2E.

S-11.1: E2E test for settlement lifecycle

File: e2e/settlement-lifecycle.spec.ts (new)
Write scope: e2e/settlement-lifecycle.spec.ts
Parallel group: e2e-specs

Acceptance criteria:
- R-P11-01: Create settlement for completed load → GL journal entries created (verified via accounting API)
- R-P11-02: Posted settlement PUT/PATCH returns 400/409 (immutability enforced)
- R-P11-03: Settlement total_amount matches load rate_amount + sum(expenses)

Verify:
  cmd: npx playwright test e2e/settlement-lifecycle.spec.ts --reporter=list
  expect: all tests pass including immutability enforcement
  artifact: Playwright HTML report

---

Phase 12: Remove Dead Production Affordances

Goal: No "coming soon" buttons, fake KPIs, or redirect shims in production UI.

S-12.1: Remove or replace dead actions in QuoteManager

File: components/QuoteManager.tsx
Write scope: components/QuoteManager.tsx
Parallel group: frontend-cleanup

Current: 4 buttons with disabled title="Feature not yet available" at
lines 528-539 and 1214-1216.

Target: Remove disabled buttons entirely. If the feature exists behind them,
wire it up. If not, remove the button.

Acceptance criteria:
- R-P12-01: No elements with title="Feature not yet available" in QuoteManager
- R-P12-02: No disabled buttons that represent unimplemented features
- R-P12-03: Remaining buttons all trigger real actions

Verify:
  cmd: grep -n "Feature not yet available" components/QuoteManager.tsx
  expect: 0 matches
  cmd: npx vitest run -- QuoteManager
  expect: all tests pass
  artifact: test output

S-12.2: Remove Dashboard redirect shim

File: components/Dashboard.tsx, App.tsx
Write scope: components/Dashboard.tsx, App.tsx
Parallel group: frontend-cleanup

Current: Dashboard.tsx is 31 lines — a redirect to Operations Center.

Target: Delete Dashboard.tsx. Update App.tsx to handle "dashboard" tab by
redirecting to "operations-hub" inline. Remove lazy import.

Acceptance criteria:
- R-P12-04: Dashboard.tsx deleted
- R-P12-05: App.tsx handles "dashboard" route by setting activeTab to "operations-hub"
- R-P12-06: No remaining imports or references to Dashboard component in codebase

Verify:
  cmd: test ! -f components/Dashboard.tsx && echo "PASS" || echo "FAIL"
  expect: PASS
  cmd: grep -rn "Dashboard" components/ App.tsx --include="*.tsx" | grep -v node_modules
  expect: 0 matches (no remaining references)
  cmd: npx vitest run -- App
  expect: all tests pass
  artifact: test output

S-12.3: Clean up stale demo documentation

Files: docs/demo-runbook.md
Write scope: docs/demo-runbook.md
Parallel group: docs-cleanup

Note: E2E_RESULTS.md accuracy (R-P12-08) is handled in S-16.1 (Documentation Truth)
to avoid write-scope conflict with the docs-cleanup parallel group.

Acceptance criteria:
- R-P12-07: demo-runbook.md has no "avoid this area" warnings for shipped features (update or remove)

Verify:
  cmd: grep -in "avoid\|do not\|skip\|broken" docs/demo-runbook.md
  expect: 0 matches for shipped features
  artifact: demo-runbook.md diff

---

Phase 13: Observability — Health Separation & Structured Logging

Goal: Health endpoint separates liveness from readiness. Every request
produces a structured log line.

S-13.1: Separate liveness from readiness in health endpoint

File: server/routes/health.ts
Write scope: server/routes/health.ts
Parallel group: backend-observability

Target:
1. /api/health/live — returns 200 always if process running (liveness probe)
2. /api/health/ready — returns 200 only if MySQL connected AND Firebase available
   AND no pending migrations. Returns 503 with {"ready":false, "reason":"..."} otherwise.
3. /api/health (legacy) — unchanged for backward compat

Acceptance criteria:
- R-P13-01: GET /api/health/live returns 200 always (process alive)
- R-P13-02: GET /api/health/ready returns 200 when MySQL + Firebase healthy
- R-P13-03: GET /api/health/ready returns 503 when MySQL disconnected
- R-P13-04: GET /api/health (legacy) unchanged

Verify:
  cmd: curl -s localhost:5000/api/health/live | jq .status → "alive"
  cmd: curl -s localhost:5000/api/health/ready | jq .ready → true (when healthy)
  cmd: cd server && npx vitest run --reporter=verbose -- health
  expect: all tests pass including degraded-state test
  artifact: test output showing all 3 endpoint variants

S-13.2: Add structured request logging with correlation IDs

Files: server/middleware/metrics.ts, server/lib/logger.ts
Write scope: server/middleware/metrics.ts
Parallel group: backend-observability

Target:
1. On every response (not just errors): emit structured log line with
   method, path, statusCode, duration_ms, correlationId, companyId (if auth'd)
2. Use existing pino logger (server/lib/logger.ts)
3. In-memory metrics store remains (pilot-acceptable). Add code comment:
   "PRODUCTION TODO: Export to Prometheus/Datadog/CloudWatch via prom-client
   or equivalent. In-memory store is single-node only."

Acceptance criteria:
- R-P13-05: Every request produces structured log: {method, path, statusCode, duration_ms}
- R-P13-06: Correlation ID appears in every request log
- R-P13-07: Authenticated requests include companyId in log
- R-P13-08: Code comment documents production export path

Verify:
  cmd: cd server && npx vitest run --reporter=verbose -- metrics
  expect: tests assert structured log output contains all required fields
  cmd: grep "PRODUCTION TODO" server/middleware/metrics.ts
  expect: 1 match documenting export path
  artifact: test output showing log format assertions

---

Phase 14: Performance — Real Load Test Foundation

Goal: At least one real (non-mocked) load test validates latency and
concurrency against a real database.

S-14.1: Create real load test against staging-like environment

File: server/__tests__/performance/real-load.test.ts (new)
Write scope: server/__tests__/performance/real-load.test.ts
Parallel group: backend-perf

Target:
1. Start real Express server + real MySQL (test DB)
2. 10 concurrent authenticated GET /api/loads requests
3. 10 concurrent authenticated POST /api/loads requests
4. Measure p50, p95, p99 latencies
5. Assert: p99 read < 500ms, p99 write < 1000ms
6. Assert: no MySQL connection pool exhaustion (no ECONNREFUSED/PROTOCOL_CONNECTION_LOST)
7. Note: This proves single-node baseline. Real staging soak test is a future
   ops task (documented in Phase 17 runbook).

Acceptance criteria:
- R-P14-01: Test starts real Express server with real MySQL (not mocked)
- R-P14-02: Read p99 < 500ms at 10 concurrent requests
- R-P14-03: Write p99 < 1000ms at 10 concurrent requests
- R-P14-04: No connection pool errors during test
- R-P14-05: Test documents that this is single-node baseline (not staging soak)

Verify:
  cmd: cd server && DB_NAME=loadpilot_test npx vitest run -- real-load
  expect: all assertions pass, p99 values printed
  artifact: test output showing p50/p95/p99 latency table

---
## P2 — STRUCTURAL TRUST
---

Phase 15: Monolith Breakup — Component Decomposition

Goal: Reduce regression-magnet monolith files to bounded feature modules.

S-15.1: Extract subsystem panels from IntelligenceHub

File: components/IntelligenceHub.tsx (5214 lines)
Write scope: components/IntelligenceHub.tsx, components/operations/ (new directory)
Parallel group: frontend-decomp

Target: Identify the 3-5 largest subsystem panels and extract each into its
own component file under components/operations/.

Acceptance criteria:
- R-P15-01: IntelligenceHub.tsx reduced to < 2000 lines (orchestration only)
- R-P15-02: Each extracted panel is a self-contained component with own file
- R-P15-03: No functionality changes — pure extraction refactor
- R-P15-04: All existing IntelligenceHub tests pass after extraction

Verify:
  cmd: wc -l components/IntelligenceHub.tsx
  expect: < 2000
  cmd: ls components/operations/*.tsx | wc -l
  expect: >= 3
  cmd: npx vitest run -- IntelligenceHub
  expect: all tests pass
  artifact: line count before/after + test output

S-15.2: Extract QuoteManager subsystems

File: components/QuoteManager.tsx
Write scope: components/QuoteManager.tsx, components/quotes/ (new directory)
Parallel group: frontend-decomp
Depends on: S-12.1 (dead buttons removed before decomposition)

Target: Extract quote detail panel, lead management, booking panel into
separate components under components/quotes/.

Acceptance criteria:
- R-P15-05: QuoteManager.tsx reduced to < 800 lines
- R-P15-06: Extracted components are independently testable
- R-P15-07: All existing QuoteManager tests pass

Verify:
  cmd: wc -l components/QuoteManager.tsx
  expect: < 800
  cmd: ls components/quotes/*.tsx | wc -l
  expect: >= 2
  cmd: npx vitest run -- QuoteManager
  expect: all tests pass
  artifact: line count before/after + test output

---

Phase 16: Documentation Truth — Align Docs with Codebase

Goal: Every documentation file accurately reflects current codebase state.

S-16.1: Update stale documentation files

Files: E2E_RESULTS.md, docs/deployment/MIGRATION_RUNBOOK.md, server/migrations/README.md
Write scope: E2E_RESULTS.md, docs/deployment/MIGRATION_RUNBOOK.md, server/migrations/README.md
Parallel group: docs-cleanup

Acceptance criteria:
- R-P12-08: E2E_RESULTS.md reflects actual spec count (45 specs) and test count
- R-P16-01: E2E_RESULTS.md reflects actual Playwright spec count (run npx playwright test --list, count output)
- R-P16-02: MIGRATION_RUNBOOK.md references correct top-of-chain migration (ls server/migrations/*.sql | tail -1)
- R-P16-03: migrations/README.md has correct "next available" number
- R-P16-04: No documentation file references a migration number, test count, or filename that doesn't exist

Verify:
  cmd: npx playwright test --list 2>/dev/null | wc -l
  expect: number matches E2E_RESULTS.md
  cmd: ls server/migrations/*.sql | tail -1
  expect: filename matches MIGRATION_RUNBOOK.md top-of-chain reference
  cmd: grep -oP '\d{3}_\S+\.sql' docs/deployment/MIGRATION_RUNBOOK.md | while read f; do test -f "server/migrations/$f" || echo "MISSING: $f"; done
  expect: no MISSING output
  artifact: diff of each updated file

---

Phase 17: Rollout Procedures — Migration Drill & Staging Rehearsal

Goal: Operators have one current migration truth, one staging rehearsal
command, and one rollback drill.

S-17.1: Create production migration and rollback runbook

Files: docs/ops/migration-runbook.md, docs/ops/rollback-procedure.md
Write scope: docs/ops/migration-runbook.md, docs/ops/rollback-procedure.md
Parallel group: docs-cleanup

Acceptance criteria:
- R-P17-01: Migration runbook lists exact commands: check pending, apply all, apply one, rollback one
- R-P17-02: Rollback procedure tested against current schema (commands verified locally)
- R-P17-03: Staging rehearsal documented: exact env vars, DB snapshot command, migration command, smoke test command
- R-P17-04: All commands are copy-pasteable (no placeholders requiring interpretation — use $VARIABLE syntax for env-specific values)

Verify:
  cmd: grep -c "TODO\|TBD\|PLACEHOLDER\|XXX" docs/ops/migration-runbook.md docs/ops/rollback-procedure.md
  expect: 0 matches
  cmd: Execute the "check pending migrations" command from the runbook
  expect: command runs successfully and shows current state
  artifact: screenshot of runbook command execution

---

## Phase Summary

| Phase | Tier | Focus | Stories | Key Files |
|-------|------|-------|---------|-----------|
| 1 | P0 | Release truth: ports + CI | 2 | ci.yml, vite.config.ts, playwright.config.ts |
| 2 | P0 | Data truth: remove ALL fallbacks | 5 | storageService.ts, authService.ts, brokerService.ts, storage/*.ts |
| 3 | P0 | Tenant safety: repo-layer + webhooks | 2 | server/routes/*.ts, tracking.ts |
| 4 | P0 | Identity + dev surfaces | 2 | users.ts, firebase.ts, features.ts |
| 5 | P0 | Secrets: encryption service + tracking | 2 | secret-encryption.ts, tracking.ts, quickbooks.service.ts |
| 6 | P0 | Storage: Firebase Storage adapter | 2 | document.service.ts, documents.ts |
| 7 | P1 | E2E: auth lifecycle | 1 | e2e/auth-lifecycle.spec.ts (new) |
| 8 | P1 | E2E: quote-to-load | 1 | e2e/quote-to-load.spec.ts (strengthen) |
| 9 | P1 | E2E: load lifecycle | 1 | e2e/load-lifecycle.spec.ts (strengthen) |
| 10 | P1 | E2E: document lifecycle | 1 | e2e/document-lifecycle.spec.ts (new) |
| 11 | P1 | E2E: settlement lifecycle | 1 | e2e/settlement-lifecycle.spec.ts (new) |
| 12 | P1 | Remove dead affordances | 3 | QuoteManager.tsx, Dashboard.tsx, demo-runbook.md |
| 13 | P1 | Observability + health separation | 2 | health.ts, metrics.ts |
| 14 | P1 | Real load testing | 1 | performance/ |
| 15 | P2 | Monolith decomposition | 2 | IntelligenceHub.tsx, QuoteManager.tsx |
| 16 | P2 | Documentation truth | 1 | E2E_RESULTS.md, MIGRATION_RUNBOOK.md |
| 17 | P2 | Rollout procedures | 1 | docs/ops/ |
| **Total** | | | **30 stories** | |

## Parallel Execution Groups

Stories within the same group can run simultaneously (disjoint write scopes).
Stories in different groups may also parallelize if no depends_on conflict.

| Group | Stories | Write Scope |
|-------|---------|-------------|
| config | S-1.1, S-1.2 | server/index.ts, vite.config.ts, playwright.config.ts, ci.yml |
| frontend-data-truth | S-2.1, S-2.4, S-2.5 | storageService.ts, brokerService.ts, storage/*.ts |
| frontend-data-truth-auth-reads | S-2.2 | authService.ts (read fallbacks) |
| frontend-data-truth-auth-writes | S-2.3 (after S-2.2) | authService.ts (write fallbacks) |
| backend-tenant | S-3.1 | server/routes/* (except tracking.ts) |
| backend-tracking-webhook | S-3.2 | server/routes/tracking.ts (webhook hardening) |
| backend-tracking-secrets | S-5.2 (after S-3.2 + S-5.1) | server/routes/tracking.ts (secret encryption) |
| backend-identity | S-4.1 | server/routes/users.ts, server/lib/env.ts |
| frontend-dev-surfaces | S-4.2 | firebase.ts, features.ts, mockDataService.ts |
| backend-security | S-5.1 | secret-encryption.ts, quickbooks.service.ts |
| backend-storage | S-6.1 → S-6.2 (sequential) | document.service.ts, documents.ts |
| e2e-specs | S-7.1, S-8.1, S-9.1, S-10.1, S-11.1 | e2e/*.spec.ts (each unique file) |
| frontend-cleanup | S-12.1, S-12.2 | QuoteManager.tsx, Dashboard.tsx/App.tsx |
| backend-observability | S-13.1, S-13.2 | health.ts, metrics.ts |
| backend-perf | S-14.1 | performance/real-load.test.ts |
| frontend-decomp | S-15.1, S-15.2 | IntelligenceHub.tsx, QuoteManager.tsx |
| docs-cleanup | S-12.3, S-16.1, S-17.1 | docs only |

## Dependency Graph

S-2.3 depends on S-2.2 (same file: authService.ts — reads first, then writes)
S-4.2 depends on S-2.2 AND S-2.3 (writes authService.ts — moves seedFixtures)
S-5.2 depends on S-5.1 (needs encryption service) AND S-3.2 (same file: tracking.ts)
S-6.2 depends on S-6.1 (needs factory)
S-15.2 depends on S-12.1 (dead buttons removed before decomposition)
All P1 E2E specs depend on P0 completion (data truth + tenant safety in place)
All P2 depends on P1 completion

## Requirement Index

| ID | Description | Phase |
|----|-------------|-------|
| R-P1-01 | PORT is single source of truth for Express | 1 |
| R-P1-02 | Playwright uses PORT ?? 5000 | 1 |
| R-P1-03 | Vite proxy uses VITE_BACKEND_PORT correctly | 1 |
| R-P1-04 | .env.example documents PORT and VITE_PORT | 1 |
| R-P1-05 | No hardcoded 5101 in codebase | 1 |
| R-P1-06 | CI runs npm run build | 1 |
| R-P1-07 | CI validates migration integrity | 1 |
| R-P1-08 | CI runs deployment-readiness | 1 |
| R-P1-09 | CI runs live smoke (real MySQL) | 1 |
| R-P1-10 | All CI jobs required for merge | 1 |
| R-P2-01 | getLoads throws on failure | 2 |
| R-P2-02 | getDispatchEvents throws on failure | 2 |
| R-P2-03 | getIncidents throws on failure | 2 |
| R-P2-04 | createIncident throws on failure | 2 |
| R-P2-05 | saveIncident throws on failure | 2 |
| R-P2-06 | saveIncidentAction throws on failure | 2 |
| R-P2-07 | _cachedLoads not returned on error | 2 |
| R-P2-08 | Components handle storageService errors | 2 |
| R-P2-09 | getCompany throws on failure | 2 |
| R-P2-10 | getCompanyUsers throws on failure | 2 |
| R-P2-11 | Session hydration failure → user null | 2 |
| R-P2-12 | Session failure emits auth event | 2 |
| R-P2-13 | updateCompany throws on ALL errors | 2 |
| R-P2-14 | updateUser throws on ALL errors | 2 |
| R-P2-15 | Cache only mutated on success | 2 |
| R-P2-16 | Components show error on mutation failure | 2 |
| R-P2-17 | getBrokers throws on failure | 2 |
| R-P2-18 | saveBroker throws on failure | 2 |
| R-P2-19 | getContracts throws on failure | 2 |
| R-P2-20 | saveContract throws on failure | 2 |
| R-P2-21 | getRawCalls throws on failure | 2 |
| R-P2-22 | getRawTasks throws on failure | 2 |
| R-P2-23 | getRawWorkItems throws on failure | 2 |
| R-P3-01 | Repo functions require companyId param | 3 |
| R-P3-02 | No unvalidated companyId sources | 3 |
| R-P3-03 | 5+ negative tenant isolation tests | 3 |
| R-P3-04 | CI check fails on unscoped tenant queries | 3 |
| R-P3-05 | Webhook rejects missing companyId (400) | 3 |
| R-P3-06 | Webhook rejects unknown companyId (400) | 3 |
| R-P3-07 | No "unresolved" company_id in tracking | 3 |
| R-P3-08 | Webhook logs redacted (no secrets/raw coords) | 3 |
| R-P3-09 | Rejection metrics counter | 3 |
| R-P4-01 | ALLOW_AUTO_PROVISION=false blocks provision | 4 |
| R-P4-02 | ALLOW_AUTO_PROVISION=true enables provision | 4 |
| R-P4-03 | Auto-provision audit log | 4 |
| R-P4-04 | env.ts documents ALLOW_AUTO_PROVISION | 4 |
| R-P4-05 | Existing tests pass with flag=true | 4 |
| R-P4-06 | seedFixtures not in production bundle | 4 |
| R-P4-07 | No dev credentials in dist/ | 4 |
| R-P4-08 | DEMO_MODE production guard tested | 4 |
| R-P4-09 | features.ts documents trust boundary | 4 |
| R-P4-10 | seedDatabase uses dynamic import | 4 |
| R-P5-01 | Shared encryption service exported | 5 |
| R-P5-02 | QuickBooks uses shared encryption | 5 |
| R-P5-03 | SECRET_ENCRYPTION_KEY documented | 5 |
| R-P5-04 | Encrypt/decrypt roundtrip + tamper tested | 5 |
| R-P5-05 | Tracking api_token encrypted at rest | 5 |
| R-P5-06 | Tracking webhook_secret encrypted at rest | 5 |
| R-P5-07 | GET providers returns masked secrets | 5 |
| R-P5-08 | Test endpoint decrypts at point of use | 5 |
| R-P5-09 | Migration encrypts existing values | 5 |
| R-P6-01 | FirebaseStorageAdapter implements interface | 6 |
| R-P6-02 | Upload paths tenant-scoped | 6 |
| R-P6-03 | Signed URLs with time limit | 6 |
| R-P6-04 | STORAGE_BACKEND=firebase selects Firebase | 6 |
| R-P6-05 | STORAGE_BACKEND=disk selects disk | 6 |
| R-P6-06 | Factory exported from document.service.ts | 6 |
| R-P6-07 | documents.ts uses factory | 6 |
| R-P6-08 | .env.example documents STORAGE_BACKEND | 6 |
| R-P6-09 | Tests pass with STORAGE_BACKEND=disk | 6 |
| R-P7-01 | E2E auth lifecycle test | 7 |
| R-P7-02 | Test uses Firebase Auth Emulator | 7 |
| R-P7-03 | No console errors during flow | 7 |
| R-P8-01 | Quote → "quoted" status | 8 |
| R-P8-02 | Booking links to quote ID | 8 |
| R-P8-03 | Load on board with booking link | 8 |
| R-P8-04 | No console errors during flow | 8 |
| R-P9-01 | Full 8-state lifecycle | 9 |
| R-P9-02 | Invalid transitions rejected | 9 |
| R-P9-03 | Dispatch events recorded per transition | 9 |
| R-P9-04 | Status visible in UI | 9 |
| R-P10-01 | Document upload stored | 10 |
| R-P10-02 | Download matches upload | 10 |
| R-P10-03 | Metadata correctly persisted | 10 |
| R-P10-04 | Cross-tenant access blocked | 10 |
| R-P11-01 | Settlement creates GL entries | 11 |
| R-P11-02 | Posted settlement immutable | 11 |
| R-P11-03 | Settlement totals match load | 11 |
| R-P12-01 | No "Feature not yet available" | 12 |
| R-P12-02 | No disabled unimplemented buttons | 12 |
| R-P12-03 | Remaining buttons trigger real actions | 12 |
| R-P12-04 | Dashboard.tsx deleted | 12 |
| R-P12-05 | Dashboard route redirects to ops-hub | 12 |
| R-P12-06 | No broken Dashboard references | 12 |
| R-P12-07 | demo-runbook.md cleaned | 12 |
| R-P12-08 | E2E_RESULTS.md accurate | 12 |
| R-P13-01 | /api/health/live always 200 | 13 |
| R-P13-02 | /api/health/ready 200 when healthy | 13 |
| R-P13-03 | /api/health/ready 503 when degraded | 13 |
| R-P13-04 | Legacy /api/health unchanged | 13 |
| R-P13-05 | Structured request log every response | 13 |
| R-P13-06 | Correlation ID in logs | 13 |
| R-P13-07 | CompanyId in auth'd request logs | 13 |
| R-P13-08 | Production export path documented | 13 |
| R-P14-01 | Load test against real server | 14 |
| R-P14-02 | Read p99 < 500ms at 10 concurrent | 14 |
| R-P14-03 | Write p99 < 1000ms | 14 |
| R-P14-04 | No pool exhaustion | 14 |
| R-P14-05 | Single-node baseline documented | 14 |
| R-P15-01 | IntelligenceHub < 2000 lines | 15 |
| R-P15-02 | Extracted panels self-contained | 15 |
| R-P15-03 | Pure extraction, no behavior changes | 15 |
| R-P15-04 | IntelligenceHub tests pass | 15 |
| R-P15-05 | QuoteManager < 800 lines | 15 |
| R-P15-06 | Extracted components testable | 15 |
| R-P15-07 | QuoteManager tests pass | 15 |
| R-P16-01 | E2E_RESULTS.md spec count accurate | 16 |
| R-P16-02 | MIGRATION_RUNBOOK references correct migration | 16 |
| R-P16-03 | migrations/README.md correct next number | 16 |
| R-P16-04 | No doc references to nonexistent files | 16 |
| R-P17-01 | Migration commands documented | 17 |
| R-P17-02 | Rollback procedure tested | 17 |
| R-P17-03 | Staging rehearsal documented | 17 |
| R-P17-04 | All commands copy-pasteable | 17 |

## Pilot-Ready Checklist (Exit Criteria)

After all 17 phases complete, the product is deploy-ready for a controlled
pilot with real tenants. It is NOT yet full production-grade SaaS. Remaining
gaps (documented, not hidden):
- External APM/metrics export (Phase 13 documents the path, does not implement)
- Multi-node staging soak test (Phase 14 establishes single-node baseline only)
- Real load-balancer / CDN / TLS termination configuration
- Operational alerting and on-call runbooks tied to monitoring signals

Verify:

- [ ] Fresh environment boots with no manual patching, no port guessing
- [ ] CI blocks merges unless build + typecheck + tests + migration validation + smoke pass
- [ ] UI never silently substitutes stale data for failed live data (ALL 20+ fallbacks removed)
- [ ] No tenant-scoped repository method executes without explicit companyId
- [ ] CI check enforces tenant query scoping (not just convention)
- [ ] No production secret stored plaintext
- [ ] No production document lives only on local disk (adapter factory in place)
- [ ] No dev credentials or seed fixtures in production bundle
- [ ] DEMO_MODE production guard tested
- [ ] Top 5 customer workflows pass E2E with Firebase Auth Emulator
- [ ] Liveness and readiness probes separated
- [ ] Every request produces structured log with correlation ID
- [ ] Single-node performance baseline established (p99 < 500ms reads, < 1000ms writes)
- [ ] Staging migration and rollback runbooks are copy-pasteable
- [ ] Docs match codebase exactly
