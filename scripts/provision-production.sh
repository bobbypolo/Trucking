#!/usr/bin/env bash
# ==============================================================================
# provision-production.sh — GCP Infrastructure Provisioning Script for LoadPilot PRODUCTION
# ==============================================================================
#
# PURPOSE:
#   Idempotent script that provisions all GCP infrastructure required for
#   LoadPilot PRODUCTION deployment. Safe to re-run — all commands use existence
#   checks or || true to skip already-created resources.
#
#   MIRRORS scripts/provision-gcp.sh (staging) with production-grade settings:
#   - Dedicated-core Cloud SQL tier (db-custom-1-3840) — SLA-backed, NOT shared core
#   - Separate production instance name (loadpilot-prod)
#   - Separate production database (trucklogix_prod)
#   - Separate production service account (loadpilot-api-prod-sa)
#   - Production-scoped secret names (_PROD suffix to prevent staging confusion)
#
# USAGE:
#   export DB_PASSWORD_PROD="<your-production-db-password>"
#   export GEMINI_API_KEY_PROD="<your-gemini-key>"  # optional
#   bash scripts/provision-production.sh
#
# REQUIREMENTS:
#   - gcloud CLI authenticated with sufficient IAM permissions
#   - DB_PASSWORD_PROD environment variable set (required for Cloud SQL user)
#
# DATABASE TIER NOTE (IMPORTANT — PRODUCTION SLA REQUIREMENT):
#   This script uses db-custom-1-3840 (1 vCPU, 3.75 GB RAM) — a DEDICATED-CORE tier.
#   Dedicated-core tiers are SLA-backed (99.95% uptime with HA) and production-grade.
#   Do NOT downgrade to db-f1-micro (shared core, no SLA — staging only).
#   Minimum production tier: db-custom-1-3840 or higher.
#
# SEPARATE FROM STAGING:
#   Production resources use distinct names to prevent cross-contamination:
#   - Cloud SQL: loadpilot-prod (NOT loadpilot-staging)
#   - Database: trucklogix_prod (NOT trucklogix_staging)
#   - Service Account: loadpilot-api-prod-sa (NOT loadpilot-api-sa)
#   - Secrets: DB_PASSWORD_PROD, GEMINI_API_KEY_PROD (NOT DB_PASSWORD, GEMINI_API_KEY)
#
# TARGET PROJECT: Set via PROD_PROJECT_ID env var (separate from staging)
# ARTIFACT REGISTRY: us-central1-docker.pkg.dev/${PROD_PROJECT_ID}/loadpilot
# CLOUD SQL: ${PROD_PROJECT_ID}:us-central1:loadpilot-prod
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------------------
# Require PROD_PROJECT_ID — no default to prevent cross-environment mistakes
if [[ -z "${PROD_PROJECT_ID:-}" ]]; then
  echo "ERROR: PROD_PROJECT_ID env var required. Set to your production GCP project ID." >&2
  echo "  Example: export PROD_PROJECT_ID='my-loadpilot-prod'" >&2
  exit 1
fi
PROJECT_ID="${PROD_PROJECT_ID}"
REGION="us-central1"
REGISTRY_REPO="loadpilot"
# Production resource names — separate from staging to prevent cross-contamination
SQL_INSTANCE="loadpilot-prod"
SQL_DB="trucklogix_prod"
SQL_USER="trucklogix_prod"
# Production service account — separate identity from staging (loadpilot-api-sa)
SA_NAME="loadpilot-api-prod-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Deployer account — the account running this script / CI account
DEPLOYER_ACCOUNT="${DEPLOYER_ACCOUNT:-$(gcloud config get-value account 2>/dev/null)}"

# ------------------------------------------------------------------------------
# Validate prerequisites
# ------------------------------------------------------------------------------
if [[ -z "${DB_PASSWORD_PROD:-}" ]]; then
  echo "ERROR: DB_PASSWORD_PROD environment variable is required." >&2
  echo "  Export it before running: export DB_PASSWORD_PROD='<password>'" >&2
  exit 1
fi

echo "============================================================"
echo "LoadPilot GCP Production Provisioning"
echo "Project: ${PROJECT_ID}"
echo "Region:  ${REGION}"
echo "SQL Instance: ${SQL_INSTANCE} (dedicated-core, SLA-backed)"
echo "Service Account: ${SA_EMAIL}"
echo "WARN: This script provisions PRODUCTION resources."
echo "============================================================"

