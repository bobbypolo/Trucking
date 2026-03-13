#!/usr/bin/env bash
# ==============================================================================
# provision-gcp.sh — GCP Infrastructure Provisioning Script for LoadPilot
# ==============================================================================
#
# PURPOSE:
#   Idempotent script that provisions all GCP infrastructure required for
#   LoadPilot staging deployment. Safe to re-run — all commands use existence
#   checks or || true to skip already-created resources.
#
# USAGE:
#   export DB_PASSWORD="<your-db-password>"
#   export GEMINI_API_KEY="<your-gemini-key>"  # optional
#   bash scripts/provision-gcp.sh
#
# REQUIREMENTS:
#   - gcloud CLI authenticated with sufficient IAM permissions
#   - DB_PASSWORD environment variable set (required for Cloud SQL user)
#
# DATABASE TIER NOTE (IMPORTANT):
#   This script uses db-f1-micro for the Cloud SQL instance.
#   db-f1-micro is a shared core tier — staging only, no SLA, not production-grade.
#   For production: use a dedicated-core tier (e.g., db-custom-1-3840 or higher).
#   This is acceptable for cheap staging but NOT suitable for production workloads.
#
# TARGET PROJECT: gen-lang-client-0535844903
# ARTIFACT REGISTRY: us-central1-docker.pkg.dev/gen-lang-client-0535844903/loadpilot
# CLOUD SQL: gen-lang-client-0535844903:us-central1:loadpilot-staging
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------------------
PROJECT_ID="${GCP_PROJECT:-gen-lang-client-0535844903}"
REGION="us-central1"
REGISTRY_REPO="loadpilot"
SQL_INSTANCE="loadpilot-staging"
SQL_DB="trucklogix_staging"
SQL_USER="trucklogix_staging"
SA_NAME="loadpilot-api-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Deployer account — the account running this script / CI account
DEPLOYER_ACCOUNT="${DEPLOYER_ACCOUNT:-$(gcloud config get-value account 2>/dev/null)}"

# ------------------------------------------------------------------------------
# Validate prerequisites
# ------------------------------------------------------------------------------
if [[ -z "${DB_PASSWORD:-}" ]]; then
  echo "ERROR: DB_PASSWORD environment variable is required." >&2
  exit 1
fi

echo "============================================================"
echo "LoadPilot GCP Provisioning"
echo "Project: ${PROJECT_ID}"
echo "Region:  ${REGION}"
echo "============================================================"

# ------------------------------------------------------------------------------
# Step 1: Enable required GCP APIs
# ------------------------------------------------------------------------------
echo ""
echo "--- Step 1: Enabling required APIs ---"

gcloud services enable run.googleapis.com \
  --project="${PROJECT_ID}" || true

gcloud services enable sqladmin.googleapis.com \
  --project="${PROJECT_ID}" || true

gcloud services enable secretmanager.googleapis.com \
  --project="${PROJECT_ID}" || true

gcloud services enable artifactregistry.googleapis.com \
  --project="${PROJECT_ID}" || true

gcloud services enable cloudbuild.googleapis.com \
  --project="${PROJECT_ID}" || true

echo "All 5 APIs enabled."

# ------------------------------------------------------------------------------
# Step 2: Create Artifact Registry repository (not deprecated GCR)
# ------------------------------------------------------------------------------
echo ""
echo "--- Step 2: Creating Artifact Registry repository ---"

gcloud artifacts repositories create "${REGISTRY_REPO}" \
  --repository-format=docker \
  --location="${REGION}" \
  --description="LoadPilot Docker images" \
  --project="${PROJECT_ID}" || true

echo "Artifact Registry repo '${REGISTRY_REPO}' ready."

# Configure Docker auth for Artifact Registry
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet || true

# ------------------------------------------------------------------------------
# Step 3: Create Cloud SQL instance
# IMPORTANT: db-f1-micro is staging only — shared core, no SLA.
#            Do NOT use in production. Use dedicated-core tier instead.
# ------------------------------------------------------------------------------
echo ""
echo "--- Step 3: Creating Cloud SQL instance (db-f1-micro — staging only, shared core, no SLA) ---"

if ! gcloud sql instances describe "${SQL_INSTANCE}" \
    --project="${PROJECT_ID}" &>/dev/null; then
  gcloud sql instances create "${SQL_INSTANCE}" \
    --database-version=MYSQL_8_0 \
    --tier=db-f1-micro \
    --region="${REGION}" \
    --storage-auto-increase \
    --no-backup \
    --project="${PROJECT_ID}"
  echo "Cloud SQL instance '${SQL_INSTANCE}' created."
else
  echo "Cloud SQL instance '${SQL_INSTANCE}' already exists — skipping."
fi

# ------------------------------------------------------------------------------
# Step 4: Create database and user
# ------------------------------------------------------------------------------
echo ""
echo "--- Step 4: Creating database and user ---"

gcloud sql databases create "${SQL_DB}" \
  --instance="${SQL_INSTANCE}" \
  --project="${PROJECT_ID}" || true

gcloud sql users create "${SQL_USER}" \
  --instance="${SQL_INSTANCE}" \
  --password="${DB_PASSWORD}" \
  --project="${PROJECT_ID}" || true

echo "Database '${SQL_DB}' and user '${SQL_USER}' ready."

# ------------------------------------------------------------------------------
# Step 5: Create secrets in Secret Manager
# SCOPE: Only REAL secrets — DB_PASSWORD and GEMINI_API_KEY.
#        Non-secret config (FIREBASE_PROJECT_ID, CORS_ORIGIN, DB_NAME, DB_USER,
#        NODE_ENV) are plain Cloud Run env vars — NOT stored in Secret Manager.
# ------------------------------------------------------------------------------
echo ""
echo "--- Step 5: Creating secrets in Secret Manager (real secrets only) ---"

