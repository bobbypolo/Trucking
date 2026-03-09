Production Validation Gauntlet — 8-Gate Release Certification
Sprint Goal

Prove, with evidence, that the LoadPilot backend survives exact production conditions and can safely recover if something goes wrong.

This is NOT "does it seem functional?" — it is "can we prove it with artifacts?"

Previous Sprint (RC1): COMPLETE — 8 stories passed (R-FS-01 through R-FS-08). Route ownership clean, E2E foundation exists, localStorage release-scoped audit clean, security checklist passed, migration rehearsal done on dev DB.

This Sprint (RC2 → Production Ready): Close the gap between "RC1 conditional go" and "all release-blocking evidence passed, no no-go condition remains."

Verification Standard

The backend is "functional, stable, and ready for production deployment" only if ALL 8 gates pass:

1. Real Backend Functional Correctness
2. Data Integrity and Migration Safety
3. Tenant Isolation and Security Correctness
4. Transaction, Concurrency, and Idempotency Safety
5. Operational Observability and Recoverability
6. Staging Soak and Performance Sanity
7. Real User-Facing E2E with Live Backend
8. Deployment Rehearsal and Rollback Proof

Hard No-Go Rules

If ANY of these are true, the backend is NOT ready:

- Release-scoped workflows require localStorage fallback
- Backend-online live E2E critical paths fail
- Cross-tenant isolation is not proven
- Migrations not rehearsed on prod-like data
- Reconciliation not clean
- Rollback not executed successfully
- Duplicate route ownership still exists
- Settlement workflow correctness not proven
- Document consistency between DB and storage not proven
- Auth model still ambiguous or misconfigured

Parallel Execution Strategy

Two workstreams run at all times:

Stream A — Backend Validation (Gates 1, 2, 4, 5, 6)
  Focus: server tests, DB integrity, concurrency, observability, performance
  Agent: ralph-worker or Builder with backend focus

Stream B — E2E & Security (Gates 3, 7, 8)
  Focus: tenant isolation, live E2E with backend online, deployment rehearsal
  Agent: ralph-worker or Builder with E2E/security focus

Dependencies: Stream B Gate 7 requires Stream A Gate 1 (backend must be online first).
All other work is parallelizable.

Evidence Pack (8 artifacts required)

1. RC_BACKEND_FUNCTIONAL_REPORT.md — Gate 1 evidence
2. STAGING_MIGRATION_REHEARSAL.md — Gate 2 evidence (update existing)
3. RECONCILIATION_REPORT.md — Gate 2 evidence
4. TENANT_SECURITY_AUDIT.md — Gate 3 evidence
5. CONCURRENCY_SAFETY_REPORT.md — Gate 4 evidence
6. PERF_SANITY_REPORT.md — Gate 6 evidence (update existing)
7. LIVE_E2E_RESULTS.md — Gate 7 evidence
8. RC_GO_NO_GO.md — Gate 8 final decision (replace existing)

All artifacts go in: .claude/docs/evidence/

Scope Policy

In scope: ONLY work that produces gate evidence or unblocks gate evidence.
Out of scope: Polish, new features, broad refactors, non-release entities.

Crutches OFF for release verification:
- Backend MUST be online
- DEMO_MODE OFF
- localStorage fallback disabled for release entities
- Mocks OFF for release-scoped workflows
- Real auth path ON
- Real DB (dev DB with prod-like data acceptable for RC2)

---

Phase 1 — Backend Functional Correctness (Gate 1)

Objective: Prove every release-scoped workflow works with the real backend online — not demo mode, not localStorage fallback, not mocks.

Stream A Stories:

R-PV-01 — Backend Startup and Health Verification

Goal: Get the backend running reliably and prove core infrastructure works.

Done when:
- R-PV-01-01: `npm run server` starts without error, `GET /api/health` returns 200
- R-PV-01-02: MySQL connection pool initializes (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME configured)
- R-PV-01-03: Firebase Admin SDK initializes (FIREBASE_PROJECT_ID or GOOGLE_APPLICATION_CREDENTIALS)
- R-PV-01-04: All 13 migrations run cleanly on dev DB (`server/scripts/staging-rehearsal.ts` or equivalent)
- R-PV-01-05: Correlation ID middleware attaches UUID to every response header
- R-PV-01-06: Rate limiting responds with 429 after threshold exceeded
- R-PV-01-07: Evidence captured in RC_BACKEND_FUNCTIONAL_REPORT.md § Infrastructure

R-PV-02 — Release Workflow Functional Proof (Integration Tests)

Goal: Prove all release-scoped business logic works with real assertions against the actual codebase.

