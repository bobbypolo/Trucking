# LoadPilot — Master Operator Command Checklist

> Version: 1.0 | Last Updated: 2026-03-13
> Purpose: Step-by-step production deployment runbook with exact copy-paste commands.
> An operator following this document from top to bottom should be able to deploy LoadPilot
> to production without referring to any other document.
>
> Cross-references: `DEPLOYMENT_RUNBOOK.md`, `ROLLBACK_PROCEDURE.md`, `GO_NO_GO_CHECKLIST.md`,
> `STAGING_EXECUTION_EVIDENCE.md`, `ENV_INVENTORY.md`, `RESTORE_PROCEDURE.md`

---

## STOP — Fill In These Values Before Starting

Copy this block into a local scratch file and fill in every blank. You will reference these
values throughout the procedure. **Never paste real values into this document.**

```
PROD_PROJECT_ID:              _______________
Production domain:            app.loadpilot.com
Service account:              loadpilot-api-prod-sa@$PROD_PROJECT_ID.iam.gserviceaccount.com
Cloud SQL connection name:    $PROD_PROJECT_ID:us-central1:loadpilot-prod
DB_PASSWORD_PROD secret:      (stored in Secret Manager — do not write here)
GEMINI_API_KEY_PROD secret:   (stored in Secret Manager — do not write here)
Notification email:           _______________
On-call engineer (primary):   _______________
On-call engineer (backup):    _______________
RC git tag:                   rc-1.0.0
Docker image tag:             REPLACE_WITH_FULL_IMAGE_TAG
Docker image digest:          REPLACE_WITH_SHA256_DIGEST
Firebase Hosting version:     REPLACE_WITH_FIREBASE_HOSTING_VERSION_ID
Prior good Cloud Run revision: REPLACE_WITH_PRIOR_REVISION_NAME
Prior good Firebase version:   REPLACE_WITH_PRIOR_FIREBASE_VERSION
```

Set the project ID in your shell now and keep it set for the entire session:

```bash
export PROD_PROJECT_ID="REPLACE_WITH_YOUR_PROD_PROJECT_ID"
gcloud config set project $PROD_PROJECT_ID
```

---

## Pre-Flight: Prerequisites

Before running any section, confirm these tools are installed and authenticated:

```bash
# Verify tool versions
gcloud version | head -1
firebase --version
docker --version
git --version
node --version
npx playwright --version

# Verify gcloud authentication
gcloud auth list
gcloud config get-value project   # Must match $PROD_PROJECT_ID

# Verify Firebase authentication
firebase login --no-localhost      # Skip if already logged in
firebase projects:list             # Confirm prod project appears
```

- [ ] `gcloud` authenticated with an account that has `roles/owner` or equivalent on `$PROD_PROJECT_ID`
- [ ] `firebase` CLI authenticated and prod project visible in `firebase projects:list`
- [ ] Docker daemon running (`docker info` returns without error)
- [ ] Node.js >= 18 installed (`node --version`)
- [ ] Working directory is the repository root (`ls package.json` succeeds)
- [ ] Current branch is `main` and all PR work is merged

---

## Section A — Release Candidate Freeze

> Goal: Lock the exact artifact set for this production deployment. Every downstream step
> must trace back to these artifacts. No changes are permitted after this section completes.

### A.1 Confirm PR #16 Merged

```bash
# Confirm the feature branch is merged and main is up to date
git fetch origin
git log --oneline origin/main | head -5
# Verify the expected commit message from PR #16 appears in the log
```

- [ ] PR #16 is merged into `main`
- [ ] Local `main` is up to date with `origin/main`

### A.2 Freeze the Release Candidate

```bash
# Create the RC tag (idempotent if already exists — script checks)
bash scripts/freeze-rc.sh

# Verify the tag was created and annotated
git show rc-1.0.0
```

- [ ] `rc-1.0.0` tag exists on the correct commit
- [ ] `git show rc-1.0.0` displays the expected commit message and author

### A.3 Record the Exact Artifact Identifiers

Run these commands and paste the outputs into your scratch file under the placeholder names
listed in the header block above.

```bash
# Exact git commit SHA (40 characters)
git rev-parse rc-1.0.0

# Exact Docker image tag (written by freeze-rc.sh or build script)
# Example format: us-central1-docker.pkg.dev/$PROD_PROJECT_ID/loadpilot/loadpilot-api:rc-1.0.0
echo "Docker image tag: REPLACE_WITH_FULL_IMAGE_TAG"

# Exact Docker image digest (sha256:...)
docker inspect --format='{{index .RepoDigests 0}}' \
  us-central1-docker.pkg.dev/$PROD_PROJECT_ID/loadpilot/loadpilot-api:rc-1.0.0

# Firebase Hosting version ID (after staging deploy — update after Section F)
firebase hosting:releases --project $PROD_PROJECT_ID --limit 3
```

- [ ] Git commit SHA recorded (40-char hex)
- [ ] Docker image tag recorded (full registry path including tag)
- [ ] Docker image digest recorded (sha256:...)
- [ ] Firebase Hosting deploy/version ID recorded
- [ ] `docs/deployment/STAGING_EXECUTION_EVIDENCE.md` completed with real outputs
- [ ] `docs/deployment/GO_NO_GO_CHECKLIST.md` updated with actual verified values
- [ ] Rollback procedure in `docs/deployment/ROLLBACK_PROCEDURE.md` references the
      exact prior good revision name and Firebase Hosting version (filled in scratch file above)

---

## Section B — Production Project & Identity

> Goal: Confirm the dedicated production GCP project exists with Firebase enabled, and that
> the Cloud Run runtime service account has exactly the IAM roles it needs — no more.

### B.1 Confirm Production GCP Project