# Secret 1: DB_PASSWORD
if ! gcloud secrets describe "DB_PASSWORD" \
    --project="${PROJECT_ID}" &>/dev/null; then
  echo -n "${DB_PASSWORD}" | gcloud secrets create "DB_PASSWORD" \
    --data-file=- \
    --replication-policy=automatic \
    --project="${PROJECT_ID}"
  echo "Secret 'DB_PASSWORD' created."
else
  # Update existing secret with new version
  echo -n "${DB_PASSWORD}" | gcloud secrets versions add "DB_PASSWORD" \
    --data-file=- \
    --project="${PROJECT_ID}" || true
  echo "Secret 'DB_PASSWORD' already exists — version updated."
fi

# Secret 2: GEMINI_API_KEY (optional)
if [[ -n "${GEMINI_API_KEY:-}" ]]; then
  if ! gcloud secrets describe "GEMINI_API_KEY" \
      --project="${PROJECT_ID}" &>/dev/null; then
    echo -n "${GEMINI_API_KEY}" | gcloud secrets create "GEMINI_API_KEY" \
      --data-file=- \
      --replication-policy=automatic \
      --project="${PROJECT_ID}"
    echo "Secret 'GEMINI_API_KEY' created."
  else
    echo -n "${GEMINI_API_KEY}" | gcloud secrets versions add "GEMINI_API_KEY" \
      --data-file=- \
      --project="${PROJECT_ID}" || true
    echo "Secret 'GEMINI_API_KEY' already exists — version updated."
  fi
else
  # Create placeholder if not provided
  if ! gcloud secrets describe "GEMINI_API_KEY" \
      --project="${PROJECT_ID}" &>/dev/null; then
    echo -n "PLACEHOLDER" | gcloud secrets create "GEMINI_API_KEY" \
      --data-file=- \
      --replication-policy=automatic \
      --project="${PROJECT_ID}"
    echo "Secret 'GEMINI_API_KEY' created (placeholder — update before use)."
  else
    echo "Secret 'GEMINI_API_KEY' already exists — skipping."
  fi
fi

echo "Secrets configured (DB_PASSWORD, GEMINI_API_KEY)."

# ------------------------------------------------------------------------------
# Step 6: Create dedicated service account
# ------------------------------------------------------------------------------
echo ""
echo "--- Step 6: Creating dedicated service account ---"

if ! gcloud iam service-accounts describe "${SA_EMAIL}" \
    --project="${PROJECT_ID}" &>/dev/null; then
  gcloud iam service-accounts create "${SA_NAME}" \
    --display-name="LoadPilot API Service Account" \
    --description="Dedicated Cloud Run service identity for LoadPilot API" \
    --project="${PROJECT_ID}"
  echo "Service account '${SA_EMAIL}' created."
else
  echo "Service account '${SA_EMAIL}' already exists — skipping."
fi

# ------------------------------------------------------------------------------
# Step 7: Grant IAM roles to dedicated service account
# ------------------------------------------------------------------------------
echo ""
echo "--- Step 7: Granting IAM roles to service account ---"

# Grant secretmanager.secretAccessor — allows reading secret values
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None || true

echo "Granted roles/secretmanager.secretAccessor to ${SA_EMAIL}"

# Grant cloudsql.client — allows connecting to Cloud SQL via socket
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.client" \
  --condition=None || true

echo "Granted roles/cloudsql.client to ${SA_EMAIL}"

# ------------------------------------------------------------------------------
# Step 8: Grant serviceAccountUser on dedicated SA to deployer
# Required: Cloud Run needs to attach a custom service identity during deploy.
# Without this, `gcloud run deploy --service-account=...` fails with permission
# denied even if the deployer has roles/run.admin.
# ------------------------------------------------------------------------------
echo ""
echo "--- Step 8: Granting serviceAccountUser on dedicated SA to deployer ---"

if [[ -n "${DEPLOYER_ACCOUNT}" ]]; then
  # Determine member type (service account vs user)
  if [[ "${DEPLOYER_ACCOUNT}" == *"@"*".iam.gserviceaccount.com" ]]; then
    DEPLOYER_MEMBER="serviceAccount:${DEPLOYER_ACCOUNT}"
  else
    DEPLOYER_MEMBER="user:${DEPLOYER_ACCOUNT}"
  fi

  gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
    --member="${DEPLOYER_MEMBER}" \
    --role="roles/iam.serviceAccountUser" \
    --project="${PROJECT_ID}" || true

  echo "Granted roles/iam.serviceAccountUser on ${SA_EMAIL} to ${DEPLOYER_MEMBER}"
else
  echo "WARNING: DEPLOYER_ACCOUNT not set — skipping serviceAccountUser grant."
  echo "  Run manually: gcloud iam service-accounts add-iam-policy-binding ${SA_EMAIL} \\"
  echo "    --member=user:<your-email> --role=roles/iam.serviceAccountUser --project=${PROJECT_ID}"
fi

# ==============================================================================
echo ""
echo "============================================================"
echo "Provisioning complete!"
echo ""
echo "Summary:"
echo "  Project:          ${PROJECT_ID}"
echo "  Artifact Registry: ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REGISTRY_REPO}"
echo "  Cloud SQL:        ${SQL_INSTANCE} (${REGION}) — db-f1-micro (staging only, shared core, no SLA)"
echo "  Database:         ${SQL_DB}"
echo "  DB User:          ${SQL_USER}"
echo "  Secrets:          DB_PASSWORD, GEMINI_API_KEY"
echo "  Service Account:  ${SA_EMAIL}"
echo "    Roles:          secretmanager.secretAccessor, cloudsql.client"
echo "============================================================"
