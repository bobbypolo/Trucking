#!/usr/bin/env bash
# backup-setup.sh — Production Cloud SQL backup and PITR configuration
# Tests R-P3-01, R-P3-02, R-P3-03, R-P3-04, R-P3-05, R-P3-06, R-P3-07, R-P3-08
set -euo pipefail

# Require PROD_PROJECT_ID — no default to prevent cross-environment mistakes
if [[ -z "${PROD_PROJECT_ID:-}" ]]; then
  echo "ERROR: PROD_PROJECT_ID env var required. Set to your production GCP project ID." >&2
  exit 1
fi
PROJECT_ID="${PROD_PROJECT_ID}"
INSTANCE="loadpilot-prod"
BACKUP_START_TIME="03:00"
RETAINED_BACKUPS_COUNT=7
RETAINED_TRANSACTION_LOG_DAYS=7

echo "=============================="
echo " LoadPilot — Backup Setup"
echo " Instance: ${INSTANCE}"
echo " Project:  ${PROJECT_ID}"
echo "=============================="
echo ""

# Verify gcloud is authenticated
if ! gcloud auth print-access-token --quiet > /dev/null 2>&1; then
  echo "ERROR: Not authenticated. Run: gcloud auth login"
  exit 1
fi

echo "Step 1: Configuring automated backups with PITR on ${INSTANCE}..."
gcloud sql instances patch "${INSTANCE}" \
  --project="${PROJECT_ID}" \
  --backup-start-time="${BACKUP_START_TIME}" \
  --retained-backups-count="${RETAINED_BACKUPS_COUNT}" \
  --enable-bin-log \
  --retained-transaction-log-days="${RETAINED_TRANSACTION_LOG_DAYS}" \
  --quiet

echo ""
echo "Step 2: Verifying backup configuration..."
gcloud sql instances describe "${INSTANCE}" \
  --project="${PROJECT_ID}" \
  --format="json(settings.backupConfiguration)"

echo ""
echo "Step 3: Creating on-demand baseline backup..."
gcloud sql backups create \
  --instance="${INSTANCE}" \
  --project="${PROJECT_ID}" \
  --description="Baseline backup created by backup-setup.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo ""
echo "=============================="
echo " Backup Configuration Summary"
echo "=============================="
echo " Instance:               ${INSTANCE}"
echo " Backup window:          ${BACKUP_START_TIME} UTC (daily)"
echo " Retained backups:       ${RETAINED_BACKUPS_COUNT} days"
echo " Binary logging (PITR):  enabled"
echo " Transaction log days:   ${RETAINED_TRANSACTION_LOG_DAYS} days"
echo " RTO target:             < 15 minutes"
echo " RPO target:             < 5 minutes (with PITR)"
echo "=============================="
echo ""
echo "Backup setup complete. On-demand baseline backup created."
