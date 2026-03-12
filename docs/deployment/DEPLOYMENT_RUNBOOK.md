# Deployment Runbook — LoadPilot (Cloud Run + Firebase Hosting)

> Version: 1.0 | Last Updated: 2026-03-11
> Deployment Targets: Cloud Run (backend) + Firebase Hosting (frontend)

This runbook covers every step required to deploy LoadPilot to production. Follow it in order. Do not skip steps. Gate 0 of the Controlled Rollout Plan must be GREEN before executing this runbook.

---

## Pre-Deploy Checklist

Complete all items before starting the Deploy Steps. Any NO answer is a hard stop.

| # | Check | Command / Evidence | Pass? |
|---|-------|-------------------|-------|
| 1 | All unit + integration tests pass (0 failures) | `cd server && npx vitest run 2>&1 \| grep "Tests"` shows 0 failed | [ ] |
| 2 | Migration rehearsal passed on staging Cloud SQL | `npx tsx server/scripts/staging-rehearsal.ts` exits 0 with `"overallPassed": true` | [ ] |
| 3 | Staging E2E functional sweep passed | `npx playwright test e2e/functional-sweep.spec.ts --reporter=list` shows all passing | [ ] |
| 4 | Staging rollback drill completed with evidence | See `docs/deployment/ROLLBACK_DRILL_EVIDENCE.md` | [ ] |
| 5 | Runbook reviewed by on-call operator | Sign-off: ______________ Date: ______________ | [ ] |
| 6 | All required env vars confirmed in GCP Secret Manager | See ENV_INVENTORY.md for full list | [ ] |
| 7 | Cloud Monitoring dashboard configured | See Post-Deploy Verification section | [ ] |
| 8 | On-call engineer assigned and available | Name: ______________ Contact: ______________ | [ ] |
| 9 | Baseline test suite is NOT materially red | **Go/No-Go CANNOT pass while baseline has unresolved failures** | [ ] |
| 10 | `npm run build` (Vite) completes with 0 errors | `npm run build 2>&1 \| tail -5` shows build success + dist/ populated | [ ] |
| 11 | Docker container builds and starts successfully | `docker build -t loadpilot-api . && docker run --rm loadpilot-api node -e "require('./dist/index.js')"` | [ ] |
| 12 | CORS_ORIGIN matches the Firebase Hosting domain | `echo $CORS_ORIGIN` matches the frontend URL | [ ] |

---

## Deploy Steps

### Step 1 — Build Frontend (Vite)

```bash
# From project root
npm run build
# Verify dist/ directory populated
ls dist/index.html dist/assets/
```

Expected: `dist/index.html` exists, `dist/assets/` contains chunked JS and CSS.

### Step 2 — Build Backend Container

```bash
# Build Docker image (tag with git SHA for traceability)
GIT_SHA=$(git rev-parse --short HEAD)
docker build -t gcr.io/YOUR_GCP_PROJECT/loadpilot-api:${GIT_SHA} .
docker push gcr.io/YOUR_GCP_PROJECT/loadpilot-api:${GIT_SHA}
echo "Image pushed: gcr.io/YOUR_GCP_PROJECT/loadpilot-api:${GIT_SHA}"
echo "Deploy timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

Record the deploy timestamp in your incident log.

### Step 3 — Run Migrations on Cloud SQL (Staging or Production)

```bash
# Set Cloud SQL connection env vars (from Secret Manager)
export DB_HOST=$(gcloud secrets versions access latest --secret=DB_HOST)
export DB_USER=$(gcloud secrets versions access latest --secret=DB_USER)
export DB_PASSWORD=$(gcloud secrets versions access latest --secret=DB_PASSWORD)
export DB_NAME=$(gcloud secrets versions access latest --secret=DB_NAME)

# Run full migration chain
npx tsx server/scripts/staging-rehearsal.ts 2>&1 | tee /tmp/migration-$(date +%Y%m%d-%H%M%S).log