# ------------------------------------------------------------------------------
# Step 1: Enable required GCP APIs
# Same APIs as staging — enable is idempotent.
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
# Step 2: Verify Artifact Registry repository exists
# Images are shared between staging and production — same repo, different tags.
# Staging provisioning creates this repo; we just verify/ensure it exists.
# ------------------------------------------------------------------------------
echo ""
echo "--- Step 2: Ensuring Artifact Registry repository exists ---"

gcloud artifacts repositories create "${REGISTRY_REPO}" \
  --repository-format=docker \
  --location="${REGION}" \
  --description="LoadPilot Docker images" \
  --project="${PROJECT_ID}" || true

echo "Artifact Registry repo '${REGISTRY_REPO}' ready."

# Configure Docker auth for Artifact Registry
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet || true

# ------------------------------------------------------------------------------
# Step 3: Create production Cloud SQL instance
#
# PRODUCTION TIER: db-custom-1-3840 — dedicated core, SLA-backed
#   - 1 vCPU, 3.75 GB RAM
#   - Google SLA: 99.95% uptime (with high availability replica)
#   - Production-grade: no noisy-neighbor risk, predictable performance
#
# DO NOT USE db-f1-micro FOR PRODUCTION:
#   - db-f1-micro is shared core — no SLA, noisy-neighbor risk
#   - Acceptable for staging cost savings only
#   - NOT suitable for production workloads
# ------------------------------------------------------------------------------
echo ""
echo "--- Step 3: Creating production Cloud SQL instance (db-custom-1-3840 — dedicated core, SLA-backed) ---"

if ! gcloud sql instances describe "${SQL_INSTANCE}" \
    --project="${PROJECT_ID}" &>/dev/null; then
  gcloud sql instances create "${SQL_INSTANCE}" \
    --database-version=MYSQL_8_0 \
    --tier=db-custom-1-3840 \
    --region="${REGION}" \
    --storage-auto-increase \
    --backup \
    --backup-start-time="03:00" \
    --enable-bin-log \
    --retained-transaction-log-days=7 \
    --project="${PROJECT_ID}"
  echo "Production Cloud SQL instance '${SQL_INSTANCE}' created (dedicated-core, SLA-backed)."
else
  echo "Production Cloud SQL instance '${SQL_INSTANCE}' already exists — skipping."
fi

# ------------------------------------------------------------------------------
# Step 4: Create production database and user
# ------------------------------------------------------------------------------
echo ""
echo "--- Step 4: Creating production database and user ---"

gcloud sql databases create "${SQL_DB}" \
  --instance="${SQL_INSTANCE}" \
  --project="${PROJECT_ID}" || true

# Pass DB_PASSWORD_PROD via environment variable reference (not hardcoded)
DB_PASS_FLAG="--password=${DB_PASSWORD_PROD}"
gcloud sql users create "${SQL_USER}" \
  --instance="${SQL_INSTANCE}" \
  "${DB_PASS_FLAG}" \
  --project="${PROJECT_ID}" || true
unset DB_PASS_FLAG

echo "Production database '${SQL_DB}' and user '${SQL_USER}' ready."

# ------------------------------------------------------------------------------
# Step 5: Create production secrets in Secret Manager
#
# SCOPE: Only REAL secrets — DB_PASSWORD_PROD and GEMINI_API_KEY_PROD.
#        _PROD suffix distinguishes production secrets from staging secrets
#        (DB_PASSWORD, GEMINI_API_KEY) to prevent accidental cross-environment
#        secret access or misconfiguration.
#
# NON-SECRET CONFIG (FIREBASE_PROJECT_ID, CORS_ORIGIN, DB_NAME, DB_USER, NODE_ENV)
# are plain Cloud Run env vars — NOT stored in Secret Manager.
# ------------------------------------------------------------------------------
echo ""
echo "--- Step 5: Creating production secrets in Secret Manager (_PROD suffix) ---"

# Secret 1: DB_PASSWORD_PROD (production DB password)
if ! gcloud secrets describe "DB_PASSWORD_PROD" \
    --project="${PROJECT_ID}" &>/dev/null; then
  echo -n "${DB_PASSWORD_PROD}" | gcloud secrets create "DB_PASSWORD_PROD" \
    --data-file=- \
    --replication-policy=automatic \
    --project="${PROJECT_ID}"
  echo "Secret 'DB_PASSWORD_PROD' created."
else
  # Update existing secret with new version
  echo -n "${DB_PASSWORD_PROD}" | gcloud secrets versions add "DB_PASSWORD_PROD" \
    --data-file=- \
    --project="${PROJECT_ID}" || true
  echo "Secret 'DB_PASSWORD_PROD' already exists — version updated."
