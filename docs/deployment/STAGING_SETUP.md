# Staging Environment Setup

> Deployment Targets (Locked):
>
> - **Backend**: Cloud Run (managed container runtime)
> - **Database**: Cloud SQL for MySQL (managed MySQL, separate from dev)
> - **Frontend**: Firebase Hosting (SPA with /api/\* rewrite to Cloud Run)
> - **Monitoring**: Cloud Logging + Cloud Monitoring (native to Cloud Run)

This document provides sequential setup steps for the LoadPilot staging environment. Complete each step in order. Do not proceed to Gate 1 (canary deploy) until all steps are verified.

---

## Automated Deployment Scripts

All manual commands in this document have been automated into scripts. Run them in order:

```bash
# Step 1: Provision GCP infrastructure (Cloud SQL, Artifact Registry, Secret Manager, service accounts)
bash scripts/provision-gcp.sh

# Step 2: Build Docker image, push to Artifact Registry, deploy Cloud Run + Firebase Hosting
bash scripts/deploy-staging.sh

# Step 3: Run database migrations against staging Cloud SQL via Cloud SQL Auth Proxy
bash scripts/run-staging-migrations.sh

# Step 4: Verify staging health, auth enforcement, and CORS
bash scripts/verify-staging.sh

# Step 5: Execute rollback drill
bash scripts/rollback-drill.sh

# Step 6: Configure Cloud Monitoring alert policies
bash scripts/setup-monitoring.sh
```

> **scripts/provision-gcp.sh** provisions Cloud SQL, Artifact Registry
> (`us-central1-docker.pkg.dev`), Secret Manager secrets (DB_PASSWORD and
> GEMINI_API_KEY only), and dedicated service account `loadpilot-api-sa`.
>
> **scripts/deploy-staging.sh** builds and pushes the Docker image to Artifact
> Registry, deploys Cloud Run `loadpilot-api` with dedicated service account
> (`--service-account=loadpilot-api-sa@...`) and sets `DB_SOCKET_PATH=/cloudsql/...`
> (not DB_HOST overloading), then deploys Firebase Hosting.
>
> **scripts/run-staging-migrations.sh** starts Cloud SQL Auth Proxy on port 3307
> (TCP mode) and runs `staging-rehearsal.ts`.
>
> **scripts/verify-staging.sh** runs health checks against both Cloud Run URL and
> Firebase Hosting URL, verifies auth returns 401/403 (not 500), validates CORS
> headers, and confirms the frontend bundle does not contain `localhost`.

---

## DB Connection — DB_SOCKET_PATH (Cloud Run)

Cloud Run connects to Cloud SQL via a Unix socket path, NOT via `DB_HOST`. Use
the dedicated `DB_SOCKET_PATH` environment variable (not an overloaded `DB_HOST`):

```
DB_SOCKET_PATH=/cloudsql/gen-lang-client-0535844903:us-central1:loadpilot-staging
```

`server/db.ts` checks `DB_SOCKET_PATH` first. If set, it uses the `socketPath`
parameter (Cloud SQL socket mode). Otherwise it falls back to `DB_HOST` + `DB_PORT`
for local TCP connections.

> Do NOT set `DB_HOST=/cloudsql/...` on Cloud Run. Use `DB_SOCKET_PATH` for
> socket-mode connections and leave `DB_HOST` for local dev only.

---


---

## Prerequisites

- GCP project created (separate from production)
- Firebase staging project created (separate from dev/prod)
- `gcloud` CLI installed and authenticated
- `firebase` CLI installed and authenticated
- Docker installed locally (for container builds)
- MySQL client available locally (for validation)

---

## Step 1 — Create Firebase Staging Project

Create a dedicated Firebase project for staging (never share with dev or prod).

```bash
# Create Firebase project via console or CLI
firebase projects:create loadpilot-staging

# Add Firebase Hosting to the staging project
firebase target:apply hosting loadpilot-staging loadpilot-staging

# Update firebase.json to add staging target:
# "targets": { "loadpilot-staging": { "hosting": { "target": "loadpilot-staging" } } }

# Enable Firebase Auth in the Firebase Console for loadpilot-staging project
# Copy Firebase config to .env.staging (VITE_FIREBASE_* vars)
```

**Verify**: Firebase Console shows `loadpilot-staging` project with Auth enabled.

---

## Step 2 — Provision Cloud SQL for MySQL Instance

Create a Cloud SQL MySQL 8.0 instance for staging. This is the **Database: Cloud SQL for MySQL** target.

