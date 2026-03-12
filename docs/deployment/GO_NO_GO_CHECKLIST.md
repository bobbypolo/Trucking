# Go / No-Go Production Checklist — LoadPilot

> Version: 1.0 | Last Updated: 2026-03-11

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

- [ ] Output shows `0 failed` (not "mostly green", not "only 3 failing")
- [ ] Any quarantined test has a `// QUARANTINED: <reason> — tracked in <issue-ref>` comment AND operator approval
- [ ] **If this box cannot be checked: STOP. This is a NO-GO.**

Verified by: ______________ Date: ______________

### 2. Migration Rehearsal — Staging Cloud SQL PASS

```bash
npx tsx server/scripts/staging-rehearsal.ts 2>&1 | grep "overallPassed"
```

- [ ] Output shows `"overallPassed": true`
- [ ] Exit code is 0
- [ ] All 15 migrations (001 through 015) confirmed applied in correct order

Verified by: ______________ Date: ______________

### 3. Staging E2E — Functional Sweep PASS

```bash
npx playwright test e2e/functional-sweep.spec.ts --reporter=list 2>&1 | tail -5
```

- [ ] All tests pass (minimum 10 tests covering login, load CRUD, dispatch, tenant isolation)
- [ ] Zero console errors captured during sweep
- [ ] Test run timestamp recorded: ______________

Verified by: ______________ Date: ______________

### 4. Staging Rollback Drill — Executed and Evidenced

- [ ] Rollback drill completed on staging (not local)
- [ ] Evidence file exists at `docs/deployment/ROLLBACK_DRILL_EVIDENCE.md`
- [ ] Evidence includes: (a) deploy timestamp, (b) pre-rollback E2E pass, (c) rollback execution timestamp, (d) post-rollback E2E pass
- [ ] MigrationRunner.down() + up() round-trip validated (rollback-validation.test.ts passes)

Verified by: ______________ Date: ______________

### 5. Runbook Reviewed by Operator

- [ ] On-call engineer has read `docs/deployment/DEPLOYMENT_RUNBOOK.md` end-to-end
- [ ] On-call engineer has read `docs/deployment/ROLLBACK_PROCEDURE.md` end-to-end
- [ ] On-call engineer can execute each step without assistance

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

Verified by: ______________ Date: ______________

### 7. Cloud Monitoring Dashboard — Configured and Alerting

- [ ] Cloud Run request count metric visible in dashboard
- [ ] Error rate alert policy configured: > 5% for 5 minutes → page on-call
- [ ] Latency alert policy configured: p99 > 3s for 5 minutes → page on-call
- [ ] Cloud Logging structured log entries visible (not raw text)
- [ ] Dashboard URL recorded: ______________

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

- [ ] Run this command immediately before signing off — not from memory
- [ ] Baseline is GREEN: `0 failed`
- [ ] **Go/No-Go CANNOT pass while baseline test suite has unresolved failures**
- [ ] If baseline turned red between checklist start and this final check: **STOP. Re-evaluate.**

Final baseline check timestamp: ______________
Result: ______________ tests passed, ______________ failed
Verified by: ______________ Date: ______________

---

## Final Go / No-Go Decision

All 9 items above must be checked YES to proceed.

```
Go/No-Go Decision: [ ] GO    [ ] NO-GO

If NO-GO, reason: ________________________________

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
