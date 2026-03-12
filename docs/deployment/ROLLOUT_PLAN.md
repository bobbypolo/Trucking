# Controlled Rollout Plan — LoadPilot Production Deployment

> Version: 1.0 | Last Updated: 2026-03-11
> Targets: Cloud Run (backend) + Firebase Hosting (frontend) + Cloud SQL for MySQL (database)

This plan governs the controlled, gate-driven rollout of LoadPilot to production. Each gate has explicit entry criteria (what must be true to enter the gate) and exit criteria (what must be true to proceed to the next gate). Any gate failure halts the rollout until the issue is resolved.

---

## Gate 0 — Pre-Deploy Readiness

**Objective**: Confirm the codebase, test suite, and infrastructure are ready for production deployment.

### Entry Criteria

- Baseline test suite is green (0 failures) — confirmed by running `cd server && npx vitest run`
- Code review approved on the release branch
- No unresolved `FIXME` or `TODO` comments in release scope
- All external dependencies (Firebase, Cloud Run, Cloud SQL) are provisioned for staging

### Exit Criteria (ALL must be true to proceed to Gate 1)

| #   | Criterion                                                       | Verification Command                                          |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | **Baseline suite green** — 0 test failures (not "mostly green") | `cd server && npx vitest run 2>&1 \| grep "Tests"` → 0 failed |
| 2   | Migration rehearsal PASS on fresh DB                            | `bash server/scripts/migration-dry-run.sh` exits 0            |
| 3   | `validateEnv()` passes in staging mode                          | `NODE_ENV=staging npx tsx server/lib/env.ts` exits 0          |
| 4   | Go/No-Go checklist approved (see GO_NO_GO_CHECKLIST.md)         | All 9+ items checked                                          |
| 5   | Release branch SHA confirmed and recorded                       | `git rev-parse HEAD` recorded in deployment log               |

**HARD STOP**: **Baseline test suite must be green. Go/No-Go CANNOT pass while baseline has unresolved failures.** Do not advance to Gate 1 if any test is failing without an approved quarantine.

---

## Gate 1 — Staging Canary

**Objective**: Validate the deployment pipeline and application correctness against the staging Cloud Run + Cloud SQL environment.

### Entry Criteria

- Gate 0 fully passed
- Staging Cloud Run service exists and is reachable
- Staging Cloud SQL instance provisioned with migrations applied
- Staging Firebase Hosting project configured with /api/\* rewrite to staging Cloud Run

### Deploy Steps

```bash
# Deploy to staging (same steps as DEPLOYMENT_RUNBOOK.md but targeting staging resources)
gcloud run deploy loadpilot-api-staging \
  --image gcr.io/YOUR_GCP_PROJECT/loadpilot-api:${GIT_SHA} \
  --region us-central1 \
  --set-env-vars "NODE_ENV=staging" \
  --set-secrets "..."

firebase deploy --only hosting --project YOUR_FIREBASE_STAGING_PROJECT
```

### Exit Criteria (ALL must be true to proceed to Gate 2)

| #   | Criterion                                             | Verification                                                     |
| --- | ----------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | Health endpoint returns 200 on staging                | `curl -sf https://STAGING_URL/api/health`                        |
| 2   | E2E functional sweep passes on staging                | `npx playwright test e2e/functional-sweep.spec.ts` — all passing |
| 3   | Cloud Logging shows 0 unhandled errors during E2E run | Cloud Logging query for severity >= ERROR during test window     |
| 4   | Staging rollback drill completed with evidence        | See ROLLBACK_DRILL_EVIDENCE.md                                   |
| 5   | Soak period: 1 hour monitoring of staging traffic     | Cloud Monitoring dashboard — error rate < 1%, p99 < 2s           |

### Rollback Trigger (any of these → halt + rollback)

- E2E test failures on staging
- Error rate > 5% during soak period
- Any unhandled error in Cloud Logging during smoke run

---

## Gate 2 — Limited Production (Single Tenant Pilot)