```bash
# Confirm the project exists and is active
gcloud projects describe $PROD_PROJECT_ID --format="value(lifecycleState)"
# Expected output: ACTIVE

# Confirm billing is enabled (Cloud Run and Cloud SQL require billing)
gcloud beta billing projects describe $PROD_PROJECT_ID --format="value(billingEnabled)"
# Expected output: True
```

- [ ] Project lifecycle state is `ACTIVE`
- [ ] Billing is enabled

### B.2 Enable Required APIs

```bash
# Enable all required GCP APIs (idempotent)
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  firebase.googleapis.com \
  cloudbuild.googleapis.com \
  iam.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --project=$PROD_PROJECT_ID

# Verify
gcloud services list --enabled --project=$PROD_PROJECT_ID \
  --filter="name:(run.googleapis.com OR sqladmin.googleapis.com OR secretmanager.googleapis.com)" \
  --format="table(name,state)"
```

- [ ] `run.googleapis.com` ENABLED
- [ ] `sqladmin.googleapis.com` ENABLED
- [ ] `secretmanager.googleapis.com` ENABLED
- [ ] `artifactregistry.googleapis.com` ENABLED

### B.3 Enable Firebase on the Project

```bash
# This is done via Firebase Console or the Firebase Management API.
# Verify Firebase is enabled:
firebase projects:list | grep $PROD_PROJECT_ID
# Expected: $PROD_PROJECT_ID appears in the list
```

- [ ] Firebase project visible in `firebase projects:list`

### B.4 Create Production Firebase Web App

```bash
# Create the Firebase web app (run once — skip if already exists)
firebase apps:create WEB "LoadPilot Production" --project $PROD_PROJECT_ID

# Retrieve the Firebase config (copy output into .env.production)
firebase apps:sdkconfig WEB --project $PROD_PROJECT_ID
```

Copy the SDK config output into `.env.production`:

```
VITE_FIREBASE_API_KEY=REPLACE_WITH_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=$PROD_PROJECT_ID.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=$PROD_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=$PROD_PROJECT_ID.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=REPLACE_WITH_SENDER_ID
VITE_FIREBASE_APP_ID=REPLACE_WITH_APP_ID
```

- [ ] Firebase web app created (or confirmed existing)
- [ ] All `VITE_FIREBASE_*` values populated in `.env.production`

### B.5 Provision All Production Infrastructure

```bash
# This script creates: Artifact Registry, Cloud SQL, service account, Secret Manager secrets
bash scripts/provision-production.sh
```

- [ ] Script exits with code 0 (no errors)
- [ ] Artifact Registry repository `loadpilot` exists in `us-central1`
- [ ] Cloud SQL instance `loadpilot-prod` is `RUNNABLE` (verified in Section D)
- [ ] Service account `loadpilot-api-prod-sa` exists (verified below)

### B.6 Verify Service Account

```bash
gcloud iam service-accounts describe \
  loadpilot-api-prod-sa@${PROD_PROJECT_ID}.iam.gserviceaccount.com \
  --project=$PROD_PROJECT_ID
# Expected: displayName, email, and uniqueId fields printed — no error
```

- [ ] Service account describe returns without error

### B.7 Verify IAM Bindings

The service account must have exactly these three roles and no others on the production project:

| Role                                 | Purpose                              |
| ------------------------------------ | ------------------------------------ |
| `roles/cloudsql.client`              | Connect to Cloud SQL via Unix socket |
| `roles/secretmanager.secretAccessor` | Read secrets at runtime              |
| `roles/iam.serviceAccountUser`       | Allow Cloud Run to act as this SA    |

```bash
# List all IAM bindings for the service account
gcloud projects get-iam-policy $PROD_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:loadpilot-api-prod-sa" \
  --format="table(bindings.role,bindings.members)"
```

Expected output contains exactly:

```
ROLE                                        MEMBERS
roles/cloudsql.client                       serviceAccount:loadpilot-api-prod-sa@...
roles/iam.serviceAccountUser                serviceAccount:loadpilot-api-prod-sa@...
roles/secretmanager.secretAccessor          serviceAccount:loadpilot-api-prod-sa@...
```

- [ ] `roles/cloudsql.client` binding present
- [ ] `roles/secretmanager.secretAccessor` binding present
- [ ] `roles/iam.serviceAccountUser` binding present
- [ ] No unexpected additional roles (principle of least privilege)

---

## Section C — Production Secrets & Config

> Goal: All runtime configuration is stored in GCP Secret Manager or as Cloud Run environment
> variables. No secrets are in the container image, source code, or `.env` files committed to git.

### C.1 Secrets Inventory

The following values must be stored in Secret Manager before deploying:

| Secret Name           | Sensitivity   | Notes                                     |
| --------------------- | ------------- | ----------------------------------------- |
| `DB_PASSWORD_PROD`    | P0 — Critical | MySQL password for `trucklogix_prod` user |
| `GEMINI_API_KEY_PROD` | P0 — Critical | Google Gemini AI API key (server-only)    |

### C.2 Store Secrets in Secret Manager

```bash
# Store DB_PASSWORD_PROD
# (you will be prompted — paste the password and press Enter, then Ctrl+D)
gcloud secrets create DB_PASSWORD_PROD \
  --replication-policy="automatic" \
  --project=$PROD_PROJECT_ID
printf "REPLACE_WITH_DB_PASSWORD" | \
  gcloud secrets versions add DB_PASSWORD_PROD \
  --data-file=- \
  --project=$PROD_PROJECT_ID

# Store GEMINI_API_KEY_PROD
gcloud secrets create GEMINI_API_KEY_PROD \
  --replication-policy="automatic" \
  --project=$PROD_PROJECT_ID
printf "REPLACE_WITH_GEMINI_API_KEY" | \
  gcloud secrets versions add GEMINI_API_KEY_PROD \
  --data-file=- \
  --project=$PROD_PROJECT_ID
```