```bash
# Create Cloud SQL instance (us-central1 or your preferred region)
gcloud sql instances create loadpilot-staging \
  --database-version=MYSQL_8_0 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --project=YOUR_GCP_PROJECT_ID

# Create staging database
gcloud sql databases create trucklogix_staging \
  --instance=loadpilot-staging \
  --project=YOUR_GCP_PROJECT_ID

# Create staging database user
gcloud sql users create trucklogix_staging \
  --instance=loadpilot-staging \
  --password=YOUR_SECURE_PASSWORD \
  --project=YOUR_GCP_PROJECT_ID

# Get connection name (needed for Cloud Run)
gcloud sql instances describe loadpilot-staging \
  --project=YOUR_GCP_PROJECT_ID \
  --format="value(connectionName)"
# Output: YOUR_GCP_PROJECT_ID:us-central1:loadpilot-staging
```

**Verify**: `gcloud sql instances list` shows `loadpilot-staging` with status `RUNNABLE`.

---

## Step 3 — Deploy Express Backend Container to Cloud Run

Build and deploy the Express server as a Cloud Run container. This is the **Backend: Cloud Run** target.

```bash
# Build production container (from repo root)
docker build -t gcr.io/YOUR_GCP_PROJECT_ID/loadpilot-server:staging -f Dockerfile.server .

# Push to Google Container Registry
docker push gcr.io/YOUR_GCP_PROJECT_ID/loadpilot-server:staging

# Deploy to Cloud Run with Cloud SQL connection
gcloud run deploy loadpilot-server-staging \
  --image=gcr.io/YOUR_GCP_PROJECT_ID/loadpilot-server:staging \
  --platform=managed \
  --region=us-central1 \
  --add-cloudsql-instances=YOUR_GCP_PROJECT_ID:us-central1:loadpilot-staging \
  --set-env-vars="NODE_ENV=staging" \
  --set-env-vars="DB_NAME=trucklogix_staging" \
  --set-env-vars="DB_USER=trucklogix_staging" \
  --set-env-vars="DB_HOST=/cloudsql/YOUR_GCP_PROJECT_ID:us-central1:loadpilot-staging" \
  --set-secrets="DB_PASSWORD=loadpilot-staging-db-password:latest" \
  --set-secrets="FIREBASE_PROJECT_ID=loadpilot-staging-firebase-project:latest" \
  --set-secrets="CORS_ORIGIN=loadpilot-staging-cors-origin:latest" \
  --set-secrets="GEMINI_API_KEY=loadpilot-staging-gemini-key:latest" \
  --allow-unauthenticated \
  --min-instances=1 \
  --project=YOUR_GCP_PROJECT_ID

# Get the Cloud Run service URL
gcloud run services describe loadpilot-server-staging \
  --region=us-central1 \
  --format="value(status.url)"
# Output: https://loadpilot-server-staging-XXXX-uc.a.run.app
```

**Verify**: `curl https://loadpilot-server-staging-XXXX-uc.a.run.app/api/health` returns `{"status":"ok"}`.

---

## Step 4 — Configure Firebase Hosting Rewrite to Cloud Run

Update `firebase.json` to route all `/api/*` requests from Firebase Hosting to the Cloud Run service. This connects the **Frontend: Firebase Hosting** to the **Backend: Cloud Run**.

```json
{
  "hosting": {
    "target": "loadpilot-staging",
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "loadpilot-server-staging",
          "region": "us-central1"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

```bash
# Build frontend with staging API URL
VITE_API_URL=https://loadpilot-server-staging-XXXX-uc.a.run.app/api npm run build

# Deploy to Firebase Hosting staging target
firebase deploy --only hosting:loadpilot-staging --project=loadpilot-staging
```

**Verify**: `curl https://loadpilot-staging.web.app/api/health` returns `{"status":"ok"}` (routes through Hosting to Cloud Run).

---

## Step 5 — Configure Environment Variables via Secret Manager

Store all P0/P1 secrets in GCP Secret Manager. Never hardcode secrets in Cloud Run env vars or source code.

```bash
# Create secrets (replace with actual values)
echo -n "YOUR_DB_PASSWORD" | \
  gcloud secrets create loadpilot-staging-db-password \
  --data-file=- --project=YOUR_GCP_PROJECT_ID

echo -n "loadpilot-staging" | \
  gcloud secrets create loadpilot-staging-firebase-project \
  --data-file=- --project=YOUR_GCP_PROJECT_ID

echo -n "https://staging.loadpilot.com" | \
  gcloud secrets create loadpilot-staging-cors-origin \
  --data-file=- --project=YOUR_GCP_PROJECT_ID

echo -n "YOUR_GEMINI_API_KEY" | \
  gcloud secrets create loadpilot-staging-gemini-key \
  --data-file=- --project=YOUR_GCP_PROJECT_ID

# Grant Cloud Run service account access to secrets
gcloud secrets add-iam-policy-binding loadpilot-staging-db-password \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=YOUR_GCP_PROJECT_ID
```

**Note on exception_management.sql**: The unnumbered migration `server/migrations/exception_management.sql` is NOT part of the automated chain (001-015). Before deploying to staging, apply it manually or number it as 016. See `ENV_INVENTORY.md` — Known Unnumbered Migration section for resolution path.

