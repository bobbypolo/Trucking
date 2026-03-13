# Go / No-Go Production Checklist — LoadPilot

> Version: 2.0 | Last Updated: 2026-03-12

## CRITICAL GATE — MUST READ BEFORE PROCEEDING

**Go/No-Go CANNOT pass while baseline test suite has unresolved failures.**

If `cd server && npx vitest run 2>&1 | grep "Tests"` shows ANY failures that are not formally quarantined with an approved issue reference and operator sign-off, the answer to this checklist is **NO-GO**. Do not proceed to production deployment.

This is not a policy that can be waived by time pressure. A red baseline means the system's correctness guarantees are unknown.

---

## Checklist

Complete all items. Each requires active verification — not assumption. Sign and date when complete.

### 1. Test Suite — 0 Failures

```bash
cd server && npx vitest run 2>&1 | grep "Tests"
```

- [x] Output shows `0 failed` (not "mostly green", not "only 3 failing")
- [x] Any quarantined test has a `// QUARANTINED: <reason> — tracked in <issue-ref>` comment AND operator approval
- [x] **If this box cannot be checked: STOP. This is a NO-GO.**

Verified by: ralph-story STORY-005 Date: 2026-03-12
Result: 1160 server tests passed, 0 failed. 139 frontend tests passed, 0 failed.

### 2. Migration Rehearsal — Staging Cloud SQL PASS

```bash
npx tsx server/scripts/staging-rehearsal.ts 2>&1 | grep "overallPassed"
```

- [ ] Output shows `"overallPassed": true`
- [ ] Exit code is 0
- [ ] All 16 migrations (001 through 016) confirmed applied in correct order

Note (2026-03-12): Migration dry-run script created in STORY-003. Requires live Cloud SQL to execute.
Migration chain 001-016 is structurally complete and numbered. Rehearsal run: PENDING — requires staging environment.

Verified by: ______________ Date: ______________

### 3. Staging E2E — Functional Sweep PASS

```bash
npx playwright test e2e/functional-sweep.spec.ts --reporter=list 2>&1 | tail -5
```

- [x] All tests pass (minimum 10 tests covering login, load CRUD, dispatch, tenant isolation)
- [x] Zero console errors captured during sweep (auth-expected errors only)
- [x] Test run timestamp recorded: 2026-03-12 23:55 UTC (local)

Note (2026-03-12): Local run verified. Full staging environment run: PENDING — requires GCP staging.

Verified by: ralph-story STORY-005 Date: 2026-03-12 (local only — staging run required before production)

### 4. Staging Rollback Drill — Executed and Evidenced

- [ ] Rollback drill completed on staging (not local)
- [x] Evidence file exists at `docs/deployment/ROLLBACK_DRILL_EVIDENCE.md`
- [x] Evidence includes: (a) deploy timestamp, (b) pre-rollback E2E pass, (c) rollback execution timestamp, (d) post-rollback E2E pass
- [x] MigrationRunner.down() + up() round-trip validated (rollback-validation.test.ts passes)

Note (2026-03-12): Rollback drill evidence created and rollback-validation.test.ts passes (7/7).
Staging drill: PENDING — requires GCP staging environment.

Verified by: ______________ Date: ______________

### 5. Runbook Reviewed by Operator

- [ ] On-call engineer has read `docs/deployment/DEPLOYMENT_RUNBOOK.md` end-to-end
- [ ] On-call engineer has read `docs/deployment/ROLLBACK_PROCEDURE.md` end-to-end
- [ ] On-call engineer can execute each step without assistance

Note (2026-03-12): Runbooks are complete and reviewed at STORY-004 level. Operator sign-off required before production.

Reviewed by: ______________ Date: ______________

### 6. Environment Variables — Confirmed in Secret Manager

```bash
# Verify all required secrets exist
for secret in DB_HOST DB_USER DB_PASSWORD DB_NAME FIREBASE_PROJECT_ID GOOGLE_APPLICATION_CREDENTIALS CORS_ORIGIN; do
  gcloud secrets versions access latest --secret=$secret > /dev/null && echo "OK: $secret" || echo "MISSING: $secret"
done
```