### C.3 Verify Secrets Are Accessible

```bash
for secret in DB_PASSWORD_PROD GEMINI_API_KEY_PROD; do
  gcloud secrets versions access latest --secret=$secret \
    --project=$PROD_PROJECT_ID > /dev/null 2>&1 \
    && echo "OK: $secret" \
    || echo "MISSING: $secret"
done
```

- [ ] `OK: DB_PASSWORD_PROD`
- [ ] `OK: GEMINI_API_KEY_PROD`

### C.4 Required Non-Secret Environment Variables for Cloud Run

These are set directly as environment variables on the Cloud Run service (not in Secret Manager):

| Variable              | Value                                                   |
| --------------------- | ------------------------------------------------------- |
| `PROD_PROJECT_ID`     | Your GCP project ID                                     |
| `FIREBASE_PROJECT_ID` | Same as `PROD_PROJECT_ID`                               |
| `CORS_ORIGIN`         | `https://app.loadpilot.com`                             |
| `DB_NAME`             | `trucklogix_prod`                                       |
| `DB_USER`             | `trucklogix_prod`                                       |
| `DB_SOCKET_PATH`      | `/cloudsql/$PROD_PROJECT_ID:us-central1:loadpilot-prod` |
| `NODE_ENV`            | `production`                                            |
| `VITE_API_URL`        | `/api` (build-time, set in `.env.production`)           |

```bash
# Verify NODE_ENV will be set correctly (after deploy — check via gcloud)
gcloud run services describe loadpilot-api-prod \
  --project=$PROD_PROJECT_ID \
  --region=us-central1 \
  --format="yaml(spec.template.spec.containers[0].env)"
# Confirm NODE_ENV=production appears in output
```

- [ ] `CORS_ORIGIN` set to `https://app.loadpilot.com` (NOT `*`, NOT localhost)
- [ ] `NODE_ENV` set to `production`
- [ ] `DB_SOCKET_PATH` uses the correct Cloud SQL connection name
- [ ] `DB_NAME` set to `trucklogix_prod`
- [ ] `DB_USER` set to `trucklogix_prod`

### C.5 Required Frontend Config in `.env.production`

```bash
# Confirm .env.production exists and is gitignored
ls -la .env.production
git status .env.production    # Must show "(untracked)" or not appear — never staged

# Confirm all VITE_FIREBASE_* keys are present (non-empty)
grep -c "VITE_FIREBASE_" .env.production
# Expected: 6 (one per Firebase config key)
```

Optional variables (populate if features should be active at launch):

```bash
# Google Maps (required for map route feature)
# VITE_GOOGLE_MAPS_API_KEY=REPLACE_WITH_MAPS_KEY

# Azure Maps Weather (required for weather overlay)
# VITE_WEATHER_API_KEY=REPLACE_WITH_WEATHER_KEY
```

- [ ] `.env.production` exists locally and is NOT committed to git
- [ ] All 6 `VITE_FIREBASE_*` values populated
- [ ] `VITE_API_URL=/api` set (routes frontend API calls through Firebase Hosting rewrite)
- [ ] Decision made on `VITE_GOOGLE_MAPS_API_KEY` (populate or intentionally omit)

### C.6 Pre-Production Key Rotation (MANDATORY)

Per `ENV_INVENTORY.md` security notes: two keys were previously committed to git history
and must be rotated to new values before any production deployment.

```bash
# Verify these secrets are using newly generated values (not the old committed values)
# JWT_SECRET: generate a new cryptographically random 32-byte value
#   openssl rand -base64 48
#
# GOOGLE_MAPS_API_KEY: regenerate in GCP Console with referrer restrictions
#   https://console.cloud.google.com/apis/credentials?project=$PROD_PROJECT_ID
```

- [ ] `JWT_SECRET` rotated to a new value (minimum 32 bytes, generated with `openssl rand`)
- [ ] `GOOGLE_MAPS_API_KEY` regenerated in GCP Console with HTTP referrer restriction
      set to `https://app.loadpilot.com/*`

---

## Section D — Database & Recovery Protection

> Goal: Production Cloud SQL instance is running with automated backups, PITR, and 7-day
> retention. Migrations 001-016 are applied. Recovery procedure is documented and verified.

### D.1 Verify Cloud SQL Instance State

```bash
# Confirm instance is RUNNABLE
gcloud sql instances describe loadpilot-prod \
  --project=$PROD_PROJECT_ID \
  --format="value(state)"
# Expected output: RUNNABLE

# Confirm instance details
gcloud sql instances describe loadpilot-prod \
  --project=$PROD_PROJECT_ID \
  --format="yaml(databaseVersion,settings.tier,settings.locationPreference,region)"
```

- [ ] Instance state is `RUNNABLE`
- [ ] Database version is `MYSQL_8_0` (or confirmed version)
- [ ] Instance is in `us-central1` region

### D.2 Verify Production Database and User Exist

```bash
# List databases on the instance
gcloud sql databases list --instance=loadpilot-prod \
  --project=$PROD_PROJECT_ID \
  --format="table(name)"
# Expected: trucklogix_prod appears

# List users on the instance
gcloud sql users list --instance=loadpilot-prod \
  --project=$PROD_PROJECT_ID \
  --format="table(name,host)"
# Expected: trucklogix_prod user appears
```

- [ ] Database `trucklogix_prod` exists
- [ ] User `trucklogix_prod` exists

### D.3 Enable Automated Backups and PITR

