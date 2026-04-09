# Sprint B1 — Phase 1 gap fix + Sentry + program docs + feature flags DB

> **Active sprint plan.** Full program roadmap: `docs/PLAN-trucker-app-master.md`
>
> This file contains ONLY the Sprint B1 execution contract. After B1
> merges, the handoff script replaces this file with Sprint B2's contract.

## Context

Sprint A shipped Phase 1 IFTA audit packet export (PR #59, SHA `dd8a8f4`).
B1 is the first sprint of 13 (B1 → M) that delivers the trucker mobile
app and all supporting backend, docs, telemetry, and store-launch work.

## Locked decisions (applicable to B1)

1. **Package manager**: root stays npm. `apps/trucker/` (created in B2)
   is an isolated npm subproject. Use `npm ci` (not `npm install`) in
   all verification and CI commands.

2. **Peer layout** — `apps/trucker/` is a peer directory to root
   `src/`, `components/`, `services/`. Web app stays exactly where it
   is.

3. **Phase 1 gap fix is additive** — Sprint A's `tax_year`,
   `packet_hash`, DB-blob storage is canonical. B1 adds migration
   with `aging_bucket` column, updates job, wraps in external scheduler.
   Bucket contract: `current=0`, `1_30=1..30`, `31_60=31..60`,
   `61_90=61..90`, `90_plus=>90`.

4. **Windows-safe tooling only** — All operator-run scripts are
   `.cjs`/`.mjs` (Node.js) or `.ps1` (PowerShell). NEVER `.sh`.
   All verification commands use cross-platform tools: `npx vitest run`,
   `npx tsc --noEmit`, `node scripts/*.cjs`. NEVER use `grep`, `wc`,
   `/dev/null`, `/tmp`, or shell pipelines. **All R-marker assertions
   that read a file use `fs.readFileSync` + regex — the word "grep"
   does not appear in any R-marker description.**

5. **Migration-number management**: placeholders resolved for B1:
   053 = `invoices_aging_bucket` (STORY-B1-01),
   054 = `feature_flags` (STORY-B1-09).
   Max existing migration at dispatch = 052.

6. **Feature flags consistent from B1**: `feature_flags` table
   migration + minimal read endpoint ship in B1 (so flags are
   DB-or-env from the first mobile sprint, not env-only for B2–G).

7. **Operator gates separated from Ralph R-markers.** Simulator
   validation, real-device testing, EAS builds, store submissions,
   legal review are release checklist rows signed by operator,
   NEVER Ralph R-markers.

8. **Two-layer completion**: Engineering complete (code + targeted
   tests + SaaS non-regression) vs Launch complete (+ real device
   validation + legal review + store submission).

## SaaS regression protection strategy

Every sprint that touches `server/`, `shared/contracts/`, or root
`package.json` runs the SaaS non-regression gate:

1. **Additive backend changes only** — existing routes/services/migrations
   are FROZEN unless explicitly additively extended.
2. **No web UI replacement** — web components are NOT touched.
3. **Role/tenant contract tests** — every new route runs existing
   `requireAuth` + `requireTenant` middleware tests.
4. **Existing route regression** — any sprint that touches a route file
   runs the full existing test file for that route.

## Required documents written by B1

| Doc | Content |
|---|---|
| `docs/PLAN-trucker-app-master.md` | Canonical roadmap mirror of full program plan |
| `docs/trucker-app-release-checklist.md` | All operator-run validation + release gates |
| `docs/trucker-app-baseline-debt.md` | Populated with REAL baseline failures |
| `docs/trucker-app-sprint-history.md` | Initial entry = Sprint A SHA `dd8a8f4` |
| `docs/trucker-app-env-matrix.md` | Env variable table (see content spec below) |
| `docs/trucker-app-feature-flags.md` | 6 flag inventory + DB read path |
| `docs/trucker-app-migration-numbering.md` | Placeholder rule |

### Content spec: `docs/trucker-app-env-matrix.md`

- Table with columns: `Variable`, `Category`, `Local`, `Staging`,
  `Production`, `EAS Build-time`, `Scope`, `Rotation`
- Categories: Database, Firebase, Stripe, Twilio, Sentry, PostHog,
  Motive, Gemini, JWT, EXPO_PUBLIC_*
- Rule: any `EXPO_PUBLIC_*` key is bundled into the mobile binary —
  server secrets MUST NOT use that prefix
- Secret rotation procedure

### Content spec: `docs/trucker-app-feature-flags.md`

- Flag inventory:
  - `FEATURE_TRUCKER_MOBILE_BETA` — gates whole app, default false in prod
  - `FEATURE_MOTIVE_ELD` — gates ELD integration, default false
  - `FEATURE_BROKER_CREDIT` — gates broker credit display, default false
  - `FEATURE_FACILITY_DWELL` — gates dwell export, default false
  - `FEATURE_FREEMIUM_QUOTA` — gates AI quota enforcement, default false
  - `FEATURE_FORCE_UPGRADE` — gates force-upgrade modal, default false
- Read priority: DB > env > default false
- DB read endpoint: `GET /api/feature-flags` returns merged flag map
  for current tenant
- Admin write: `PUT /api/feature-flags/:name` admin-only, tenant-scoped
- Removal criteria: 100% enabled for 30 days with no rollback → remove

## Sprint B1 Contract

**Branch**: `ralph/trucker-app-sprint-b1`
**Phases**: 1-gap + 11-partial (Sentry init) + feature-flags foundation
**Dispatch gate**: Sprint A merged (confirmed — PR #59, SHA `dd8a8f4`)
**External accounts**: None
**Story count**: 10 stories / 25 R-markers
**Operator gates**: None
**Parallelism**: STORY-01..03 sequential; 04..10 parallel (07, 08 depend on 05 for verify script)
**SaaS non-regression gate**: YES — touches `server/jobs/`, `server/index.ts`
**Mobile domain layering rule**: N/A (no mobile code)

### Stories

**STORY-B1-01 — Migration adds `aging_bucket`**
- Files (new):
  - `server/migrations/053_invoices_aging_bucket.sql`
- Test file (new):
  - `server/__tests__/migrations/053_invoices_aging_bucket.test.ts`
- R-markers:
  - `R-B1-01` test reads SQL file via `fs.readFileSync` and asserts UP
    section contains exactly one
    `ALTER TABLE ar_invoices ADD COLUMN aging_bucket VARCHAR(16) NULL`
    line via regex match.
  - `R-B1-02` test reads file via `fs.readFileSync` and asserts DOWN
    section contains exactly one
    `ALTER TABLE ar_invoices DROP COLUMN aging_bucket` and zero other
    `DROP` occurrences (regex count).

**STORY-B1-02 — Job populates `aging_bucket`**
- Files (extended):
  - `server/jobs/invoice-aging-nightly.ts` (~20 line addition)
- Test file (extended):
  - `server/__tests__/jobs/invoice-aging-nightly.test.ts` (~30 line addition)
- R-markers:
  - `R-B1-03` 5 invoice fixtures (ages 0, 15, 45, 75, 120 days) produce
    bucket assignments `current`, `1_30`, `31_60`, `61_90`, `90_plus`;
    test asserts exact values via `.toBe()`.
  - `R-B1-04` invoice with null `issued_at` → `aging_bucket` stays null
    (test asserts `.toBeNull()`).

**STORY-B1-03 — External scheduler wrapper (Windows-safe)**
- Files (new):
  - `scripts/invoice-aging-nightly.cjs`
  - `docs/ops/invoice-aging-nightly.md`
- Test file (new):
  - `server/__tests__/scripts/invoice-aging-nightly.test.ts`
- R-markers:
  - `R-B1-05` test spawns `node scripts/invoice-aging-nightly.cjs --dry-run`
    via `child_process.spawnSync`; asserts exit code 0 and stdout
    contains `"status":"dry-run"`.
  - `R-B1-06` runbook contains H2 sections `## Dry-run`,
    `## Production invocation`, `## Idempotency`, `## Failure alerting`,
    `## Cron example`, `## GitHub Actions example`, `## Rollback`;
    test reads file via `fs.readFileSync` and asserts each heading via
    regex.
  - `R-B1-07` test spawns wrapper with no `DATABASE_URL` env; asserts
    non-zero exit and stderr JSON contains `"error":"missing_database_url"`.

**STORY-B1-04 — Sentry server-side init**
- Files (extended):
  - `server/index.ts` (add `import { initSentry } from './lib/sentry'`
    + `initSentry()` call before `app.listen`, gated on DSN)
- Test file (new):
  - `server/__tests__/index.sentry-init.test.ts`
- R-markers:
  - `R-B1-08` test reads `server/index.ts` via `fs.readFileSync` and
    asserts the import line and conditional `initSentry()` call via
    regex match.
  - `R-B1-09` integration test sets `process.env.SENTRY_DSN='test-dsn'`,
    mocks `initSentry`, imports `server/index`, asserts `initSentry`
    called exactly once.
  - `R-B1-10` integration test with `SENTRY_DSN` unset → server module
    loads without throwing.

**STORY-B1-05 — Master program document + release checklist + sprint history**
- Files (extended):
  - `docs/PLAN-trucker-app-master.md` (ensure required sections exist)
- Files (new):
  - `docs/trucker-app-release-checklist.md`
  - `docs/trucker-app-sprint-history.md`
  - `scripts/verify-program-docs.cjs` (Node.js helper reading the 3
    docs and asserting required section headings exist via regex)
- R-markers:
  - `R-B1-11` master plan contains H2 sections for all 13 sprints
    (B1..M); verified by `scripts/verify-program-docs.cjs` using regex
    on file content read via `fs.readFileSync`.
  - `R-B1-12` master plan contains `## Shipped Baseline (Sprint A)`
    section; verified by helper script.
  - `R-B1-13` release checklist contains tables for operator gates
    `OP-ACCT-*`, `OP-SIM-*`, `OP-DEV-*`, `OP-EAS-*`, `OP-STORE-*`,
    `OP-LEGAL-*`; verified by helper script.
  - `R-B1-14` sprint-history has initial entry with `dd8a8f4` Sprint A
    SHA.

**STORY-B1-06 — Baseline debt register populated with REAL entries**
- Files (new):
  - `docs/trucker-app-baseline-debt.md`
  - `scripts/verify-baseline-debt.cjs`
- Approach: The Ralph worker runs `npx vitest run` (root + server)
  capturing output via `child_process.spawnSync`, extracts failing
  test file paths, populates the register with 6-column entries.
- R-markers:
  - `R-B1-15` `docs/trucker-app-baseline-debt.md` exists and contains
    a markdown table with columns `file | failure | owner | first-seen
    | expiry | justification`; verified via
    `scripts/verify-baseline-debt.cjs` which parses the markdown
    table using `fs.readFileSync` + regex.
  - `R-B1-16` register either contains ≥ 1 real entry OR an explicit
    `| _(verified clean at <date>)_ |` placeholder row; helper script
    asserts one of the two.

**STORY-B1-07 — Env matrix doc**
- Files (new):
  - `docs/trucker-app-env-matrix.md`
- Depends on: STORY-B1-05 (verify script)
- R-markers:
  - `R-B1-17` doc contains table with columns `Variable`, `Category`,
    `Local`, `Staging`, `Production`, `EAS Build-time`, `Scope`,
    `Rotation`; verified via helper script reading file with
    `fs.readFileSync` and matching header via regex.
  - `R-B1-18` doc contains H2 section `## EXPO_PUBLIC_* rule` stating
    that mobile public keys MUST use the prefix and server secrets
    MUST NOT.

**STORY-B1-08 — Feature flags doc + migration numbering rule**
- Files (new):
  - `docs/trucker-app-feature-flags.md`
  - `docs/trucker-app-migration-numbering.md`
- Depends on: STORY-B1-05 (verify script)
- R-markers:
  - `R-B1-19` feature flags doc lists all 6 flags (per spec above);
    helper script reads file and asserts each flag name via regex.
  - `R-B1-20` migration-numbering doc contains the placeholder rule
    and assignment procedure; helper script asserts H2 sections
    `## Placeholder convention` and `## Assignment procedure`.

**STORY-B1-09 — `feature_flags` DB table + read endpoint**
- Files (new):
  - `server/migrations/054_feature_flags.sql` (table columns: id,
    tenant_id, flag_name, flag_value BOOLEAN, updated_at, updated_by)
  - `server/routes/feature-flags.ts`
- Files (extended):
  - `server/index.ts`
    (mount: `app.use('/api/feature-flags', featureFlagsRouter)`)
- Test files (new):
  - `server/__tests__/migrations/054_feature_flags.test.ts`
  - `server/__tests__/routes/feature-flags.test.ts`
- R-markers:
  - `R-B1-21` migration creates `feature_flags` table with 6 columns;
    test reads SQL file via `fs.readFileSync`.
  - `R-B1-22` `GET /api/feature-flags` returns merged flag map (env +
    DB) for authenticated user's tenant; integration test via supertest.
  - `R-B1-23` `PUT /api/feature-flags/:name` requires admin role;
    non-admin → HTTP 403 (auth-negative R-marker per Rule 16).
  - `R-B1-24` `server/index.ts` mount line
    `app.use('/api/feature-flags', featureFlagsRouter)` present —
    test reads file via `fs.readFileSync` and asserts via regex match
    (no shell `grep`).

**STORY-B1-10 — SaaS non-regression verification**
- Files (new):
  - `scripts/verify-saas-regression.cjs`
- R-markers:
  - `R-B1-25` helper script runs `npx vitest run src/__tests__/` and
    `cd server && npx vitest run __tests__/routes/accounting.test.ts
    __tests__/routes/ifta.test.ts __tests__/middleware/requireAuth.test.ts`
    via `child_process.spawnSync`, captures exit codes, asserts all 0
    (modulo baseline debt exclusions from `baseline-debt.md`).

### Files NOT touched
- `server/migrations/051_ifta_audit_packets.sql` (FROZEN)
- `server/migrations/052_invoices_aging_tracking.sql` (FROZEN)
- `server/routes/ifta-audit-packets.ts` (FROZEN)
- `server/services/ifta-audit-packet.service.ts` (FROZEN)
- `components/IFTAManager.tsx` (FROZEN)
- `services/financialService.ts` (FROZEN)
- `server/scripts/seed-sales-demo.ts` (FROZEN — BSD contract)
- `scripts/demo-certify.cjs` (FROZEN — BSD contract)
- Any file under `apps/` or `packages/`

### Baseline debt exceptions
Populated during STORY-B1-06 execution. The register is the runtime
source of truth; this line in the plan is a pointer.

### Targeted verification command (Windows-safe)
```
cd server
npx vitest run __tests__/migrations __tests__/jobs/invoice-aging-nightly.test.ts __tests__/index.sentry-init.test.ts __tests__/routes/feature-flags.test.ts __tests__/scripts/invoice-aging-nightly.test.ts
npx tsc --noEmit
cd ..
node scripts/invoice-aging-nightly.cjs --dry-run
node scripts/verify-program-docs.cjs
node scripts/verify-baseline-debt.cjs
node scripts/verify-saas-regression.cjs
```

### Exit artifact
- PR `Sprint B1: Phase 1 gap + Sentry + program docs + feature flags DB`
- All 25 R-markers green (R-B1-01..R-B1-25)
- `docs/trucker-app-sprint-history.md` appended with B1 merge SHA

## V-Model Guarantee

Every sprint traverses the full V: requirements (R-markers) →
design (file inventory + architecture docs) → implementation (Ralph
stories with 4-checkpoint TDD) → unit tests → integration tests (sprint
targeted verification) → system tests (`/verify` + `/audit`) →
acceptance tests (release checklist, operator-signed).

**R-markers are Ralph-automatable only.** Real-device validation,
simulator validation, EAS build invocation, store submission, legal
review, and any other operator-run validation are tracked as **release
checklist rows** signed off by a human operator, NOT as Ralph R-markers.

## Ralph dispatch invariants

1. Worktree isolation per story worker
2. Checkpoint hash before each story
3. Feature branch `ralph/trucker-app-sprint-b1`
4. 4-checkpoint TDD (Red → Green → Refactor → Gate)
5. Selective staging (no `git add -A`)
6. Format before commit
7. Fixture validation (collect-only)
8. Circuit breaker (3 consecutive skips → halt)
9. `needs_verify` cleared before next sprint dispatch
10. `npm ci` (not `npm install`) in all verifications
11. All R-marker assertions use `fs.readFileSync` + regex (no shell `grep`)

## SaaS Non-Regression Gate

| Sprint | Touches SaaS backend? | Gate |
|---|---|---|
| **B1** | YES (jobs, index.ts) | accounting/ifta/documents/requireAuth tests |

## Feature Flags Strategy (B1 onward)

Feature flags are available from Sprint B1 via DB (`feature_flags`
table + `/api/feature-flags` endpoint) + env var fallback. Read
priority: DB > env > default false.

| Flag | Default | Enabled when | Removal criteria |
|---|---|---|---|
| `FEATURE_TRUCKER_MOBILE_BETA` | false | B2 dev, M beta launch | 100% rollout 30d |
| `FEATURE_MOTIVE_ELD` | false | G stories, M user-facing | 100% rollout 30d |
| `FEATURE_BROKER_CREDIT` | false | K with MIN_HISTORY_DAYS | 90d data + 100% |
| `FEATURE_FACILITY_DWELL` | false | K admin-only | admin adoption complete |
| `FEATURE_FREEMIUM_QUOTA` | false | J enforcement | 100% paid-tier conversion track |
| `FEATURE_FORCE_UPGRADE` | false | L on, M user-facing | version deprecation cycle |

## Migration Number Management

Master plan uses placeholders `<NEXT>`. For B1, all placeholders are
resolved: 053 (aging_bucket), 054 (feature_flags).

Assignment procedure for future sprints:
1. Operator runs `node scripts/next-migration-number.cjs`
2. Helper reads `server/migrations/` via `fs.readdirSync`, returns max+1
3. Operator replaces `<NEXT>` in sprint PLAN.md with actual numbers
4. Ralph halts if it sees unresolved `<NEXT>` in file paths

## Sprint Handoff

After B1 merges:
1. Record merge SHA in `docs/trucker-app-sprint-history.md`
2. Extract Sprint B2 section from `docs/PLAN-trucker-app-master.md`
3. Replace this file (`.claude/docs/PLAN.md`) with Sprint B2 contract
4. Regenerate `.claude/prd.json` for Sprint B2
5. Reset `.claude/.workflow-state.json`
6. Create branch `ralph/trucker-app-sprint-b2`
7. Dispatch `/ralph`
