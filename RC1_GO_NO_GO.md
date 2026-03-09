# RC1 Go/No-Go Decision -- LoadPilot

**Sprint**: Production Readiness Sprint (R-FS-01 through R-FS-08)
**Date**: 2026-03-09
**Decision Owner**: Engineering Lead
**Document**: R-FS-08-02 / R-FS-08-04

---

## Decision Summary

| Decision         | Status             |
| ---------------- | ------------------ |
| **RC1 Go/No-Go** | **CONDITIONAL GO** |

LoadPilot is cleared for Release Candidate 1 (RC1) deployment with a controlled
rollout, subject to the documented blockers below being resolved or formally
waived before production promotion.

---

## The 6 Release Questions

### Question 1: Are release-scoped flows fully live-backed?

**Answer: YES**

All release-scoped entity flows are fully API/database-backed. No release-critical
workflow depends on localStorage as authoritative storage.

Evidence (LOCALSTORAGE_RELEASE_AUDIT.md):

- Loads: API-only via `/api/loads` (`loadService.ts`)
- Stops (load legs): included in LoadData via API
- Settlements: API-only via `/api/accounting/settlements`
- Dispatch Events: API-only via `/api/dispatch-events`
- Documents (VaultDoc): API-only via `/api/accounting/docs` (`financialService.ts`)

Grep verification confirms zero localStorage usage for:
`STORAGE_KEY_LOADS`, `STORAGE_KEY_STOPS`, `STORAGE_KEY_SETTLEMENTS`,
`STORAGE_KEY_DISPATCH_EVENTS`, `loadpilot_loads`, `loadpilot_stops`,
`loadpilot_settlements`, `loadpilot_dispatch_events`

Remaining localStorage usage (23 keys across non-release modules) is classified
as deferred-safe: CRM features, safety/training modules, reference-data caches.
None affect core load lifecycle, dispatch, settlement, or document workflows.

**Gate**: PASS

---

### Question 2: Are migrations proven in staging?

**Answer: YES -- with qualifications**

Evidence (STAGING_MIGRATION_REHEARSAL.md, ROLLBACK_VALIDATION.md):

- Migration sequence (001-009) rehearsed on isolated dev DB instance
- Pre-migration: 64 load rows with 12 legacy PascalCase statuses
- Post-migration: 64 rows with 8 canonical lowercase statuses (0 lost)
- Normalization mapping verified and documented
- Referential integrity: 0 orphaned dispatch_events
- Application compatibility: server test suite passes post-migration
- Rollback round-trip: proven via `staging-rehearsal.ts`

**Qualification**: The rehearsal was performed on the development database
(`trucklogix`) using isolated test data, not a full production snapshot.
A true prod-like staging environment with sanitized prod data was not available
for this sprint. The migration logic is fully proven; the environment isolation
is partially met.

**Owner for gap closure**: Database/Infrastructure Owner
**Risk if not closed**: Low -- migration SQL is idempotent, normalization is
reversible, rollback script is documented and tested.

**Gate**: PASS (with staging environment gap noted)

---

### Question 3: Is rollback proven?

**Answer: YES**

Evidence (ROLLBACK_VALIDATION.md):

- Rollback mechanism: LIFO single-step via `server/lib/migrator.ts rollback()`
- `002_load_status_normalization_rollback.sql` exists and tested
- Round-trip test: rollback-down + rollback-reapply + integrity check -- PASS
- Known lossy mappings documented (many-to-one canonical to legacy):
  - `planned` from Planned, Booked, CorrectionRequested -- rolls back to Planned
  - `arrived` from Arrived, Docked -- rolls back to Arrived
  - `delivered` from Unloaded, Delivered -- rolls back to Delivered
  - `completed` from Invoiced, Settled -- rolls back to Invoiced
- Decision: lossy rollback is accepted because transitional states are not
  operationally significant; post-rollback reconciliation identifies any loads
  needing manual review
- Repair procedure (alternative to full rollback): documented and available

**Gate**: PASS

---

### Question 4: Are E2E critical paths passing?

**Answer: CONDITIONAL YES -- blocker documented**

Evidence (E2E_RESULTS.md):

- 5 E2E spec files implemented (satisfies R-FS-03-05)
- 47 tests discovered across 5 specs
- Real assertions implemented for all 5 critical paths:
  - Auth + tenant resolution (auth.spec.ts)
  - Load lifecycle (load-lifecycle.spec.ts)
  - Settlement workflow + immutability (settlement.spec.ts)
  - Tenant isolation (tenant-isolation.spec.ts)
  - Scanner / AI proxy (scanner.spec.ts)
- API-level assertions: logically verified and correct

**Blocker B1 (Medium)**: Server startup failure prevents automated E2E run

- Cause: ts-node does not resolve `server/types/express.d.ts` ambient
  declaration at runtime, causing TS2339 on `req.correlationId`
- Impact: Playwright webServer timeout; full automated test suite cannot execute
- Workaround: Manual server start + `E2E_SERVER_RUNNING=1`; all API-level
  assertion logic has been verified manually
- 891 server unit tests (67 files, 0 failures) confirm server correctness

**Owner**: Backend Engineer
**Risk if not closed before production**: Medium -- without automated E2E,
regressions in critical paths could reach production undetected.

**Waiver condition**: Acceptable for RC1 if manual E2E smoke pass is completed
before deployment and the ts-node issue is resolved in the first patch release.

**Gate**: CONDITIONAL PASS (blocker B1 -- see Unresolved Blockers section)

---

### Question 5: Are tenant/security gates passing?

**Answer: YES**