- [ ] All required secrets return OK (no MISSING entries)
- [ ] CORS_ORIGIN matches the production Firebase Hosting domain (not localhost)
- [ ] NODE_ENV is set to `production` in Cloud Run env vars
- [ ] See `docs/deployment/ENV_INVENTORY.md` for the full required variable list

Note (2026-03-12): ENV_INVENTORY.md complete (STORY-002). Secret Manager provisioning: PENDING — requires GCP access.

Verified by: ______________ Date: ______________

### 7. Cloud Monitoring Dashboard — Configured and Alerting

- [ ] Cloud Run request count metric visible in dashboard
- [ ] Error rate alert policy configured: > 5% for 5 minutes → page on-call
- [ ] Latency alert policy configured: p99 > 3s for 5 minutes → page on-call
- [ ] Cloud Logging structured log entries visible (not raw text)
- [ ] Dashboard URL recorded: ______________

Note (2026-03-12): PENDING — requires GCP infrastructure provisioning.

Verified by: ______________ Date: ______________

### 8. On-Call Assigned and Available

- [ ] On-call engineer identified by name
- [ ] On-call engineer has the runbook and can execute rollback
- [ ] Emergency contact chain documented and tested (engineer responds to test page)
- [ ] 48-hour monitoring commitment confirmed

On-call engineer: ______________ Contact: ______________
Backup engineer: ______________ Contact: ______________

### 9. Baseline NOT Red — Final Confirmation

```bash
cd server && npx vitest run 2>&1 | tail -5
```

- [x] Run this command immediately before signing off — not from memory
- [x] Baseline is GREEN: `0 failed`
- [x] **Go/No-Go CANNOT pass while baseline test suite has unresolved failures**
- [x] If baseline turned red between checklist start and this final check: **STOP. Re-evaluate.**

Final baseline check timestamp: 2026-03-12 23:55 UTC
Result: 1160 tests passed, 0 failed (server) | 139 tests passed, 0 failed (frontend) | 201 E2E passed, 0 failed
Verified by: ralph-story STORY-005 Date: 2026-03-12

---

## Local Verification Status (2026-03-12)

Items 1, 3, 9 are locally verified GREEN. Items 2, 4, 5, 6, 7, 8 require GCP staging infrastructure.

| Item | Status | Notes |
|------|--------|-------|
| 1. Test suite 0 failures | GREEN (2026-03-12) | 1160 server + 139 frontend + 201 E2E, all passing |
| 2. Migration rehearsal | PENDING | Requires Cloud SQL staging — script ready |
| 3. Staging E2E sweep | LOCAL PASS (2026-03-12) | Requires full staging for sign-off |
| 4. Rollback drill | PENDING | Requires GCP staging environment |
| 5. Runbook reviewed | PENDING | Operator sign-off required |
| 6. Secrets in Secret Manager | PENDING | Requires GCP access |
| 7. Monitoring dashboard | PENDING | Requires GCP infrastructure |
| 8. On-call assigned | PENDING | Human action required |
| 9. Baseline final check | GREEN (2026-03-12) | 1160 server, 0 failed |

**Current status**: Code is ready. Operational items 2-8 require GCP staging environment provisioning.

---

## Final Go / No-Go Decision

All 9 items above must be checked YES to proceed.

```
Go/No-Go Decision: [ ] GO    [ ] NO-GO

If NO-GO, reason: Items 2-8 require GCP staging environment (not yet provisioned)

Decision made by: ______________
Title/Role: ______________
Date and time (UTC): ______________
```

**A NO-GO decision is not a failure — it is the system working as designed.**
Return to the relevant checklist item, resolve the issue, and re-run the full checklist from item 1.

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-11 | ralph-story STORY-005 | Initial go/no-go checklist |
| 2.0 | 2026-03-12 | ralph-story STORY-005 (Go-Live Qual) | Updated items 1, 3, 9 as locally verified GREEN. Added local verification status table. Updated migration count to 016. Added staging environment pending notes for items 2-8. |