**Verify**: `gcloud secrets list --project=YOUR_GCP_PROJECT_ID` shows all staging secrets.

---

## Step 6 — Run Migration Chain Against Staging Cloud SQL

Apply all 15 migrations to the staging Cloud SQL database in order.

```bash
# Connect to Cloud SQL via Cloud SQL Auth Proxy (run in background)
cloud-sql-proxy YOUR_GCP_PROJECT_ID:us-central1:loadpilot-staging &

# Run migration chain via staging-rehearsal.ts (validates + applies)
DB_HOST=127.0.0.1 \
DB_USER=trucklogix_staging \
DB_PASSWORD=YOUR_DB_PASSWORD \
DB_NAME=trucklogix_staging \
npx tsx server/scripts/staging-rehearsal.ts

# OR apply via apply-migrations.sh (raw SQL, no validation)
DB_USER=trucklogix_staging \
DB_PASSWORD=YOUR_DB_PASSWORD \
DB_HOST=127.0.0.1 \
DB_NAME=trucklogix_staging \
bash server/scripts/apply-migrations.sh

# Apply unnumbered migration manually (if not yet numbered)
mysql -u trucklogix_staging -p -h 127.0.0.1 trucklogix_staging \
  < server/migrations/exception_management.sql
```

**Verify**: `staging-rehearsal.ts` outputs `"overallPassed": true` with 0 validation failures. All 15 numbered migrations appear in `SELECT * FROM _migrations` with `checksum_valid = 1`.

---

## Step 7 — End-to-End Verification

Run a full end-to-end verification of the staging environment.

```bash
# 1. Health check via Hosting (tests full routing chain)
curl -s https://staging.loadpilot.com/api/health | jq .
# Expected: {"status":"ok"}

# 2. Verify CORS headers are present
curl -I -X OPTIONS https://staging.loadpilot.com/api/loads \
  -H "Origin: https://staging.loadpilot.com"
# Expected: Access-Control-Allow-Origin: https://staging.loadpilot.com

# 3. Verify auth protection (no token should return 401)
curl -s https://staging.loadpilot.com/api/loads
# Expected: {"error": {"code": "AUTH_REQUIRED", ...}}

# 4. Check Cloud Logging for startup errors
gcloud logging read \
  'resource.type="cloud_run_revision" AND severity>=ERROR' \
  --project=YOUR_GCP_PROJECT_ID \
  --limit=20

# 5. Run E2E smoke tests against staging
E2E_BASE_URL=https://staging.loadpilot.com npx playwright test e2e/ --reporter=list

# 6. Verify Cloud Monitoring dashboard is receiving metrics
# Open: https://console.cloud.google.com/monitoring → Dashboard for loadpilot-server-staging
# Confirm: Request count, Error rate, Instance count are populating
```

**Verify**:

- All health checks return expected responses
- Cloud Logging shows no ERROR-level messages on startup
- Cloud Monitoring shows request metrics populating
- E2E smoke tests pass (or documented skip reasons)

---

## Deployment Target Summary

| Component                                        | Choice                                      | Notes                                                        |
| ------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------ |
| **Backend: Cloud Run**                           | `loadpilot-server-staging` in `us-central1` | Managed container, auto-scaling, min-instances=1 for staging |
| **Database: Cloud SQL for MySQL**                | `loadpilot-staging` MySQL 8.0               | Managed MySQL, separate instance from dev                    |
| **Frontend: Firebase Hosting**                   | `loadpilot-staging` Firebase project        | SPA with /api/\* rewrite to Cloud Run                        |
| **Monitoring: Cloud Logging + Cloud Monitoring** | Native to Cloud Run                         | Zero additional setup — stdout/stderr auto-captured          |

---

## Troubleshooting

| Symptom                                   | Likely Cause                                                         | Fix                                                                            |
| ----------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Cloud Run returns 500 on startup          | Missing required env var (DB_HOST, FIREBASE_PROJECT_ID, CORS_ORIGIN) | Check Cloud Logging for `Missing required environment variables` error         |
| `CORS_ORIGIN` startup failure             | `validateEnv()` fail-closed in staging/prod                          | Confirm `loadpilot-staging-cors-origin` secret exists and Cloud Run has access |
| `/api/health` returns 502                 | Cloud SQL connection failure                                         | Verify `--add-cloudsql-instances` flag and DB_HOST socket path                 |
| Hosting 404 on `/api/*`                   | Rewrite rule missing or incorrect serviceId                          | Verify `firebase.json` rewrite uses correct Cloud Run `serviceId`              |
| Migration fails with checksum error       | Migration file modified after first apply                            | Restore original migration file; do not modify applied migrations              |
| `exception_management.sql` tables missing | Unnumbered migration not applied                                     | Apply manually: `mysql ... < server/migrations/exception_management.sql`       |