**Objective**: Validate behavior with real production data under controlled conditions.

### Entry Criteria

- Gate 1 fully passed
- Pilot tenant identified and consented
- On-call engineer available and monitoring
- Rollback procedure tested and evidence documented (Gate 1 rollback drill)

### Deploy Steps

```bash
# Deploy to production Cloud Run
gcloud run deploy loadpilot-api \
  --image gcr.io/YOUR_GCP_PROJECT/loadpilot-api:${GIT_SHA} \
  --region us-central1 \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets "..."

# Deploy frontend
firebase deploy --only hosting --project YOUR_FIREBASE_PRODUCTION_PROJECT

# Record deployment timestamp
echo "Production deploy timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

### Exit Criteria (ALL must be true to proceed to Gate 3)

| #   | Criterion                                                                                | Verification                                                       |
| --- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | Pilot tenant successfully completes core workflow (login, create load, dispatch, settle) | Manual validation checklist sign-off                               |
| 2   | No data integrity issues during pilot period                                             | DB row counts stable; no unexpected NULLs or constraint violations |
| 3   | 24-hour soak: error rate < 1%, p99 < 2s                                                  | Cloud Monitoring dashboard screenshot                              |
| 4   | Zero P0 bugs reported by pilot tenant                                                    | Support queue review                                               |

### Rollback Trigger

- P0 bug affecting pilot tenant
- Data integrity violation detected
- Error rate > 5% sustained for 10 minutes

---

## Gate 3 — General Availability (Full Production Deploy)

**Objective**: Full production rollout to all tenants.

### Entry Criteria

- Gates 0, 1, and 2 fully passed
- 24-hour soak from Gate 2 completed with no issues
- All rollback drills documented
- Post-mortem from any Gate 2 issues resolved

### Deploy Steps

No additional deployment steps required if Gate 2 used the production infrastructure. Gate 3 is a traffic/access enablement step:

```bash
# If previously behind a feature flag or tenant whitelist, enable for all tenants
# [Operator-specific: update tenant whitelist, remove feature flag, etc.]

echo "GA release timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

### Exit Criteria

| #   | Criterion                                        | Verification                                     |
| --- | ------------------------------------------------ | ------------------------------------------------ |
| 1   | All tenants can access the application           | Smoke health check from multiple tenant accounts |
| 2   | Error rate < 0.5% over first 48 hours            | Cloud Monitoring dashboard                       |
| 3   | No P0 or P1 bugs reported in first 48 hours      | Support queue review                             |
| 4   | Rollback criteria documented and on-call briefed | On-call runbook updated                          |

### 48-Hour Monitoring Period

Post-GA, maintain heightened monitoring for 48 hours:

- Cloud Monitoring alert: error rate > 2% → page on-call immediately
- Cloud Monitoring alert: p99 > 3s for 5 minutes → page on-call
- Daily Cloud Logging review at 09:00 UTC

### Rollback Criteria (GA period)

- P0 bug affecting multiple tenants
- Error rate > 5% for 5 minutes
- Data integrity violation in production
- Security incident

Execute `ROLLBACK_PROCEDURE.md` immediately if any trigger fires.

---

## Gate Summary

| Gate   | Trigger              | Key Requirement                      | Go Condition        |
| ------ | -------------------- | ------------------------------------ | ------------------- |
| Gate 0 | Pre-deploy           | **Baseline suite green** (hard gate) | All 5 criteria pass |
| Gate 1 | Staging canary       | E2E + rollback drill + 1h soak       | All 5 criteria pass |
| Gate 2 | Limited production   | Pilot tenant + 24h soak              | All 4 criteria pass |
| Gate 3 | General availability | GA release + 48h monitoring          | All 4 criteria pass |

---

## Revision History

| Version | Date       | Author                | Changes              |
| ------- | ---------- | --------------------- | -------------------- |
| 1.0     | 2026-03-11 | ralph-story STORY-005 | Initial rollout plan |
