# Deployment Commands Reference

LoadPilot SaaS GCP Production Deployment Runbook.

All commands assume gcloud auth login completed and project configured.
Replace ALL_CAPS placeholders with your values.

---

## Phase 1 - GCP Project Bootstrap

Authenticate, set project, and enable required APIs.

Commands:
  gcloud auth login
  gcloud config set project PROJECT_ID
  gcloud config set compute/region REGION
  gcloud services enable sqladmin.googleapis.com run.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
  gcloud artifacts repositories create loadpilot --repository-format=docker --location=REGION

---

## Phase 2 - Cloud SQL Provisioning

Create Cloud SQL MySQL 8.0 instance, database, and user.

Commands:
  gcloud sql instances create loadpilot-staging --database-version=MYSQL_8_0 --tier=db-f1-micro --region=REGION --storage-auto-increase
  gcloud sql databases create trucklogix_staging --instance=loadpilot-staging
  gcloud sql users create DB_USER --instance=loadpilot-staging --password=DB_PASSWORD
  gcloud sql instances describe loadpilot-staging --format='value(connectionName)'
  # Output: PROJECT:REGION:INSTANCE -> use as DB_SOCKET_PATH=/cloudsql/PROJECT:REGION:INSTANCE

---

## Phase 3 - Secret Manager Setup

Store secrets in Secret Manager and configure service account IAM.

Commands:
  printf 'DB_PASSWORD_VALUE' | gcloud secrets create DB_PASSWORD --data-file=- --replication-policy=automatic
  printf 'GEMINI_KEY_VALUE' | gcloud secrets create GEMINI_API_KEY --data-file=- --replication-policy=automatic
  gcloud iam service-accounts create loadpilot-run --display-name='LoadPilot Cloud Run SA'
  gcloud secrets add-iam-policy-binding DB_PASSWORD --member=serviceAccount:loadpilot-run@PROJECT_ID.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor
  gcloud secrets add-iam-policy-binding GEMINI_API_KEY --member=serviceAccount:loadpilot-run@PROJECT_ID.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor
  gcloud projects add-iam-policy-binding PROJECT_ID --member=serviceAccount:loadpilot-run@PROJECT_ID.iam.gserviceaccount.com --role=roles/cloudsql.client

---

## Phase 4 - Docker Image Build and Push

Build the Docker image and push to Artifact Registry.

Commands:
  gcloud auth configure-docker REGION-docker.pkg.dev
  docker build -t REGION-docker.pkg.dev/PROJECT_ID/loadpilot/api:GIT_SHA -f Dockerfile .
  docker push REGION-docker.pkg.dev/PROJECT_ID/loadpilot/api:GIT_SHA

---

## Phase 5 - Cloud Run Deployment

Deploy backend API to Cloud Run using DB_SOCKET_PATH for Cloud SQL Unix socket.

Commands:
  gcloud run deploy loadpilot-api \
    --image=REGION-docker.pkg.dev/PROJECT_ID/loadpilot/api:GIT_SHA \
    --platform=managed --region=REGION \
    --service-account=loadpilot-run@PROJECT_ID.iam.gserviceaccount.com \
    --add-cloudsql-instances=PROJECT_ID:REGION:loadpilot-staging \
    --set-env-vars=NODE_ENV=production,DB_SOCKET_PATH=/cloudsql/PROJECT_ID:REGION:loadpilot-staging,DB_NAME=trucklogix_staging,DB_USER=DB_USER,PORT=8080 \
    --set-secrets=DB_PASSWORD=DB_PASSWORD:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest \
    --allow-unauthenticated --port=8080 --memory=512Mi --cpu=1

  gcloud run services describe loadpilot-api --platform=managed --region=REGION --format='value(status.url)'

---

## Phase 6 - Database Migrations

Run staging rehearsal script. Supports DB_SOCKET_PATH for Cloud SQL Unix socket.

