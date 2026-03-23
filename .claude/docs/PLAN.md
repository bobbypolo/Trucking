Plan: Full QA Remediation — LoadPilot Integration Fix

 Context

 A Playwright-driven QA audit on 2026-03-22 found LoadPilot is ~35% functional
 as an integrated product despite 177+ backend endpoints and 15+ polished UI
 pages. This plan remediates every issue cataloged in
 docs/QA-FULL-AUDIT-2026-03-22.md plus page-level feature gaps and HTTP 403/400
  errors.

 Audit totals: 120 console errors (41×500, 26×403, 21×400, 20×401, 11×404), 42
 hardcoded fake values, 18+ dead buttons, 5 schema conflicts, 8 missing tables,
  18 auth-less service functions, 9 incomplete pages.

 Branch: ralph/full-saas-integration-sprint (current)

 ---
 Phase 1: Auth Infrastructure (eliminates 401s + race conditions)

 S-1.1: Replace raw fetch() in financialService.ts

 File: services/financialService.ts
 Reuse: api.get/post/patch/delete from services/api.ts (lines 69-86)

 All 20 functions use raw fetch() with no Bearer token. Convert each to the
 api.* helpers which auto-inject auth via getIdTokenAsync().

 ┌─────────────────────┬──────┬───────────┐
 │      Function       │ Line │  Method   │
 ├─────────────────────┼──────┼───────────┤
 │ getGLAccounts       │ 7    │ api.get   │
 ├─────────────────────┼──────┼───────────┤
 │ getLoadProfitLoss   │ 16   │ api.get   │
 ├─────────────────────┼──────┼───────────┤
 │ createARInvoice     │ 21   │ api.post  │
 ├─────────────────────┼──────┼───────────┤
 │ createAPBill        │ 30   │ api.post  │
 ├─────────────────────┼──────┼───────────┤
 │ createJournalEntry  │ 39   │ api.post  │
 ├─────────────────────┼──────┼───────────┤
 │ getSettlements      │ 48   │ api.get   │
 ├─────────────────────┼──────┼───────────┤
 │ createSettlement    │ 59   │ api.post  │
 ├─────────────────────┼──────┼───────────┤
 │ importFuelPurchases │ 68   │ api.post  │
 ├─────────────────────┼──────┼───────────┤
 │ getInvoices         │ 75   │ api.get   │
 ├─────────────────────┼──────┼───────────┤
 │ getBills            │ 84   │ api.get   │
 ├─────────────────────┼──────┼───────────┤
 │ getVaultDocs        │ 93   │ api.get   │
 ├─────────────────────┼──────┼───────────┤
 │ uploadToVault       │ 99   │ api.post  │
 ├─────────────────────┼──────┼───────────┤
 │ updateDocStatus     │ 107  │ api.patch │
 ├─────────────────────┼──────┼───────────┤
 │ getIFTASummary      │ 115  │ api.get   │
 ├─────────────────────┼──────┼───────────┤
 │ getMileageEntries   │ 124  │ api.get   │
 ├─────────────────────┼──────┼───────────┤
 │ saveMileageEntry    │ 130  │ api.post  │
 ├─────────────────────┼──────┼───────────┤
 │ postIFTAToLedger    │ 138  │ api.post  │
 ├─────────────────────┼──────┼───────────┤
 │ getIFTAEvidence     │ 146  │ api.get   │
 ├─────────────────────┼──────┼───────────┤
 │ analyzeIFTA         │ 151  │ api.post  │
 ├─────────────────────┼──────┼───────────┤
 │ lockIFTATrip        │ 160  │ api.post  │
 └─────────────────────┴──────┴───────────┘

 Verify: grep -c "fetch(" services/financialService.ts → 0. Frontend tests
 pass.

 S-1.2: Replace raw fetch() in storageService.ts

 File: services/storageService.ts

 4 functions use raw fetch() + manual getAuthHeaders(): getDispatchEvents
 (L245), getTimeLogs (L276), logTime, logDispatchEvent. Convert to api.*
 helpers. Remove duplicate 401/403 checks (lines 259, 294).

 Verify: grep -c "fetch(" services/storageService.ts → 0. Duplicate auth checks
  gone.

 S-1.3: Auth readiness gate in App.tsx

 File: App.tsx

 Line 308: setUser(updatedUser) renders children BEFORE refreshData() completes
  → components fire API calls with stale state.

 Fix:
 1. Add const [isAuthReady, setIsAuthReady] = useState(false)
 2. In onUserChange callback (L306): call setIsAuthReady(true) AFTER await
 refreshData() completes
 3. Gate render: if (!user || !isAuthReady) → show <LoadingSkeleton>
 4. On logout/null user: reset isAuthReady = false

 Verify: Login → no 401 console errors. Children mount only after token
 confirmed.

 S-1.4: useCurrentUser() reactive hook

 Files: NEW hooks/useCurrentUser.ts, consumers: LoadDetailView.tsx:95,
 LoadList.tsx:29, Settlements.tsx
 Reuse: onUserChange() from services/authService.ts:119

 getCurrentUser() (authService.ts:396) returns _sessionCache synchronously —
 null before auth settles. Create useCurrentUser() hook subscribing to
 onUserChange(). Replace synchronous getCurrentUser() calls in consumer
 components.

 Verify: Components re-render on auth state change. No null-user crashes at
 render time.

 S-1.5: 401 token refresh + single retry in api.ts

 File: services/api.ts (lines 43-48)

 Current: on 401, dispatch auth:session-expired and throw immediately.

 Fix: On first 401 → auth.currentUser?.getIdToken(true) to force-refresh →
 retry once with fresh token → if still 401, THEN dispatch event and throw.

 Verify: Token expiry mid-session recovers transparently. Modal only on true
 auth failure.

 ---
 Phase 2: Database Schema (eliminates 500s + 404s)

 S-2.1: Fix schema conflicts + update migration runner

 Files: server/migrations/001_baseline.sql,
 server/migrations/003_operational_entities.sql,
 server/__tests__/helpers/docker-mysql.ts

 CRITICAL CONTEXT: The migration runner (docker-mysql.ts:119-143) has a
 hardcoded MIGRATION_ORDER array (stops at migration 023). It runs all
 migrations every time with CREATE TABLE IF NOT EXISTS and catch { } — meaning
 if 001 creates a table first, later migrations silently skip.

 Three-part fix:

 Part A: Remove 5 duplicate CREATE TABLEs from 001_baseline.sql:

 ┌────────────┬─────────────────────────┬───────────────────────────────┐
 │   Table    │ Remove from 001 (lines) │    Authoritative migration    │
 ├────────────┼─────────────────────────┼───────────────────────────────┤
 │ quotes     │ ~292-316                │ 017_quotes_leads_bookings.sql │
 ├────────────┼─────────────────────────┼───────────────────────────────┤
 │ leads      │ ~280-290                │ 017_quotes_leads_bookings.sql │
 ├────────────┼─────────────────────────┼───────────────────────────────┤
 │ bookings   │ ~318-329                │ 017_quotes_leads_bookings.sql │
 ├────────────┼─────────────────────────┼───────────────────────────────┤
 │ messages   │ ~261-271                │ 018_messages_threads.sql      │
 ├────────────┼─────────────────────────┼───────────────────────────────┤
 │ work_items │ ~332-345                │ 019_tasks_workitems.sql       │
 └────────────┴─────────────────────────┴───────────────────────────────┘

 Also remove the ALTER TABLE messages ADD COLUMN company_id from
 003_operational_entities.sql (018 includes it).

 Part B: Update MIGRATION_ORDER in server/__tests__/helpers/docker-mysql.ts to
 include all migrations through 032:
 Add to MIGRATION_ORDER array (024-031 may already exist from previous sprint):
   "024_safety_domain.sql",
   "025_vault_docs.sql",
   "026_notification_jobs.sql",
   "027_add_subscription_tier.sql",
   "028_stripe_subscriptions.sql",
   "029_quickbooks_tokens.sql",
   "030_gps_positions.sql",
   "031_stripe_webhook_events.sql",
   "032_parties_subsystem.sql",  // new from S-2.2

 Part C: For databases where 001 already ran (development), the reconciliation
 migration 017 already uses CREATE TABLE IF NOT EXISTS which will skip. Since
 this is a development project (not production), the fix is: the test runner
 starts from a fresh Docker container each time. Removing from 001 ensures
 fresh DBs get the correct schema. For dev databases, instruct developers to
 reset: docker rm loadpilot-dev and re-run.

 Verify: Fresh migration creates tables matching repository expectations:
 - DESCRIBE quotes → has customer_id, broker_id, created_by (017 schema)
 - DESCRIBE leads → has status, source, contact_name (017 schema)
 - DESCRIBE bookings → has customer_id, pickup_date, delivery_date (017 schema)
 - DESCRIBE work_items → has sla_deadline, assignee_id (019 schema)
 - Server tests pass: cd server && npx vitest run

 S-2.2: Create migration 032 — parties subsystem

 File: NEW server/migrations/032_parties_subsystem.sql
 Schema source: server/routes/clients.ts lines 283-600 (exact columns queried)

 8 missing tables:
 1. parties (id, company_id, name, type, is_customer, is_vendor, status,
 mc_number, dot_number, rating, created_at, updated_at)
 2. party_contacts (id, party_id, name, role, email, phone, is_primary,
 created_at) FK→parties CASCADE
 3. party_documents (id, party_id, document_type, document_url, created_at)
 FK→parties CASCADE
 4. rate_rows (id, party_id, tenant_id, catalog_item_id, variant_id, direction,
  currency, price_type, unit_type, base_amount, unit_amount, min_charge,
 max_charge, free_units, effective_start, effective_end, taxable_flag,
 rounding_rule, notes_internal, approval_required) FK→parties CASCADE
 5. rate_tiers (id, rate_row_id, tier_start, tier_end, unit_amount,
 base_amount) FK→rate_rows CASCADE
 6. constraint_sets (id, party_id, tenant_id, applies_to, priority, status,
 effective_start, effective_end) FK→parties CASCADE
 7. constraint_rules (id, constraint_set_id, rule_type, field_key, operator,
 value_text, enforcement, message) FK→constraint_sets CASCADE
 8. party_catalog_links (id, party_id, catalog_item_id) FK→parties CASCADE

 All tables include company_id index for tenant isolation where applicable.

 Verify: GET /api/providers, GET /api/contacts (clients.ts route) → 200 (empty
 arrays).

 S-2.3: Company record creation in signup

 Files: server/routes/users.ts (signup handler)

 User's company (5f44e58d-...) returns 404 from /api/companies/{id}. Signup
 creates company in Firestore only, not MySQL.

 Fix:
 1. Add MySQL INSERT INTO companies in signup handler
 2. Add migration/seed to backfill existing users' missing company records
 3. Ensure company_id foreign keys are satisfied

 Verify: GET /api/companies/{id} → 200. Company Settings page loads (no
 infinite spinner).

 S-2.4: Fix dashboard_card + missing routes

 Files: server/routes/dispatch.ts:314, server/routes/equipment.ts

 Endpoint: GET /api/dashboard/cards
 Issue: 500 — query uses company_id = ? but seeded data may have NULL
 Fix: Fix query or seed data to match tenant format
 ────────────────────────────────────────
 Endpoint: GET /api/dispatch/events
 Issue: 404 — frontend calls /dispatch/events but route is
   /dispatch-events/:companyId
 Fix: Fix frontend path OR add route alias
 ────────────────────────────────────────
 Endpoint: GET /api/equipment
 Issue: 404 — route requires /:companyId param
 Fix: Fix frontend to pass companyId OR add tenant-scoped route

 Verify: All three endpoints return 200.

 ---
 Phase 3: HTTP 403 + 400 Error Investigation & Fix

 S-3.1: Fix 403 permission errors (26 errors)

 Root cause investigation found two sources:

 A) Tenant mismatch (requireTenant middleware,
 server/middleware/requireTenant.ts:35-47)
 - Compares URL param :companyId and body field company_id against
 req.user.tenantId
 - If company record is missing (S-2.3 bug), tenantId may be null → false 403s
 - Fix: S-2.3 (company creation) should resolve the cascade. Verify after
 S-2.3.

 B) Role-based access (12 endpoints)
 - Routes like /api/clients/:id/archive require ["admin", "dispatcher"]
 - Test user with "driver" role triggers 403 on these routes
 - Fix: This is correct behavior (not a bug). Ensure the demo/test user has
 "admin" or "dispatcher" role. Add role documentation for frontend so UI hides
 buttons the user can't access.

 Files: server/middleware/requireTenant.ts, server/routes/clients.ts,
 server/routes/equipment.ts, server/routes/dispatch.ts

 Verify: After S-2.3 fix, re-run Playwright session → 403 count drops from 26
 to <5 (only legitimate role-denied ones remain). Frontend hides role-gated
 buttons for insufficient roles.

 S-3.2: Fix 400 malformed request errors (21 errors)

 Root causes identified:

 ┌───────┬───────────────────────────────────┬─────────────────────────────┐
 │ Count │              Source               │             Fix             │
 ├───────┼───────────────────────────────────┼─────────────────────────────┤
 │       │ AI routes (/api/ai/extract-*) —   │ Frontend sends image data   │
 │ 8     │ missing imageBase64 field         │ correctly or doesn't call   │
 │       │                                   │ endpoints without payload   │
 ├───────┼───────────────────────────────────┼─────────────────────────────┤
 │       │ Safety routes — missing required  │ Frontend validates required │
 │ 5     │ fields (title, quiz_id,           │  fields before submitting   │
 │       │ vehicle_id)                       │                             │
 ├───────┼───────────────────────────────────┼─────────────────────────────┤
 │ 2     │ Dispatch events —                 │ Frontend ensures payload is │
 │       │ JSON.stringify(payload) fails     │  serializable               │
 ├───────┼───────────────────────────────────┼─────────────────────────────┤
 │ 2     │ Equipment PATCH — no valid fields │ Frontend sends only allowed │
 │       │  in PATCH_ALLOWED_COLUMNS         │  field names                │
 ├───────┼───────────────────────────────────┼─────────────────────────────┤
 │       │ Zod schema validation — body      │ Frontend aligns form fields │
 │ 2     │ doesn't match                     │  with backend schema        │
 │       │ createEquipmentSchema             │                             │
 ├───────┼───────────────────────────────────┼─────────────────────────────┤
 │ 2     │ Weather/document — missing        │ Frontend validates before   │
 │       │ coordinates or file validation    │ calling                     │
 └───────┴───────────────────────────────────┴─────────────────────────────┘

 Fix approach: Add client-side validation in the frontend forms/services that
 call these endpoints. Ensure required fields are always populated. For AI
 routes, guard the API call behind a if (!imageBase64) return check.

 Files: Components that trigger these calls (SafetyView form submissions,
 equipment forms, dispatch event logging), services/aiService.ts

 Verify: After fixes, re-run Playwright session → 400 count drops from 21 to
 <3.

 ---
 Phase 4: Hardcoded Data Removal (42 instances)

 S-4.1: SafetyView.tsx — 12 hardcoded values

 File: components/SafetyView.tsx

 ┌───────────┬────────────────────────┬───────────────────────────────────┐
 │   Lines   │         Value          │                Fix                │
 ├───────────┼────────────────────────┼───────────────────────────────────┤
 │ 1037,     │                        │ Fetch from                        │
 │ 1044,     │ Quiz scores 85, 42, 98 │ /api/safety/quiz-results or show  │
 │ 1051      │                        │ "No data"                         │
 ├───────────┼────────────────────────┼───────────────────────────────────┤
 │ 1106,     │ Test scores "95%",     │                                   │
 │ 1112,     │ "100%", "65%" with     │ Fetch from API or empty state     │
 │ 1118      │ fake names             │                                   │
 ├───────────┼────────────────────────┼───────────────────────────────────┤
 │ 1085      │ "324 Certified Units"  │ Compute from equipment data or    │
 │           │                        │ show "0"                          │
 ├───────────┼────────────────────────┼───────────────────────────────────┤
 │ 1159      │ Safety Score "75"      │ Fetch from company settings       │
 ├───────────┼────────────────────────┼───────────────────────────────────┤
 │ 1169      │ Maintenance Interval   │ Fetch from company settings       │
 │           │ "90 Days"              │                                   │
 ├───────────┼────────────────────────┼───────────────────────────────────┤
 │ 1281-82   │ "Unit 101", "Unit 102" │ Fetch from                        │
 │           │                        │ /api/equipment/:companyId         │
 └───────────┴────────────────────────┴───────────────────────────────────┘

 Pattern: Replace hardcoded arrays with useState([]) + useEffect API call. Show
  "No data yet" empty states.

 S-4.2: AccountingPortal.tsx — 10 hardcoded values

 File: components/AccountingPortal.tsx

 ┌───────────┬───────────────────┬─────────────────────────────────────────┐
 │   Lines   │       Value       │                   Fix                   │
 ├───────────┼───────────────────┼─────────────────────────────────────────┤
 │ 335       │ "14" pending docs │ Compute: invoices.filter(i =>           │
 │           │                   │ !i.pod_attached).length                 │
 ├───────────┼───────────────────┼─────────────────────────────────────────┤
 │ 343       │ "$2,840" IFTA     │ Fetch from /api/accounting/ifta/summary │
 │           │                   │  or "$0.00"                             │
 ├───────────┼───────────────────┼─────────────────────────────────────────┤
 │ 123-149   │ 3 automation rule │ Init empty, fetch from API              │
 │           │  objects          │                                         │
 ├───────────┼───────────────────┼─────────────────────────────────────────┤
 │ 170-176   │ setTimeout mock   │ Replace with API call or remove         │
 │           │ matching          │                                         │
 ├───────────┼───────────────────┼─────────────────────────────────────────┤
 │ 971       │ glAccountId       │ Lookup from glAccounts.find(a =>        │
 │           │ "5000"            │ a.accountNumber === '5000')             │
 ├───────────┼───────────────────┼─────────────────────────────────────────┤
 │ 1024-1046 │ 4 hardcoded audit │ Fetch from /api/audit                   │
 │           │  log entries      │                                         │
 ├───────────┼───────────────────┼─────────────────────────────────────────┤
 │ 1032      │ "1 hour ago"      │ Compute with formatDistanceToNow(date)  │
 │           │ timestamp         │                                         │
 ├───────────┼───────────────────┼─────────────────────────────────────────┤
 │ 1112      │ "42.5 hrs" time   │ Compute from data or show "—"           │
 │           │ saved             │                                         │
 ├───────────┼───────────────────┼─────────────────────────────────────────┤
 │ 1118      │ "14" active       │ Compute: automationRules.filter(r =>    │
 │           │ triggers          │ r.enabled).length                       │
 └───────────┴───────────────────┴─────────────────────────────────────────┘

 S-4.3: IntelligenceHub.tsx — 8 hardcoded values

 File: components/IntelligenceHub.tsx

 ┌───────────┬────────────────────────┬────────────────────────────────────┐
 │   Lines   │         Value          │                Fix                 │
 ├───────────┼────────────────────────┼────────────────────────────────────┤
 │ 515-523   │ Mock call session      │ Init empty array                   │
 │           │ "CS-9901"              │                                    │
 ├───────────┼────────────────────────┼────────────────────────────────────┤
 │ 1236      │ "888-555-0000" phone   │ Use driver?.phone or ""            │
 ├───────────┼────────────────────────┼────────────────────────────────────┤
 │ 1242      │ "800-SAFE-KCI" phone   │ Fetch from company settings or ""  │
 ├───────────┼────────────────────────┼────────────────────────────────────┤
 │ 1413      │ eta "45-60 mins"       │ Compute from vendor/incident       │
 │           │                        │ locations or "TBD"                 │
 ├───────────┼────────────────────────┼────────────────────────────────────┤
 │ 1604-1614 │ "John Doe", stats      │ Use active load data or "No active │
 │           │                        │  load"                             │
 ├───────────┼────────────────────────┼────────────────────────────────────┤
 │ 1619      │ "Trucker Tom"          │ Use actual caller data             │
 ├───────────┼────────────────────────┼────────────────────────────────────┤
 │ 1702-1716 │ mockCallers array (3   │ Init empty, populate from call     │
 │           │ entries)               │ queue                              │
 └───────────┴────────────────────────┴────────────────────────────────────┘

 S-4.4: Remaining components — 12 hardcoded values

 Component: ExceptionConsole.tsx
 Lines: 430
 Value: "SLA: 24m Left"
 Fix: Compute from ex.slaDueAt - Date.now()
 ────────────────────────────────────────
 Component: ExceptionConsole.tsx
 Lines: 525
 Value: "01:42:00"
 Fix: Compute from Date.now() - new Date(ex.createdAt)
 ────────────────────────────────────────
 Component: ExceptionConsole.tsx
 Lines: 571
 Value: "Average Resolution: 1h 14m"
 Fix: Compute from resolved exceptions' createdAt/resolvedAt
 ────────────────────────────────────────
 Component: LoadGantt.tsx
 Lines: 88, 91
 Value: "04:00 AM", "ETA: 06:30 PM"
 Fix: Use load.pickupTime, load.estimatedDeliveryTime
 ────────────────────────────────────────
 Component: QuoteManager.tsx
 Lines: 1189, 1209
 Value: "Acme Global", "3125550199"
 Fix: Use selectedQuote.customerName/Phone
 ────────────────────────────────────────
 Component: NetworkPortal.tsx
 Lines: 1244-47
 Value: "NEW CONTACT", "PENDING@MAIL.COM"
 Fix: Empty strings
 ────────────────────────────────────────
 Component: Auth.tsx
 Lines: 377
 Value: dailyCost: 45
 Fix: FALSE POSITIVE — valid signup default; no company settings exist yet
   during signup. Keep as-is.
 ────────────────────────────────────────
 Component: AccountingView.tsx
 Lines: 72
 Value: "Mocking" comment
 Fix: FALSE POSITIVE — code computes REAL trends from real load data. Only fix:

   change misleading comment from "Mocking" to "Compute".

 ---
 Phase 5: Non-Functional Buttons (18+ buttons)

 S-5.1: LoadDetailView.tsx — 10 buttons

 File: components/LoadDetailView.tsx

 ┌───────┬──────────────┬──────────────────────────────────────────────────┐
 │ Lines │    Button    │                     Handler                      │
 ├───────┼──────────────┼──────────────────────────────────────────────────┤
 │ 231   │ Print BOL    │ Call BOL generation → open PDF (existing jsPDF   │
 │       │              │ in exportService.ts)                             │
 ├───────┼──────────────┼──────────────────────────────────────────────────┤
 │ 232   │ Carrier      │ Navigate to rate card or show modal with load's  │
 │       │ Rates        │ carrier rates                                    │
 ├───────┼──────────────┼──────────────────────────────────────────────────┤
 │ 233   │ Load Stops   │ Scroll to/expand stops section in the detail     │
 │       │              │ view                                             │
 ├───────┼──────────────┼──────────────────────────────────────────────────┤
 │ 234   │ Documents    │ Open documents modal → fetch from                │
 │       │              │ /api/documents?loadId=                           │
 ├───────┼──────────────┼──────────────────────────────────────────────────┤
 │ 235   │ Show Route   │ Open map modal (toast "Requires Google Maps API  │
 │       │              │ key" if unconfigured)                            │
 ├───────┼──────────────┼──────────────────────────────────────────────────┤
 │ 236   │ Audit Logs   │ Navigate to /activity-log?loadId={id}            │
 ├───────┼──────────────┼──────────────────────────────────────────────────┤
 │ 248   │ Tag for      │ PATCH /api/loads/:id with flagged: true + visual │
 │       │ Action       │  indicator                                       │
 ├───────┼──────────────┼──────────────────────────────────────────────────┤
 │ 251   │ Lock/Unlock  │ PATCH /api/loads/:id with locked: true/false +   │
 │       │              │ icon toggle                                      │
 ├───────┼──────────────┼──────────────────────────────────────────────────┤
 │ 464   │ + Add Pickup │ Add stop entry form with type=pickup             │
 ├───────┼──────────────┼──────────────────────────────────────────────────┤
 │ 467   │ + Add Drop   │ Add stop entry form with type=dropoff            │
 └───────┴──────────────┴──────────────────────────────────────────────────┘

 No silent no-ops allowed. Every button MUST produce a visible result. The only
  acceptable "not implemented" is a toast with text "Feature coming soon —
 [feature name]" that is visually distinct (not silent). Buttons with existing
 backend support MUST call the real API.

 Implementation classification (no ambiguity):

 ┌───────────────┬───────┬─────────────────────────────────────────────────┐
 │    Button     │ Type  │                    Rationale                    │
 ├───────────────┼───────┼─────────────────────────────────────────────────┤
 │ Print BOL     │ REAL  │ jsPDF exists in exportService.ts, load data     │
 │               │       │ available                                       │
 ├───────────────┼───────┼─────────────────────────────────────────────────┤
 │ Carrier Rates │ TOAST │ No rate card UI exists yet                      │
 ├───────────────┼───────┼─────────────────────────────────────────────────┤
 │ Load Stops    │ REAL  │ Scroll-to anchor to stops section (already      │
 │               │       │ rendered)                                       │
 ├───────────────┼───────┼─────────────────────────────────────────────────┤
 │ Documents     │ REAL  │ /api/documents?loadId= endpoint exists          │
 ├───────────────┼───────┼─────────────────────────────────────────────────┤
 │ Show Route    │ TOAST │ Requires Google Maps API key (not configured)   │
 ├───────────────┼───────┼─────────────────────────────────────────────────┤
 │ Audit Logs    │ REAL  │ Navigate to /activity-log?loadId={id}           │
 ├───────────────┼───────┼─────────────────────────────────────────────────┤
 │ Tag for       │ REAL  │ PATCH /api/loads/:id with flagged field         │
 │ Action        │       │                                                 │
 ├───────────────┼───────┼─────────────────────────────────────────────────┤
 │ Lock/Unlock   │ REAL  │ PATCH /api/loads/:id with locked field          │
 ├───────────────┼───────┼─────────────────────────────────────────────────┤
 │ + Add Pickup  │ REAL  │ Add stop form entry with type=pickup            │
 ├───────────────┼───────┼─────────────────────────────────────────────────┤
 │ + Add Drop    │ REAL  │ Add stop form entry with type=dropoff           │
 └───────────────┴───────┴─────────────────────────────────────────────────┘

 Pass/fail: All 8 REAL buttons call APIs or navigate. 2 TOAST buttons show
 visible notification. Zero silent no-ops.

 S-5.2: Remaining 8 buttons

 Implementation classification (no ambiguity):

 ┌──────────────────┬───────┬────────────┬───────┬─────────────────────────┐
 │    Component     │ Lines │   Button   │ Type  │         Handler         │
 ├──────────────────┼───────┼────────────┼───────┼─────────────────────────┤
 │ AccountingPortal │ 381   │ View All   │ REAL  │ navigate('/loads')      │
 │                  │       │ Loads      │       │                         │
 ├──────────────────┼───────┼────────────┼───────┼─────────────────────────┤
 │ AccountingPortal │ 1097  │ Create New │ TOAST │ "Automation rule        │
 │                  │       │  Rule      │       │ builder coming soon"    │
 ├──────────────────┼───────┼────────────┼───────┼─────────────────────────┤
 │                  │ 619,  │ More       │       │ "Line item actions      │
 │ AccountingPortal │ 757   │ options    │ TOAST │ coming soon"            │
 │                  │       │ (⋯)        │       │                         │
 ├──────────────────┼───────┼────────────┼───────┼─────────────────────────┤
 │ SafetyView       │ 743   │ Service    │ TOAST │ "Service request form   │
 │                  │       │            │       │ coming soon"            │
 ├──────────────────┼───────┼────────────┼───────┼─────────────────────────┤
 │ SafetyView       │ 746   │ History    │ TOAST │ "Maintenance history    │
 │                  │       │            │       │ coming soon"            │
 ├──────────────────┼───────┼────────────┼───────┼─────────────────────────┤
 │ SafetyView       │ 850   │ View       │ REAL  │ navigate('/accounting') │
 │                  │       │ Financials │       │                         │
 ├──────────────────┼───────┼────────────┼───────┼─────────────────────────┤
 │ SafetyView       │ 1087  │ Manage     │ TOAST │ "Certification manager  │
 │                  │       │            │       │ coming soon"            │
 ├──────────────────┼───────┼────────────┼───────┼─────────────────────────┤
 │ Settlements      │ 433   │ Chevron    │ REAL  │ Wire setExpandedRow(id) │
 │                  │       │ expand     │       │  toggle                 │
 └──────────────────┴───────┴────────────┴───────┴─────────────────────────┘

 Pass/fail: 3 REAL buttons navigate/toggle. 5 TOAST buttons show visible
 notification. Zero silent no-ops.

 ---
 Phase 6: Page-Level Feature Completion

 S-6.1: Dashboard — add 3 chart visualizations

 File: components/Dashboard.tsx
 Library: recharts (already used by IFTAChart in the project — reuse pattern)

 Currently: text-only stat cards (lines 214-391). No visualization library
 rendered.

 Fix (exactly 3 charts):
 1. BarChart: RPM by day (last 7 days) — computed from loads prop, group by
 pickupDate, avg ratePerMile
 2. LineChart: Exception count by day (last 7 days) — computed from exceptions
 prop, group by createdAt date
 3. BarChart: Revenue vs Cost by week — computed from loads carrierRate vs
 customerRate

 All charts render from existing props. If data is empty, show "No data for
 this period" placeholder inside the chart area.

 Pass/fail: 3 chart components render. Zero hardcoded chart data. Empty state
 shown when no loads/exceptions exist.

 S-6.2: Load Board — fix +New button z-index

 File: components/LoadBoardEnhanced.tsx and/or components/LoadList.tsx

 Audit reports "+New button z-index blocked". Sidebar toggle uses z-20, bottom
 panel uses z-30. Investigate if LoadList's +New button is behind one of these
 layers.

 Fix: Adjust z-index hierarchy so +New button is always clickable. Test click
 target.

 Verify: +New button is clickable and either opens new load form or navigates
 to creation page.

 S-6.3: Reports/Analytics — add charts + drill-down

 File: components/AnalyticsDashboard.tsx

 Currently: imports BarChart3 and PieChart icons (L4) but never renders actual
 charts. Text-only cards (lines 141-172).

 Fix:
 - Add recharts BarChart: Broker RPM comparison
 - Add recharts PieChart: Lane revenue distribution
 - Add click handlers on broker/lane cards for drill-down navigation

 Verify: Charts render with data from props. Click navigates to filtered view.

 S-6.4: Schedule/Calendar — multi-day load visualization

 File: components/CalendarView.tsx

 Line 187: l.pickupDate === formatDateKey(date) — loads only show on pickup
 day.

 Fix: Render loads across the date range (pickupDate → deliveryDate). Show
 duration span or indicator on each day the load is active.

 Verify: Multi-day loads appear on all days between pickup and delivery.

 S-6.5: Command Center — complete incident detail

 File: components/CommandCenterView.tsx

 Incident detail drawer (L429+) is half-built. timeline array exists (L305) but
  isn't rendered visually.

 Fix: Render selectedIncident.timeline as a vertical timeline component in the
 detail drawer. Show action, actor, timestamp for each entry.

 Verify: Clicking an incident opens detail with readable timeline.

 S-6.6: Settlements — batch processing + export

 Files: components/Settlements.tsx, server/routes/accounting.ts (if new
 endpoint needed)

 Line 643: "Batch Print" shows feedback only (mock). Line 650: "Finalize" also
 mocks.

 Fix:
 1. Wire "Batch Print" → generate PDF using jsPDF (reuse pattern from
 exportService.ts) for all visible settlement rows
 2. Wire "Finalize" → PATCH /api/settlements/batch to mark selected settlements
  as finalized (add endpoint to server/routes/accounting.ts if absent)
 3. Add "Export CSV" button → generate CSV from settlement data, trigger
 download

 Pass/fail: "Batch Print" produces a PDF. "Finalize" calls an API and updates
 row status. "Export CSV" triggers file download. Zero mock showFeedback-only
 operations remain.

 S-6.7: IntelligenceHub — reports section

 File: components/IntelligenceHub.tsx

 No reports tab exists. Only call sessions and messaging.

 Fix: Add "Reports" tab/section showing:
 - Call metrics computed from call session data (count, avg duration)
 - Interaction summary (calls vs messages count)

 Verify: Reports tab shows computed metrics or "No data" empty state.

 S-6.8: DriverMobileHome — wire change requests + docs

 Files: components/DriverMobileHome.tsx, server/routes/loads.ts (for change
 request endpoint)

 Line 150: Comment "Mock Change Requests & Docs for MVP". createChangeRequest()
  (L212) creates in-memory only.

 Fix:
 1. Add POST /api/loads/:id/change-requests endpoint in server/routes/loads.ts
 (INSERT into work_items table with type="CHANGE_REQUEST")
 2. Add GET /api/loads/:id/change-requests endpoint (SELECT from work_items
 where type="CHANGE_REQUEST")
 3. Wire frontend createChangeRequest() to call the POST endpoint instead of
 in-memory push
 4. Add change request list rendered below load card with status badges
 (PENDING/APPROVED/REJECTED)
 5. Add document list fetched from existing /api/documents?loadId= endpoint

 Pass/fail: createChangeRequest() calls API (not in-memory). Change request
 list renders from API data. Document list shows data from /api/documents.
 Remove "Mock Change Requests" comment.

 S-6.9: DispatcherTimeline — replace mock location text

 File: components/DispatcherTimeline.tsx

 Lines 88-90: Shows "Geocoded Terminal Entry (Lat: ...)" — mock text with raw
 coordinates.

 Fix: Format as "Location: {lat.toFixed(4)}, {lng.toFixed(4)}" (or reverse
 geocode if Google Maps API key available). Remove "Geocoded Terminal Entry"
 fake label.

 Verify: Location text shows coordinates in readable format, not fake label.

 ---
 Phase 7: End-to-End Verification

 Goal: Prove every fix works with methods that go BEYOND the test suites (which
  missed these issues originally). Each verification step has a binary
 PASS/FAIL gate.

 S-7.1: Automated test suites (baseline gate)

 cd server && npx vitest run          # Server tests — MUST: 0 failures
 cd .. && npx vitest run              # Frontend tests — MUST: 0 failures
 npx tsc --noEmit                     # Frontend TS — MUST: 0 errors
 cd server && npx tsc --noEmit        # Server TS — MUST: 0 errors
 python -m pytest .claude/hooks/tests/ -v  # Hook tests — MUST: 0 failures

 FAIL if: any test fails or TS error count > 0. Zero regressions allowed.

 S-7.2: Exhaustive static grep verification (every hardcoded value)

 Each grep MUST return 0 matches. Any match = FAIL.

 # ── Auth service: no raw fetch() ──
 grep -c "fetch(" services/financialService.ts           # MUST: 0
 grep -c "fetch(" services/storageService.ts             # MUST: 0

 # ── SafetyView.tsx: all 12 hardcoded values removed ──
 grep -Pn 'progress:\s*85' components/SafetyView.tsx     # MUST: 0
 grep -Pn 'progress:\s*42' components/SafetyView.tsx     # MUST: 0
 grep -Pn 'progress:\s*98' components/SafetyView.tsx     # MUST: 0
 grep -n '"95%"' components/SafetyView.tsx                # MUST: 0
 grep -n '"100%"' components/SafetyView.tsx               # MUST: 0 (test score
  context)
 grep -n '"65%"' components/SafetyView.tsx                # MUST: 0
 grep -n '"324 Certified' components/SafetyView.tsx       # MUST: 0
 grep -n 'value:.*"75"' components/SafetyView.tsx         # MUST: 0 (safety
 score)
 grep -n '"90 Days"' components/SafetyView.tsx            # MUST: 0
 grep -n '"Unit 101"' components/SafetyView.tsx           # MUST: 0
 grep -n '"Unit 102"' components/SafetyView.tsx           # MUST: 0

 # ── AccountingPortal.tsx: all 10 hardcoded values removed ──
 grep -n 'val:.*"14"' components/AccountingPortal.tsx     # MUST: 0
 grep -n '"\$2,840"' components/AccountingPortal.tsx      # MUST: 0
 grep -n '"42.5 hrs"' components/AccountingPortal.tsx     # MUST: 0
 grep -n 'setTimeout.*matched' components/AccountingPortal.tsx  # MUST: 0
 grep -n 'glAccountId:.*"5000"' components/AccountingPortal.tsx # MUST: 0
 grep -n '"1 hour ago"' components/AccountingPortal.tsx   # MUST: 0
 grep -n 'value:.*"14".*Active' components/AccountingPortal.tsx # MUST: 0

 # ── IntelligenceHub.tsx: all 8 mock values removed ──
 grep -n '"CS-9901"' components/IntelligenceHub.tsx       # MUST: 0
 grep -n '"888-555-0000"' components/IntelligenceHub.tsx  # MUST: 0
 grep -n '"800-SAFE-KCI"' components/IntelligenceHub.tsx  # MUST: 0
 grep -n '"John Doe"' components/IntelligenceHub.tsx      # MUST: 0
 grep -n '"Trucker Tom"' components/IntelligenceHub.tsx   # MUST: 0
 grep -n '"Mike Thompson"' components/IntelligenceHub.tsx # MUST: 0
 grep -n '"Choptank"' components/IntelligenceHub.tsx      # MUST: 0
 grep -n '"Blue Star"' components/IntelligenceHub.tsx     # MUST: 0
 grep -n '"45-60 mins"' components/IntelligenceHub.tsx    # MUST: 0

 # ── ExceptionConsole.tsx: all 3 hardcoded values removed ──
 grep -n '"SLA: 24m' components/ExceptionConsole.tsx      # MUST: 0
 grep -n '"01:42:00"' components/ExceptionConsole.tsx     # MUST: 0
 grep -n '"1h 14m"' components/ExceptionConsole.tsx       # MUST: 0

 # ── Other components ──
 grep -n '"04:00 AM"' components/LoadGantt.tsx            # MUST: 0
 grep -n '"ETA: 06:30 PM"' components/LoadGantt.tsx       # MUST: 0
 grep -n '"Acme Global"' components/QuoteManager.tsx      # MUST: 0
 grep -n '"3125550199"' components/QuoteManager.tsx       # MUST: 0
 grep -n '"PENDING@MAIL.COM"' components/NetworkPortal.tsx # MUST: 0
 grep -n '"NEW CONTACT"' components/NetworkPortal.tsx     # MUST: 0
 grep -n '"000-000-000"' components/NetworkPortal.tsx     # MUST: 0
 grep -n 'Geocoded Terminal Entry' components/DispatcherTimeline.tsx  # MUST: 0
 grep -n 'Mock Change Requests' components/DriverMobileHome.tsx      # MUST: 0

 FAIL if: any grep returns > 0 matches.

 S-7.3: Dead button audit (no onClick={undefined})

 # Find buttons without onClick handlers in remediated components
 # Each must return 0 matches for buttons WITHOUT handlers
 grep -Pn '<button[^>]*(?<!onClick=\{[^}]+\})>\s*$'
 components/LoadDetailView.tsx  # MUST: 0

 Also manually verify by reading each button in the modified components — every
  <button> element must have an onClick prop.

 FAIL if: any button element lacks an onClick handler.

 S-7.4: Endpoint regression (15 endpoints — binary pass/fail)

 Start server with npm run server. Hit each endpoint with valid auth token.

 MUST return 200 (were 500) — 9 endpoints:

 ┌──────────────────────────┬──────────┬──────────┐
 │         Endpoint         │ Previous │ Required │
 ├──────────────────────────┼──────────┼──────────┤
 │ GET /api/quotes          │ 500      │ 200      │
 ├──────────────────────────┼──────────┼──────────┤
 │ GET /api/leads           │ 500      │ 200      │
 ├──────────────────────────┼──────────┼──────────┤
 │ GET /api/bookings        │ 500      │ 200      │
 ├──────────────────────────┼──────────┼──────────┤
 │ GET /api/work-items      │ 500      │ 200      │
 ├──────────────────────────┼──────────┼──────────┤
 │ GET /api/kci-requests    │ 500      │ 200      │
 ├──────────────────────────┼──────────┼──────────┤
 │ GET /api/dashboard/cards │ 500      │ 200      │
 ├──────────────────────────┼──────────┼──────────┤
 │ GET /api/providers       │ 500      │ 200      │
 ├──────────────────────────┼──────────┼──────────┤
 │ GET /api/contacts        │ 500      │ 200      │
 ├──────────────────────────┼──────────┼──────────┤
 │ GET /api/safety/vendors  │ 500      │ 200      │
 └──────────────────────────┴──────────┴──────────┘

 MUST return 200 (were 401) — 2 endpoints:

 ┌──────────────────────────────┬──────────┬──────────┐
 │           Endpoint           │ Previous │ Required │
 ├──────────────────────────────┼──────────┼──────────┤
 │ GET /api/accounting/accounts │ 401      │ 200      │
 ├──────────────────────────────┼──────────┼──────────┤
 │ GET /api/accounting/invoices │ 401      │ 200      │
 └──────────────────────────────┴──────────┴──────────┘

 MUST return 200 (were 404) — 3 endpoints:

 ┌──────────────────────────────────────┬──────────┬──────────┐
 │               Endpoint               │ Previous │ Required │
 ├──────────────────────────────────────┼──────────┼──────────┤
 │ GET /api/companies/{id}              │ 404      │ 200      │
 ├──────────────────────────────────────┼──────────┼──────────┤
 │ GET /api/dispatch-events/{companyId} │ 404      │ 200      │
 ├──────────────────────────────────────┼──────────┼──────────┤
 │ GET /api/equipment/{companyId}       │ 404      │ 200      │
 └──────────────────────────────────────┴──────────┴──────────┘

 FAIL if: any endpoint returns its previous error status.

 S-7.5: Console error regression (hard targets)

 Navigate every page via Playwright. Intercept all fetch calls. Count errors by
  category.

 ┌──────────┬─────────────┬─────────────────────┬───────────┐
 │ Category │ Audit Count │       Target        │ FAIL if > │
 ├──────────┼─────────────┼─────────────────────┼───────────┤
 │ HTTP 500 │ 41          │ 0                   │ 0         │
 ├──────────┼─────────────┼─────────────────────┼───────────┤
 │ HTTP 401 │ 20          │ 0                   │ 0         │
 ├──────────┼─────────────┼─────────────────────┼───────────┤
 │ HTTP 404 │ 11          │ 2                   │ 3         │
 ├──────────┼─────────────┼─────────────────────┼───────────┤
 │ HTTP 403 │ 26          │ 3 (role-based only) │ 5         │
 ├──────────┼─────────────┼─────────────────────┼───────────┤
 │ HTTP 400 │ 21          │ 2                   │ 4         │
 ├──────────┼─────────────┼─────────────────────┼───────────┤
 │ TOTAL    │ 120         │ 7                   │ 12        │
 └──────────┴─────────────┴─────────────────────┴───────────┘

 FAIL if: total > 12 or any 500/401 errors remain.

 S-7.6: Component feature verification checklist

 Every Phase 6 feature must be verified independently:

 ┌─────────────────────┬──────────────────────┬────────────────────────────┐
 │        Story        │     Verification     │       PASS criteria        │
 ├─────────────────────┼──────────────────────┼────────────────────────────┤
 │ S-6.1 Dashboard     │                      │ 3 recharts components      │
 │ charts              │ Open Dashboard page  │ render (BarChart,          │
 │                     │                      │ LineChart, BarChart)       │
 ├─────────────────────┼──────────────────────┼────────────────────────────┤
 │ S-6.2 Load Board    │ Click +New button on │ Button is clickable, not   │
 │ +New                │  Load Board          │ obscured. Opens form or    │
 │                     │                      │ navigates.                 │
 ├─────────────────────┼──────────────────────┼────────────────────────────┤
 │ S-6.3 Analytics     │ Open                 │ At least 2 recharts        │
 │ charts              │ Reports/Analytics    │ render. Click broker card  │
 │                     │ page                 │ → navigates.               │
 ├─────────────────────┼──────────────────────┼────────────────────────────┤
 │ S-6.4 Calendar      │ Create load with     │ Load appears on Mon, Tue,  │
 │ multi-day           │ pickup Mon, delivery │ Wed cells                  │
 │                     │  Wed                 │                            │
 ├─────────────────────┼──────────────────────┼────────────────────────────┤
 │ S-6.5 Command       │ Click incident in    │ Detail drawer shows        │
 │ Center timeline     │ Command Center       │ timeline entries with      │
 │                     │                      │ timestamps                 │
 ├─────────────────────┼──────────────────────┼────────────────────────────┤
 │ S-6.6 Settlements   │ Click "Batch Print"  │ PDF generated/downloaded.  │
 │ batch               │ with 2+ settlements  │ Click "Finalize" → API     │
 │                     │                      │ call made.                 │
 ├─────────────────────┼──────────────────────┼────────────────────────────┤
 │ S-6.7               │                      │ Reports tab/section        │
 │ IntelligenceHub     │ Open IntelligenceHub │ visible. Shows metrics or  │
 │ reports             │                      │ "No data".                 │
 ├─────────────────────┼──────────────────────┼────────────────────────────┤
 │ S-6.8 DriverMobile  │ Submit change        │ Request appears in list    │
 │ requests            │ request on driver    │ after page refresh.        │
 │                     │ view                 │                            │
 ├─────────────────────┼──────────────────────┼────────────────────────────┤
 │ S-6.9               │ View timeline with   │ Shows "Location: xx.xxxx,  │
 │ DispatcherTimeline  │ location entry       │ yy.yyyy" not "Geocoded     │
 │                     │                      │ Terminal Entry"            │
 └─────────────────────┴──────────────────────┴────────────────────────────┘

 FAIL if: any row does not meet PASS criteria.

 ---
 ---
 Ralph Orchestration & Agent Isolation

 Merge-Conflict Prevention: Combined Stories

 Stories touching the same file MUST be handled by the same agent to prevent
 merge conflicts. The following stories are MERGED:

 Combined Story: C-1: SafetyView full remediation
 Original Stories: S-4.1 + SafetyView buttons from S-5.2
 File(s): SafetyView.tsx
 Reason: Both modify same file
 ────────────────────────────────────────
 Combined Story: C-2: AccountingPortal full remediation
 Original Stories: S-4.2 + AccountingPortal buttons from S-5.2
 File(s): AccountingPortal.tsx
 Reason: Both modify same file
 ────────────────────────────────────────
 Combined Story: C-3: IntelligenceHub full remediation
 Original Stories: S-4.3 + S-6.7
 File(s): IntelligenceHub.tsx
 Reason: Hardcoded removal + reports section
 ────────────────────────────────────────
 Combined Story: C-4: Settlements full remediation
 Original Stories: Settlements button from S-5.2 + S-6.6
 File(s): Settlements.tsx, server/routes/accounting.ts
 Reason: Button + batch in same file

 After merging: 24 execution stories (down from 28).

 Worktree Isolation Strategy

 All ralph-story agents MUST use isolation: "worktree" + model: "opus".

 All agents work on the same feature branch
 (ralph/full-saas-integration-sprint). Each agent gets its own git worktree —
 an isolated filesystem copy of the repo at the current branch HEAD. Changes
 from completed worktrees are merged back to the feature branch before the next
  wave starts.

 Wave model (not free-for-all parallelism):

 WAVE 1 (sequential — foundation)
   Phase 1: S-1.1 → S-1.2 → S-1.3 → S-1.4 → S-1.5
   Phase 2: S-2.1 → S-2.2 → S-2.3 → S-2.4
   Phase 3: S-3.1 → S-3.2
   └─ Each story commits to feature branch. Next story starts from updated
 HEAD.
   └─ QUALITY GATE: All tests pass, TS clean, before Wave 2 starts.

 WAVE 2 (parallel — up to 10 agents in worktrees simultaneously)
   Each agent gets its own worktree. No two agents touch the same file.

   ┌─ Agent A: C-1 (SafetyView full remediation)
   │   Files: components/SafetyView.tsx
   │
   ├─ Agent B: C-2 (AccountingPortal full remediation)
   │   Files: components/AccountingPortal.tsx
   │
   ├─ Agent C: C-3 (IntelligenceHub full remediation)
   │   Files: components/IntelligenceHub.tsx
   │
   ├─ Agent D: C-4 (Settlements full remediation)
   │   Files: components/Settlements.tsx, server/routes/accounting.ts
   │
   ├─ Agent E: S-4.4 (ExceptionConsole + LoadGantt + QuoteManager +
 NetworkPortal + AccountingView)
   │   Files: ExceptionConsole.tsx, LoadGantt.tsx, QuoteManager.tsx,
 NetworkPortal.tsx, AccountingView.tsx
   │
   ├─ Agent F: S-5.1 (LoadDetailView buttons)
   │   Files: components/LoadDetailView.tsx
   │
   ├─ Agent G: S-6.1 (Dashboard charts)
   │   Files: components/Dashboard.tsx
   │
   ├─ Agent H: S-6.2 + S-6.3 (LoadBoard z-index + Analytics charts)
   │   Files: components/LoadBoardEnhanced.tsx, components/LoadList.tsx,
 components/AnalyticsDashboard.tsx
   │
   ├─ Agent I: S-6.4 + S-6.5 (Calendar multi-day + CommandCenter timeline)
   │   Files: components/CalendarView.tsx, components/CommandCenterView.tsx
   │
   └─ Agent J: S-6.8 + S-6.9 (DriverMobile + DispatcherTimeline)
       Files: components/DriverMobileHome.tsx,
 components/DispatcherTimeline.tsx, server/routes/loads.ts

   └─ MERGE: Each worktree merged to feature branch as agent completes.
   └─ QUALITY GATE: All tests pass, TS clean, after all agents merged.

 WAVE 3 (sequential — verification)
   Phase 7: S-7.1 → S-7.2 → S-7.3 → S-7.4 → S-7.5 → S-7.6
   └─ Runs on merged feature branch. No worktrees needed.

 File Ownership Matrix (zero overlap)

 CRITICAL: No two parallel agents may modify the same file. This matrix is the
 contract.

 ┌─────────────────────────────┬─────────────┬─────────┐
 │            File             │ Owner Agent │ Stories │
 ├─────────────────────────────┼─────────────┼─────────┤
 │ SafetyView.tsx              │ Agent A     │ C-1     │
 ├─────────────────────────────┼─────────────┼─────────┤
 │ AccountingPortal.tsx        │ Agent B     │ C-2     │
 ├─────────────────────────────┼─────────────┼─────────┤
 │ IntelligenceHub.tsx         │ Agent C     │ C-3     │
 ├─────────────────────────────┼─────────────┼─────────┤
 │ Settlements.tsx             │ Agent D     │ C-4     │
 ├─────────────────────────────┼─────────────┼─────────┤
 │ server/routes/accounting.ts │ Agent D     │ C-4     │
 ├─────────────────────────────┼─────────────┼─────────┤
 │ ExceptionConsole.tsx        │ Agent E     │ S-4.4   │
 ├─────────────────────────────┼─────────────┼─────────┤
 │ LoadGantt.tsx               │ Agent E     │ S-4.4   │
 ├─────────────────────────────┼─────────────┼─────────┤
 │ QuoteManager.tsx            │ Agent E     │ S-4.4   │
 ├─────────────────────────────┼─────────────┼─────────┤
 │ NetworkPortal.tsx           │ Agent E     │ S-4.4   │
 ├─────────────────────────────┼─────────────┼─────────┤
 │ AccountingView.tsx          │ Agent E     │ S-4.4   │
 ├─────────────────────────────┼─────────────┼─────────┤
 │ LoadDetailView.tsx          │ Agent F     │ S-5.1   │
 ├─────────────────────────────┼─────────────┼─────────┤
 │ Dashboard.tsx               │ Agent G     │ S-6.1   │
 ├─────────────────────────────┼─────────────┼─────────┤
 │ LoadBoardEnhanced.tsx       │ Agent H     │ S-6.2   │
 ├─────────────────────────────┼─────────────┼─────────┤
 │ LoadList.tsx                │ Agent H     │ S-6.2   │
 ├─────────────────────────────┼─────────────┼─────────┤
 │ AnalyticsDashboard.tsx      │ Agent H     │ S-6.3   │
 ├─────────────────────────────┼─────────────┼─────────┤
 │ CalendarView.tsx            │ Agent I     │ S-6.4   │
 ├─────────────────────────────┼─────────────┼─────────┤
 │ CommandCenterView.tsx       │ Agent I     │ S-6.5   │
 ├─────────────────────────────┼─────────────┼─────────┤
 │ DriverMobileHome.tsx        │ Agent J     │ S-6.8   │
 ├─────────────────────────────┼─────────────┼─────────┤
 │ DispatcherTimeline.tsx      │ Agent J     │ S-6.9   │
 ├─────────────────────────────┼─────────────┼─────────┤
 │ server/routes/loads.ts      │ Agent J     │ S-6.8   │
 └─────────────────────────────┴─────────────┴─────────┘

 Quality Gates

 ┌──────┬──────────┬────────────────────────────────────┬──────────────────┐
 │ Gate │  After   │               Checks               │   FAIL action    │
 ├──────┼──────────┼────────────────────────────────────┼──────────────────┤
 │ G1   │ Wave 1   │ npx vitest run (server +           │ Fix before Wave  │
 │      │          │ frontend), npx tsc --noEmit (both) │ 2                │
 ├──────┼──────────┼────────────────────────────────────┼──────────────────┤
 │ G2   │ Wave 2   │ Same + grep verification (S-7.2    │ Reject worktree, │
 │      │ merge    │ subset for merged files)           │  retry           │
 ├──────┼──────────┼────────────────────────────────────┼──────────────────┤
 │ G3   │ Wave 3   │ Full S-7.1 through S-7.6           │ Document         │
 │      │          │                                    │ remaining issues │
 └──────┴──────────┴────────────────────────────────────┴──────────────────┘

 Code Quality Constraints (all agents)

 1. Pattern reuse: Use api.get/post/patch/delete from services/api.ts for all
 API calls. Use useState + useEffect pattern from existing components (e.g.,
 LoadList.tsx) for data fetching. Use recharts from existing IFTAChart pattern
 for charts.
 2. No new abstractions: No new utility functions, helper files, or wrapper
 components unless the story explicitly calls for one (S-1.4 useCurrentUser is
 the only exception).
 3. Error handling: Use try/catch around API calls. Show user-visible error
 states, not silent failures.
 4. Empty states: When data is absent, render "No data yet" or "—", never leave
  hardcoded placeholder.
 5. Tests: Each agent MUST run npx vitest run in their worktree before marking
 complete. If new backend endpoints are added (S-6.6, S-6.8), add at least 1
 integration test per endpoint.
 6. Selective staging: git add only the files in the agent's ownership matrix.
 Never git add -A.

 New Test Requirements

 Stories that add new endpoints or significant new features MUST include tests:

 ┌───────┬─────────────────────────────────────┬───────────────────────────┐
 │ Story │          New Test Required          │         Test Type         │
 ├───────┼─────────────────────────────────────┼───────────────────────────┤
 │ S-6.6 │ PATCH /api/settlements/batch        │ Server integration test   │
 │       │ endpoint                            │                           │
 ├───────┼─────────────────────────────────────┼───────────────────────────┤
 │ S-6.8 │ POST /api/loads/:id/change-requests │ Server integration test   │
 │       │  + GET                              │                           │
 ├───────┼─────────────────────────────────────┼───────────────────────────┤
 │ S-1.5 │ 401 retry logic in api.ts           │ Frontend unit test (mock  │
 │       │                                     │ fetch)                    │
 ├───────┼─────────────────────────────────────┼───────────────────────────┤
 │ S-1.4 │ useCurrentUser hook                 │ Frontend unit test (mock  │
 │       │                                     │ onUserChange)             │
 └───────┴─────────────────────────────────────┴───────────────────────────┘

 Files Modified (Complete — Post-Merge)

 ┌─────────────────────────────────────────┬──────┬────────┬──────────────┐
 │                  File                   │ Agen │ Storie │    Change    │
 │                                         │  t   │   s    │              │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │                                         │ Wave │        │ Replace 20   │
 │ services/financialService.ts            │ 1    │ S-1.1  │ raw fetch()  │
 │                                         │      │        │ with api.*   │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │                                         │ Wave │        │ Replace 4    │
 │ services/storageService.ts              │ 1    │ S-1.2  │ raw fetch()  │
 │                                         │      │        │ with api.*   │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │                                         │ Wave │        │ Add          │
 │ App.tsx                                 │ 1    │ S-1.3  │ isAuthReady  │
 │                                         │      │        │ gate         │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │                                         │ Wave │        │ NEW —        │
 │ hooks/useCurrentUser.ts                 │ 1    │ S-1.4  │ reactive     │
 │                                         │      │        │ auth hook    │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │ services/api.ts                         │ Wave │ S-1.5  │ 401 retry    │
 │                                         │ 1    │        │ logic        │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │                                         │      │        │ Remove 5     │
 │ server/migrations/001_baseline.sql      │ Wave │ S-2.1  │ duplicate    │
 │                                         │ 1    │        │ CREATE       │
 │                                         │      │        │ TABLEs       │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │ server/migrations/003_operational_entit │ Wave │        │ Remove       │
 │ ies.sql                                 │ 1    │ S-2.1  │ messages     │
 │                                         │      │        │ ALTER        │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │                                         │      │        │ Update MIGRA │
 │ server/__tests__/helpers/docker-mysql.t │ Wave │ S-2.1  │ TION_ORDER   │
 │ s                                       │ 1    │        │ array (add   │
 │                                         │      │        │ 024-030)     │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │ server/migrations/032_parties_subsystem │ Wave │ S-2.2  │ NEW — 8      │
 │ .sql                                    │ 1    │        │ party tables │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │                                         │ Wave │        │ Company      │
 │ server/routes/users.ts                  │ 1    │ S-2.3  │ creation in  │
 │                                         │      │        │ signup       │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │                                         │ Wave │        │ Fix dashboar │
 │ server/routes/dispatch.ts               │ 1    │ S-2.4  │ d_card +     │
 │                                         │      │        │ routes       │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │                                         │ Wave │        │ Fix          │
 │ server/routes/equipment.ts              │ 1    │ S-2.4  │ equipment    │
 │                                         │      │        │ route path   │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │                                         │      │        │ Remove 12    │
 │ components/SafetyView.tsx               │ Agen │ C-1    │ hardcoded +  │
 │                                         │ t A  │        │ wire 4       │
 │                                         │      │        │ buttons      │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │                                         │      │        │ Remove 10    │
 │ components/AccountingPortal.tsx         │ Agen │ C-2    │ hardcoded +  │
 │                                         │ t B  │        │ wire 3       │
 │                                         │      │        │ buttons      │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │                                         │ Agen │        │ Remove 8     │
 │ components/IntelligenceHub.tsx          │ t C  │ C-3    │ mock items + │
 │                                         │      │        │  add reports │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │                                         │ Agen │        │ Compute 3    │
 │ components/ExceptionConsole.tsx         │ t E  │ S-4.4  │ dynamic      │
 │                                         │      │        │ values       │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │                                         │ Agen │        │ Use load     │
 │ components/LoadGantt.tsx                │ t E  │ S-4.4  │ data for     │
 │                                         │      │        │ times        │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │                                         │ Agen │        │ Use quote    │
 │ components/QuoteManager.tsx             │ t E  │ S-4.4  │ data for     │
 │                                         │      │        │ customer     │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │ components/NetworkPortal.tsx            │ Agen │ S-4.4  │ Empty string │
 │                                         │ t E  │        │  defaults    │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │                                         │      │        │ Fix          │
 │ components/AccountingView.tsx           │ Agen │ S-4.4  │ misleading   │
 │                                         │ t E  │        │ "Mocking"    │
 │                                         │      │        │ comment      │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │                                         │ Agen │        │ Wire 10      │
 │ components/LoadDetailView.tsx           │ t F  │ S-5.1  │ button       │
 │                                         │      │        │ handlers     │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │                                         │ Agen │        │ Wire chevron │
 │ components/Settlements.tsx              │ t D  │ C-4    │  + batch +   │
 │                                         │      │        │ export       │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │                                         │ Agen │        │ Add batch    │
 │ server/routes/accounting.ts             │ t D  │ C-4    │ settlement   │
 │                                         │      │        │ endpoint     │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │                                         │ Agen │        │ Add 3        │
 │ components/Dashboard.tsx                │ t G  │ S-6.1  │ recharts vis │
 │                                         │      │        │ ualizations  │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │ components/LoadBoardEnhanced.tsx        │ Agen │ S-6.2  │ Fix +New     │
 │                                         │ t H  │        │ z-index      │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │                                         │ Agen │        │ Z-index      │
 │ components/LoadList.tsx                 │ t H  │ S-6.2  │ adjustment   │
 │                                         │      │        │ if needed    │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │ components/AnalyticsDashboard.tsx       │ Agen │ S-6.3  │ Add charts + │
 │                                         │ t H  │        │  drill-down  │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │ components/CalendarView.tsx             │ Agen │ S-6.4  │ Multi-day    │
 │                                         │ t I  │        │ load spans   │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │                                         │ Agen │        │ Complete     │
 │ components/CommandCenterView.tsx        │ t I  │ S-6.5  │ incident     │
 │                                         │      │        │ timeline     │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │                                         │ Agen │        │ Wire change  │
 │ components/DriverMobileHome.tsx         │ t J  │ S-6.8  │ requests +   │
 │                                         │      │        │ docs         │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │                                         │ Agen │        │ Replace mock │
 │ components/DispatcherTimeline.tsx       │ t J  │ S-6.9  │  location    │
 │                                         │      │        │ text         │
 ├─────────────────────────────────────────┼──────┼────────┼──────────────┤
 │                                         │ Agen │        │ Add change   │
 │ server/routes/loads.ts                  │ t J  │ S-6.8  │ request      │
 │                                         │      │        │ endpoints    │
 └─────────────────────────────────────────┴──────┴────────┴──────────────┘

 Total: 32 files, 7 phases, 24 stories (after merge), 3 waves, 10 parallel
 agents in Wave 2

 ---
 Appendix A: Traceability Matrix — Every Audit Finding → Story

 Every issue from docs/QA-FULL-AUDIT-2026-03-22.md must map to a story.
 Unmapped items = plan gap.

 Section 1: Missing Database Tables (8 tables)

 ┌─────────────────────┬───────┬────────┐
 │        Table        │ Story │ Status │
 ├─────────────────────┼───────┼────────┤
 │ parties             │ S-2.2 │ MAPPED │
 ├─────────────────────┼───────┼────────┤
 │ party_contacts      │ S-2.2 │ MAPPED │
 ├─────────────────────┼───────┼────────┤
 │ party_documents     │ S-2.2 │ MAPPED │
 ├─────────────────────┼───────┼────────┤
 │ rate_rows           │ S-2.2 │ MAPPED │
 ├─────────────────────┼───────┼────────┤
 │ rate_tiers          │ S-2.2 │ MAPPED │
 ├─────────────────────┼───────┼────────┤
 │ constraint_sets     │ S-2.2 │ MAPPED │
 ├─────────────────────┼───────┼────────┤
 │ constraint_rules    │ S-2.2 │ MAPPED │
 ├─────────────────────┼───────┼────────┤
 │ party_catalog_links │ S-2.2 │ MAPPED │
 └─────────────────────┴───────┴────────┘

 Section 1: Schema Conflicts (5 tables)

 ┌─────────────────────────┬───────┬────────┐
 │          Table          │ Story │ Status │
 ├─────────────────────────┼───────┼────────┤
 │ quotes (001 vs 017)     │ S-2.1 │ MAPPED │
 ├─────────────────────────┼───────┼────────┤
 │ leads (001 vs 017)      │ S-2.1 │ MAPPED │
 ├─────────────────────────┼───────┼────────┤
 │ bookings (001 vs 017)   │ S-2.1 │ MAPPED │
 ├─────────────────────────┼───────┼────────┤
 │ messages (001 vs 018)   │ S-2.1 │ MAPPED │
 ├─────────────────────────┼───────┼────────┤
 │ work_items (001 vs 019) │ S-2.1 │ MAPPED │
 └─────────────────────────┴───────┴────────┘

 Section 1: Broken Endpoints (9 × 500)

 ┌──────────────────────────┬───────┬────────┐
 │         Endpoint         │ Story │ Status │
 ├──────────────────────────┼───────┼────────┤
 │ GET /api/quotes          │ S-2.1 │ MAPPED │
 ├──────────────────────────┼───────┼────────┤
 │ GET /api/leads           │ S-2.1 │ MAPPED │
 ├──────────────────────────┼───────┼────────┤
 │ GET /api/bookings        │ S-2.1 │ MAPPED │
 ├──────────────────────────┼───────┼────────┤
 │ GET /api/kci-requests    │ S-2.1 │ MAPPED │
 ├──────────────────────────┼───────┼────────┤
 │ GET /api/work-items      │ S-2.1 │ MAPPED │
 ├──────────────────────────┼───────┼────────┤
 │ GET /api/dashboard/cards │ S-2.4 │ MAPPED │
 ├──────────────────────────┼───────┼────────┤
 │ GET /api/providers       │ S-2.2 │ MAPPED │
 ├──────────────────────────┼───────┼────────┤
 │ GET /api/contacts        │ S-2.2 │ MAPPED │
 ├──────────────────────────┼───────┼────────┤
 │ GET /api/safety/vendors  │ S-2.4 │ MAPPED │
 └──────────────────────────┴───────┴────────┘

 Section 3: Hardcoded Data (42 instances)

 ┌─────┬───────────────────────┬────────────────┬───────┬──────────────────┐
 │  #  │       Component       │     Value      │ Story │      Status      │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 1   │ SafetyView:1037       │ 85 (quiz)      │ S-4.1 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 2   │ SafetyView:1044       │ 42 (quiz)      │ S-4.1 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 3   │ SafetyView:1051       │ 98 (quiz)      │ S-4.1 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 4   │ SafetyView:1106       │ "95%"          │ S-4.1 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 5   │ SafetyView:1112       │ "100%"         │ S-4.1 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 6   │ SafetyView:1118       │ "65%"          │ S-4.1 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 7   │ SafetyView:1085       │ "324           │ S-4.1 │ MAPPED           │
 │     │                       │ Certified"     │       │                  │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 8   │ SafetyView:1159       │ "75"           │ S-4.1 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 9   │ SafetyView:1169       │ "90 Days"      │ S-4.1 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 10  │ SafetyView:1281       │ "Unit 101/102" │ S-4.1 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 11  │ AccountingPortal:335  │ "14"           │ S-4.2 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 12  │ AccountingPortal:343  │ "$2,840"       │ S-4.2 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 13  │ AccountingPortal:1112 │ "42.5 hrs"     │ S-4.2 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 14  │ AccountingPortal:1118 │ "14" triggers  │ S-4.2 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 15  │ AccountingPortal:123  │ 3 rule objects │ S-4.2 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 16  │ AccountingPortal:170  │ setTimeout     │ S-4.2 │ MAPPED           │
 │     │                       │ mock           │       │                  │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 17  │ AccountingPortal:971  │ "5000" GL      │ S-4.2 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 18  │ AccountingPortal:1024 │ audit entries  │ S-4.2 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 19  │ AccountingPortal:1032 │ "1 hour ago"   │ S-4.2 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 20  │ ExceptionConsole:430  │ "SLA: 24m"     │ S-4.4 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 21  │ ExceptionConsole:525  │ "01:42:00"     │ S-4.4 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 22  │ ExceptionConsole:571  │ "1h 14m"       │ S-4.4 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 23  │ IntelligenceHub:1603  │ "John Doe"     │ S-4.3 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 24  │ IntelligenceHub:1618  │ "Trucker Tom"  │ S-4.3 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 25  │ IntelligenceHub:1702  │ mockCallers    │ S-4.3 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 26  │ IntelligenceHub:515   │ "CS-9901"      │ S-4.3 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 27  │ IntelligenceHub:1413  │ "45-60 mins"   │ S-4.3 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 28  │ IntelligenceHub:1236  │ "888-555-0000" │ S-4.3 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 29  │ IntelligenceHub:1242  │ "800-SAFE-KCI" │ S-4.3 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 30  │ LoadGantt:88          │ "04:00 AM"     │ S-4.4 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 31  │ LoadGantt:91          │ "ETA: 06:30    │ S-4.4 │ MAPPED           │
 │     │                       │ PM"            │       │                  │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 32  │ QuoteManager:1189     │ "Acme Global"  │ S-4.4 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 33  │ QuoteManager:1209     │ "3125550199"   │ S-4.4 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 34  │ NetworkPortal:1246    │ "PENDING@MAIL" │ S-4.4 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │     │                       │                │       │ FALSE POSITIVE   │
 │ 35  │ Auth:377              │ dailyCost: 45  │ N/A   │ (valid signup    │
 │     │                       │                │       │ default)         │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │     │                       │ "Mocking"      │       │ MAPPED           │
 │ 36  │ AccountingView:72     │ comment        │ S-4.4 │ (comment-only    │
 │     │                       │                │       │ fix)             │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 37  │ IntelligenceHub:57    │ seedMockData   │ N/A   │ OK (DEV-gated)   │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 38  │ DriverMobileHome:150  │ Mock comment   │ S-6.8 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 39  │ DispatcherTimeline:88 │ Mock location  │ S-6.9 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 40  │ NetworkPortal:1244    │ "NEW CONTACT"  │ S-4.4 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 41  │ NetworkPortal:1247    │ "000-000-000"  │ S-4.4 │ MAPPED           │
 ├─────┼───────────────────────┼────────────────┼───────┼──────────────────┤
 │ 42  │ AccountingPortal:1032 │ "1 hour ago"   │ S-4.2 │ MAPPED           │
 └─────┴───────────────────────┴────────────────┴───────┴──────────────────┘

 Section 4: Non-Functional Buttons (18 buttons)

 ┌─────┬───────────────────────┬─────────────────┬───────┬────────────────┐
 │  #  │       Component       │     Button      │ Story │     Status     │
 ├─────┼───────────────────────┼─────────────────┼───────┼────────────────┤
 │ 1   │ LoadDetailView:231    │ Print BOL       │ S-5.1 │ MAPPED (REAL)  │
 ├─────┼───────────────────────┼─────────────────┼───────┼────────────────┤
 │ 2   │ LoadDetailView:232    │ Carrier Rates   │ S-5.1 │ MAPPED (TOAST) │
 ├─────┼───────────────────────┼─────────────────┼───────┼────────────────┤
 │ 3   │ LoadDetailView:233    │ Load Stops      │ S-5.1 │ MAPPED (REAL)  │
 ├─────┼───────────────────────┼─────────────────┼───────┼────────────────┤
 │ 4   │ LoadDetailView:234    │ Documents       │ S-5.1 │ MAPPED (REAL)  │
 ├─────┼───────────────────────┼─────────────────┼───────┼────────────────┤
 │ 5   │ LoadDetailView:235    │ Show Route      │ S-5.1 │ MAPPED (TOAST) │
 ├─────┼───────────────────────┼─────────────────┼───────┼────────────────┤
 │ 6   │ LoadDetailView:236    │ Audit Logs      │ S-5.1 │ MAPPED (REAL)  │
 ├─────┼───────────────────────┼─────────────────┼───────┼────────────────┤
 │ 7   │ LoadDetailView:248    │ Tag for Action  │ S-5.1 │ MAPPED (REAL)  │
 ├─────┼───────────────────────┼─────────────────┼───────┼────────────────┤
 │ 8   │ LoadDetailView:251    │ Lock/Unlock     │ S-5.1 │ MAPPED (REAL)  │
 ├─────┼───────────────────────┼─────────────────┼───────┼────────────────┤
 │ 9   │ LoadDetailView:464    │ + Add Pickup    │ S-5.1 │ MAPPED (REAL)  │
 ├─────┼───────────────────────┼─────────────────┼───────┼────────────────┤
 │ 10  │ LoadDetailView:467    │ + Add Drop      │ S-5.1 │ MAPPED (REAL)  │
 ├─────┼───────────────────────┼─────────────────┼───────┼────────────────┤
 │ 11  │ AccountingPortal:381  │ View All Loads  │ S-5.2 │ MAPPED (REAL)  │
 ├─────┼───────────────────────┼─────────────────┼───────┼────────────────┤
 │ 12  │ AccountingPortal:1097 │ Create New Rule │ S-5.2 │ MAPPED (TOAST) │
 ├─────┼───────────────────────┼─────────────────┼───────┼────────────────┤
 │ 13  │ AccountingPortal:619  │ More options    │ S-5.2 │ MAPPED (TOAST) │
 ├─────┼───────────────────────┼─────────────────┼───────┼────────────────┤
 │ 14  │ SafetyView:743        │ Service         │ S-5.2 │ MAPPED (TOAST) │
 ├─────┼───────────────────────┼─────────────────┼───────┼────────────────┤
 │ 15  │ SafetyView:746        │ History         │ S-5.2 │ MAPPED (TOAST) │
 ├─────┼───────────────────────┼─────────────────┼───────┼────────────────┤
 │ 16  │ SafetyView:850        │ View Financials │ S-5.2 │ MAPPED (REAL)  │
 ├─────┼───────────────────────┼─────────────────┼───────┼────────────────┤
 │ 17  │ SafetyView:1087       │ Manage          │ S-5.2 │ MAPPED (TOAST) │
 ├─────┼───────────────────────┼─────────────────┼───────┼────────────────┤
 │ 18  │ Settlements:433       │ Chevron expand  │ S-5.2 │ MAPPED (REAL)  │
 └─────┴───────────────────────┴─────────────────┴───────┴────────────────┘

 Section 5: Auth Bugs (7 bugs)

 ┌─────────────────────────────────────────┬───────┬────────┐
 │                   Bug                   │ Story │ Status │
 ├─────────────────────────────────────────┼───────┼────────┤
 │ Bug 1: financialService missing auth    │ S-1.1 │ MAPPED │
 ├─────────────────────────────────────────┼───────┼────────┤
 │ Bug 2: No auth readiness gate           │ S-1.3 │ MAPPED │
 ├─────────────────────────────────────────┼───────┼────────┤
 │ Bug 3: Components fire API without auth │ S-1.3 │ MAPPED │
 ├─────────────────────────────────────────┼───────┼────────┤
 │ Bug 4: getCurrentUser() null            │ S-1.4 │ MAPPED │
 ├─────────────────────────────────────────┼───────┼────────┤
 │ Bug 5: storageService raw fetch         │ S-1.2 │ MAPPED │
 ├─────────────────────────────────────────┼───────┼────────┤
 │ Bug 6: No 401 retry                     │ S-1.5 │ MAPPED │
 ├─────────────────────────────────────────┼───────┼────────┤
 │ Bug 7: Company record missing           │ S-2.3 │ MAPPED │
 └─────────────────────────────────────────┴───────┴────────┘

 Section 6: Page-Level Gaps (9 pages)

 ┌────────────────────┬────────────────────────────┬───────┬────────┐
 │        Page        │           Issue            │ Story │ Status │
 ├────────────────────┼────────────────────────────┼───────┼────────┤
 │ Dashboard          │ Missing charts             │ S-6.1 │ MAPPED │
 ├────────────────────┼────────────────────────────┼───────┼────────┤
 │ Load Board         │ +New button blocked        │ S-6.2 │ MAPPED │
 ├────────────────────┼────────────────────────────┼───────┼────────┤
 │ Reports/Analytics  │ No charts, no drill-down   │ S-6.3 │ MAPPED │
 ├────────────────────┼────────────────────────────┼───────┼────────┤
 │ Schedule/Calendar  │ No multi-day loads         │ S-6.4 │ MAPPED │
 ├────────────────────┼────────────────────────────┼───────┼────────┤
 │ Command Center     │ Incident detail incomplete │ S-6.5 │ MAPPED │
 ├────────────────────┼────────────────────────────┼───────┼────────┤
 │ Settlements        │ No batch/reports           │ S-6.6 │ MAPPED │
 ├────────────────────┼────────────────────────────┼───────┼────────┤
 │ IntelligenceHub    │ Reports stub               │ S-6.7 │ MAPPED │
 ├────────────────────┼────────────────────────────┼───────┼────────┤
 │ DriverMobileHome   │ Mock change requests       │ S-6.8 │ MAPPED │
 ├────────────────────┼────────────────────────────┼───────┼────────┤
 │ DispatcherTimeline │ Mock location text         │ S-6.9 │ MAPPED │
 └────────────────────┴────────────────────────────┴───────┴────────┘

 Section 7-8: HTTP Error Categories

 ┌─────────────────┬───────┬────────────────────────────┬────────┐
 │    Category     │ Count │           Story            │ Status │
 ├─────────────────┼───────┼────────────────────────────┼────────┤
 │ 500 errors (41) │ 41    │ S-2.1, S-2.2, S-2.4        │ MAPPED │
 ├─────────────────┼───────┼────────────────────────────┼────────┤
 │ 401 errors (20) │ 20    │ S-1.1, S-1.2, S-1.3, S-1.5 │ MAPPED │
 ├─────────────────┼───────┼────────────────────────────┼────────┤
 │ 403 errors (26) │ 26    │ S-3.1                      │ MAPPED │
 ├─────────────────┼───────┼────────────────────────────┼────────┤
 │ 400 errors (21) │ 21    │ S-3.2                      │ MAPPED │
 ├─────────────────┼───────┼────────────────────────────┼────────┤
 │ 404 errors (11) │ 11    │ S-2.3, S-2.4               │ MAPPED │
 └─────────────────┴───────┴────────────────────────────┴────────┘

 Missing Routes

 ┌────────────────────────────┬───────┬────────┐
 │           Route            │ Story │ Status │
 ├────────────────────────────┼───────┼────────┤
 │ /api/dispatch/events (404) │ S-2.4 │ MAPPED │
 ├────────────────────────────┼───────┼────────┤
 │ /api/equipment (404)       │ S-2.4 │ MAPPED │
 ├────────────────────────────┼───────┼────────┤
 │ /api/companies/{id} (404)  │ S-2.3 │ MAPPED 