# Verify exit 0 and overallPassed: true
echo "Exit code: $?"
```

If exit code is non-0 or `overallPassed` is false: **STOP. Do not proceed. Execute Rollback Procedure.**

### Step 4 — Deploy Backend to Cloud Run

```bash
gcloud run deploy loadpilot-api \
  --image gcr.io/YOUR_GCP_PROJECT/loadpilot-api:${GIT_SHA} \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --min-instances 1 \
  --set-secrets "DB_HOST=DB_HOST:latest,DB_USER=DB_USER:latest,DB_PASSWORD=DB_PASSWORD:latest,DB_NAME=DB_NAME:latest,FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID:latest,GOOGLE_APPLICATION_CREDENTIALS=GOOGLE_APPLICATION_CREDENTIALS:latest,CORS_ORIGIN=CORS_ORIGIN:latest" \
  --set-env-vars "NODE_ENV=production"

echo "Cloud Run deploy timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

Record the Cloud Run revision URL. Verify the service is SERVING:

```bash
gcloud run services describe loadpilot-api --region us-central1 --format="value(status.url)"
```

### Step 5 — Deploy Frontend to Firebase Hosting

```bash
firebase deploy --only hosting --project YOUR_FIREBASE_PROJECT
echo "Firebase Hosting deploy timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

Firebase Hosting rewrites `/api/*` requests to the Cloud Run service URL (configured in `firebase.json`).

### Step 6 — Verify Rewrite Configuration

```bash
# Confirm firebase.json rewrites /api/* to Cloud Run
cat firebase.json | grep -A5 "rewrites"
```

Expected: rewrite rule pointing `/api/**` to the Cloud Run service URL.

---

## Post-Deploy Verification

### Health Check

```bash
HOSTING_URL=https://YOUR_FIREBASE_HOSTING_URL
curl -sf ${HOSTING_URL}/api/health | jq .
# Expected: {"status":"ok","message":"LoadPilot API is running","timestamp":"..."}
```

If health check fails: **Execute Rollback Procedure immediately.**

### E2E Smoke Test (Against Production/Staging)

```bash
PLAYWRIGHT_BASE_URL=${HOSTING_URL} npx playwright test e2e/real-smoke.spec.ts --reporter=list 2>&1 | tail -20
```

Expected: All smoke tests pass.

### Cloud Monitoring Dashboard

1. Open GCP Console → Cloud Run → `loadpilot-api` → Metrics
2. Verify request count is > 0 (health check hits should register)
3. Verify error rate < 1%
4. Verify p99 latency < 2000ms
5. Set alert policy: error rate > 5% for 5 minutes → page on-call

### Cloud Logging — Verify Structured Logs

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=loadpilot-api" \
  --limit=20 \
  --format=json | jq '.[0].jsonPayload'
```

Expected: Structured pino JSON log entries (not raw text).

---

## Rollback Procedure

See `docs/deployment/ROLLBACK_PROCEDURE.md` for detailed numbered steps.

**Quick Reference** (execute in this order):

1. `gcloud run services update-traffic loadpilot-api --to-revisions=PREVIOUS=100 --region=us-central1`
2. `firebase hosting:clone SOURCE_SITE:SOURCE_VERSION DEST_SITE:live`
3. `npx tsx server/scripts/staging-rehearsal.ts --rollback-test` (triggers MigrationRunner.down() if needed)
4. DNS/traffic reversal if applicable
5. Post-rollback health check + E2E smoke

---

## Emergency Contacts

| Role | Contact | Escalation |
|------|---------|-----------|
| On-call engineer | See deployment Pre-Deploy Checklist item 8 | — |
| Firebase Support | https://firebase.google.com/support | GCP Console → Support |
| Cloud Run / GCP | https://cloud.google.com/support | GCP Console → Support |
| Database (Cloud SQL) | GCP Console → Cloud SQL → Instance → Connect | DBA lead |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-11 | ralph-story STORY-005 | Initial runbook creation |