```bash
# Configure backups and PITR (idempotent)
bash scripts/backup-setup.sh

# Verify backup configuration
gcloud sql instances describe loadpilot-prod \
  --project=$PROD_PROJECT_ID \
  --format="value(settings.backupConfiguration)"
```

Expected backup configuration output includes:

- `binaryLogEnabled: true` (enables PITR)
- `enabled: true` (enables automated backups)
- `startTime` (daily backup window, e.g. `04:00`)
- `transactionLogRetentionDays: 7`

```bash
# Explicit PITR verification
gcloud sql instances describe loadpilot-prod \
  --project=$PROD_PROJECT_ID \
  --format="json(settings.backupConfiguration)" | \
  python3 -c "import sys,json; c=json.load(sys.stdin)['settings']['backupConfiguration']; \
  print('Backups enabled:', c.get('enabled')); \
  print('Binary log (PITR):', c.get('binaryLogEnabled')); \
  print('Log retention days:', c.get('transactionLogRetentionDays'))"
```

- [ ] `enabled: true` (automated daily backups on)
- [ ] `binaryLogEnabled: true` (PITR enabled)
- [ ] `transactionLogRetentionDays` is `7`
- [ ] Backup start time is in a low-traffic window (e.g. 04:00 UTC)

### D.4 Verify Retention Policy

```bash
# Verify backup retention settings
gcloud sql instances describe loadpilot-prod \
  --project=$PROD_PROJECT_ID \
  --format="value(settings.backupConfiguration.backupRetentionSettings)"
# Expected: retainedBackups=7, retentionUnit=COUNT (or equivalent 7-day policy)
```

- [ ] At least 7 daily backups retained
- [ ] First automated backup completed (check backup list after 24 hours)

### D.5 Document Restore Procedure Reference

- [ ] `docs/deployment/RESTORE_PROCEDURE.md` has been read end-to-end by the on-call engineer
- [ ] On-call engineer knows the exact commands to initiate a PITR restore
- [ ] Target recovery time (RTO) and recovery point (RPO) are understood:
      RTO target: < 15 minutes | RPO target: < 5 minutes (with PITR)

### D.6 Run Database Migrations

```bash
# Apply all 16 migrations (001 through 016) to production Cloud SQL
export PROD_PROJECT_ID="$PROD_PROJECT_ID" && bash scripts/run-production-migrations.sh
# This script requires PROD_PROJECT_ID and DB_PASSWORD_PROD env vars.
# It uses Cloud SQL Proxy on port 3308 to connect to loadpilot-prod.

# Verify migrations applied
npx tsx -e "
import { MigrationRunner } from './server/lib/migrator.js';
import { createPool } from './server/db.js';
const pool = createPool();
const runner = new MigrationRunner(pool, './server/migrations');
const status = await runner.status();
console.log('Applied:', status.applied.length, 'migrations');
console.log('Pending:', status.pending.length, 'migrations');
console.log('Last applied:', status.applied.slice(-1)[0] || 'none');
await pool.end();
" 2>&1
```

- [ ] All 16 migrations (001 through 016) applied
- [ ] 0 pending migrations
- [ ] Migration runner reports `"overallPassed": true`
- [ ] Last applied migration is `016_exception_management` (or equivalent final migration)

---

## Section E — Backend Deployment Verification

> Goal: Cloud Run service is live, using the correct service account and Cloud SQL connection,
> all secrets are injected correctly, health check returns 200, and auth enforcement is active.

### E.1 Build and Deploy to Cloud Run

```bash
# Build Docker image and deploy to Cloud Run (blue/green with --no-traffic)
bash scripts/deploy-production.sh

# The script deploys with --no-traffic. Traffic is switched in Section H (rollout gates).
# After this step, the service exists but receives 0% of production traffic.
```

- [ ] Script exits with code 0
- [ ] Cloud Run service `loadpilot-api-prod` exists in `us-central1`

### E.2 Confirm Service Configuration

```bash
# Verify service exists and was recently updated
gcloud run services describe loadpilot-api-prod \
  --project=$PROD_PROJECT_ID \
  --region=us-central1 \
  --format="yaml(status.url,spec.template.spec.serviceAccountName,spec.template.metadata.annotations)"
```

- [ ] Service URL is present (note it — this is `$CLOUD_RUN_URL`)
- [ ] `serviceAccountName` is `loadpilot-api-prod-sa@$PROD_PROJECT_ID.iam.gserviceaccount.com`
- [ ] `run.googleapis.com/cloudsql-instances` annotation contains `$PROD_PROJECT_ID:us-central1:loadpilot-prod`

### E.3 Retrieve the Cloud Run URL

```bash
CLOUD_RUN_URL=$(gcloud run services describe loadpilot-api-prod \
  --project=$PROD_PROJECT_ID \
  --region=us-central1 \
  --format="value(status.url)")
echo "Cloud Run URL: $CLOUD_RUN_URL"
# Export for use in subsequent commands this session
export CLOUD_RUN_URL
```

### E.4 Health Check

```bash
# Health check — must return 200
curl -s -o /dev/null -w "%{http_code}" ${CLOUD_RUN_URL}/api/health
# Expected: 200

# Full health response
curl -s ${CLOUD_RUN_URL}/api/health | python3 -m json.tool
# Expected: {"status":"ok","message":"LoadPilot API is running","timestamp":"..."}
```

- [ ] `/api/health` returns HTTP `200`
- [ ] Response body contains `"status": "ok"`

### E.5 Auth Enforcement Check