Done when:
- R-PV-02-01: Auth path verified — login produces valid JWT, tenant context resolves, logout invalidates session
- R-PV-02-02: Load CRUD — create load persists to DB, read returns correct data, update modifies fields
- R-PV-02-03: Stop persistence — stops created with load, sequence maintained, lat/lng stored
- R-PV-02-04: Driver/equipment assignment — persists to DB, tenant-scoped, concurrent double-assignment rejected
- R-PV-02-05: Load state transitions — all 8 valid transitions succeed, all invalid transitions return 422 BusinessRuleError
- R-PV-02-06: Dispatch guards — planned→dispatched requires driver_id, equipment_id, pickup stop, dropoff stop, same-tenant
- R-PV-02-07: Dispatch events — transition writes immutable event to dispatch_events table
- R-PV-02-08: Document upload — persists metadata to documents table, storage path recorded
- R-PV-02-09: Document state machine — pending→finalized→processing→review_required→accepted/rejected all work
- R-PV-02-10: OCR flow — processing produces ocr_results record with confidence score
- R-PV-02-11: Settlement generation — completed load generates settlement with correct line items, DECIMAL(10,2) precision
- R-PV-02-12: Settlement state machine — pending_generation→generated→reviewed→posted, adjusted branch works
- R-PV-02-13: Settlement immutability — posted settlement rejects modification
- R-PV-02-14: `cd server && npx vitest run` exits 0 — all tests pass
- R-PV-02-15: Evidence captured in RC_BACKEND_FUNCTIONAL_REPORT.md § Workflow Correctness

Stream B Story (parallel):

R-PV-03 — E2E Test Infrastructure Fix

Goal: Fix the ts-node/Playwright startup blocker so E2E runs are fully automated.

Done when:
- R-PV-03-01: `npx playwright test --list` discovers all spec files without error
- R-PV-03-02: Playwright webServer config starts both frontend (5173) and backend (5000) automatically
- R-PV-03-03: E2E_SERVER_RUNNING env var is set automatically by Playwright config (not manual)
- R-PV-03-04: At least one E2E spec runs end-to-end with backend online (auth.spec.ts minimum)
- R-PV-03-05: Console output shows no ts-node type errors during startup

---

Phase 2 — Data Integrity and Migration Safety (Gate 2)

Objective: Prove the data layer is safe for production — migrations, rollback, reconciliation, status normalization.

Stream A Stories:

R-PV-04 — Migration Rehearsal on Prod-Like Data

Goal: Run all 13 migrations on a realistic dataset and prove correctness.

Done when:
- R-PV-04-01: Dev DB seeded with prod-like data (realistic load counts, multiple tenants, mixed statuses)
- R-PV-04-02: All 13 migrations execute in order without error
- R-PV-04-03: Pre/post row counts captured for loads, settlements, documents, users, equipment
- R-PV-04-04: Pre/post status distribution captured (12 PascalCase → 8 canonical lowercase)
- R-PV-04-05: No invalid enums/statuses remain after migration (query proof)
- R-PV-04-06: FK relationships remain valid (no orphaned stops, no dangling load_ids)
- R-PV-04-07: Document metadata matches storage state (no orphaned records)
- R-PV-04-08: No duplicate active equipment assignments exist
- R-PV-04-09: Settlement amounts match expected DECIMAL(10,2) precision
- R-PV-04-10: Evidence captured in STAGING_MIGRATION_REHEARSAL.md (update existing)

R-PV-05 — Reconciliation and Rollback Proof

Goal: Prove data is clean after migration and rollback path works.

Done when:
- R-PV-05-01: Reconciliation service runs against post-migration DB — no discrepancies
- R-PV-05-02: Settlement totals reconcile with line items
- R-PV-05-03: Load status counts match expected post-normalization values
- R-PV-05-04: Rollback script exists and reverses migration cleanly
- R-PV-05-05: Post-rollback DB is in valid pre-migration state
- R-PV-05-06: Re-run migrations after rollback — same clean result
- R-PV-05-07: Evidence captured in RECONCILIATION_REPORT.md

---

Phase 3 — Security, Tenant Isolation, and Transaction Safety (Gates 3 + 4)

Objective: Prove tenant boundaries hold, auth is fail-closed, and concurrent/duplicate operations are safe.

Stream A Story:

R-PV-06 — Transaction, Concurrency, and Idempotency Tests

Goal: Prove atomic operations, concurrent safety, and idempotency with dedicated test evidence.