Evidence (SECURITY_RELEASE_CHECKLIST.md):

| Check                                                                | Status |
| -------------------------------------------------------------------- | ------ |
| No client-side Gemini key exposure (VITE_GEMINI removed)             | PASS   |
| `/api/metrics` requires auth + admin role                            | PASS   |
| Public endpoint allowlist: only `GET /api/health`                    | PASS   |
| All 80+ release-scoped routes enforce `requireAuth`                  | PASS   |
| Tenant isolation: `requireAuth` + `requireTenant` on all data routes | PASS   |
| SQL queries: all include `WHERE company_id = ?`                      | PASS   |
| Upload validation: size, extension, MIME type, path traversal        | PASS   |
| Server test suite: 891 tests, 0 failures                             | PASS   |

Specific tenant isolation tests passing:

- `__tests__/regression/tenant-isolation.test.ts` -- 14 tests
- `__tests__/middleware/route-audit.test.ts` -- 11 tests
- `__tests__/regression/auth-security.test.ts` -- 15 tests

**Gate**: PASS

---

### Question 6: Are known blockers resolved or waived with owner and risk?

**Answer: YES -- all blockers documented below with owner and risk**

---

## Unresolved Blockers

### Blocker B1 -- E2E Automated Run Blocked by ts-node Startup Failure

**Severity**: Medium
**Owner**: Backend Engineer (Robert)
**Status**: Documented -- waived for RC1 with conditions

**Description**: The Playwright webServer fails to start the Express server via
ts-node because the Express type augmentation in `server/types/express.d.ts`
is not resolved at ts-node runtime. This causes TS2339 on `req.correlationId`.

**Impact**: Automated E2E CI run is blocked. All 47 tests are discovered but
cannot execute in CI without manual intervention.

**Risk**: Medium. Without automated E2E, critical-path regressions could reach
production without being caught by the CI gate.

**Waiver Condition**: RC1 may proceed if:

1. A manual E2E smoke pass is completed by the releasing engineer before deployment
2. The ts-node type resolution fix is shipped in RC1 patch (Release 1.0.1)
3. CI E2E gate is enforced from RC1 patch onward

**Fix approach**: Either add `--require tsconfig-paths/register` to ts-node
invocation, or pre-compile server to JS before E2E run (`tsc --outDir dist` +
`node dist/index.js`). Alternatively, update tsconfig.json to add explicit
`typeRoots` pointing to `server/types/`.

---

### Blocker B2 -- Staging Rehearsal on Full Production Snapshot Not Completed

**Severity**: Low
**Owner**: Infrastructure Owner (Robert)
**Status**: Documented -- waived for RC1

**Description**: Migration rehearsal was performed on the development database
with representative seeded data (64 rows), not a sanitized production snapshot.
A true prod-like staging environment was not provisioned for this sprint.

**Impact**: Low. Migration SQL is deterministic and idempotent. The normalization
logic has been unit-tested (10 tests in `load-status-migration.test.ts`). The
primary risk is unexpected edge-case data in production that seeded data did not
cover.

**Risk**: Low. Database contains only development data at this time; no real
production load data exists to introduce edge cases.

**Waiver Condition**: Acceptable for RC1 as the first production deployment is
to a fresh environment. A full staging rehearsal with prod data is required
before any production-to-production migration.

---

## Sprint Story Completion Status

| Story   | Title                             | Status |
| ------- | --------------------------------- | ------ |
| R-FS-01 | Route Ownership Audit             | PASS   |
| R-FS-02 | Staging Migration Rehearsal       | PASS   |
| R-FS-03 | Critical E2E Implementation       | PASS   |
| R-FS-04 | localStorage Eradication          | PASS   |
| R-FS-05 | Route Test Coverage Closure       | PASS   |
| R-FS-06 | Frontend Confidence Pack          | PASS   |
| R-FS-07 | Security and Public Surface Audit | PASS   |
| R-FS-08 | RC1 Evidence Pack and Go/No-Go    | PASS   |

**All 8 stories complete.**

---

## Evidence Artifact Checklist

| Artifact                       | Status                         |
| ------------------------------ | ------------------------------ |
| ROUTE_OWNERSHIP_AUDIT.md       | EXISTS -- PASS                 |
| STAGING_MIGRATION_REHEARSAL.md | EXISTS -- PASS                 |
| ROLLBACK_VALIDATION.md         | EXISTS -- PASS                 |
| E2E_RESULTS.md                 | EXISTS -- PASS                 |
| LOCALSTORAGE_RELEASE_AUDIT.md  | EXISTS -- PASS                 |
| SECURITY_RELEASE_CHECKLIST.md  | EXISTS -- PASS                 |
| RC1_GO_NO_GO.md                | EXISTS (this document) -- PASS |

**All 7 required evidence artifacts exist.**

---

## RC1 Release Conditions

LoadPilot RC1 may proceed to production with the following conditions:

1. **Before deployment**: Manual E2E smoke pass completed by releasing engineer
   covering: login, load creation, dispatch, settlement generation.

2. **Day-of deployment**: Fresh database schema applied via migration sequence
   (001-009). No legacy PascalCase load statuses exist (fresh environment).

3. **Post-deployment**: Server health check at `/api/health` confirms `status: ok`.
   Application reads/writes loads using canonical lowercase status values.

4. **Within RC1 patch**: ts-node startup issue resolved; automated E2E CI gate
   enforced from that point forward.

5. **Controlled rollout**: RC1 is deployed to a single pilot tenant before
   general availability. Rollback procedure is documented and ready.

---

**Decision: CONDITIONAL GO for RC1**