```bash
# Unauthenticated request to protected endpoint — must NOT return 500
curl -s -o /dev/null -w "%{http_code}" ${CLOUD_RUN_URL}/api/loads
# Expected: 401 or 403

curl -s -o /dev/null -w "%{http_code}" ${CLOUD_RUN_URL}/api/dispatch
# Expected: 401 or 403

curl -s -o /dev/null -w "%{http_code}" ${CLOUD_RUN_URL}/api/audit
# Expected: 401 or 403
```

- [ ] `/api/loads` returns `401` or `403` (NOT `500`, NOT `200`)
- [ ] `/api/dispatch` returns `401` or `403`
- [ ] `/api/audit` returns `401` or `403`

### E.6 Startup Log Review

```bash
# Check startup logs — look for errors in the first 50 entries
gcloud logging read \
  "resource.type=cloud_run_revision \
   AND resource.labels.service_name=loadpilot-api-prod" \
  --project=$PROD_PROJECT_ID \
  --limit=50 \
  --format=json | \
  python3 -c "
import sys, json
logs = json.load(sys.stdin)
for e in reversed(logs):
    sev = e.get('severity','INFO')
    msg = e.get('textPayload') or str(e.get('jsonPayload',{}).get('message',''))
    print(f'{sev}: {msg[:120]}')
"
```

Review the output for:

- [ ] No `ERROR` severity entries on startup
- [ ] No `Failed to connect to Cloud SQL` messages
- [ ] No `Secret not found` or `Permission denied` messages for Secret Manager
- [ ] No `Firebase Admin initialization failed` messages
- [ ] Startup message `LoadPilot API is running` (or equivalent) is present

### E.7 Automated Smoke Test

```bash
# Run the 8-point production smoke test
bash scripts/smoke-test-production.sh

# Run the full 10-point verification gate (auto-rollback if gate fails)
bash scripts/verify-production.sh
```

- [ ] `smoke-test-production.sh` exits with code 0
- [ ] `verify-production.sh` exits with code 0
- [ ] All 10 verification gate points reported as PASS

---

## Section F — Frontend Deployment Verification

> Goal: Firebase Hosting is live at `https://app.loadpilot.com`, the custom domain has a valid
> SSL certificate, the `/api/**` rewrite reaches Cloud Run, and the built bundle contains no
> localhost references.

### F.1 Build the Production Frontend

```bash
# Build with production environment
npm run build -- --mode production
# Reads .env.production for VITE_* variables

# Confirm build succeeded
ls -la dist/index.html
```

- [ ] Build completes without TypeScript errors
- [ ] `dist/index.html` exists

### F.2 Check for Localhost References in Built Bundle

```bash
# Must return no results — any match is a blocker
grep -r "localhost:5000" dist/ && echo "BLOCKER: localhost:5000 found in bundle" || echo "CLEAN: no localhost:5000 references"
grep -r "localhost:3000" dist/ && echo "BLOCKER: localhost:3000 found in bundle" || echo "CLEAN: no localhost:3000 references"
grep -r "127.0.0.1" dist/ && echo "WARNING: 127.0.0.1 found in bundle" || echo "CLEAN: no 127.0.0.1 references"
```

- [ ] No `localhost:5000` references in built JS/CSS
- [ ] No `localhost:3000` references in built JS/CSS
- [ ] `VITE_API_URL` is `/api` in the built bundle (routes through Hosting rewrite)

### F.3 Deploy to Firebase Hosting

```bash
# Deploy hosting only (backend deployed separately via Cloud Run)
firebase deploy --only hosting --project=$PROD_PROJECT_ID

# Record the deploy/version ID from the output
# Example output line: "Project Console: https://console.firebase.google.com/project/.../hosting/..."
```

- [ ] `firebase deploy` exits with code 0
- [ ] Firebase Hosting version ID recorded in the scratch file (needed for rollback)

### F.4 Verify Custom Domain and SSL

```bash
# Check domain resolves and returns 200 with valid SSL
curl -sI https://app.loadpilot.com | head -5
# Expected: HTTP/2 200 (or HTTP/1.1 200)
# Expected header: content-type: text/html

# Verify SSL certificate is valid (non-expired, correct hostname)
echo | openssl s_client -connect app.loadpilot.com:443 -servername app.loadpilot.com 2>/dev/null \
  | openssl x509 -noout -dates -subject
# Expected: notAfter date is in the future, subject contains app.loadpilot.com or loadpilot.com
```

- [ ] `https://app.loadpilot.com` returns HTTP `200`
- [ ] SSL certificate is valid and not expired
- [ ] SSL certificate covers `app.loadpilot.com`

### F.5 Verify API Rewrite

```bash
# The /api/** rewrite in firebase.json must route to Cloud Run
# This call goes through Hosting → Cloud Run → health endpoint
curl -s -o /dev/null -w "%{http_code}" https://app.loadpilot.com/api/health
# Expected: 200

# Full response through the rewrite
curl -s https://app.loadpilot.com/api/health | python3 -m json.tool
# Expected: {"status":"ok","message":"LoadPilot API is running","timestamp":"..."}
```

- [ ] `https://app.loadpilot.com/api/health` returns `200` (proves rewrite is active)
- [ ] Auth enforcement still active through the rewrite:

```bash
curl -s -o /dev/null -w "%{http_code}" https://app.loadpilot.com/api/loads
# Expected: 401 or 403
```

- [ ] `/api/loads` via the domain returns `401` or `403` (NOT `500`)

### F.6 Browser Smoke Test

Open `https://app.loadpilot.com` in an incognito browser window and verify:

- [ ] App loads without blank screen or JavaScript console errors
- [ ] Login page renders correctly
- [ ] Login with a valid test account succeeds
- [ ] Logout works (session is cleared, returns to login page)

---

## Section G — Core Workflow Smoke Test

> Goal: Manually verify every release-critical workflow on production before enabling broad
> traffic. A single failure in this section is a NO-GO. Do not proceed to Section H until
> all items are checked.