Appendix B: Acceptance Criteria R-Markers

Each criterion below is the single source of truth for verification.
Format: - R-PN-NN: criterion text (story ID)

Phase 1: Auth Infrastructure

- R-P1-01: grep -c fetch( services/financialService.ts returns 0 â€” all raw fetch() calls replaced with api.* helpers (S-1.1)
- R-P1-02: Frontend tests pass with no regressions after conversion (S-1.1)

- R-P1-03: grep -c fetch( services/storageService.ts returns 0 â€” all raw fetch() calls replaced (S-1.2)
- R-P1-04: Duplicate auth checks at lines 259, 294 removed (S-1.2)

- R-P1-05: isAuthReady state added â€” children render blocked until refreshData() completes (S-1.3)
- R-P1-06: Login produces no 401 console errors â€” children mount only after auth ready (S-1.3)
- R-P1-07: Logout resets isAuthReady to false (S-1.3)

- R-P1-08: useCurrentUser hook subscribes to onUserChange and returns reactive user state (S-1.4)
- R-P1-09: Consumer components re-render on auth state change without null-user crashes (S-1.4)

- R-P1-10: On first 401, token is force-refreshed and request retried once (S-1.5)
- R-P1-11: If retry succeeds with fresh token, no auth:session-expired event dispatched (S-1.5)
- R-P1-12: If retry also returns 401, auth:session-expired event dispatched and error thrown (S-1.5)

Phase 2: Database Schema

- R-P2-01: 5 duplicate CREATE TABLE statements removed from 001_baseline.sql (quotes, leads, bookings, messages, work_items) (S-2.1)
- R-P2-02: ALTER TABLE messages ADD COLUMN company_id removed from 003_operational_entities.sql (S-2.1)
- R-P2-03: MIGRATION_ORDER array in docker-mysql.ts updated to include all migrations through 032 (S-2.1)
- R-P2-04: Server tests pass with clean migration order (S-2.1)

- R-P2-05: Migration 032 creates all 8 party tables with correct columns and FK constraints (S-2.2)
- R-P2-06: GET /api/providers returns 200 (empty array) after migration (S-2.2)
- R-P2-07: GET /api/contacts returns 200 (empty array) after migration (S-2.2)

- R-P2-08: Signup handler creates company record in MySQL in addition to Firestore (S-2.3)
- R-P2-09: GET /api/companies/{id} returns 200 after signup â€” no more 404 (S-2.3)

- R-P2-10: GET /api/dashboard/cards returns 200 with valid auth â€” no more 500 (S-2.4)
- R-P2-11: Dispatch events route accessible from frontend path â€” no more 404 (S-2.4)
- R-P2-12: Equipment route accessible with tenant-scoped path â€” no more 404 (S-2.4)

Phase 3: HTTP Error Fixes

- R-P3-01: 403 error count drops from 26 to less than 5 after tenant mismatch fix (S-3.1)
- R-P3-02: Remaining 403s are legitimate role-based access denials (S-3.1)

- R-P3-03: 400 error count drops from 21 to less than 3 after client-side validation added (S-3.2)
- R-P3-04: AI route calls guarded by if (!imageBase64) return check (S-3.2)

Phase 4: Hardcoded Data Removal

- R-P4-01: All 12 hardcoded values removed from SafetyView.tsx â€” data fetched from API or shows empty state (C-1)
- R-P4-02: 4 SafetyView buttons wired â€” Service/History/Manage show toast, View Financials navigates (C-1)
- R-P4-03: Zero silent no-ops remain â€” every button produces visible result (C-1)

- R-P4-04: All 10 hardcoded values removed from AccountingPortal.tsx â€” values computed from real data or API (C-2)
- R-P4-05: 3 AccountingPortal buttons wired â€” View All Loads navigates, Create New Rule and More options show toast (C-2)
- R-P4-06: setTimeout mock matching removed, replaced with API call or removed entirely (C-2)

- R-P4-07: All 8 mock values removed from IntelligenceHub.tsx â€” init empty arrays, use real data (C-3)
- R-P4-08: Reports tab/section added showing computed call metrics or 'No data' empty state (C-3)
- R-P4-09: mockCallers array removed, call queue populated from real data or empty (C-3)

Phase 5: Non-Functional Buttons

- R-P5-01: Chevron expand wired to setExpandedRow(id) toggle (C-4)
- R-P5-02: Batch Print generates PDF using jsPDF for all visible settlement rows (C-4)
- R-P5-03: Finalize calls PATCH /api/settlements/batch and updates row status (C-4)
- R-P5-04: Export CSV triggers file download with settlement data (C-4)

Phase 4: Hardcoded Data Removal

- R-P4-10: ExceptionConsole 3 hardcoded values replaced with dynamic computations from exception data (S-4.4)
- R-P4-11: LoadGantt uses load.pickupTime and load.estimatedDeliveryTime â€” no hardcoded times (S-4.4)
- R-P4-12: QuoteManager uses selectedQuote data â€” no hardcoded customer names or phone numbers (S-4.4)
- R-P4-13: NetworkPortal uses empty string defaults â€” no fake placeholder data (S-4.4)
- R-P4-14: AccountingView misleading 'Mocking' comment changed to accurately describe computation (S-4.4)

Phase 5: Non-Functional Buttons

- R-P5-05: 8 REAL buttons call APIs or navigate â€” Print BOL, Load Stops, Documents, Audit Logs, Tag, Lock, +Pickup, +Drop (S-5.1)
- R-P5-06: 2 TOAST buttons show visible notification â€” Carrier Rates and Show Route (S-5.1)
- R-P5-07: Zero silent no-ops remain in LoadDetailView â€” every button produces visible result (S-5.1)

Phase 6: Page-Level Feature Completion

- R-P6-01: 3 recharts components render in Dashboard (BarChart RPM, LineChart exceptions, BarChart revenue) (S-6.1)
- R-P6-02: Chart data computed from existing props â€” zero hardcoded chart data (S-6.1)
- R-P6-03: Empty state 'No data for this period' shown when no loads/exceptions exist (S-6.1)

- R-P6-04: +New button is clickable and not obscured by other z-index layers â€” opens new load form or navigates (S-6.2)

- R-P6-05: At least 2 recharts components render in AnalyticsDashboard (BarChart and PieChart) (S-6.3)
- R-P6-06: Click on broker/lane card navigates to filtered view (drill-down) (S-6.3)

- R-P6-07: Multi-day loads appear on all days between pickup and delivery dates, not just pickup day (S-6.4)

- R-P6-08: Incident timeline renders as vertical timeline in detail drawer (S-6.5)
- R-P6-09: Each timeline entry shows action, actor, and timestamp (S-6.5)

- R-P6-10: createChangeRequest() calls POST /api/loads/:id/change-requests API â€” not in-memory (S-6.8)
- R-P6-11: Change request list renders from GET API data with status badges (PENDING/APPROVED/REJECTED) (S-6.8)
- R-P6-12: Document list populated from /api/documents?loadId= endpoint (S-6.8)
- R-P6-13: 'Mock Change Requests' comment removed from source (S-6.8)

- R-P6-14: Location text shows coordinates in readable format, not fake 'Geocoded Terminal Entry' label (S-6.9)
- R-P6-15: No reference to 'Geocoded Terminal Entry' remains in component (S-6.9)

Phase 7: End-to-End Verification

- R-P7-01: Server tests pass with 0 failures (S-7.1)
- R-P7-02: Frontend tests pass with 0 failures (S-7.1)
- R-P7-03: TypeScript compilation has 0 errors for both frontend and server (S-7.1)

- R-P7-04: All grep checks for hardcoded values return 0 matches across all remediated components (S-7.2)

- R-P7-05: No button elements lack onClick handlers in remediated components (S-7.3)

- R-P7-06: 9 endpoints that previously returned 500 now return 200 (S-7.4)
- R-P7-07: 2 endpoints that previously returned 401 now return 200 (S-7.4)
- R-P7-08: 3 endpoints that previously returned 404 now return 200 (S-7.4)

- R-P7-09: Zero HTTP 500 errors remain across all pages (S-7.5)
- R-P7-10: Zero HTTP 401 errors remain across all pages (S-7.5)
- R-P7-11: Total console errors across all pages is 12 or fewer (down from 120) (S-7.5)

- R-P7-12: All 9 Phase 6 features verified per checklist â€” each meets its PASS criteria (S-7.6)
