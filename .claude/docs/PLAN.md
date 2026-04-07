Bulletproof Sales Demo — CORRECTED Plan (live functions only)

 ▎ Status: replaces the existing F:\Trucking\DisbatchMe\.claude\docs\PLAN.md. The current PLAN.md was written
 against assumptions that do not match the live codebase. This plan re-derives every phase from ground truth
 gathered by 3 parallel Explore agents on 2026-04-07.

 ▎ Branch (created by ralph at dispatch time): ralph/bulletproof-sales-demo
 ▎ Replaces: F:\Trucking\DisbatchMe\.claude\prd.json (the prior production-readiness sprint, all 10 stories
 already passed=true, backup saved at .claude/prd.production-readiness.completed.json)

 ---
 Context

 The salesperson needs a bulletproof self-led product demo of three hero stories: AI-assisted document
 automation, IFTA compliance, and the cross-entity CRM/registry. The current product is functionally complete
 for these stories but the stock demo seed and live AI model variability make it unsafe to put in front of
 customers. A prior plan (PLAN.md at HEAD) tried to address this with a tenant-scoped extraction shim and
 several other approaches that turned out to be incompatible with both the user's "live functions only, no
 mocks or stubs" constraint AND the actual code (wrong table names, wrong route keys, wrong UI selectors,
 wrong assumptions about exported helpers).

 This corrected plan re-derives every phase under one prime directive and against verified file paths, line
 numbers, table schemas, and UI selectors gathered from the live source.

 ---
 Prime Directive — LIVE FUNCTIONS ONLY

 The demo must use only the unmodified production code paths that already exist on main. Every "magic moment"
 in the salesperson's demo comes from pre-seeded real database rows that the live, untouched production code
 reads and renders. There are no mocks, no stubs, no test doubles, no if (tenantId === 'SALES-DEMO') { return
 cannedResponse; } shortcuts, no shims sitting in front of any service.

 Hard rules:
 1. Zero edits to server/routes/ai.ts, server/services/gemini.service.ts, server/services/document.service.ts,
  server/services/ocr.service.ts, server/middleware/requireAuth.ts, server/middleware/requireTier.ts,
 server/middleware/requireTenant.ts, server/lib/sql-auth.ts, any existing migration, or any existing route
 handler.
 2. Two acceptable categories of new code only:
   - Seed scripts and fixture data that INSERT rows into existing tables via existing schemas using INSERT
 IGNORE.
   - Two demo-mode opt-in surfaces that are flag-gated and never run on production tenants:
       - A nav filter in App.tsx that hides routes when VITE_DEMO_NAV_MODE=sales.
     - A POST /api/demo/reset route that runs the live reset script when triple-locked (admin role +
 sales-demo tenant id + ALLOW_DEMO_RESET=1 env var).
 3. No backwards-compat shims, no helper modules wrapped around production functions, no "demo branch" inside
 any existing handler.
 4. Production tenant behavior is byte-for-byte identical before and after this sprint. The only way to enter
 demo mode is via env vars that are not set in production.

 What this means for the document-automation hero story (the main change vs prior plan)

 The prior plan tried to short-circuit POST /api/ai/extract-load for the sales-demo tenant. REJECTED. Instead:

 - The seed creates a real loads row (e.g. id LP-DEMO-RC-001), real documents rows attached to it with the
 extracted fields stored on the load record in their normal columns, and real linked artifact files in storage
  (or skipped if the existing document model treats artifact paths as optional).
 - The salesperson's demo flow is: "Here is a load that came in this morning. Here is the rate confirmation
 the driver uploaded from the cab. Here are all the fields the AI auto-extracted, sitting on the load record."
  The salesperson opens existing rows via the live LoadBoardEnhanced and live document UI. Zero AI calls
 happen during this demo.
 - A documented secondary path lets the salesperson optionally do a real live upload (real Gemini, real cost)
 for extra impact — but Phase 7 certification covers only the seeded path so the salesperson is never exposed
 to model variability when it matters.

 This is what "live function only" actually looks like: data the seed wrote, code the production tenants run.

 ---
 Continuity Objects — the thread that carries through every hero flow

 The same objects must appear in every hero step so the buyer feels one coherent story instead of five
 unrelated screens. Any phase that introduces new seeded data MUST reuse these exact identifiers / names
 verbatim — this continuity is the single biggest driver of the "wow" reaction on stage.

 | Object            | Canonical value                                            | Appears in                          |
 | ----------------- | ---------------------------------------------------------- | ------------------------------------ |
 | Tenant / company  | `SALES-DEMO-001`                                           | Phases 1, 2, 3, 4, 6, 7             |
 | Hero load         | `LP-DEMO-RC-001`                                           | Phases 2, 3, 7; all 3 hero specs    |
 | Broker (customer) | `SALES-DEMO-CUST-001` / `ACME Logistics LLC` (MC / DOT set)| Phases 2, 3 (IFTA narrative), 4     |
 | Commodity + wt    | `Frozen Beef`, `42,500 lbs`                                | Phase 2 load card + runbook script  |
 | Rate              | `$3,250` carrier rate                                      | Phase 2 load card + runbook script  |
 | Route             | Houston TX → Chicago IL (6 IFTA jurisdictions)             | Phases 2 + 3 (same trip)            |
 | IFTA period       | Q4 2025                                                    | Phase 3 walkthrough + summary       |
 | Rate con artifact | `rate-con.pdf` (real file, seeded to storage)              | Phase 2 document card download      |
 | BOL artifact      | `bol.pdf`                                                  | Phase 2 document card download      |
 | Lumper artifact   | `lumper-receipt.pdf`                                       | Phase 2 document card download      |

 **Phase 4 reminder**: when seeding the 12 CRM parties, ONE of the two brokers MUST be
 `SALES-DEMO-CUST-001` / ACME Logistics LLC (the same broker the salesperson just saw attached to the hero
 load in Phase 2). The buyer opens the broker in NetworkPortal and recognizes it — that is the magic moment.

 ---
 Findings (verified) and corrections

 #: 1
 User finding: CRM phase built on wrong tables (broker_credit_scores, customer_rate_sheets,
 party_interactions)
   and unsupported endpoints (/api/contacts?party_id, /api/documents?party_id)
 Verified?: Verified by Agent A — none of those tables exist; neither endpoint supports party_id filtering
 Correction: Rewrite Phase 4 around the 8 real tables that server/routes/clients.ts:477-535 actually JOINs and

   the single API call GET /api/parties that NetworkPortal makes
 ────────────────────────────────────────
 #: 2
 User finding: Demo-shell allowlist does not match real App.tsx route keys
 Verified?: Verified by Agent B — real keys are operations-hub, loads, calendar, network, telematics-setup,
   accounting, exceptions, company (+ hidden quotes); IFTA is a nested tab inside accounting, not a top-level
   route
 Correction: Rewrite Phase 6 allowlist to use the real keys and document that IFTA navigation is accounting →
   "Fuel & IFTA" tab
 ────────────────────────────────────────
 #: 3
 User finding: Deterministic intake story does not actually produce a deterministic created load (Scanner can
   stabilize extracted fields, but DriverMobileHome.tsx:573 regenerates loadNumber =
   INT-${Date.now().toString(36).toUpperCase()} client-side and the extraction payload cannot override it)
 Verified?: Verified by Agent B — line 573 confirmed
 Correction: Phase 2 abandons the "live extraction → deterministic load number" narrative entirely. The seed
   creates the load row directly with id LP-DEMO-RC-001. The salesperson navigates to a pre-existing load. No
   code change to DriverMobileHome.tsx.
 ────────────────────────────────────────
 #: 4
 User finding: IFTA Phase written against UI controls that do not exist (ifta-quarter-select,
   ifta-run-analysis, etc.)
 Verified?: Verified by Agent B — quarter selector is <button>Q1</button>...Q4, year selector is <select> with

   2025/2026, IFTA evidence + analysis auto-run on mount of IFTAEvidenceReview (no Run Analysis button), zero
   data-testid attributes anywhere in IFTA UI
 Correction: Phase 3 Playwright spec rewritten to use text selectors only against the real button text and the

   auto-run flow
 ────────────────────────────────────────
 #: 5
 User finding: Certification under-specified for Windows + Firebase
 Verified?: Verified by Agent C — cross-env not installed; e2e auth fixture requires FIREBASE_WEB_API_KEY +
   pre-existing Firebase users; no programmatic user provisioning anywhere
 Correction: Phase 7 ships a .env.local driven Windows-safe script and an explicit Firebase user provisioning
   prerequisite documented in the runbook
 ────────────────────────────────────────
 #: 6
 User finding: Phase 1 understated seed-script implementation work
 Verified?: Verified by Agent C — seed-demo.ts has zero exports, no helpers callable from outside, and does
 NOT
    seed GL-6900/GL-2200 or create Firebase users
 Correction: Phase 1 ships an independent seed pipeline at server/scripts/seed-sales-demo.ts. Zero edits to
   seed-demo.ts (touching it would violate the prime directive — that file is part of the SaaS source). The
 new
    pipeline duplicates the small amount of SQL it needs

 Plus three additional corrections discovered during exploration that the user did not flag:

 #: 7
 Discovery: The brief said "documents" was a top-level nav route. It is not — there is no documents route key
   in App.tsx. Documents are accessed within loads / network / accounting.
 Source: Agent B
 Correction: Drop documents from the demo allowlist. Driver intake lives inside the loads Driver Mobile
   experience, not a separate documents route.
 ────────────────────────────────────────
 #: 8
 Discovery: seed-demo.ts does not seed GL-6900 (IFTA Expense) or GL-2200 (IFTA Payable). Phase 3 IFTA POST
   /api/accounting/ifta-post would FK-fail without them.
 Source: Agent C
 Correction: The new seed-sales-demo.ts must seed GL-6900 + GL-2200 in its own GL accounts step.
 ────────────────────────────────────────
 #: 9
 Discovery: POST /api/parties has a bug in server/routes/clients.ts:797 — it tries to INSERT entity_class and
   vendor_profile columns that don't exist. Existing GET /api/parties works fine because the read query uses
   SELECT *.
 Source: Agent A
 Correction: Phase 4 seeds parties via direct SQL INSERT (not the buggy POST endpoint). The live read path is
   fine and we use it. We do NOT fix the POST bug as part of this sprint — that is a SaaS bug, not a demo
   concern, and this sprint touches no SaaS source. Filed as a follow-up note in the seed-contract doc.

 ---
 Tech inventory (verified, paste-quality)

 App.tsx route keys (Agent B, lines 546-604, 949-1143)

 ┌──────────────────┬─────────────┬────────────┬──────────────────────────────────┬──────────────────────┐
 │       Key        │    Label    │  Category  │            Component             │     Use in demo?     │
 ├──────────────────┼─────────────┼────────────┼──────────────────────────────────┼──────────────────────┤
 │ operations-hub   │ Operations  │ OPERATIONS │ IntelligenceHub                  │ YES (default         │
 │                  │ Center      │            │                                  │ landing)             │
 ├──────────────────┼─────────────┼────────────┼──────────────────────────────────┼──────────────────────┤
 │                  │             │            │                                  │ YES (hero 1 — show   │
 │ loads            │ Load Board  │ OPERATIONS │ LoadBoardEnhanced                │ seeded               │
 │                  │             │            │                                  │ LP-DEMO-RC-001)      │
 ├──────────────────┼─────────────┼────────────┼──────────────────────────────────┼──────────────────────┤
 │ calendar         │ Schedule    │ OPERATIONS │ CalendarView                     │ YES                  │
 ├──────────────────┼─────────────┼────────────┼──────────────────────────────────┼──────────────────────┤
 │ network          │ Onboarding  │ OPERATIONS │ NetworkPortal                    │ YES (hero 3 — CRM)   │
 ├──────────────────┼─────────────┼────────────┼──────────────────────────────────┼──────────────────────┤
 │ telematics-setup │ Telematics  │ OPERATIONS │ TelematicsSetup                  │ NO (hide in demo)    │
 ├──────────────────┼─────────────┼────────────┼──────────────────────────────────┼──────────────────────┤
 │                  │             │            │ AccountingPortal (contains       │                      │
 │ accounting       │ Financials  │ FINANCIALS │ nested "Fuel & IFTA" tab →       │ YES (hero 2 — IFTA)  │
 │                  │             │            │ IFTAManager →                    │                      │
 │                  │             │            │ IFTAEvidenceReview)              │                      │
 ├──────────────────┼─────────────┼────────────┼──────────────────────────────────┼──────────────────────┤
 │ exceptions       │ Issues &    │ ADMIN      │ ExceptionConsole                 │ YES                  │
 │                  │ Alerts      │            │                                  │                      │
 ├──────────────────┼─────────────┼────────────┼──────────────────────────────────┼──────────────────────┤
 │ company          │ Company     │ ADMIN      │ CompanyProfile                   │ NO (hide in demo)    │
 │                  │ Settings    │            │                                  │                      │
 ├──────────────────┼─────────────┼────────────┼──────────────────────────────────┼──────────────────────┤
 │ quotes           │ (no nav     │ (route     │ QuoteManager                     │ NO (already hidden — │
 │                  │ entry)      │ only)      │                                  │  known 403 issue)    │
 └──────────────────┴─────────────┴────────────┴──────────────────────────────────┴──────────────────────┘

 Nav button data-testid pattern (App.tsx ~line 866): data-testid="nav-${item.id}" — e.g., nav-accounting,
 nav-network, nav-loads. Stable for Playwright.

 CRM enrichment chain (Agent A, server/routes/clients.ts:477-535)

 GET /api/parties runs one base query then 6 parallel Promise.all enrichments and assembles the response. The
 8 tables touched by the read path:

 Table: parties
 Migration: 032_parties_subsystem.sql:6-20, FK fixed in 037_fix_parties_fk.sql
 Required cols: id, company_id, name; defaults: type='carrier', status='active'; nullable: mc_number,
   dot_number, rating, tags JSON (added in 040)
 NetworkPortal tab consuming the data: IDENTITY
 ────────────────────────────────────────
 Table: party_contacts
 Migration: 032:22-33
 Required cols: id, party_id, name
 NetworkPortal tab consuming the data: CONTACTS
 ────────────────────────────────────────
 Table: party_documents
 Migration: 032:35-43
 Required cols: id, party_id
 NetworkPortal tab consuming the data: DOCS
 ────────────────────────────────────────
 Table: rate_rows
 Migration: 032:45-69
 Required cols: id, party_id
 NetworkPortal tab consuming the data: RATES
 ────────────────────────────────────────
 Table: rate_tiers
 Migration: 032:71-80
 Required cols: id, rate_row_id
 NetworkPortal tab consuming the data: RATES (nested under rate row)
 ────────────────────────────────────────
 Table: constraint_sets
 Migration: 032:82-94
 Required cols: id, party_id
 NetworkPortal tab consuming the data: CONSTRAINTS
 ────────────────────────────────────────
 Table: constraint_rules
 Migration: 032:96-107
 Required cols: id, constraint_set_id
 NetworkPortal tab consuming the data: CONSTRAINTS (nested under set)
 ────────────────────────────────────────
 Table: party_catalog_links
 Migration: 032:109-115
 Required cols: id, party_id, catalog_item_id
 NetworkPortal tab consuming the data: CATALOG

 Tables that DO NOT exist (verified by grep across server/migrations/*.sql): broker_credit_scores,
 customer_rate_sheets, party_interactions. The prior plan referenced all three.

 Filter capability gaps (do not use):
 - GET /api/contacts — no party_id filter (server/routes/contacts.ts:13-34).
 - GET /api/documents — party_id is not in documentListQuerySchema
 (server/schemas/document.schema.ts:117-127).

 Single API call to populate every NetworkPortal tab: GET /api/parties. NetworkPortal makes one fetch on mount
  (components/NetworkPortal.tsx:230 via services/networkService.ts:4-26). All 6 tabs (IDENTITY, CONTACTS,
 CATALOG, RATES, CONSTRAINTS, DOCS) read from the enriched response. No per-tab API calls.

 Known SaaS bug (NOT fixed in this sprint, documented as out-of-scope follow-up): POST /api/parties
 (clients.ts:797) tries to INSERT entity_class and vendor_profile columns that do not exist. Phase 4 seeds via
  direct INSERT and never calls POST.

 IFTA UI (Agent B, IFTAManager.tsx, IFTAEvidenceReview.tsx)

 Navigation: nav-accounting → click tab labeled "Fuel & IFTA" → IFTAManager renders → click "Q4" button →
 select year 2025 from <select aria-label="Select year"> → IFTAManager lists delivered loads as cards (no
 data-testid, only the load number text like #LP-DEMO-RC-001) → click the load card → IFTAEvidenceReview
 opens.

 IFTAEvidenceReview (useEffect at lines 47-60):
 - Fetches evidence via getIFTAEvidence(load.id) on mount.
 - If evidence rows exist, automatically calls analyzeIFTA({ pings: data, mode: 'GPS' }) and renders the
 jurisdiction split table.
 - The user manually checks an attestation <input type="checkbox"> ("Confirm and Attest Evidence") and clicks
 <button>Lock Trip for Audit</button>.

 There is no manual "Run Analysis" button. There are no data-testid attributes in either file. Playwright must
  use text-based selectors throughout.

 Driver intake load number (Agent B, DriverMobileHome.tsx:570-605)

 Line 573: const loadNumber = \INT-${Date.now().toString(36).toUpperCase()}`;`

 Pure client-side, not overridable, never reads from extraction payload. The plan does not modify this —
 instead the seed creates the demo load row directly with id LP-DEMO-RC-001, so the demo never exercises the
 intake submit path during the sales presentation.

 seed-demo.ts (Agent C, server/scripts/seed-demo.ts)

 - Zero export statements. Strictly procedural CLI.
 - 11 helper functions (seedCompany 206-233, seedUsers 235-262, ..., seedApBills 552-654, verifySeed 656-741)
 all private; main() at 745-824 invoked at 826.
 - Uses companyId = process.env.DEMO_COMPANY_ID || seedData.company.id (default DEMO-COMPANY-001).
 - Seeds 5 GL accounts (1200 / 2000 / 4000 / 6100 / 6200). Does NOT seed GL-6900 (IFTA Expense) or GL-2200
 (IFTA Payable).
 - Inserts MySQL users rows with role + email but no firebase_uid. Comment at line 808: "Log in using any
 Firebase user linked to this company_id."

 Decision: do not touch this file. The new seed pipeline is fully independent at
 server/scripts/seed-sales-demo.ts and duplicates the SQL it needs.

 e2e auth fixture (Agent C, e2e/fixtures/auth.fixture.ts)

 - Reads FIREBASE_WEB_API_KEY (required), E2E_API_URL (default http://localhost:5000), and per-role
 E2E_<ROLE>_EMAIL / E2E_<ROLE>_PASSWORD env vars (defaults admin@loadpilot.dev / AdminPassword123! etc.).
 - Calls signInWithPassword against
 https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY} and wraps the
 returned idToken in an AuthContext with .get/.post/.patch/.delete helpers.
 - No programmatic user creation. Users must pre-exist in Firebase.
 - If creds missing, returns a no-token context so callers can test.skip(!process.env.FIREBASE_WEB_API_KEY,
 "...").

 Playwright + Windows scripting (Agent C)

 - playwright.config.ts: testDir: "./e2e", baseURL: "http://localhost:3101", single chromium project,
 reporter: "list", webServer block starts both Express (port 5000) + Vite (port 3101) when
 E2E_SERVER_RUNNING=1 is set, otherwise Express only.
 - 46 spec files, kebab-case naming (auth.spec.ts, team02-dispatch-load-create.spec.ts, ...).
 - cross-env is NOT installed. Root package.json scripts use Unix syntax (cd server && npm.cmd run dev).
 Windows portability requires .env.local files or PowerShell $env:VAR=value syntax.

 ---
 Phase Breakdown

 Phase 1 — Independent Sales-Demo Seed Pipeline (foundation)

 Goal: A fresh SALES-DEMO-001 tenant exists in the database with subscription_tier='Fleet Core', GL accounts
 including GL-6900 and GL-2200, two MySQL user rows linked by env-supplied firebase_uid values, and a
 one-button reset script. Independent of seed-demo.ts — does not import, modify, or call it.

 Files (new):

 Path: server/scripts/seed-sales-demo.ts
 Purpose: Standalone TS script. main() loads env via dotenv.config({ path: '.env.local' }) — SINGLE ENV
   CONTRACT, .env.local is the one source of truth across seed, reset, and certify (NOT .env). Then
   creates a mysql connection and calls 5 internal helpers (seedCompany, seedUsers, seedGlAccounts,
   seedSalesDemoIfta (added Phase 3), seedSalesDemoParties (added Phase 4)), exits 0/1. Mirrors the
   structure of seed-demo.ts but copies only the minimum SQL needed. Hard-codes companyId =
   'SALES-DEMO-001'. After inserts runs UPDATE companies SET subscription_tier='Fleet Core',
   subscription_status='active' WHERE id=?.

   Required env vars in .env.local (validated at startup, fail-fast with explanatory error if missing):
     - DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME (existing project DB conventions)
     - SALES_DEMO_ADMIN_FIREBASE_UID (the Firebase Auth UID for the seeded admin user; provisioned
       manually via Firebase Console — see Phase 6 runbook)
     - SALES_DEMO_DRIVER_FIREBASE_UID (the Firebase Auth UID for the seeded driver user; same)

   ENV CONTRACT (single source of truth):
     - .env.local is the ONLY env file consumed by seed, reset, and certify scripts.
     - .env (without .local) is reserved for the existing SaaS dev workflow and is NOT touched.
     - The runbook (Phase 6) tells the salesperson to copy .env.example.sales-demo (added in Phase 1)
       to .env.local and fill in the 7 required values.
     - Phase 7's demo-certify.cjs ALSO loads from .env.local — NO env split between seed/reset and cert.
 ────────────────────────────────────────
 Path: server/scripts/reset-sales-demo.ts
 Purpose: Wraps the seed. Refuses to run when process.env.DB_NAME matches /prod|production/i. Then runs
   tenant-scoped DELETE statements in this exact order BEFORE deleting the company row, because several
   seeded tables have NO FK to companies and DO NOT cascade (verified against migrations 005, 011, 012,
   013, and the column rename in 038):

   IMPORTANT — column name verified against migration 038_accounting_tenant_to_company_id.sql: every
   accounting and IFTA table that originally used tenant_id was renamed to company_id by migration 038
   (gl_accounts line 30, journal_entries line 40, ar_invoices line 49, ap_bills line 59, fuel_ledger
   line 67, mileage_jurisdiction line 83, ifta_trip_evidence line 115, ifta_trips_audit line 123).
   The DELETE statements MUST use company_id, NOT tenant_id, against the live schema.

     1. DELETE FROM ifta_trips_audit         WHERE company_id  = 'SALES-DEMO-001';
     2. DELETE FROM ifta_trip_evidence       WHERE company_id  = 'SALES-DEMO-001';
     3. DELETE FROM mileage_jurisdiction     WHERE company_id  = 'SALES-DEMO-001';
     4. DELETE FROM fuel_ledger              WHERE company_id  = 'SALES-DEMO-001';
     5. DELETE FROM journal_lines            WHERE journal_entry_id IN
          (SELECT id FROM journal_entries WHERE company_id = 'SALES-DEMO-001');
        -- journal_lines has FK to journal_entries ON DELETE CASCADE so step 6 also handles this,
        -- but explicit deletion makes the script defensive against partial state. journal_lines
        -- itself has NO company_id / tenant_id column — it must be filtered via journal_entries.
     6. DELETE FROM journal_entries          WHERE company_id  = 'SALES-DEMO-001';
     7. DELETE FROM ar_invoices              WHERE company_id  = 'SALES-DEMO-001';
     8. DELETE FROM ap_bills                 WHERE company_id  = 'SALES-DEMO-001';
     9. DELETE FROM gl_accounts              WHERE company_id  = 'SALES-DEMO-001';
    10. DELETE FROM documents                WHERE company_id  = 'SALES-DEMO-001';
    11. DELETE FROM companies                WHERE id          = 'SALES-DEMO-001';
        -- This cascades through: users, customers, parties (after migration 037),
        -- party_contacts, party_documents, rate_rows, rate_tiers, constraint_sets,
        -- constraint_rules, party_catalog_links, loads, load_legs, equipment.

   Finally invokes seedSalesDemo on the now-clean tenant. The 11 DELETE statements are idempotent
   (safe to run when no rows exist) and tenant-scoped (zero risk to other tenants in shared dev DB).
 ────────────────────────────────────────
 Path: server/scripts/sales-demo-fixtures/sales-demo-data.json
 Purpose: Static JSON fixture: 1 company, 2 users (admin + driver), 7 GL accounts (the 5 stock + GL-6900 +
   GL-2200), the IFTA + parties data referenced by Phases 3 and 4.
 ────────────────────────────────────────
 Path: server/__tests__/scripts/seed-sales-demo.test.ts
 Purpose: Unit tests against a mocked mysql connection: asserts the company INSERT, the explicit
   subscription_tier='Fleet Core' UPDATE, all 7 GL accounts present, missing-env-var error path, idempotent on

   second run (counts INSERT IGNORE vs INSERT).
 ────────────────────────────────────────
 Path: server/__tests__/scripts/reset-sales-demo.test.ts
 Purpose: Unit tests for reset: prod-name guard, DELETE-then-seed call order, error propagation.
 ────────────────────────────────────────
 Path: server/__tests__/middleware/sales-demo-tier-audit.test.ts
 Purpose: Integration: walks every route registered in server/index.ts that uses requireTier('Automation Pro')

   or requireTier('Fleet Core'), fires a fake request with a mocked DB returning subscription_tier='Fleet
 Core'
    for SALES-DEMO-001, and asserts statusCode !== 403 for every one. Asserts at least 15 routes are
 exercised.
 ────────────────────────────────────────
 Path: docs/sales-demo-seed-contract.md
 Purpose: Authoritative reset contract. Sections: ## Rows present after reset, ## Firebase UID env contract,
 ##
   GL accounts that must exist, ## Hidden routes & rationale, ## Known SaaS follow-ups (out of scope this
   sprint) (lists the POST /api/parties entity_class/vendor_profile bug).
 ────────────────────────────────────────
 Path: server/__tests__/docs/sales-demo-seed-contract.test.ts
 Purpose: Doc-as-spec test: regex-asserts the 5 H2 sections above are present.
 ────────────────────────────────────────
 Path: .env.example.sales-demo
 Purpose: Example env file documenting the 7 required env vars (DB_HOST/PORT/USER/PASSWORD/NAME +
   SALES_DEMO_ADMIN_FIREBASE_UID + SALES_DEMO_DRIVER_FIREBASE_UID). Salesperson copies this to
   .env.local and fills in real values. Committed to git as the env contract source of truth.
 ────────────────────────────────────────
 Path: server/__tests__/docs/env-example-sales-demo.test.ts
 Purpose: Doc-as-spec: asserts .env.example.sales-demo file exists and contains placeholder lines for
   all 7 required keys (regex-checked).

 Files (existing) extended:

 Path: package.json (root)
 What changes: Add scripts: "demo:reset:sales": "ts-node --transpile-only server/scripts/reset-sales-demo.ts",

   "demo:seed:sales": "ts-node --transpile-only server/scripts/seed-sales-demo.ts". Use --transpile-only so it

   works on Windows without an explicit tsconfig path. No env vars in script  value — the salesperson sets
 them
    in .env.local.

 Acceptance criteria (R-markers):
 - R-P1-01 [unit]: seedSalesDemo issues UPDATE companies SET subscription_tier='Fleet Core' for SALES-DEMO-001
  (assert by SQL capture).
 - R-P1-02 [unit]: seedSalesDemo throws Error('SALES_DEMO_ADMIN_FIREBASE_UID required') when env var unset.
 - R-P1-03 [unit]: resetSalesDemo throws when DB_NAME='production-loadpilot'.
 - R-P1-04 [unit]: seedSalesDemo inserts gl_accounts rows with ids GL-6900 AND GL-2200 (the IFTA pair) before
 any IFTA evidence insert.
 - R-P1-05 [integration]: tier audit walks ≥15 requireTier('Fleet Core'|'Automation Pro') routes and asserts
 statusCode !== 403 for the seeded admin.
 - R-P1-06 [unit]: docs/sales-demo-seed-contract.md contains the 5 required H2 sections.
 - R-P1-07 [unit]: 100% of seedSalesDemo insert statements use INSERT IGNORE (idempotent).
 - R-P1-08 [unit]: seedSalesDemo does NOT import or require server/scripts/seed-demo.ts (independent pipeline
 guarantee — assert via grep on the source).
 - R-P1-09 [unit]: resetSalesDemo issues DELETE statements against ALL of these 10 tables in the verified
   non-cascading list, in order, BEFORE the DELETE FROM companies: ifta_trips_audit, ifta_trip_evidence,
   mileage_jurisdiction, fuel_ledger, journal_lines, journal_entries, ar_invoices, ap_bills, gl_accounts,
   documents. Asserted by SQL capture against a mocked mysql connection — every table name appears in the
   captured DELETE list at least once and the company DELETE is the LAST one issued.
 - R-P1-10 [unit]: resetSalesDemo is idempotent — second invocation against an already-empty tenant exits 0
   without error (no "row not found" or FK violation).
 - R-P1-11 [unit]: .env.example.sales-demo file exists at the repo root and contains placeholder lines
   for all 7 required keys (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME,
   SALES_DEMO_ADMIN_FIREBASE_UID, SALES_DEMO_DRIVER_FIREBASE_UID) — assert via grep on the file.
 - R-P1-12 [unit]: seedSalesDemo source contains exactly one dotenv.config call and that call references
   '.env.local' (NOT '.env') — proves the single env contract. Assert via grep on the source.

 Verification command:
 cd server && npx vitest run __tests__/scripts/seed-sales-demo.test.ts
 __tests__/scripts/reset-sales-demo.test.ts __tests__/middleware/sales-demo-tier-audit.test.ts
 __tests__/docs/sales-demo-seed-contract.test.ts

 ---
 Phase 2 — Pre-Seeded Hero Load + Broker (live data, zero AI calls)

 Goal: After npm run demo:reset:sales, a load with id LP-DEMO-RC-001 exists in the sales-demo tenant with
 a real customers row attached as the broker AND three documents linked to the load. The salesperson opens
 the load via the live LoadBoardEnhanced and live LoadDetailView. The seeded broker name, commodity, weight,
 and rate are visible in the load detail panel. The documents panel shows that 3 documents exist on the load.
 Zero changes to ai.ts, Scanner.tsx, DriverMobileHome.tsx, gemini.service.ts, document.service.ts,
 LoadDetailView.tsx, brokerService.ts, or any other production code path.

 IMPORTANT NARRATIVE CONSTRAINTS (verified against live source):
 - The certified demo asserts on FIELDS THAT LIVE ON THE LOAD ROW (loadNumber, pickup/dropoff facility,
   commodity, weight, rate, broker name resolved through customers table). These all render through
   LoadDetailView.tsx unchanged (verified at LoadDetailView.tsx:140 for the broker lookup).
 - The canonical documents UI at LoadDetailView.tsx:1125-1135 reads doc.filename and doc.type, but the
   GET /api/documents response today returns raw rows where the columns are original_filename /
   sanitized_filename / document_type — there is no mapping layer (verified at
   server/repositories/document.repository.ts:9-24 and services/storage/vault.ts:65-81). In the current
   code the labels render as undefined. **This sprint relaxes the zero-production-diff constraint for
   exactly one file — `server/repositories/document.repository.ts` — to add a ≤10-line mapping that
   aliases original_filename → filename and document_type → type on every returned row.** It is the
   single highest-value polish touch: a buyer looking at the hero load's documents panel sees
   professional labels instead of "undefined undefined". LoadDetailView.tsx itself stays untouched
   (R-P2-08 still greps it for zero diff). document.service.ts also stays untouched (Phase 7 still
   greps it for zero diff). The mapping lives only at the repository layer.
 - Broker name visibility requires a row in the legacy customers table (NOT parties), because
   App.tsx:294-296 calls getBrokers() which queries GET /api/clients/:companyId, and that route at
   server/routes/clients.ts:37-72 runs SELECT * FROM customers WHERE company_id = ?. The Phase 4
   parties seed is for the NetworkPortal CRM hero ONLY — it does NOT populate the broker lookup used
   by LoadDetailView.

 Files (new):

 Path: server/scripts/seed-sales-demo-loads.ts
 Purpose: Helper module. Exports seedSalesDemoLoads(conn). INSERT IGNORE in this exact order:
   1. INTO customers (id 'SALES-DEMO-CUST-001', company_id, name 'ACME Logistics LLC', type 'Broker',
      mc_number, dot_number, email, phone, address, payment_terms 'Net 30') — this becomes the broker
      that LoadDetailView resolves via getBrokers().
   2. INTO loads (id 'LP-DEMO-RC-001', company_id 'SALES-DEMO-001', status 'delivered',
      customer_id 'SALES-DEMO-CUST-001' [CRITICAL — this is what the broker lookup keys on],
      driver_id (a seeded user from Phase 1), loadNumber 'LP-DEMO-RC-001', commodity, weight,
      pickup/dropoff city/state/facility name, carrier_rate, driver_pay, all the columns
      LoadDetailView.tsx renders).
   3. INTO load_legs (2 rows: pickup + dropoff, FK to LP-DEMO-RC-001).
   4. INTO documents (3 rows: rate confirmation, BOL, lumper receipt; all linked via load_id =
      'LP-DEMO-RC-001'; column values populate original_filename, sanitized_filename, mime_type,
      file_size_bytes, storage_path, document_type, status='ready', uploaded_by). Storage path may
      point at a non-existent file — the documents panel just lists the row, it does not require
      the binary to exist for the demo.
 ────────────────────────────────────────
 Path: server/scripts/sales-demo-fixtures/loads/LP-DEMO-RC-001.json
 Purpose: Static fixture: 1 customers row + 1 load row + 2 load_legs + 3 documents rows. Pickup Houston TX,
   dropoff Chicago IL, commodity 'Frozen Beef', weight '42,500 lbs', carrier rate '$3,250', broker name
   'ACME Logistics LLC'. All values are what the salesperson narrates on stage.
 ────────────────────────────────────────
 Path: server/scripts/sales-demo-fixtures/loads/extracted-fields.md
 Purpose: Human-readable cheat sheet listing the exact fields the salesperson should narrate when opening
   LP-DEMO-RC-001 on stage. Documents panel now shows readable filename/type labels (repository mapping
   added this sprint) and documents are downloadable (seeded artifacts added this sprint).
 ────────────────────────────────────────
 Path: server/scripts/sales-demo-fixtures/loads/artifacts/rate-con.pdf
 Purpose: Real binary artifact for the hero load's rate confirmation document. A small text-only PDF
   (≥ 1KB, valid %PDF- magic number) that the seed script copies into the live upload directory so
   clicking Download on the rate con card returns a real file. Content is a one-page printout showing
   ACME Logistics LLC header, Frozen Beef line item, Houston → Chicago route, $3,250 rate.
 ────────────────────────────────────────
 Path: server/scripts/sales-demo-fixtures/loads/artifacts/bol.pdf
 Purpose: Real binary artifact for the hero load's BOL. A small text-only PDF with shipper / consignee /
   commodity / weight fields readable so the salesperson can open the downloaded file on stage if asked.
 ────────────────────────────────────────
 Path: server/scripts/sales-demo-fixtures/loads/artifacts/lumper-receipt.pdf
 Purpose: Real binary artifact for the hero load's lumper receipt. Small text-only PDF with a scanned
   look (single-column receipt layout) showing the date, facility, lumper fee, signature line.
 ────────────────────────────────────────
 Path: server/__tests__/repositories/document.repository.mapping.test.ts
 Purpose: Unit test for the new mapping layer. Given a raw row from the database with fields
   `{original_filename: "rate-con.pdf", document_type: "rate_confirmation", ...}`, the repository
   accessor returns an object whose `.filename === "rate-con.pdf"` AND `.type === "rate_confirmation"`,
   with both the original fields AND the aliases present (backwards compatibility). Also asserts the
   mapping is a pure transform (no I/O).
 ────────────────────────────────────────
 Path: server/__tests__/integration/sales-demo-document-download.test.ts
 Purpose: Integration: against the seeded sales-demo tenant, calls the live
   GET /api/documents/:id/download for each of the 3 seeded documents (rate-con, bol, lumper-receipt).
   Asserts: (a) status 200, (b) Content-Type === 'application/pdf', (c) response body length > 1024
   bytes, (d) first 4 bytes equal `%PDF`. Uses the unmodified production download handler.
 ────────────────────────────────────────
 Path: server/__tests__/scripts/seed-sales-demo-loads.test.ts
 Purpose: Asserts the seed inserts exactly 1 customer + 1 load + 2 legs + 3 documents in that order, with
   the load.customer_id matching the seeded customer.id; idempotent on second run.
 ────────────────────────────────────────
 Path: server/__tests__/integration/sales-demo-load-readback.test.ts
 Purpose: Integration: against the seeded sales-demo tenant, calls the LIVE GET /api/loads/:id, the LIVE
   GET /api/clients/SALES-DEMO-001, and the LIVE GET /api/documents?load_id=LP-DEMO-RC-001 endpoints.
   Asserts:
     - GET /api/loads returns the seeded load with loadNumber 'LP-DEMO-RC-001'.
     - GET /api/clients returns at least 1 customer row with id 'SALES-DEMO-CUST-001' and name
       'ACME Logistics LLC'.
     - GET /api/documents returns 3 documents linked to load_id 'LP-DEMO-RC-001'.
   All three calls go through the unmodified production handlers.
 ────────────────────────────────────────
 Path: e2e/sales-demo/01-document-automation.spec.ts
 Purpose: Playwright spec. Logs in as SALES-DEMO-ADMIN, navigates [data-testid="nav-loads"] → finds row
   containing 'LP-DEMO-RC-001' → clicks it → asserts the load detail panel shows:
     - text 'LP-DEMO-RC-001' (loadNumber)
     - text 'ACME Logistics LLC' (broker name resolved through getBrokers)
     - text 'Frozen Beef' (commodity)
     - text 'Houston' AND text 'Chicago' (pickup + dropoff cities)
   Then clicks the 'Documents' action button → asserts the documents panel opens and has at least 3
   document cards visible (selector: card containers, NOT inner label text). No upload action. No AI call.
   Reads existing seeded data through the unmodified UI.

 Files (existing) extended:

 Path: server/scripts/seed-sales-demo.ts
 What changes: call seedSalesDemoLoads(conn) after seedGlAccounts(conn) (Phase 1 created the orchestrator;
   Phase 2 appends one call). Additionally, inside seedSalesDemoLoads, after the INSERTs, copy the three
   artifact PDFs from server/scripts/sales-demo-fixtures/loads/artifacts/ into the live upload directory
   at `${process.env.UPLOAD_DIR || "./uploads"}/sales-demo/LP-DEMO-RC-001/{rate-con,bol,lumper-receipt}.pdf`
   so the download endpoint (GET /api/documents/:id/download) can return them as real files. Uses
   `fs.promises.copyFile` with `{ recursive: true }` mkdir on the parent. Idempotent — skip copy if
   destination file already exists with the expected size.
 ────────────────────────────────────────
 Path: server/repositories/document.repository.ts
 What changes (precise diff scope, ≤ 10 added lines, 0 removed lines): in the accessor(s) that return
   document rows to callers (listDocuments / findById / whatever is used by the GET /api/documents and
   GET /api/documents/:id handlers), append two alias properties to each returned row before returning:
   `row.filename = row.original_filename; row.type = row.document_type;`. Both aliases live ALONGSIDE
   the original columns — no column is removed, renamed, or deleted. LoadDetailView.tsx:1125-1135 then
   reads `doc.filename` and `doc.type` and renders readable text instead of undefined. This is the
   single production-code relaxation this sprint; it is tested by R-P2-12 (unit) and R-P2-13 (e2e).

 Acceptance criteria:
 - R-P2-01 [unit]: seedSalesDemoLoads inserts exactly 1 row into customers with id 'SALES-DEMO-CUST-001'
   and type 'Broker' (assert via SQL capture).
 - R-P2-02 [unit]: seedSalesDemoLoads inserts exactly 1 row into loads with id 'LP-DEMO-RC-001' AND
   customer_id = 'SALES-DEMO-CUST-001' (assert the FK linkage via SQL capture).
 - R-P2-03 [unit]: seedSalesDemoLoads inserts exactly 2 rows into load_legs and 3 rows into documents
   linked to LP-DEMO-RC-001.
 - R-P2-04 [unit]: seedSalesDemoLoads is idempotent — second invocation produces 0 new rows (INSERT IGNORE
   count).
 - R-P2-05 [unit]: seedSalesDemoLoads does NOT import or call any function from server/routes/ai.ts or
   server/services/gemini.service.ts (live-functions-only guarantee — assert via grep).
 - R-P2-06 [integration]: GET /api/loads against the sales-demo admin returns the load with loadNumber
   'LP-DEMO-RC-001'; GET /api/clients/SALES-DEMO-001 returns the broker; GET /api/documents?load_id=
   'LP-DEMO-RC-001' returns 3 document rows. All three use the unmodified production handlers.
 - R-P2-07 [e2e]: Playwright spec opens LP-DEMO-RC-001 from Load Board, asserts the visible DOM contains
   'LP-DEMO-RC-001', 'ACME Logistics LLC', 'Frozen Beef', 'Houston', and 'Chicago' within 5 seconds.
   Clicks Documents button and asserts at least 3 document cards (container selector) are visible.
 - R-P2-08 [unit]: grep server/routes/ai.ts, server/services/gemini.service.ts, components/Scanner.tsx,
   components/DriverMobileHome.tsx, components/LoadDetailView.tsx, services/brokerService.ts HEAD vs
   sprint-end shows zero diff (snapshot test on file SHA256 for each file). NOTE:
   server/repositories/document.repository.ts is DELIBERATELY EXCLUDED from this grep — the mapping
   fix lives in that file (R-P2-12).
 - R-P2-09 [unit]: three real binary artifact fixtures exist at
   server/scripts/sales-demo-fixtures/loads/artifacts/{rate-con,bol,lumper-receipt}.pdf; each file is
   at least 1024 bytes AND the first 4 bytes of each file equal `%PDF` (valid PDF magic number).
   Assert via fs.statSync + fs.readFileSync on the raw bytes.
 - R-P2-10 [unit]: seedSalesDemoLoads copies the 3 fixtures into the live upload directory at
   `${UPLOAD_DIR}/sales-demo/LP-DEMO-RC-001/{rate-con,bol,lumper-receipt}.pdf` where UPLOAD_DIR
   defaults to './uploads'. After the seed runs, the 3 destination files exist AND their sizes
   match the fixture source sizes. Assert via fs.stat post-seed. Second invocation is a no-op
   (idempotent copy).
 - R-P2-11 [integration]: GET /api/documents/:id/download for each of the 3 seeded documents on
   LP-DEMO-RC-001 returns status 200, Content-Type 'application/pdf', Content-Length > 1024, and
   the first 4 bytes of the response body equal `%PDF`. Uses the unmodified production download
   handler at server/routes/documents.ts:297.
 - R-P2-12 [unit]: the document repository accessor that returns rows to the GET /api/documents and
   GET /api/documents/:id handlers aliases original_filename → filename and document_type → type on
   every returned row. Test: insert a document row with original_filename='rate-con.pdf' and
   document_type='rate_confirmation', call the accessor, assert result.filename === 'rate-con.pdf'
   AND result.type === 'rate_confirmation' AND the original columns are still present. Diff on
   document.repository.ts is ≤ 10 added lines and 0 removed lines (assert via git diff --numstat).
 - R-P2-13 [e2e]: extends R-P2-07. After the Documents panel opens with ≥ 3 cards, assert each
   card's visible text contains a non-empty filename string (matches /\\w+\\.pdf$/) AND a readable
   type label ('Rate Confirmation', 'Bill of Lading', or 'Lumper Receipt' — all seeded via the
   document_type values). The literal string 'undefined' does NOT appear anywhere inside any of
   the 3 document cards.

 Verification command:
 cd server && npx vitest run __tests__/scripts/seed-sales-demo-loads.test.ts
 __tests__/integration/sales-demo-load-readback.test.ts
 __tests__/integration/sales-demo-document-download.test.ts
 __tests__/repositories/document.repository.mapping.test.ts
 && cd .. && set E2E_SERVER_RUNNING=1&& npx playwright test e2e/sales-demo/01-document-automation.spec.ts

 ▎ The set VAR=val&& (Windows cmd) syntax is portable. The runbook documents the PowerShell equivalent.

 ---
 Phase 3 — IFTA Trip-Based Evidence Seed + Real-UI Walkthrough (integration)

 Goal: The hero load LP-DEMO-RC-001 (seeded by Phase 2) has Q4 2025 IFTA evidence in the database — GPS
 pings spanning 6+ jurisdictions, fuel purchases, mileage by jurisdiction — so that the live
 GET /api/accounting/ifta-summary returns a valid quarter and the live IFTAEvidenceReview UI can analyze,
 attest, and lock the trip. Phase 3 is FUNDAMENTALLY trip/load-based, NOT truck-based.

 IMPORTANT NARRATIVE CONSTRAINT (verified at IFTAEvidenceReview.tsx:65-66):
 The IFTA audit-lock flow writes truckId from load.driver_id, NOT from a real truck/equipment row:
   const audit: Partial<IFTATripAudit> = {
     truckId: load.driver_id || "UNKNOWN",   // line 66 — this is NOT a truck FK
     loadId: load.id,
     ...
   };
 So the seeded "truck" in the prior plan was decorative. The corrected design seeds NO equipment row.
 The "trip" the salesperson locks is identified by load_id (LP-DEMO-RC-001) — the truck_id column gets
 populated from the load's driver_id at lock time. The salesperson narrates the demo as "every trip we
 deliver becomes IFTA evidence the next quarter" — load-centric, not fleet-centric.

 Files (new):

 Path: server/scripts/seed-sales-demo-ifta.ts
 Purpose: Helper. Exports seedSalesDemoIfta(conn). INSERT IGNORE in this exact order. ALL column names
   verified against migrations 011, 012, 013, 038 — the accounting/IFTA tables use company_id (renamed
   from tenant_id by migration 038) and fuel_ledger uses entry_date (verified at 011 line 114):

   1. INTO ifta_trip_evidence: 12 rows. ALL 12 rows have company_id = 'SALES-DEMO-001', load_id =
      'LP-DEMO-RC-001' (the Phase 2 hero load) and driver_id = (the seeded driver from Phase 1).
      truck_id column is set to NULL (the lock-time handler will populate it from load.driver_id at
      audit time). Each row has lat/lng/timestamp/state_code crossing Texas → Louisiana → Arkansas →
      Missouri → Illinois → Indiana → Ohio for a realistic Q4 2025 trip. source = 'GPS'.
   2. INTO fuel_ledger: 8 rows with company_id = 'SALES-DEMO-001', distributed across the same 6
      jurisdictions for Q4 2025. Required columns per migration 011 line 103-121: id, company_id
      (renamed from tenant_id), state_code (CHAR(2) NOT NULL), gallons (DECIMAL(10,3) NOT NULL),
      total_cost (DECIMAL(10,2) NOT NULL), entry_date (DATE NOT NULL — NOT 'fuel_date'), source
      (ENUM Manual/ELD/Import/Receipt). Optional: truck_id, load_id, price_per_gallon, vendor_name.
   3. INTO mileage_jurisdiction: 6 rows with company_id = 'SALES-DEMO-001' for Q4 2025 (one per
      jurisdiction), summing to ≥20,000 miles.
   NO INSERT INTO equipment. NO truck row. Trip-based, not truck-based.
 ────────────────────────────────────────
 Path: server/scripts/sales-demo-fixtures/ifta-q4-2025.json
 Purpose: The 26 rows above (12 + 8 + 6) as static data. All rows scoped to company_id =
   'SALES-DEMO-001' (column name verified against migration 038) and the ifta_trip_evidence rows
   are load-scoped to 'LP-DEMO-RC-001'. The fuel_ledger rows use the entry_date column name
   (verified against migration 011 line 114), NOT 'fuel_date' which does not exist.
 ────────────────────────────────────────
 Path: server/__tests__/scripts/seed-sales-demo-ifta.test.ts
 Purpose: Asserts via SQL capture: 12 ifta_trip_evidence INSERTs all with load_id 'LP-DEMO-RC-001';
   8 fuel_ledger INSERTs all with company_id 'SALES-DEMO-001'; 6 mileage_jurisdiction INSERTs;
   ZERO INSERT INTO equipment statements; idempotent on second run.
 ────────────────────────────────────────
 Path: server/__tests__/integration/sales-demo-ifta-summary.test.ts
 Purpose: Calls the live GET /api/accounting/ifta-summary?quarter=4&year=2025 against the seeded admin
   and asserts rows.length >= 6, totalMiles >= 20000, netTaxDue > 0. Uses the unmodified production route.
 ────────────────────────────────────────
 Path: e2e/sales-demo/02-ifta-walkthrough.spec.ts
 Purpose: Playwright spec, all text selectors against the real UI. Continuity narrative for sales:
   *"This is the same `LP-DEMO-RC-001` trip you just opened — Houston TX → Chicago IL, 42,500 lbs of Frozen
   Beef. Now it's filing its Q4 2025 fuel tax across 6 jurisdictions, and we're about to audit-lock it."*
 Sequence:
   [data-testid="nav-accounting"] click → button:has-text("Fuel & IFTA") click →
   button:has-text("Q4") click → select[aria-label="Select year"] choose '2025' → wait for the
   delivered-load card whose visible text contains 'LP-DEMO-RC-001' → click the card → wait for
   IFTAEvidenceReview panel (assert text 'Evidence Timeline' visible — Agent B verified this header at
   IFTAEvidenceReview.tsx:138) → wait for text 'Computed Jurisdiction Split' (proves auto-analysis ran;
   Agent B verified this header at IFTAEvidenceReview.tsx:194) → check input[type="checkbox"]
   (the attestation checkbox; verified at IFTAEvidenceReview.tsx:259-265) → click
   button:has-text("Lock Trip for Audit") (verified at IFTAEvidenceReview.tsx:290) → wait for the
   success toast text 'Trip evidence locked' or similar success indicator within 10 seconds.

 Files (existing) extended: server/scripts/seed-sales-demo.ts — append seedSalesDemoIfta(conn) call after
 seedSalesDemoLoads (Phase 3 depends on the load row from Phase 2 existing first).

 Acceptance criteria:
 - R-P3-01 [unit]: seedSalesDemoIfta returns { evidenceRows: 12, fuelRows: 8, mileageRows: 6 }. The return
   shape contains NO trucksInserted field (trip-based, not truck-based).
 - R-P3-02 [unit]: All 12 ifta_trip_evidence INSERT statements have load_id = 'LP-DEMO-RC-001' (assert via
   SQL capture against a mocked mysql connection).
 - R-P3-03 [unit]: seedSalesDemoIfta source contains ZERO references to the string 'equipment' and ZERO
   'INSERT INTO equipment' statements (assert via grep — proves trip-based design).
 - R-P3-04 [integration]: GET /api/accounting/ifta-summary?quarter=4&year=2025 returns rows.length >= 6 &&
   totalMiles >= 20000 && netTaxDue > 0. Uses the live unmodified route handler.
 - R-P3-05 [e2e]: Playwright walkthrough completes the full sequence above and asserts the evidence-locked
   success indicator appears within 10 seconds. Spec uses zero data-testid on IFTA elements (only text
   selectors); grep on the spec file confirms no occurrence of `data-testid="ifta-`.
 - R-P3-06 [unit]: seedSalesDemoIfta is idempotent (second invocation produces 0 new rows).
 - R-P3-07 [unit]: grep components/IFTAManager.tsx, components/IFTAEvidenceReview.tsx,
   components/AccountingPortal.tsx HEAD vs sprint-end shows zero diff (live-functions-only guarantee).

 Verification command:
 cd server && npx vitest run __tests__/scripts/seed-sales-demo-ifta.test.ts
 __tests__/integration/sales-demo-ifta-summary.test.ts && cd .. && set E2E_SERVER_RUNNING=1&& npx playwright
 test e2e/sales-demo/02-ifta-walkthrough.spec.ts

 ---
 Phase 4 — CRM Registry Depth (the rewrite — real tables, real /api/parties)

 Goal: NetworkPortal renders 12 parties (3 customers, 2 brokers, 2 vendors, 3 facilities, 2 contractors), each
  enriched with contacts, documents, rates, constraints, and catalog links via the live GET /api/parties
 enrichment query. Zero edits to clients.ts, NetworkPortal.tsx, networkService.ts, contacts.ts, documents.ts,
 or any schema.

 Files (new):

 Path: server/scripts/seed-sales-demo-parties.ts
 Purpose: Helper. Exports seedSalesDemoParties(conn). Direct SQL INSERT IGNORE into the 8 verified tables
   (parties, party_contacts, party_documents, rate_rows, rate_tiers, constraint_sets, constraint_rules,
   party_catalog_links). Does NOT touch broker_credit_scores, customer_rate_sheets, or party_interactions
 (none
    exist). Does NOT call POST /api/parties (it has the entity_class/vendor_profile bug).
 ────────────────────────────────────────
 Path: server/scripts/sales-demo-fixtures/parties.json
 Purpose: 12 parties (3/2/2/3/2 split across Customer/Broker/Vendor/Facility/Contractor) with full
 sub-records:
   ≥1 contact per party (24 contacts total), ≥1 document per party (12 documents), ≥1 rate row per party with
   1-2 tiers (15+ rate rows), ≥1 constraint set per party with 1-2 rules (15+ rules), ≥1 catalog link per
 party
    (12+ links). All values realistic for trucking.
   **CONTINUITY REQUIREMENT**: one of the two brokers MUST reuse the same party identity the salesperson
   already saw on the hero load in Phase 2: `SALES-DEMO-CUST-001` / name `ACME Logistics LLC`. This broker
   gets the full enrichment treatment (≥1 contact, ≥1 document, ≥1 rate row with tiers, ≥1 constraint set,
   ≥1 catalog link). The Playwright spec explicitly drills into ACME Logistics LLC — not a random broker.
 ────────────────────────────────────────
 Path: server/__tests__/scripts/seed-sales-demo-parties.test.ts
 Purpose: Asserts row counts via SQL capture; asserts type breakdown (3 Customer, 2 Broker, ...); idempotent;
   gracefully no-ops if any optional table is missing (defensive).
 ────────────────────────────────────────
 Path: server/__tests__/integration/sales-demo-network-portal.test.ts
 Purpose: Calls live GET /api/parties against the seeded admin. Asserts: response length === 12; type
   breakdown; first broker has contacts.length >= 1, documents.length >= 1, rates.length >= 1,
   constraintSets.length >= 1, catalogLinks.length >= 1.
 ────────────────────────────────────────
 Path: e2e/sales-demo/03-network-portal-walkthrough.spec.ts
 Purpose: Playwright spec. [data-testid="nav-network"] click → wait for NetworkPortal shell → assert ≥12 party

   rows visible → click the party row whose name text contains `ACME Logistics LLC` (NOT the first broker
   in the list — the continuity requirement: buyer must recognize the same broker from the hero load) →
   wait for the 6 tabs (IDENTITY, CONTACTS, CATALOG, RATES, CONSTRAINTS, DOCS) → for each tab in turn click
   and assert at least one row of content visible.

 Files (existing) extended: server/scripts/seed-sales-demo.ts — append seedSalesDemoParties(conn) call after
 seedSalesDemoIfta.

 Acceptance criteria:
 - R-P4-01 [unit]: seedSalesDemoParties inserts exactly 3 customers, 2 brokers, 2 vendors, 3 facilities, 2
 contractors AND one of the 2 brokers is `SALES-DEMO-CUST-001` / `ACME Logistics LLC` (the same broker
 attached to the Phase 2 hero load — continuity object) — assert by type breakdown AND exact-id lookup via
 SQL capture.
 - R-P4-02 [unit]: every party has at least 1 contact, 1 document, 1 rate row, 1 constraint set, 1 catalog
 link (assert via fixture validation + SQL capture counts).
 - R-P4-03 [unit]: seedSalesDemoParties does NOT issue any INSERT against broker_credit_scores,
 customer_rate_sheets, or party_interactions (assert via grep on the source).
 - R-P4-04 [unit]: seedSalesDemoParties does NOT call POST /api/parties and does NOT import any function from
 server/routes/clients.ts (live-functions-only via direct SQL).
 - R-P4-05 [integration]: GET /api/parties returns exactly 12 parties for the sales-demo tenant with the
 correct type breakdown and the first broker has all 5 enrichment arrays non-empty.
 - R-P4-06 [e2e]: Playwright walkthrough opens NetworkPortal, locates the row with text `ACME Logistics LLC`
 (continuity-object assertion — must match the Phase 2 hero broker, not any broker), clicks it, then clicks
 each of the 6 tabs (IDENTITY, CONTACTS, CATALOG, RATES, CONSTRAINTS, DOCS) and asserts content is visible
 in each.
 - R-P4-07 [unit]: grep components/NetworkPortal.tsx, services/networkService.ts, server/routes/clients.ts
 HEAD vs sprint-end shows zero diff.

 Verification command:
 cd server && npx vitest run __tests__/scripts/seed-sales-demo-parties.test.ts
 __tests__/integration/sales-demo-network-portal.test.ts && cd .. && set E2E_SERVER_RUNNING=1&& npx playwright
  test e2e/sales-demo/03-network-portal-walkthrough.spec.ts

 ---
 Phase 5 — Demo-Blocker Regression Tests (no production-code edits)

 Goal: Lock down the three demo-blocker concerns from the brief (SafetyView fake KPI, FleetMap env-var leak,
 Quotes 403) with regression tests so they cannot regress. Discovery showed two of them are already correct in
  the code; this phase asserts they stay correct. The third is handled by Phase 6's nav allowlist (Quotes is
 hidden in demo mode).

 Files (new):

 Path: __tests__/components/SafetyView.sales-demo.test.tsx
 Purpose: Render with operators=[], assert Non-Compliant tile shows the empty-state value (verified by Agent
   finding) and never renders the literal string "13". Render with 5 compliant operators, assert tile shows
 "0"
    and "All Clear".
 ────────────────────────────────────────
 Path: __tests__/components/GlobalMapViewEnhanced.sales-demo.test.tsx
 Purpose: Render with VITE_GOOGLE_MAPS_API_KEY="", assert fallback data-testid="map-fallback" is present and
   the substring "VITE_GOOGLE_MAPS_API_KEY" does not appear anywhere in the rendered DOM.
 ────────────────────────────────────────
 Path: __tests__/components/GoogleMapsAPITester.sales-demo.test.tsx
 Purpose: Render GoogleMapsAPITester (the actual debug page that DOES expose the env var name) and assert it
 is
   hidden by Phase 6's allowlist test (cross-references Phase 6).

 Files (existing) extended: docs/sales-demo-seed-contract.md — append section ## Quotes route disposition
 explaining the route is hidden by Phase 6 nav filter, not deleted, and root cause of the 403 is
 environment-specific user/tenant mapping.

 Acceptance criteria:
 - R-P5-01 [unit]: SafetyView with operators=[] does not render the substring "13" anywhere in the DOM.
 - R-P5-02 [unit]: SafetyView with 5 compliant operators renders "0" and "All Clear" in the Non-Compliant
 tile.
 - R-P5-03 [unit]: GlobalMapViewEnhanced fallback DOM never contains the substring "VITE_GOOGLE_MAPS_API_KEY".
 - R-P5-04 [unit]: docs/sales-demo-seed-contract.md contains a ## Quotes route disposition H2 section.
 - R-P5-05 [unit]: grep components/SafetyView.tsx, components/GlobalMapViewEnhanced.tsx HEAD vs sprint-end
 shows zero diff.

 Verification command:
 npx vitest run __tests__/components/SafetyView.sales-demo.test.tsx
 __tests__/components/GlobalMapViewEnhanced.sales-demo.test.tsx
 __tests__/components/GoogleMapsAPITester.sales-demo.test.tsx && cd server && npx vitest run
 __tests__/docs/sales-demo-seed-contract.test.ts

 ---
 Phase 6 — Demo Shell: Nav Allowlist + Reset Button + Reset Endpoint (the only production-code touch)

 Goal: When VITE_DEMO_NAV_MODE=sales, the App.tsx nav renders only the demo-safe routes (using the real route
 keys) plus a Reset Demo button that POSTs to a triple-locked /api/demo/reset endpoint. Production users (no
 env var set) see byte-for-byte identical behavior.

 This is the only phase that touches production source code. Two files change: App.tsx (nav filter + reset
 button) and server/index.ts (one-line route mount). Both changes are env-flag-gated.

 Files (new):

 Path: services/demoNavConfig.ts
 Purpose: Pure config. Exports DEMO_NAV_ALLOWLIST =
   ['operations-hub','loads','calendar','network','accounting','exceptions'] as const and isDemoNavMode = ()
 =>
    import.meta.env.VITE_DEMO_NAV_MODE === 'sales'. Real route keys only, no fictional ones.
 ────────────────────────────────────────
 Path: __tests__/services/demoNavConfig.test.ts
 Purpose: Asserts allowlist contains exactly the 6 keys, isDemoNavMode() true/false branches.
 ────────────────────────────────────────
 Path: __tests__/App.demo-nav.test.tsx
 Purpose: Renders App with stubbed env. Demo-mode-off: assert Telematics and Company Settings nav items
   present. Demo-mode-on: assert they are absent, Reset Demo button present.
 ────────────────────────────────────────
 Path: server/routes/demo.ts
 Purpose: New router. POST /api/demo/reset triple-locked: (1) requireAuth, (2) req.user.role === 'admin', (3)
   req.user.tenantId === 'SALES-DEMO-001', (4) process.env.ALLOW_DEMO_RESET === '1'. On all 4 conditions,
   dynamically await import('../scripts/reset-sales-demo') and run resetSalesDemo. Returns { ok: true, summary

   } or 403 with explanatory error field.
 ────────────────────────────────────────
 Path: server/__tests__/routes/demo.test.ts
 Purpose: Integration tests: 401 unauth, 403 non-admin, 403 wrong tenant, 403 missing env, 200 with mocked
   resetSalesDemo returning a sentinel summary.
 ────────────────────────────────────────
 Path: docs/sales-demo-runbook.md
 Purpose: Salesperson runbook. 8 H2 sections required by tests:
   ## Two Chrome profiles
   ## Setting demo nav mode (.env.local)
   ## Resetting between demos
   ## Recovery from accidental URL
   ## Firebase user provisioning prerequisite
   ## Live Gemini disclaimer
   ## Certified Core demo script (6 steps)
   ## Wow Appendix — Optional live driver upload
   The last two sections mirror the narrative + table from PLAN.md so the salesperson has a single
   document to read on stage. Each hero step in the Certified Core section includes its
   "Business outcome" line verbatim.
 ────────────────────────────────────────
 Path: server/__tests__/docs/sales-demo-runbook.test.ts
 Purpose: Doc-as-spec test for the 6 H2 sections.

 Files (existing) extended:

 Path: App.tsx
 What changes (precise diff scope): Add 1 import line (demoNavConfig). In the nav-rendering block (around line

   866), wrap the categories[].items filter so when isDemoNavMode(), items not in DEMO_NAV_ALLOWLIST are
   dropped. Inside the filter, when isDemoNavMode() && currentUser.role === 'admin', append a synthetic Reset
   Demo nav item (id demo-reset, custom onClick that POSTs to /api/demo/reset and toasts the result). No other

   lines touched. Total diff < 30 lines.
 ────────────────────────────────────────
 Path: server/index.ts
 What changes (precise diff scope): Add 2 lines (1 import, 1 mount): import demoRouter from './routes/demo';
   and app.use('/api/demo', demoRouter);. Mount only when process.env.ALLOW_DEMO_RESET === '1' so production
   never registers the route at all.

 Acceptance criteria:
 - R-P6-01 [unit]: isDemoNavMode() returns true iff VITE_DEMO_NAV_MODE === 'sales'.
 - R-P6-02 [unit]: DEMO_NAV_ALLOWLIST deep-equals exactly
 ['operations-hub','loads','calendar','network','accounting','exceptions'] (toEqual on literal array).
 - R-P6-03 [unit]: App.tsx with demo mode off renders Telematics, Company Settings, Issues & Alerts,
 Operations Center nav items (production-untouched proof).
 - R-P6-04 [unit]: App.tsx with demo mode on renders only the 6 allowlisted nav items + Reset Demo button;
 Telematics and Company Settings are absent.
 - R-P6-05 [integration]: POST /api/demo/reset returns 401 unauthenticated, 403 for non-admin, 403 for
 non-SALES-DEMO-001 tenant, 403 when ALLOW_DEMO_RESET env unset.
 - R-P6-06 [integration]: POST /api/demo/reset returns 200 with ok: true when all 4 gates pass and the inner
 resetSalesDemo (mocked to return a sentinel) runs.
 - R-P6-07 [unit]: docs/sales-demo-runbook.md contains all 8 required H2 sections: "## Two Chrome
 profiles", "## Setting demo nav mode (.env.local)", "## Resetting between demos", "## Recovery from
 accidental URL", "## Firebase user provisioning prerequisite", "## Live Gemini disclaimer",
 "## Certified Core demo script (6 steps)", "## Wow Appendix — Optional live driver upload". Assert
 via regex match on each H2 line.
 - R-P6-08 [unit]: App.tsx diff vs HEAD is < 30 added lines and 0 removed lines (live-functions-only
 minimal-touch guarantee — assert via git diff --numstat App.tsx).
 - R-P6-09 [unit]: server/index.ts diff vs HEAD is exactly 2 added lines (the import + the conditional mount).

 Verification command:
 npx vitest run __tests__/services/demoNavConfig.test.ts __tests__/App.demo-nav.test.tsx && cd server && npx
 vitest run __tests__/routes/demo.test.ts __tests__/docs/sales-demo-runbook.test.ts

 ---
 Phase 7 — Windows-Safe Certification Pipeline (e2e)

 Goal: A single npm script (demo:certify:sales) runs against a freshly seeded sales-demo tenant on Windows,
 executes the 3 hero Playwright specs from Phases 2/3/4 plus a smoke spec, and writes a timestamped pass
 record into docs/release/evidence.md. No cross-env, no /tmp, no Unix-only env syntax.

 Files (new):

 Path: e2e/sales-demo/00-smoke.spec.ts
 Purpose: Bare-minimum smoke. Asserts /api/health 200, login as sales-demo admin succeeds (skip with clear
   message if FIREBASE_WEB_API_KEY unset), homepage h1 visible. Catches catastrophic infrastructure failures
   before the 3 hero specs run.
 ────────────────────────────────────────
 Path: e2e/sales-demo/README.md
 Purpose: One-page guide. Lists the 4 specs in order, the env vars required, the Windows + Unix invocation
   commands, the Firebase user provisioning prerequisite.
 ────────────────────────────────────────
 Path: scripts/demo-certify.cjs
 Purpose: Tiny Node script (no deps, .cjs so no ESM resolution issues on Windows). Reads .env.local via fs,
   spawns npx ts-node --transpile-only server/scripts/reset-sales-demo.ts then spawns npx playwright test
   e2e/sales-demo/, captures stdout to <os.tmpdir()>/sales-demo-cert-<timestamp>.log, then appends the last 50

   lines of the log to docs/release/evidence.md under a ## Sales Demo Certification H2 section with timestamp.

   Exits with the spawned playwright exit code. Uses os.tmpdir() not /tmp.
 ────────────────────────────────────────
 Path: __tests__/scripts/demo-certify.test.ts
 Purpose: Unit tests against demo-certify.cjs using temp dirs: appends correctly under the heading, exits
   non-zero on missing input, handles empty Playwright output gracefully.
 ────────────────────────────────────────
 Path: server/__tests__/docs/sales-demo-e2e-readme.test.ts
 Purpose: Doc-as-spec: e2e/sales-demo/README.md lists ≥4 spec filenames.

 Files (existing) extended:

 ┌─────────────────────────────────────────────────┬──────────────────────────────────────────────────────┐
 │                      Path                       │                     What changes                     │
 ├─────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
 │                                                 │ Add "demo:certify:sales": "node                      │
 │ package.json (root)                             │ scripts/demo-certify.cjs" (single command, no env    │
 │                                                 │ vars in the script value — .env.local carries them). │
 ├─────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
 │ docs/release/evidence.md                        │ Append empty ## Sales Demo Certification H2 heading  │
 │                                                 │ section. Runtime appends from demo-certify.cjs.      │
 ├─────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
 │ server/__tests__/docs/release-evidence.test.ts  │ Doc-as-spec: ## Sales Demo Certification H2 present. │
 │ (new)                                           │                                                      │
 └─────────────────────────────────────────────────┴──────────────────────────────────────────────────────┘

 Acceptance criteria:
 - R-P7-01 [unit]: scripts/demo-certify.cjs appends a ### <timestamp> block under ## Sales Demo Certification
 with the last 50 lines of input log.
 - R-P7-02 [unit]: scripts/demo-certify.cjs exits 1 when the input log file is missing.
 - R-P7-03 [unit]: scripts/demo-certify.cjs source contains zero references to /tmp (regex assertion);
 references os.tmpdir() instead.
 - R-P7-04 [e2e]: e2e/sales-demo/00-smoke.spec.ts passes against the seeded sales-demo tenant when
 FIREBASE_WEB_API_KEY is set; gracefully test.skips with a clear message when not.
 - R-P7-05 [unit]: e2e/sales-demo/README.md lists all 4 specs (00-smoke, 01-document-automation,
 02-ifta-walkthrough, 03-network-portal-walkthrough).
 - R-P7-06 [unit]: package.json demo:certify:sales script value is exactly node scripts/demo-certify.cjs (no
 Unix env syntax, no cross-env, no &&).
 - R-P7-07 [unit]: docs/release/evidence.md contains ## Sales Demo Certification H2.

 Verification command:
 npx vitest run __tests__/scripts/demo-certify.test.ts && cd server && npx vitest run
 __tests__/docs/sales-demo-e2e-readme.test.ts __tests__/docs/release-evidence.test.ts && cd .. && npm run
 demo:certify:sales

 ---
 File Inventory (extend vs create) — final, verified

 Extended (existing files modified) — only 4 files in the entire SaaS source touched:

 ┌──────────────────────────┬──────────┬───────────────────────────────────────────────────────────────────┐
 │           File           │ Phase(s) │                            Diff scope                             │
 ├──────────────────────────┼──────────┼───────────────────────────────────────────────────────────────────┤
 │ package.json (root)      │ 1, 7     │ 3 added script lines (demo:reset:sales, demo:seed:sales,          │
 │                          │          │ demo:certify:sales)                                               │
 ├──────────────────────────┼──────────┼───────────────────────────────────────────────────────────────────┤
 │ App.tsx                  │ 6        │ < 30 added lines: 1 import + nav filter wrapper + reset button    │
 │                          │          │ injection (all if (isDemoNavMode()) gated)                        │
 ├──────────────────────────┼──────────┼───────────────────────────────────────────────────────────────────┤
 │ server/index.ts          │ 6        │ 2 added lines: import + conditional ALLOW_DEMO_RESET mount        │
 ├──────────────────────────┼──────────┼───────────────────────────────────────────────────────────────────┤
 │ docs/release/evidence.md │ 7        │ 1 added H2 heading line                                           │
 └──────────────────────────┴──────────┴───────────────────────────────────────────────────────────────────┘

 New files — all under server/scripts/, server/__tests__/, __tests__/, e2e/sales-demo/, services/, scripts/,
 and docs/:

 Category: Seed scripts
 Files: server/scripts/seed-sales-demo.ts, seed-sales-demo-loads.ts, seed-sales-demo-ifta.ts,
   seed-sales-demo-parties.ts, reset-sales-demo.ts
 ────────────────────────────────────────
 Category: Fixture data
 Files: server/scripts/sales-demo-fixtures/sales-demo-data.json, loads/LP-DEMO-RC-001.json,
   loads/extracted-fields.md, ifta-q4-2025.json, parties.json
 ────────────────────────────────────────
 Category: Server tests
 Files: server/__tests__/scripts/seed-sales-demo.test.ts, reset-sales-demo.test.ts,
   seed-sales-demo-loads.test.ts, seed-sales-demo-ifta.test.ts, seed-sales-demo-parties.test.ts,
   __tests__/integration/sales-demo-load-readback.test.ts, sales-demo-ifta-summary.test.ts,
   sales-demo-network-portal.test.ts, __tests__/middleware/sales-demo-tier-audit.test.ts,
   __tests__/routes/demo.test.ts, __tests__/docs/sales-demo-seed-contract.test.ts, sales-demo-runbook.test.ts,

   sales-demo-e2e-readme.test.ts, release-evidence.test.ts
 ────────────────────────────────────────
 Category: Frontend tests
 Files: __tests__/services/demoNavConfig.test.ts, __tests__/App.demo-nav.test.tsx,
   __tests__/components/SafetyView.sales-demo.test.tsx, GlobalMapViewEnhanced.sales-demo.test.tsx,
   GoogleMapsAPITester.sales-demo.test.tsx, __tests__/scripts/demo-certify.test.ts
 ────────────────────────────────────────
 Category: New runtime files
 Files: services/demoNavConfig.ts (frontend), server/routes/demo.ts (backend), scripts/demo-certify.cjs (root)
 ────────────────────────────────────────
 Category: e2e specs
 Files: e2e/sales-demo/00-smoke.spec.ts, 01-document-automation.spec.ts, 02-ifta-walkthrough.spec.ts,
   03-network-portal-walkthrough.spec.ts, README.md
 ────────────────────────────────────────
 Category: Docs
 Files: docs/sales-demo-seed-contract.md, docs/sales-demo-runbook.md

 Files explicitly NOT touched (live-functions-only proof; will be asserted by R-markers and grep snapshots):
 server/routes/ai.ts, server/routes/clients.ts, server/routes/contacts.ts, server/routes/documents.ts,
 server/routes/accounting.ts, server/routes/quotes.ts, server/routes/leads.ts,
 server/services/gemini.service.ts, server/services/document.service.ts, server/services/ocr.service.ts,
 server/middleware/requireAuth.ts, server/middleware/requireTier.ts, server/middleware/requireTenant.ts,
 server/lib/sql-auth.ts, server/scripts/seed-demo.ts, server/scripts/seed-demo-data.json, every existing
 migration, components/Scanner.tsx, components/DriverMobileHome.tsx, components/IFTAManager.tsx,
 components/IFTAEvidenceReview.tsx, components/AccountingPortal.tsx, components/NetworkPortal.tsx,
 services/networkService.ts, components/SafetyView.tsx, components/GlobalMapViewEnhanced.tsx,
 components/LoadBoardEnhanced.tsx.

 ---
 Ralph prd.json specification block (drop-in ready)

 This section is the authoritative source for the new .claude/prd.json after plan approval. The story shape
 mirrors the current prd.json schema (verified against the production-readiness sprint at
 .claude/prd.production-readiness.completed.json).

 Top-level fields:
 {
   "version": "2.0",
   "planRef": ".claude/docs/PLAN.md",
   "conventionsRef": ".claude/docs/knowledge/conventions.md",
   "plan_hash": "<SHA-256 of the corrected PLAN.md after this plan is committed there>",
   "stories": [ /* 7 stories below */ ]
 }

 Story manifest — every field needed for prd.json:

 Story: S-001 Independent Sales-Demo Seed Pipeline
 Phase: 1
 Type: foundation
 parallelGroup: 0
 dependsOn: []
 Scope (files): seed-sales-demo.ts, reset-sales-demo.ts, sales-demo-data.json, package.json,
   sales-demo-seed-contract.md + 4 test files
 gateCmd: Phase 1 verification command
 ────────────────────────────────────────
 Story: S-002 Pre-Seeded Document Automation Hero
 Phase: 2
 Type: module
 parallelGroup: 1
 dependsOn: [S-001]
 Scope (files): seed-sales-demo-loads.ts, LP-DEMO-RC-001.json, extracted-fields.md, seed-sales-demo.ts
 (extend)
   + 3 test/spec files
 gateCmd: Phase 2 verification command
 ────────────────────────────────────────
 Story: S-003 IFTA Evidence Seed + Real-UI Walkthrough
 Phase: 3
 Type: integration
 parallelGroup: 1
 dependsOn: [S-001, S-002]
 Scope (files): seed-sales-demo-ifta.ts, ifta-q4-2025.json, seed-sales-demo.ts (extend) + 3 test/spec files
 gateCmd: Phase 3 verification command
 ────────────────────────────────────────
 Story: S-004 CRM Registry Depth (real /api/parties)
 Phase: 4
 Type: integration
 parallelGroup: 1
 dependsOn: [S-001]
 Scope (files): seed-sales-demo-parties.ts, parties.json, seed-sales-demo.ts (extend) + 3 test/spec files
 gateCmd: Phase 4 verification command
 ────────────────────────────────────────
 Story: S-005 Demo-Blocker Regression Tests
 Phase: 5
 Type: module
 parallelGroup: 1
 dependsOn: [S-001]
 Scope (files): 3 frontend test files + sales-demo-seed-contract.md (extend)
 gateCmd: Phase 5 verification command
 ────────────────────────────────────────
 Story: S-006 Demo Shell + Reset Endpoint
 Phase: 6
 Type: integration
 parallelGroup: 1
 dependsOn: [S-001]
 Scope (files): demoNavConfig.ts, App.tsx (extend), server/routes/demo.ts, server/index.ts (extend),
   sales-demo-runbook.md + 4 test files
 gateCmd: Phase 6 verification command
 ────────────────────────────────────────
 Story: S-007 Windows-Safe Certification Pipeline
 Phase: 7
 Type: e2e
 parallelGroup: 2
 dependsOn: [S-002, S-003, S-004, S-006]
 Scope (files): scripts/demo-certify.cjs, e2e/sales-demo/00-smoke.spec.ts, e2e/sales-demo/README.md,
   package.json (extend), docs/release/evidence.md (extend) + 3 test files
 gateCmd: Phase 7 verification command

 Story field defaults (apply to every story unless noted):
 - passed: false
 - verificationRef: "verification-log.jsonl"
 - complexity: simple for S-005, medium for S-001/S-002/S-005/S-007, complex for S-003/S-004/S-006
 - maxTurns: 100 for simple/medium, 200 for complex
 - component: server/ for S-001/S-002/S-003/S-004, frontend+server/ for S-005/S-006/S-007

 Dependency graph (for ralph parallel dispatch):
 S-001 (group 0, no deps)
   └→ S-002, S-003, S-004, S-005, S-006 (group 1, all depend only on S-001 — eligible for parallel batch)
        │  Note: S-003 also depends on S-002 because Phase 3 IFTA evidence references the load LP-DEMO-RC-001
 from Phase 2
        │  → effective parallel set in group 1 = {S-002, S-004, S-005, S-006}, then S-003 after S-002
        └→ S-007 (group 2, depends on S-002 + S-003 + S-004 + S-006 — runs last)

 With parallel_dispatch_enabled: true and parallel_batch_size: 3 (verified in .claude/workflow.json), ralph
 will dispatch S-001, then a batch of {S-002, S-004, S-005} or {S-002, S-004, S-006} (3 at a time), then the
 remainder, then S-003 once S-002 completes, then S-007.

 R-marker totals (for plan-vs-prd cross-check during validation):
 - S-001: R-P1-01..12 (12) — added R-P1-09 (explicit DELETE list), R-P1-10 (idempotent reset) as
   correction #1; added R-P1-11 (.env.example.sales-demo) and R-P1-12 (single .env.local contract) as
   correction #3 (env source unification)
 - S-002: R-P2-01..13 (13) — split prior R-P2-01 into customers + loads INSERTs (R-P2-01 + R-P2-02);
   added R-P2-08 (snapshot grep covering LoadDetailView, brokerService) as part of correction #2/#3;
   added R-P2-09..11 (real PDF artifacts: fixtures-on-disk, seed-copies-to-upload-dir, live download
   endpoint returns real binary) and R-P2-12..13 (canonical document mapping fix: repository aliases
   original_filename→filename and document_type→type, e2e asserts no 'undefined' in doc cards) as
   part of the wow-upgrade pass
 - S-003: R-P3-01..07 (7) — added R-P3-02 (load_id linkage assert), R-P3-03 (zero equipment INSERTs),
   renumbered remaining markers as part of correction #4. All accounting/IFTA SQL uses company_id
   (verified against migration 038); fuel_ledger uses entry_date (verified against migration 011).
 - S-004: R-P4-01..07 (7) — R-P4-01 + R-P4-06 strengthened to require ACME Logistics LLC as one of
   the 2 seeded brokers (continuity object — same broker as the Phase 2 hero load)
 - S-005: R-P5-01..05 (5)
 - S-006: R-P6-01..09 (9) — R-P6-07 expanded from 6 to 8 required H2 sections in the runbook
   (adds Certified Core demo script + Wow Appendix)
 - S-007: R-P7-01..07 (7)
 - Total: 60 R-markers (was 48 in original plan → 53 → 55 → 60 after the wow-upgrade pass added
   5 new Phase 2 markers for real artifacts + canonical doc mapping)

 ---
 Ralph alignment checklist (post plan-mode-exit, executed in order)

 1. Backup current prd.json → cp .claude/prd.json .claude/prd.production-readiness.completed.json (already
 done before plan mode locked editing — file is on disk).
 2. Replace .claude/docs/PLAN.md with the content of this plan file (the entire body above the "Ralph
 alignment checklist" section, plus this checklist re-stated, becomes the new PLAN.md).
 3. Compute new plan_hash: python -c "import hashlib;
 print(hashlib.sha256(open('.claude/docs/PLAN.md','rb').read()).hexdigest())" and use the result as the
 plan_hash field in prd.json.
 4. Write the new .claude/prd.json from the spec block above. 7 stories, 60 R-markers, the dependency
   graph as listed.
 5. Reset .claude/.workflow-state.json ralph section: clear feature_branch (empty string so ralph creates
 ralph/bulletproof-sales-demo on first dispatch), clear current_story_id, set current_attempt: 0, clear
 current_step, set stories_passed: 0, set stories_skipped: 0, set consecutive_skips: 0, clear
 prior_failure_summary, clear checkpoint_hash, clear cumulative_drift_warnings. Leave max_attempts: 4.
 6. Validate plan-vs-prd alignment with these greps:
   - grep -c "R-P[1-7]-[0-9]\{2\}" .claude/docs/PLAN.md should equal grep -c '"id": "R-P' .claude/prd.json
   should equal 60.
   - For every R-marker in PLAN.md, the same id appears in prd.json (use comm against sorted lists).
   - For every scope file in prd.json, the path appears in PLAN.md (paste-in check).
   - The plan_hash in prd.json equals sha256(.claude/docs/PLAN.md).
   - No story in prd.json has passed: true (fresh sprint).
 7. First /ralph invocation dispatches S-001 (foundation, no deps) on the new ralph/bulletproof-sales-demo
 branch.

 ---
 Verification (end-to-end, after the sprint completes)

 The sprint is "salesperson-shippable" when ALL of the following are true on the developer machine:

 1. npm run demo:reset:sales exits 0 (Phase 1 + the inner Phase 2/3/4 seed steps).
 2. cd server && npx vitest run __tests__/scripts/seed-sales-demo*.test.ts
 __tests__/integration/sales-demo-*.test.ts __tests__/middleware/sales-demo-tier-audit.test.ts
 __tests__/routes/demo.test.ts __tests__/docs/sales-demo-*.test.ts exits 0.
 3. npx vitest run __tests__/services/demoNavConfig.test.ts __tests__/App.demo-nav.test.tsx
 __tests__/components/SafetyView.sales-demo.test.tsx
 __tests__/components/GlobalMapViewEnhanced.sales-demo.test.tsx __tests__/scripts/demo-certify.test.ts exits
 0.
 4. npm run demo:certify:sales exits 0 (runs reset + 4 specs + appends to evidence.md).
 5. git diff main -- server/routes/ai.ts server/services/gemini.service.ts server/services/document.service.ts
  server/middleware/requireAuth.ts server/middleware/requireTier.ts server/lib/sql-auth.ts
 server/scripts/seed-demo.ts components/Scanner.tsx components/DriverMobileHome.tsx components/IFTAManager.tsx
  components/IFTAEvidenceReview.tsx components/AccountingPortal.tsx components/NetworkPortal.tsx
 services/networkService.ts components/SafetyView.tsx components/GlobalMapViewEnhanced.tsx
 components/LoadBoardEnhanced.tsx shows zero diff — proves live-functions-only. NOTE:
 server/repositories/document.repository.ts is DELIBERATELY EXCLUDED from this zero-diff list — it is
 the single production-code relaxation this sprint (≤ 10-line mapping that aliases original_filename →
 filename and document_type → type; see Phase 2 R-P2-12). No other production file is touched.
 6. STRETCH GATE (not blocking, runs nightly or pre-release): the full prior 6,432-test regression suite
   still passes (cd server && npx vitest run and npx vitest run from root). This is a stretch gate
   because (a) it covers the entire SaaS scope, far broader than this sprint's blast radius, and (b) the
   live-functions-only constraint plus the surgical diffs in Phase 6 (App.tsx <30 lines, server/index.ts
   2 lines) make broad regressions structurally unlikely. If a regression is found, it must be unrelated
   to this sprint and gets a separate bug ticket — it does NOT block sprint sign-off. The mandatory blocking
   gates are steps 1-5 above plus the full Playwright certify run in step 4.

 ---
 Certified Core Demo Script — 6 steps (lead with the pain, not the dashboard)

 Narrative opening (read aloud before clicking anything):
 *"Your driver just sent paperwork from the cab. Watch what happens next — the system has already
 extracted the load details, filed the IFTA evidence, and cross-referenced the broker in your CRM.
 You never touched a keyboard for this load."*

 The certified core is the **guaranteed path**. Every step below is covered by a Phase 2-6 test that
 runs as part of `npm run demo:certify:sales`. If any step breaks, `demo:certify:sales` fails and the
 sprint is not done.

 ┌──────┬─────────┬──────────────────────────────────────────────────────────────────┬───────────┬──────────────────────────────────────────────┐
 │ Step │ Window  │                              Action                             │ Validates │ Business outcome sales should say out loud   │
 ├──────┼─────────┼──────────────────────────────────────────────────────────────────┼───────────┼──────────────────────────────────────────────┤
 │ 1    │ Admin   │ Click Reset Demo in nav → toast "Demo reset complete"            │ Phase 1+6 │ "Clean slate — every buyer sees the same    │
 │      │ Chrome  │                                                                  │           │  outcome on stage."                          │
 ├──────┼─────────┼──────────────────────────────────────────────────────────────────┼───────────┼──────────────────────────────────────────────┤
 │ 2    │ Admin   │ nav-loads → open LP-DEMO-RC-001 → narrate the seeded broker     │ Phase 2   │ "This load came in from a driver's          │
 │      │ Chrome  │ (ACME Logistics LLC), commodity (Frozen Beef, 42,500 lbs), rate │           │  paperwork. The AI pulled every field —     │
 │      │         │ ($3,250), route (Houston → Chicago). Click Documents → open     │           │  zero manual entry. The documents are       │
 │      │         │ Rate Con card → click Download → real PDF opens.                │           │  downloadable right now."                    │
 │      │         │                                                                  │           │  **Outcome: manual entry avoided**           │
 ├──────┼─────────┼──────────────────────────────────────────────────────────────────┼───────────┼──────────────────────────────────────────────┤
 │ 3    │ Admin   │ nav-accounting → Fuel & IFTA tab → Q4 → 2025 → click the        │ Phase 3   │ "Same trip, different hat. This is now your │
 │      │ Chrome  │ LP-DEMO-RC-001 card → wait for Computed Jurisdiction Split      │           │  Q4 IFTA evidence — 6 jurisdictions, fuel   │
 │      │         │ (auto-runs) → check attest → Lock Trip for Audit → success      │           │  purchases, mileage split — and it's        │
 │      │         │ toast. Say: "This is the same LP-DEMO-RC-001 trip from step 2". │           │  audit-locked in one click."                 │
 │      │         │                                                                  │           │  **Outcome: multi-state IFTA quarter ready** │
 ├──────┼─────────┼──────────────────────────────────────────────────────────────────┼───────────┼──────────────────────────────────────────────┤
 │ 4    │ Admin   │ nav-network → locate row `ACME Logistics LLC` (the SAME broker  │ Phase 4   │ "And here is that same ACME Logistics       │
 │      │ Chrome  │ from step 2) → click it → walk all 6 tabs                        │           │  record in our trucking-aware CRM — one     │
 │      │         │ (IDENTITY/CONTACTS/CATALOG/RATES/CONSTRAINTS/DOCS) → each tab   │           │  registry across brokers, customers,        │
 │      │         │ shows seeded data for THIS broker.                               │           │  vendors, facilities, and contractors."     │
 │      │         │                                                                  │           │  **Outcome: one registry across broker /    │
 │      │         │                                                                  │           │  customer / vendor / facility / contractor**│
 ├──────┼─────────┼──────────────────────────────────────────────────────────────────┼───────────┼──────────────────────────────────────────────┤
 │ 5    │ Admin   │ Walk the nav bar and confirm Telematics, Company Settings,      │ Phase 6   │ "Demo mode hides modules that are not       │
 │      │ Chrome  │ Issues & Alerts, Dashboard, Quotes, and all operations-hub-     │           │  certified for today — the customer only    │
 │      │         │ adjacent items are not present (allowlist works).                │           │  sees what we have proved."                  │
 ├──────┼─────────┼──────────────────────────────────────────────────────────────────┼───────────┼──────────────────────────────────────────────┤
 │ 6    │ Admin   │ At end of demo, click Reset Demo again → refresh → confirm the  │ Phase 1+6 │ "Reset is one click and idempotent — the    │
 │      │ Chrome  │ exact same state is ready for the next buyer.                    │           │  next buyer sees the exact same thing."     │
 └──────┴─────────┴──────────────────────────────────────────────────────────────────┴───────────┴──────────────────────────────────────────────┘

 **Continuity rule for sales**: step 2's broker, step 3's trip, and step 4's CRM record MUST all
 refer to the same object. If step 4 opens a different broker than `ACME Logistics LLC`, the demo
 has regressed — file an issue before running it again. The Phase 4 Playwright spec (R-P4-06)
 enforces this programmatically by drilling into ACME by name.

 ---
 Wow Appendix — Optional live driver upload (NOT certified)

 The certified core above always works. The wow appendix is a **second, optional path** that lets
 sales do a real live upload in front of the buyer for maximum impact. It uses live Gemini extraction
 so it has real model variability: if Gemini is slow, returns partial data, or rate-limits, the
 fallback is the backup 20-30 second screen recording below. Do NOT run this path unless Gemini
 has been pre-flight-tested in the last hour.

 Setup (do BEFORE the buyer arrives):
 1. Open a second Chrome profile (Menu → Add profile → "DisbatchMe Driver").
 2. In that profile, log in as `SALES_DEMO_DRIVER_FIREBASE_UID`. Leave the tab parked on driver mobile
    home (App.tsx routes the driver role to DriverMobileHome on line ~761).
 3. Keep a real PDF of a rate confirmation or BOL on your laptop at `%USERPROFILE%\sales-demo-upload.pdf`.
 4. Alt-Tab between the admin Chrome profile (for the certified core) and the driver Chrome profile
    (for the appendix). The buyer sees two real windows, not a tabbed fake.

 Execution (1-2 minutes, after step 4 of the certified core):
 1. Switch to the driver Chrome profile.
 2. Open the Scanner (DriverMobileHome → Scan Document button).
 3. Upload `sales-demo-upload.pdf` — this hits POST /api/ai/extract-load live.
 4. Wait for extraction (≤ 10 seconds typical). Narrate: *"The driver just did one tap. The AI is
    extracting commodity, weight, facilities, and rate from the raw document."*
 5. When extraction returns, a new load appears in the driver's load list AND — switch to admin
    Chrome — in the admin's load board. Narrate: *"One tap. Zero manual entry. Dispatch already
    sees it."*
 6. Optional: open the new load's Documents panel to show the uploaded PDF is attached.

 Failure recovery: if Gemini takes > 15 seconds OR returns obvious garbage, press Alt-Tab back to
 admin Chrome and say: *"Gemini is having a moment — let me show you what it looks like when it
 works."* Then play `docs/sales-demo-backup-assets/04-wow-appendix-live-upload.mp4` (see Backup Assets
 below) on the admin screen. Do not apologize. Do not open the terminal.

 ---
 Backup Assets

 Sales must keep one screenshot AND one 20-30 second screen recording per hero flow for fallback.
 These are NOT committed as code artifacts — they are captured manually by sales after running
 the certified core once. Reserve directory: `docs/sales-demo-backup-assets/` (gitignored).

 | File                                       | Captures                                         |
 | ------------------------------------------ | ------------------------------------------------- |
 | 01-load-detail-seeded.png                  | Step 2: LP-DEMO-RC-001 load detail panel         |
 | 01-load-detail-documents.png               | Step 2: documents panel with 3 labeled cards     |
 | 02-ifta-jurisdiction-split.png             | Step 3: IFTAEvidenceReview computed split        |
 | 02-ifta-audit-locked.png                   | Step 3: post-audit-lock success state            |
 | 03-network-acme-tabs.png                   | Step 4: NetworkPortal showing ACME's 6 tabs      |
 | 04-wow-appendix-live-upload.mp4 (20-30s)   | Driver mobile → scan → load appears in admin    |

 If any backup asset file is missing when sales starts the demo, do NOT run the wow appendix.
 The certified core still works without these assets, but the appendix must have the video fallback.

 ---
 Risks & mitigations (refreshed)

 Risk: Ralph regenerates prd.json from a stale PLAN.md and the plan_hash mismatches
 Likelihood: Medium
 Impact: High
 Mitigation: Step 2 of the alignment checklist explicitly replaces PLAN.md before computing the hash. Step 6
   grep validation catches mismatches before /ralph runs.
 ────────────────────────────────────────
 Risk: Phase 2 seeded load is not visible on Load Board because LoadBoardEnhanced filters by tenant
 role/status
   differently than expected
 Likelihood: Low
 Impact: High
 Mitigation: Phase 2 integration test (R-P2-05) calls the live GET /api/loads/:id endpoint, not just the seed
 —
   failure surfaces in unit tests, not on stage.
 ────────────────────────────────────────
 Risk: Phase 3 IFTA Playwright spec flakes because the analysis auto-runs and may complete before Playwright's

   first wait
 Likelihood: Medium
 Impact: Medium
 Mitigation: Spec waits on the rendered Computed Jurisdiction Split table text, not on a state transition.
   Auto-run completes within ~500ms in prior runs of IFTAEvidenceReview.
 ────────────────────────────────────────
 Risk: Phase 4 seeds parties via direct INSERT and the parties table later requires a column the schema
 doesn't
   enforce
 Likelihood: Low
 Impact: Medium
 Mitigation: Agent A verified the schema column-by-column. Seed only inserts existing columns.
 ────────────────────────────────────────
 Risk: Phase 6 App.tsx diff exceeds 30 lines because the JSX restructure is more invasive than estimated
 Likelihood: Low
 Impact: Low
 Mitigation: R-P6-08 enforces the 30-line cap as a hard test. If it fails, refactor the filter into a small
   helper inside demoNavConfig.ts and call it from one site in App.tsx.
 ────────────────────────────────────────
 Risk: Phase 7 Windows certify script fails because Playwright's child-process env isn't inherited correctly
 Likelihood: Medium
 Impact: Low
 Mitigation: demo-certify.cjs uses child_process.spawn with env: process.env and explicitly sets
   E2E_SERVER_RUNNING=1 in the spawned env, then asserts the cert works on a CI Windows runner via R-P7-04.
 ────────────────────────────────────────
 Risk: Firebase user provisioning forgotten before first demo
 Likelihood: High
 Impact: High
 Mitigation: Phase 6 runbook has a dedicated ## Firebase user provisioning prerequisite section with
   step-by-step Firebase Console instructions. Phase 7 smoke spec gracefully skips with a clear
   "FIREBASE_WEB_API_KEY missing" message instead of failing silently.
 ────────────────────────────────────────
 Risk: Demo extraction narrative ("AI extracted these fields") feels dishonest when nothing was extracted
 Likelihood: Low
 Impact: Medium
 Mitigation: The fields ARE real — they were extracted by AI in the original product flow on a real document,
   captured to JSON, and seeded. The demo is showing real AI output, just from a previous run. The runbook
   documents this disclosure pattern.

 ---
 Open questions

 1. Firebase user UIDs for the sales-demo personas — must be created in the Firebase console and the UIDs
 pasted into .env.local as SALES_DEMO_ADMIN_FIREBASE_UID and SALES_DEMO_DRIVER_FIREBASE_UID. Decision: this is
  a manual one-time prerequisite documented in the runbook. Phase 1 validates the env vars are set and fails
 fast if not.
 2. Should the live Gemini "wow" demo path be certified? — The certified path is the seeded one. The live
 Gemini path is documented as an optional secondary flow but is not part of demo:certify:sales and is not
 gated by any test. The salesperson uses it at their own risk for extra impact.
 3. What if a demo blocker reappears that the brief did not anticipate? — Phase 5 only locks down the three
 known blockers. A new regression would need a new test added to the certify suite. The runbook tells the
 salesperson to file an issue if they hit one on stage.

 ---
 Positioning (how sales should frame the product on stage)

 These three lines are the pitch the demo is engineered to support. Every hero step below must feel
 like evidence for one of these claims:

 1. **"Your drivers send paperwork once. The system pulls the load details out for them."**
    (Evidence: step 2 of certified core + wow appendix)
 2. **"That same trip becomes compliance evidence instead of another back-office task."**
    (Evidence: step 3 of certified core — same LP-DEMO-RC-001 becomes Q4 IFTA audit)
 3. **"And all of it lives inside one trucking-aware CRM/operations system, even if trucking is only
    one part of the business."**
    (Evidence: step 4 of certified core — same ACME Logistics LLC in NetworkPortal)

 The buyer is not asking you to list features. They are asking whether your product removes work
 they currently do manually. These three statements are the answer.

 ---
 Definition of Done

 The sprint is complete when:
 - All 60 R-markers are passed=true in .claude/prd.json
 - npm run demo:certify:sales exits 0 against a fresh npm run demo:reset:sales
 - The live-functions-only diff check (Verification step 5 above) shows zero unrelated source edits
 - The salesperson 6-step script completes in under 10 minutes with zero terminal access
 - docs/release/evidence.md contains a ## Sales Demo Certification block with a recent timestamp and pass
 output
 - A PR titled feat: bulletproof sales demo (live functions only) is opened against main from
 ralph/bulletproof-sales-demo