Done when:
- R-PV-06-01: Load + stops create atomically — partial failure rolls back both (test with injected DB error)
- R-PV-06-02: Transition + dispatch event write atomically — partial failure rolls back both
- R-PV-06-03: Idempotency key replay — same key + same payload returns cached response
- R-PV-06-04: Idempotency key mismatch — same key + different payload returns 422
- R-PV-06-05: Concurrent stale writes — optimistic locking returns 409 ConflictError on version mismatch
- R-PV-06-06: Equipment double-assignment — same equipment assigned to two loads concurrently → one succeeds, one fails
- R-PV-06-07: Settlement generation idempotency — generating twice for same load returns same settlement
- R-PV-06-08: Document finalization idempotency — finalizing twice for same document is safe
- R-PV-06-09: `cd server && npx vitest run` exits 0
- R-PV-06-10: Evidence captured in CONCURRENCY_SAFETY_REPORT.md

Stream B Story (parallel):

R-PV-07 — Tenant Isolation and Security Verification

Goal: Prove tenant boundaries and auth are production-safe with fresh evidence.

Done when:
- R-PV-07-01: Route protection audit — all 74 endpoints categorized (auth-required vs public). Only GET /api/health is public
- R-PV-07-02: Cross-tenant read test — user from tenant A requests tenant B load → 403
- R-PV-07-03: Cross-tenant write test — user from tenant A creates load in tenant B → 403
- R-PV-07-04: Cross-tenant document access — user from tenant A requests tenant B document → 403
- R-PV-07-05: Cross-tenant settlement access — user from tenant A requests tenant B settlement → 403
- R-PV-07-06: Admin bypass verified — admin role can access cross-tenant (by design) with audit trail
- R-PV-07-07: Auth failure is fail-closed — missing/invalid/expired token → 401, never silent fallback
- R-PV-07-08: No client-side secret exposure — grep for VITE_GEMINI, API keys in bundle output
- R-PV-07-09: /api/metrics requires auth in production posture
- R-PV-07-10: Upload validation enforced — file type, size limits, rate limiting
- R-PV-07-11: `cd server && npx vitest run` exits 0
- R-PV-07-12: Evidence captured in TENANT_SECURITY_AUDIT.md

---

Phase 4 — Observability, Performance, and Live E2E (Gates 5 + 6 + 7)

Objective: Prove operational readiness and run real user-facing E2E with the live backend.

Stream A Story:

R-PV-08 — Observability Baseline and Performance Sanity

Goal: Prove the system is observable and performs within targets.

Done when:
- R-PV-08-01: Structured logs verified — pino JSON output with service, version, timestamp, level
- R-PV-08-02: Correlation ID tracing — request→response→log entry all share same correlation ID (traced example)
- R-PV-08-03: Sensitive field redaction verified — authorization, password, token, tax_id all redacted in logs
- R-PV-08-04: Error envelope verified — AppError subclasses produce correct JSON (error_code, correlation_id, no stack leak)
- R-PV-08-05: Metrics middleware captures route-level counts, error rates, latency
- R-PV-08-06: SLO baselines documented — read p99<500ms, write p99<1000ms, error rate<1%
- R-PV-08-07: Core auth + CRUD endpoints measured under stated p95 targets
- R-PV-08-08: No critical N+1 patterns on load list, settlement list, dashboard routes
- R-PV-08-09: Graceful shutdown verified — SIGTERM closes HTTP server + DB pool within 10s
- R-PV-08-10: Evidence captured in PERF_SANITY_REPORT.md (update existing)

Stream B Story (parallel, depends on Phase 1 R-PV-01 completion):

R-PV-09 — Live E2E with Backend Online

Goal: Run real user-facing Playwright tests with backend online, DEMO_MODE off, no localStorage fallback.

Done when:
- R-PV-09-01: Backend is running (port 5000), frontend is running (port 5173)
- R-PV-09-02: DEMO_MODE is OFF (Firebase credentials configured or auth mocked at server level, not client)
- R-PV-09-03: Admin flow E2E — login, navigate dashboard, verify data from API (not localStorage)
- R-PV-09-04: Dispatcher flow E2E — create load, assign driver/equipment, transition to dispatched
- R-PV-09-05: Document/OCR flow E2E — upload document, verify processing state, review accept/reject
- R-PV-09-06: Settlement flow E2E — completed load, generate settlement, review, verify posted state
- R-PV-09-07: Tenant isolation E2E — second user/company cannot see first company's loads
- R-PV-09-08: API responses verified (not fallback data) — network tab or API assertion confirms real backend response
- R-PV-09-09: DB/log validation for same flows — persisted state matches UI assertions
- R-PV-09-10: Evidence captured in LIVE_E2E_RESULTS.md with Playwright output + screenshots

