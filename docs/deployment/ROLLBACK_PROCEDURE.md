# Rollback Procedure — LoadPilot

> Version: 1.0 | Last Updated: 2026-03-11
> Targets: Cloud Run (backend) + Firebase Hosting (frontend) + Cloud SQL (database)

This document provides detailed numbered steps to execute a full rollback when a deployment fails or causes production issues. Execute steps in order. Do not skip steps unless the specific layer was not changed in the offending deployment.

---

## When to Execute This Procedure

- Health check (`/api/health`) returns non-200 after deploy
- Error rate > 5% sustained for 5 minutes (Cloud Monitoring alert)
- E2E smoke tests fail post-deploy
- On-call engineer judgement call (degraded UX, data integrity concern)

Trigger immediately. Do not wait for root cause analysis before initiating rollback.

---

## Step 1 — Cloud Run Traffic Rollback

Roll Cloud Run back to the previous stable revision immediately.

```bash
# Identify current and previous revisions
gcloud run revisions list --service=loadpilot-api-prod --region=us-central1 \
  --format="table(metadata.name,status.conditions[0].type,metadata.creationTimestamp)"

# Rollback: send 100% traffic to the previous revision
# Replace PREVIOUS_REVISION_NAME with the revision name from the list above
gcloud run services update-traffic loadpilot-api-prod \
  --to-revisions=PREVIOUS_REVISION_NAME=100 \
  --region=us-central1

echo "Cloud Run rollback timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

**Verification**: Health check should return 200 within 30 seconds.

```bash
curl -sf https://YOUR_HOSTING_URL/api/health | jq .status
# Expected: "ok"
```

---

## Step 2 — Firebase Hosting Rollback

Roll Firebase Hosting frontend back to the previous release.

```bash
# List recent releases to find the previous stable version
firebase hosting:releases --project YOUR_FIREBASE_PROJECT

# Clone (roll back) to the previous release version
# Replace PREVIOUS_VERSION with the version string from the list above
firebase hosting:clone YOUR_FIREBASE_PROJECT:PREVIOUS_VERSION YOUR_FIREBASE_PROJECT:live

echo "Firebase Hosting rollback timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

**Alternative**: Via Firebase Console → Hosting → Release History → Rollback button.

**Verification**: Open the hosting URL in a browser. Confirm the app loads and the version indicator (if any) shows the previous version.

---

## Step 3 — Cloud SQL Database Rollback via MigrationRunner.down()

Only execute this step if database migrations were applied in the failed deployment.

```bash
# Set Cloud SQL connection env vars
export DB_HOST=$(gcloud secrets versions access latest --secret=DB_HOST)
export DB_USER=$(gcloud secrets versions access latest --secret=DB_USER)
export DB_PASSWORD=$(gcloud secrets versions access latest --secret=DB_PASSWORD)
export DB_NAME=$(gcloud secrets versions access latest --secret=DB_NAME)

# Check current migration status
npx tsx -e "
import { MigrationRunner } from './server/lib/migrator.js';
import { createPool } from './server/db.js';
const pool = createPool();
const runner = new MigrationRunner(pool, './server/migrations');
const status = await runner.status();
console.log('Applied:', status.applied);
console.log('Pending:', status.pending);
await pool.end();
"

# Rollback the most recently applied migration
npx tsx server/scripts/staging-rehearsal.ts --rollback-test 2>&1 | tee /tmp/rollback-$(date +%Y%m%d-%H%M%S).log
echo "DB rollback exit code: $?"
echo "DB rollback timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

**Verification**: Re-run `staging-rehearsal.ts` (without `--rollback-test`). Confirm status is consistent. Check the app health endpoint.

**IMPORTANT**: If multiple migrations were applied, run `--rollback-test` once per migration level to roll back, in reverse order. Check status between each rollback.

---

## Step 4 — DNS / Traffic Cutover Reversal (if applicable)

If a DNS cutover or Cloud Load Balancer traffic split was applied as part of this deployment:

```bash
# If using Cloud Load Balancer traffic splitting
gcloud compute backend-services update loadpilot-backend \
  --global \
  --no-enable-cdn

# If using Cloud Armor or custom routing, reverse the policy
# [Operator-specific — document your specific traffic management setup here]

echo "DNS/traffic reversal timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

**Verification**: DNS propagation may take up to 5 minutes. Monitor Cloud Monitoring request routing metrics.

---

## Step 5 — Post-Rollback Verification

After completing Steps 1-4 (or the applicable subset), verify the system is fully recovered.

### 5a. Health Check

```bash
curl -sf https://YOUR_HOSTING_URL/api/health | jq .
# Expected: {"status":"ok","message":"LoadPilot API is running","timestamp":"..."}
```

### 5b. E2E Smoke Test

```bash
PLAYWRIGHT_BASE_URL=https://YOUR_HOSTING_URL \
  npx playwright test e2e/real-smoke.spec.ts --reporter=list 2>&1 | tail -20
# Expected: All smoke tests pass
```

### 5c. Cloud Logging Error Rate Check

```bash
# Check for errors in the last 15 minutes
gcloud logging read \
  "resource.type=cloud_run_revision AND severity>=ERROR AND resource.labels.service_name=loadpilot-api-prod" \
  --freshness=15m \
  --limit=20 \
  --format=json | jq 'length'
# Target: 0 or very low count (pre-rollback errors may still appear in history)
```

### 5d. Declare Recovery

Only declare recovery when:

- Health check returns 200
- E2E smoke passes
- Cloud Logging error rate returns to baseline (< 1%)
- On-call engineer confirms UX is stable

Record recovery timestamp:

```
Recovery declared: ______________ UTC
Rollback completed by: ______________
Root cause (brief): ______________
```

---

## Rollback Evidence Template

Copy this template to `docs/deployment/ROLLBACK_DRILL_EVIDENCE.md` or the incident record:

```
Rollback Evidence — [DATE]
==========================
Deployment timestamp: [UTC]
Pre-rollback health: PASS / FAIL
Pre-rollback E2E: PASS / FAIL
Rollback initiated: [UTC]
  - Step 1 (Cloud Run): [UTC]
  - Step 2 (Firebase Hosting): [UTC]
  - Step 3 (Cloud SQL): [UTC] (or N/A)
  - Step 4 (DNS): [UTC] (or N/A)
  - Step 5 (Post-verification): [UTC]
Post-rollback health: PASS / FAIL
Post-rollback E2E: PASS / FAIL
Recovery declared: [UTC]
```

---

## Revision History

| Version | Date       | Author                | Changes                    |
| ------- | ---------- | --------------------- | -------------------------- |
| 1.0     | 2026-03-11 | ralph-story STORY-005 | Initial rollback procedure |