### G.1 Run Automated Smoke Tests

```bash
# Automated smoke against production domain
bash scripts/smoke-test-production.sh

# Full Playwright E2E smoke (requires PLAYWRIGHT_BASE_URL)
PLAYWRIGHT_BASE_URL=https://app.loadpilot.com \
  npx playwright test e2e/real-smoke.spec.ts --reporter=list 2>&1 | tail -20
```

- [ ] Automated smoke test exits with code 0
- [ ] E2E smoke passes (all tests green)

### G.2 Authentication

| Test                                    | Expected                           | Result |
| --------------------------------------- | ---------------------------------- | ------ |
| Login with valid credentials            | Redirect to dashboard              |        |
| Login with wrong password               | Error message shown, no redirect   |        |
| Login with unknown email                | Error message shown, no redirect   |        |
| Session persists across browser refresh | User stays logged in               |        |
| Logout                                  | Session cleared, redirect to login |        |

- [ ] All authentication tests pass

### G.3 Load CRUD Operations

| Test                                         | Expected                                  | Result |
| -------------------------------------------- | ----------------------------------------- | ------ |
| Create a new load                            | Load appears in list with assigned ID     |        |
| View load detail                             | All fields visible, no blank sections     |        |
| Edit load fields (origin, destination, rate) | Changes saved and reflected after refresh |        |
| Load persists after browser refresh          | Load is still present with saved values   |        |

- [ ] All load CRUD tests pass

### G.4 Dispatch Board & Status Transitions

| Test                                               | Expected                           | Result |
| -------------------------------------------------- | ---------------------------------- | ------ |
| Dispatch board renders all active loads            | No missing loads, no blank columns |        |
| Transition load status (e.g. Available → Assigned) | Status updates immediately in UI   |        |
| Assign driver to load                              | Assignment persists after refresh  |        |
| All 8 LoadStatus states reachable via UI           | No broken state transitions        |        |

- [ ] All dispatch board tests pass

### G.5 Settlements & Accounting

| Test                                           | Expected                             | Result |
| ---------------------------------------------- | ------------------------------------ | ------ |
| Settlement record created for a delivered load | Record appears in settlements list   |        |
| Settlement amounts calculate correctly         | Math is correct — no rounding errors |        |
| Accounting view reflects settlements           | No data mismatch between views       |        |

- [ ] All settlements/accounting tests pass

### G.6 Documents & Scanner

| Test                                | Expected                                                         | Result |
| ----------------------------------- | ---------------------------------------------------------------- | ------ |
| Upload a document (BOL or Rate-Con) | Upload succeeds, document visible in load detail                 |        |
| AI parsing triggered on upload      | Parsed fields populate (or graceful error if Gemini key not set) |        |
| Scanner flow completes              | Document associated with correct load                            |        |

- [ ] All documents/scanner tests pass

### G.7 Map Route

| Test                                 | Expected                                                           | Result |
| ------------------------------------ | ------------------------------------------------------------------ | ------ |
| Load detail shows map route          | Map renders (or graceful "Maps unavailable" banner if key not set) |        |
| Route displays origin to destination | Route line visible on map                                          |        |

- [ ] Map route test passes (or Maps key intentionally omitted — banner shown)

### G.8 Audit Endpoint

```bash
# Audit endpoint requires authentication — test via curl with a valid token
# Replace REPLACE_WITH_VALID_JWT with a real token from a logged-in session
curl -s -H "Authorization: Bearer REPLACE_WITH_VALID_JWT" \
  https://app.loadpilot.com/api/audit \
  | python3 -m json.tool | head -20
# Expected: paginated audit log entries, HTTP 200
```

- [ ] `/api/audit` returns `200` with paginated results for authenticated user
- [ ] Audit entries include timestamps, user IDs, and action types

### G.9 Tenant Isolation

| Test                                                   | Expected                                     | Result |
| ------------------------------------------------------ | -------------------------------------------- | ------ |
| User A cannot see User B's loads                       | User A's load list shows only User A's loads |        |
| User A cannot directly fetch a load ID owned by User B | Returns 403 or 404                           |        |
| Audit log shows only the current tenant's events       | No cross-tenant entries visible              |        |

- [ ] Tenant isolation verified across at least two test accounts

### G.10 Role-Based Access Control

| Test                                                          | Expected                      | Result |
| ------------------------------------------------------------- | ----------------------------- | ------ |
| Admin role sees all features (dispatch, accounting, settings) | Full feature set visible      |        |
| Driver role cannot access dispatch board or accounting        | Features hidden or return 403 |        |
| Customer role cannot access internal features                 | Features hidden or return 403 |        |

- [ ] RBAC verified for at least admin and one restricted role

### G.11 Full Automated Verification

```bash
# Run the full verification suite (all 10 gate points)
bash scripts/verify-production.sh
```

- [ ] All 10 gate points report PASS
- [ ] Script exits with code 0

---

## Section H — Observability & Rollback Readiness

> Goal: Monitoring alerts are live, the current revision is tagged, the rollback path is
> verified, and on-call is confirmed available before traffic is increased.

### H.1 Configure Monitoring Alerts

```bash
# Create error rate and latency alert policies with notification channel
NOTIFICATION_EMAIL=REPLACE_WITH_ONCALL_EMAIL \
  bash scripts/setup-monitoring.sh
```

Expected output includes:

- Error rate alert policy created: `> 5% for 5 minutes`
- Latency alert policy created: `p99 > 3 seconds for 5 minutes`
- Notification channel created for `REPLACE_WITH_ONCALL_EMAIL`