---

Phase 5 — Deployment Rehearsal and Final Evidence Pack (Gate 8)

Objective: Prove deployment itself works, rollback executes, and produce the final go/no-go artifact.

R-PV-10 — Deployment Rehearsal and Rollback Execution

Goal: Prove the release candidate deploys, smokes pass, and rollback actually executes.

Done when:
- R-PV-10-01: Release candidate commit/branch frozen (no more opportunistic fixes)
- R-PV-10-02: RC deploys successfully to staging-like environment
- R-PV-10-03: Migrations run in release order during deploy
- R-PV-10-04: Post-deploy smoke tests pass (health check, auth, load CRUD, settlement)
- R-PV-10-05: Rollback path ACTUALLY EXECUTES (not just documented) — DB rolled back, app reverts
- R-PV-10-06: Post-rollback smoke tests pass — system returns to pre-deploy state
- R-PV-10-07: Re-deploy after rollback succeeds (proves repeatability)
- R-PV-10-08: Evidence captured in deployment checklist

R-PV-11 — Final Evidence Pack and Go/No-Go Decision

Goal: Produce the complete evidence bundle and make the release decision.

Done when:
- R-PV-11-01: RC_BACKEND_FUNCTIONAL_REPORT.md exists with Gate 1 evidence
- R-PV-11-02: STAGING_MIGRATION_REHEARSAL.md updated with Gate 2 evidence
- R-PV-11-03: RECONCILIATION_REPORT.md exists with Gate 2 evidence
- R-PV-11-04: TENANT_SECURITY_AUDIT.md exists with Gate 3 evidence
- R-PV-11-05: CONCURRENCY_SAFETY_REPORT.md exists with Gate 4 evidence
- R-PV-11-06: PERF_SANITY_REPORT.md updated with Gate 5+6 evidence
- R-PV-11-07: LIVE_E2E_RESULTS.md exists with Gate 7 evidence
- R-PV-11-08: RC_GO_NO_GO.md exists with ALL 8 gates explicitly answered:
  - Gate 1: Backend functional correctness — PASS/FAIL with evidence reference
  - Gate 2: Data integrity and migration safety — PASS/FAIL with evidence reference
  - Gate 3: Tenant isolation and security — PASS/FAIL with evidence reference
  - Gate 4: Transaction and concurrency safety — PASS/FAIL with evidence reference
  - Gate 5: Observability and recoverability — PASS/FAIL with evidence reference
  - Gate 6: Performance sanity — PASS/FAIL with evidence reference
  - Gate 7: Live E2E — PASS/FAIL with evidence reference
  - Gate 8: Deployment rehearsal — PASS/FAIL with evidence reference
- R-PV-11-09: No unresolved blocker remains — every FAIL has resolution or explicit waiver with owner/risk
- R-PV-11-10: Final classification assigned:
  - NOT READY: Any release-blocking gate failed
  - RELEASE CANDIDATE: All gates passed in staging verification
  - PRODUCTION READY FOR CONTROLLED ROLLOUT: RC + deployment rehearsal + rollback proven + go/no-go signed

---

Sprint Exit Criteria

The sprint is complete ONLY if:

1. All 8 gates have PASS status with evidence artifacts
2. All 8 evidence documents exist in .claude/docs/evidence/
3. RC_GO_NO_GO.md explicitly answers all 8 gate questions
4. No no-go condition from the Hard No-Go Rules remains unresolved
5. `cd server && npx vitest run` exits 0 (no regression)
6. Live E2E with backend online passes critical paths

If ANY of these is false, the sprint is not complete.

Classification on completion:

"All release-blocking evidence has passed, and no no-go condition remains."

Story Execution Order

Stream A (Backend):     R-PV-01 → R-PV-02 → R-PV-04 → R-PV-05 → R-PV-06 → R-PV-08
Stream B (E2E/Security): R-PV-03 → R-PV-07 → R-PV-09 → R-PV-10 → R-PV-11

Parallelism:
- Phase 1: R-PV-01 + R-PV-03 run in parallel
- Phase 2: R-PV-04 + R-PV-05 run sequentially (R-PV-05 depends on R-PV-04)
- Phase 3: R-PV-06 + R-PV-07 run in parallel
- Phase 4: R-PV-08 + R-PV-09 run in parallel (R-PV-09 depends on R-PV-01 from Phase 1)
- Phase 5: R-PV-10 → R-PV-11 run sequentially (final)

Total: 11 stories, 5 phases, 2 parallel streams, 8 evidence artifacts