fi

# Secret 2: GEMINI_API_KEY_PROD (optional, production Gemini key)
if [[ -n "${GEMINI_API_KEY_PROD:-}" ]]; then
  if ! gcloud secrets describe "GEMINI_API_KEY_PROD" \
      --project="${PROJECT_ID}" &>/dev/null; then
    echo -n "${GEMINI_API_KEY_PROD}" | gcloud secrets create "GEMINI_API_KEY_PROD" \
      --data-file=- \
      --replication-policy=automatic \
      --project="${PROJECT_ID}"
    echo "Secret 'GEMINI_API_KEY_PROD' created."
  else
    echo -n "${GEMINI_API_KEY_PROD}" | gcloud secrets versions add "GEMINI_API_KEY_PROD" \
      --data-file=- \
      --project="${PROJECT_ID}" || true
    echo "Secret 'GEMINI_API_KEY_PROD' already exists — version updated."
  fi
else
  # Create placeholder if not provided — update before first deploy
  if ! gcloud secrets describe "GEMINI_API_KEY_PROD" \
      --project="${PROJECT_ID}" &>/dev/null; then
    echo -n "PLACEHOLDER" | gcloud secrets create "GEMINI_API_KEY_PROD" \
      --data-file=- \
      --replication-policy=automatic \
      --project="${PROJECT_ID}"
    echo "Secret 'GEMINI_API_KEY_PROD' created (placeholder — update before production deploy)."
  else
    echo "Secret 'GEMINI_API_KEY_PROD' already exists — skipping."
  fi
fi

echo "Production secrets configured (DB_PASSWORD_PROD, GEMINI_API_KEY_PROD)."

# ------------------------------------------------------------------------------
# Step 6: Create production service account
# Separate from staging service account (loadpilot-api-sa) to enforce
# least-privilege and prevent staging credentials from accessing production.
# ------------------------------------------------------------------------------
echo ""
echo "--- Step 6: Creating production service account (loadpilot-api-prod-sa) ---"

if ! gcloud iam service-accounts describe "${SA_EMAIL}" \
    --project="${PROJECT_ID}" &>/dev/null; then
  gcloud iam service-accounts create "${SA_NAME}" \
    --display-name="LoadPilot API Production Service Account" \
    --description="Dedicated Cloud Run service identity for LoadPilot API PRODUCTION" \
    --project="${PROJECT_ID}"
  echo "Production service account '${SA_EMAIL}' created."
else
  echo "Production service account '${SA_EMAIL}' already exists — skipping."
fi

# ------------------------------------------------------------------------------
# Step 7: Grant IAM roles to production service account
# ------------------------------------------------------------------------------
echo ""
echo "--- Step 7: Granting IAM roles to production service account ---"

# Grant secretmanager.secretAccessor — allows reading production secret values
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None || true

echo "Granted roles/secretmanager.secretAccessor to ${SA_EMAIL}"

# Grant cloudsql.client — allows connecting to production Cloud SQL via socket
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.client" \
  --condition=None || true

echo "Granted roles/cloudsql.client to ${SA_EMAIL}"

# ------------------------------------------------------------------------------
# Step 8: Grant serviceAccountUser on production SA to deployer
# Required: Cloud Run needs to attach a custom service identity during deploy.
# Without this, `gcloud run deploy --service-account=...` fails with permission
# denied even if the deployer has roles/run.admin.
# ------------------------------------------------------------------------------
echo ""
echo "--- Step 8: Granting serviceAccountUser on production SA to deployer ---"

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
echo "Production Provisioning complete!"
echo ""
echo "Summary:"
echo "  Project:          ${PROJECT_ID}"
echo "  Artifact Registry: ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REGISTRY_REPO}"
echo "  Cloud SQL:        ${SQL_INSTANCE} (${REGION}) — db-custom-1-3840 (dedicated core, SLA-backed)"
echo "  Database:         ${SQL_DB}"
echo "  DB User:          ${SQL_USER}"
echo "  Secrets:          DB_PASSWORD_PROD, GEMINI_API_KEY_PROD"
echo "  Service Account:  ${SA_EMAIL}"
echo "    Roles:          secretmanager.secretAccessor, cloudsql.client"
echo ""
echo "NEXT STEPS:"
echo "  1. Update GEMINI_API_KEY_PROD secret if placeholder was used"
echo "  2. Run: bash scripts/deploy-production.sh"
echo "  3. Verify traffic is 0% on new revision before routing"
echo "============================================================"