- [ ] Error rate alert policy created
- [ ] Latency alert policy created
- [ ] Notification channel created and verified (send test notification)
- [ ] Cloud Monitoring dashboard URL recorded: `_______________`

### H.2 Send Test Notification

```bash
# Trigger a test notification to confirm the on-call channel works
# Replace CHANNEL_ID with the notification channel ID from setup-monitoring.sh output
gcloud alpha monitoring channels verify REPLACE_WITH_CHANNEL_ID \
  --project=$PROD_PROJECT_ID
# On-call engineer should receive a test alert email within 2 minutes
```

- [ ] On-call engineer received the test alert email
- [ ] On-call engineer can respond to an alert within 15 minutes

### H.3 Record Current Revision

```bash
# List the three most recent revisions — note the current (newly deployed) and previous revisions
gcloud run revisions list \
  --service=loadpilot-api-prod \
  --project=$PROD_PROJECT_ID \
  --region=us-central1 \
  --limit=3 \
  --format="table(metadata.name,status.conditions[0].type,metadata.creationTimestamp,status.observedGeneration)"
```

Record in scratch file:

- Current revision (just deployed): `REPLACE_WITH_CURRENT_REVISION_NAME`
- Previous revision (known good): `REPLACE_WITH_PRIOR_REVISION_NAME`

- [ ] Current revision name recorded
- [ ] Previous revision name recorded (this is the rollback target)

### H.4 Verify Rollback Path is Ready

The rollback command should reference the exact prior good revision recorded above:

```bash
# Dry-run — confirm the previous revision name is valid
gcloud run revisions describe REPLACE_WITH_PRIOR_REVISION_NAME \
  --service=loadpilot-api-prod \
  --project=$PROD_PROJECT_ID \
  --region=us-central1 \
  --format="value(metadata.name,status.conditions[0].type)"
# Expected: revision name printed, status READY
```

- [ ] Previous revision exists and is `READY`
- [ ] Rollback command documented and verified in `docs/deployment/ROLLBACK_PROCEDURE.md`
- [ ] On-call engineer can execute `bash scripts/rollback-drill.sh` without assistance

### H.5 Execute Rollback Drill

```bash
# Run the full rollback drill — this deploys, then rolls back, then verifies
bash scripts/rollback-drill.sh
```

The drill must confirm:

- Deploy to new revision
- E2E smoke passes on new revision
- Rollback to prior revision (100% traffic)
- E2E smoke passes on prior revision
- Recovery declared

- [ ] Rollback drill completed successfully
- [ ] `docs/deployment/ROLLBACK_DRILL_EVIDENCE.md` updated with drill timestamps
- [ ] Post-rollback health check returns `200`
- [ ] Post-rollback E2E smoke passes

### H.6 Confirm On-Call Readiness

- [ ] Primary on-call engineer: `_______________ ` — confirmed available for 48-hour monitoring window
- [ ] Backup on-call engineer: `_______________` — confirmed reachable
- [ ] Both engineers have read `docs/deployment/ROLLBACK_PROCEDURE.md` end-to-end
- [ ] Both engineers have the production domain and Cloud Run URL
- [ ] Both engineers have access to GCP Console with sufficient IAM permissions

---

## Controlled Rollout — Traffic Gates

> Each gate increases traffic to the new revision. Monitor for the specified soak time before
> advancing. A hard-stop trigger at any gate requires immediate rollback — see section below.
> Do NOT advance gates ahead of schedule under any circumstances.

### Gate A — 5% Traffic, 2-Hour Soak

```bash
bash scripts/gate-a-internal.sh
```

Post-Gate A monitoring checklist (check every 30 minutes for 2 hours):

```bash
# Error rate (should be < 1%)
gcloud logging read \
  "resource.type=cloud_run_revision \
   AND resource.labels.service_name=loadpilot-api-prod \
   AND severity>=ERROR" \
  --project=$PROD_PROJECT_ID \
  --freshness=30m \
  --limit=10 \
  --format="table(timestamp,textPayload)"

# Health check
curl -s -o /dev/null -w "%{http_code}" https://app.loadpilot.com/api/health
```

- [ ] Gate A traffic split active: 5% new revision, 95% prior revision
- [ ] T+30m: health check 200, error rate < 1%
- [ ] T+60m: health check 200, error rate < 1%
- [ ] T+90m: health check 200, error rate < 1%
- [ ] T+120m (2h soak complete): health check 200, error rate < 1%
- [ ] Gate A soak CLEAN — proceed to Gate B

**If any check fails during Gate A soak:** execute rollback immediately (see Hard Stop section).

### Gate B — 10% Traffic, 24-Hour Soak

```bash
bash scripts/gate-b-pilot.sh
```

Post-Gate B monitoring checklist (check every 2 hours for 24 hours):

```bash
# Check recent error count
gcloud logging read \
  "resource.type=cloud_run_revision \
   AND resource.labels.service_name=loadpilot-api-prod \
   AND severity>=ERROR" \
  --project=$PROD_PROJECT_ID \
  --freshness=2h \
  --limit=20 \
  --format="table(timestamp,severity,textPayload)"
```

- [ ] Gate B traffic split active: 10% new revision, 90% prior revision
- [ ] 24-hour soak completed with no hard-stop triggers
- [ ] Cloud Monitoring error rate alert did NOT fire during soak
- [ ] Cloud Monitoring latency alert did NOT fire during soak
- [ ] Gate B soak CLEAN — proceed to Gate C

**If any alert fires during Gate B soak:** execute rollback immediately.

### Gate C — 50% Traffic, 24h + 48h Clean

```bash
bash scripts/gate-c-broader.sh
```

Gate C requires a minimum 24-hour soak, plus 48 hours of clean operation (zero hard-stop
triggers, zero alert firings) before Gate D is permitted.