Commands:
  # Dry run first
  DB_SOCKET_PATH=/cloudsql/PROJECT_ID:REGION:loadpilot-staging DB_USER=DB_USER DB_PASSWORD=DB_PASSWORD DB_NAME=trucklogix_staging npx ts-node server/scripts/staging-rehearsal.ts --dry-run

  # Apply all migrations
  DB_SOCKET_PATH=/cloudsql/PROJECT_ID:REGION:loadpilot-staging DB_USER=DB_USER DB_PASSWORD=DB_PASSWORD DB_NAME=trucklogix_staging npx ts-node server/scripts/staging-rehearsal.ts

  # Verify: overallPassed must be true in output JSON

---

## Phase 7 - Firebase Frontend Deployment

Build frontend and deploy to Firebase Hosting.

Commands:
  VITE_API_URL=/api npm run build
  npx firebase deploy --only hosting

  # Configure firebase.json rewrites so /api/** proxies to Cloud Run service loadpilot-api.

---

## Phase 8 - Staging Verification

Verify health, auth enforcement, and CORS headers.

Commands:
  # Health check (must return HTTP 200)
  curl -sf CLOUD_RUN_URL/health

  # Auth enforcement (must return 401, NOT 500)
  curl -s -o /dev/null -w '%{http_code}' CLOUD_RUN_URL/api/loads

  # CORS validation
  curl -sI -X OPTIONS CLOUD_RUN_URL/api/loads -H 'Origin: https://YOUR_DOMAIN.web.app' -H 'Access-Control-Request-Method: GET'

  # Full staging rehearsal with rollback drill
  DB_SOCKET_PATH=/cloudsql/PROJECT_ID:REGION:loadpilot-staging DB_USER=DB_USER DB_PASSWORD=DB_PASSWORD DB_NAME=trucklogix_staging npx ts-node server/scripts/staging-rehearsal.ts --rollback-test

---

## Phase 9 - Go/No-Go Checklist and Rollback Drill

Execute rollback drill and complete Go/No-Go gate checks.

Rollback drill commands:
  gcloud run deploy loadpilot-api --image=REGION-docker.pkg.dev/PROJECT_ID/loadpilot/api:PREV_SHA --platform=managed --region=REGION
  curl -sf CLOUD_RUN_URL/health
  gcloud run deploy loadpilot-api --image=REGION-docker.pkg.dev/PROJECT_ID/loadpilot/api:CURRENT_SHA --platform=managed --region=REGION

Go/No-Go gate verification:
  gcloud sql instances describe loadpilot-staging --format='value(state)'
  gcloud secrets list --filter='name:DB_PASSWORD'
  gcloud artifacts docker images list REGION-docker.pkg.dev/PROJECT_ID/loadpilot/api --limit=5
  gcloud run services describe loadpilot-api --platform=managed --region=REGION
  curl -sI https://YOUR_DOMAIN.web.app

  # Sign off checklist items 2-8 in GO_NO_GO_CHECKLIST.md

---

## Quick Reference

| Phase | Action | Key Tool |
|-------|--------|----------|
| 1 | GCP Bootstrap | gcloud services enable |
| 2 | Cloud SQL | gcloud sql instances create |
| 3 | Secrets | gcloud secrets create |
| 4 | Docker Build | docker build and push |
| 5 | Cloud Run | gcloud run deploy with DB_SOCKET_PATH |
| 6 | Migrations | npx ts-node server/scripts/staging-rehearsal.ts |
| 7 | Frontend | npx firebase deploy --only hosting |
| 8 | Verify | curl health and auth endpoints |
| 9 | Go/No-Go | sign off GO_NO_GO_CHECKLIST.md |

NOTE: Always use DB_SOCKET_PATH (not DB_HOST) for Cloud SQL Unix socket connections in Cloud Run.
DB_HOST is reserved for direct TCP connections in local dev or Cloud SQL Auth Proxy TCP mode.
