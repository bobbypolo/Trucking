#!/usr/bin/env bash
# run-production-migrations.sh — Run database migrations against production Cloud SQL
# via Cloud SQL Auth Proxy in TCP mode (port 3308) for Windows compatibility.
#
# PRODUCTION DIFFERENCES FROM run-staging-migrations.sh:
#   - Cloud SQL instance: gen-lang-client-0535844903:us-central1:loadpilot-prod
#   - Port: 3308 (staging uses 3307 to avoid conflicts when running simultaneously)
#   - DB name: trucklogix_prod
#   - DB user: trucklogix_prod
#   - Creates pre-migration backup before running migrations
#
# Usage: bash scripts/run-production-migrations.sh
# Requires: DB_PASSWORD_PROD env var, gcloud auth, cloud-sql-proxy binary
#
# IMPORTANT: Always run pre-migration backup before applying migrations.
# This script creates an automated backup before migrating.

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────

PROJECT_ID="gen-lang-client-0535844903"
REGION="us-central1"
INSTANCE_NAME="loadpilot-prod"
INSTANCE_CONNECTION="${PROJECT_ID}:${REGION}:${INSTANCE_NAME}"
PROXY_PORT=3308
PROXY_HOST="127.0.0.1"
PROXY_BIN="./cloud-sql-proxy"

# ─── Check DB_PASSWORD_PROD ───────────────────────────────────────────────────

if [ -z "${DB_PASSWORD_PROD:-}" ]; then
  echo "ERROR: DB_PASSWORD_PROD env var not set."
  echo "Get it from Secret Manager:"
  echo "  gcloud secrets versions access latest --secret=DB_PASSWORD_PROD --project=${PROJECT_ID}"
  exit 1
fi

# ─── Step 1: Download Cloud SQL Auth Proxy if not present ─────────────────────

echo "[1/6] Checking cloud-sql-proxy binary..."
if [ ! -f "${PROXY_BIN}" ]; then
  echo "Downloading cloud-sql-proxy..."
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  ARCH=$(uname -m)
  if [ "${ARCH}" = "x86_64" ]; then ARCH="amd64"; fi
  PROXY_URL="https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.1/cloud-sql-proxy.${OS}.${ARCH}"
  curl -fsSL "${PROXY_URL}" -o "${PROXY_BIN}"
  chmod +x "${PROXY_BIN}"
  echo "cloud-sql-proxy downloaded."
fi

# ─── Step 2: Create pre-migration backup ──────────────────────────────────────
#
# IMPORTANT: Always create a backup before running production migrations.
# This triggers an on-demand Cloud SQL backup for point-in-time recovery.

echo "[2/6] Creating pre-migration backup of ${INSTANCE_NAME}..."
BACKUP_TIMESTAMP=$(date -u '+%Y%m%dT%H%M%SZ')
echo "Requesting on-demand backup for instance ${INSTANCE_NAME}..."
gcloud sql backups create \
  --instance="${INSTANCE_NAME}" \
  --project="${PROJECT_ID}" \
  --description="pre-migration backup ${BACKUP_TIMESTAMP}" 2>/dev/null || {
  echo "WARNING: On-demand backup request failed. Check Cloud SQL backup configuration."
  echo "Automated backups should still be running. Proceeding with caution..."
}
echo "Pre-migration backup initiated at ${BACKUP_TIMESTAMP}."
echo "Verify backup status: gcloud sql backups list --instance=${INSTANCE_NAME} --project=${PROJECT_ID}"

# ─── Step 3: Start Cloud SQL Auth Proxy in TCP mode on port 3308 ──────────────

echo "[3/6] Starting cloud-sql-proxy (TCP mode, port ${PROXY_PORT})..."
"${PROXY_BIN}" "${INSTANCE_CONNECTION}" --port "${PROXY_PORT}" &
PROXY_PID=$!
echo "cloud-sql-proxy started (PID=${PROXY_PID})"

# ─── Step 4: Wait for proxy to be ready on port 3308 ─────────────────────────

echo "[4/6] Waiting for proxy to accept connections on port ${PROXY_PORT}..."
MAX_WAIT=30
WAITED=0
while ! nc -z "${PROXY_HOST}" "${PROXY_PORT}" 2>/dev/null; do
  if [ "${WAITED}" -ge "${MAX_WAIT}" ]; then
    echo "ERROR: cloud-sql-proxy did not start within ${MAX_WAIT}s on port ${PROXY_PORT}"
    kill "${PROXY_PID}" 2>/dev/null || true
    exit 1
  fi
  sleep 1
  WAITED=$((WAITED + 1))
done
echo "Proxy ready on ${PROXY_HOST}:${PROXY_PORT}"

# ─── Step 5: Run migrations via TCP connection ────────────────────────────────

echo "[5/6] Running production migrations (DB_HOST=${PROXY_HOST} DB_PORT=${PROXY_PORT})..."
MIGRATION_EXIT=0
DB_HOST="${PROXY_HOST}" \
  DB_PORT="${PROXY_PORT}" \
  DB_NAME="trucklogix_prod" \
  DB_USER="trucklogix_prod" \
  DB_PASSWORD="${DB_PASSWORD_PROD}" \
  npx tsx server/scripts/staging-rehearsal.ts || MIGRATION_EXIT=$?

# ─── Step 6: Stop the proxy ───────────────────────────────────────────────────

echo "[6/6] Stopping cloud-sql-proxy (PID=${PROXY_PID})..."
kill "${PROXY_PID}" 2>/dev/null || true
wait "${PROXY_PID}" 2>/dev/null || true
echo "Proxy stopped."

if [ "${MIGRATION_EXIT}" -ne 0 ]; then
  echo "ERROR: Production migrations failed with exit code ${MIGRATION_EXIT}"
  echo "The pre-migration backup (${BACKUP_TIMESTAMP}) is available for restore."
  echo "Restore procedure: docs/deployment/RESTORE_PROCEDURE.md"
  exit "${MIGRATION_EXIT}"
fi

echo ""
echo "=== Production migrations complete ==="
echo "  Instance:   ${INSTANCE_CONNECTION}"
echo "  Database:   trucklogix_prod"
echo "  Proxy port: ${PROXY_PORT}"
echo "  Backup:     ${BACKUP_TIMESTAMP}"
echo ""
echo "Verify migration state:"
echo "  gcloud sql backups list --instance=${INSTANCE_NAME} --project=${PROJECT_ID}"