- [ ] Gate C traffic split active: 50% new revision, 50% prior revision
- [ ] First 24-hour checkpoint: zero hard-stop triggers, zero alert firings
- [ ] 48-hour clean window started: `_______________ UTC`
- [ ] 48-hour clean window completed: `_______________ UTC`
- [ ] Cloud Monitoring error rate alert did NOT fire during 48-hour window
- [ ] Cloud Monitoring latency alert did NOT fire during 48-hour window
- [ ] Gate C soak CLEAN — proceed to Gate D

### Gate D — 100% GA

```bash
bash scripts/gate-d-ga.sh
```

- [ ] Gate D traffic split active: 100% new revision
- [ ] Health check returns 200 at 100% traffic
- [ ] Auth enforcement confirmed at 100% traffic:

```bash
curl -s -o /dev/null -w "%{http_code}" https://app.loadpilot.com/api/loads
# Expected: 401 or 403
```

- [ ] GA declared
- [ ] Announcement sent to stakeholders

**GA declared at:** `_______________ UTC`
**Declared by:** `_______________`

---

## Hard Stop / Rollback Triggers

Rollback **immediately and without waiting for root cause analysis** if any of the following
are observed at any point during or after deployment:

| Trigger                                            | Threshold                                                       |
| -------------------------------------------------- | --------------------------------------------------------------- |
| `/api/health` returning non-200                    | Any single failure — immediate rollback                         |
| Protected endpoints returning `500`                | Any occurrence — immediate rollback                             |
| Authentication failures (widespread, not isolated) | > 1% of login attempts failing — immediate rollback             |
| Cloud SQL connectivity failures                    | Any `ECONNREFUSED` or socket error in logs — immediate rollback |
| Migration corruption or missing tables             | Any schema error in logs — immediate rollback                   |
| Load creation or editing broken                    | Confirmed via smoke test — immediate rollback                   |
| Dispatch / status transitions broken               | Confirmed via smoke test — immediate rollback                   |
| Settlements or accounting data corruption          | Any data mismatch — immediate rollback                          |
| Tenant isolation breach                            | Any cross-tenant data leak — immediate rollback + incident      |
| Severe frontend blocking issue                     | App unusable for > 1% of users — immediate rollback             |
| Cloud Monitoring error rate alert fires            | > 5% error rate for 5 minutes — immediate rollback              |
| Cloud Monitoring latency alert fires               | p99 > 3s for 5 minutes — evaluate, rollback if not resolving    |

### Rollback Command

```bash
bash scripts/rollback-drill.sh
```

After rollback, verify recovery:

```bash
# Confirm rollback is complete and system is stable
curl -s https://app.loadpilot.com/api/health | python3 -m json.tool
# Expected: {"status":"ok",...}

# Confirm auth enforcement
curl -s -o /dev/null -w "%{http_code}" https://app.loadpilot.com/api/loads
# Expected: 401 or 403

# Run post-rollback smoke
PLAYWRIGHT_BASE_URL=https://app.loadpilot.com \
  npx playwright test e2e/real-smoke.spec.ts --reporter=list 2>&1 | tail -10
```

Record the incident:

```
Rollback initiated: _______________ UTC
Rollback completed: _______________ UTC
Triggering condition: _______________
Recovery confirmed: _______________ UTC
Root cause (brief): _______________
Post-mortem scheduled: _______________
```

---

## Go / No-Go Decision Rule

**GO only when ALL of the following are true:**

| Condition                                                         | Section | Status |
| ----------------------------------------------------------------- | ------- | ------ |
| RC frozen — git tag, Docker digest, Firebase version all recorded | A       | [ ]    |
| Production GCP project active, billing enabled, APIs enabled      | B       | [ ]    |
| Service account created with exactly 3 IAM roles                  | B       | [ ]    |
| All required secrets accessible in Secret Manager                 | C       | [ ]    |
| Pre-production key rotation completed (JWT_SECRET, Maps key)      | C       | [ ]    |
| Cloud SQL instance `RUNNABLE`, database and user exist            | D       | [ ]    |
| Automated backups enabled with PITR and 7-day retention           | D       | [ ]    |
| All 16 migrations applied (0 pending)                             | D       | [ ]    |
| Cloud Run service healthy (`/api/health` returns 200)             | E       | [ ]    |
| Auth enforcement active (protected endpoints return 401/403)      | E       | [ ]    |
| Startup logs clean (no SQL, Secret Manager, or Firebase errors)   | E       | [ ]    |
| Frontend deployed at `https://app.loadpilot.com` with valid SSL   | F       | [ ]    |
| No localhost references in built bundle                           | F       | [ ]    |
| API rewrite active through Firebase Hosting                       | F       | [ ]    |
| All Section G core workflows manually verified                    | G       | [ ]    |
| Monitoring alerts configured and test notification received       | H       | [ ]    |
| Rollback drill completed and evidenced                            | H       | [ ]    |
| On-call engineer confirmed available for 48-hour window           | H       | [ ]    |
| Zero open critical defects                                        | —       | [ ]    |
| Zero open major defects on release-critical workflows             | —       | [ ]    |

**If any item is unchecked: NO-GO. Do not advance traffic beyond Gate A.**

```
Go/No-Go Decision: [ ] GO    [ ] NO-GO

If NO-GO, blocking items: _______________

Decision made by: _______________
Title/Role: _______________
Date and time (UTC): _______________
```

---

## Revision History

| Version | Date       | Author           | Changes                                                                                                                                         |
| ------- | ---------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-03-13 | Builder (manual) | Initial master operator command checklist. Covers all 8 sections plus controlled rollout gates, hard-stop triggers, and Go/No-Go decision rule. |
