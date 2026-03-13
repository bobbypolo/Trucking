#!/usr/bin/env bash
# run-staging-migrations.sh - Run database migrations against Cloud SQL via
# Cloud SQL Auth Proxy in TCP mode (port 3307) for Windows compatibility.
#
# Usage: bash scripts/run-staging-migrations.sh
# Requires: DB_PASSWORD env var, gcloud auth, cloud-sql-proxy binary
#
# Uses TCP mode (--port 3307) instead of Unix socket for Windows compatibility.
# Cloud SQL instance: gen-lang-client-0535844903:us-central1:loadpilot-staging

set -euo pipefail

# -- Configuration
PROJECT_ID="gen-lang-client-0535844903"
REGION="us-central1"
INSTANCE_CONNECTION="gen-lang-client-0535844903:us-central1:loadpilot-staging"
PROXY_PORT=3307
PROXY_HOST="127.0.0.1"
PROXY_BIN="./cloud-sql-proxy"

# -- Check DB_PASSWORD
if [ -z "${DB_PASSWORD:-}" ]; then
  echo "ERROR: DB_PASSWORD env var not set."
  echo "Get it from Secret Manager: gcloud secrets versions access latest --secret=DB_PASSWORD"
  exit 1
fi

# -- Download Cloud SQL Auth Proxy if not present
echo "[1/5] Checking cloud-sql-proxy binary..."
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

# -- Start Cloud SQL Auth Proxy in TCP mode on port 3307
echo "[2/5] Starting cloud-sql-proxy (TCP mode, port ${PROXY_PORT})..."
"${PROXY_BIN}" "${INSTANCE_CONNECTION}" --port "${PROXY_PORT}" &
PROXY_PID=$!
echo "cloud-sql-proxy started (PID=${PROXY_PID})"

# -- Wait for proxy to be ready on port 3307
echo "[3/5] Waiting for proxy to accept connections on port ${PROXY_PORT}..."
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

# -- Run staging rehearsal / migrations via TCP connection
echo "[4/5] Running staging-rehearsal.ts migrations (DB_HOST=${PROXY_HOST} DB_PORT=${PROXY_PORT})..."
MIGRATION_EXIT=0
DB_HOST="${PROXY_HOST}" \
  DB_PORT="${PROXY_PORT}" \
  DB_NAME="trucklogix_staging" \
  DB_USER="trucklogix_staging" \
  DB_PASSWORD="${DB_PASSWORD}" \
  npx tsx server/scripts/staging-rehearsal.ts || MIGRATION_EXIT=$?

# -- Stop the proxy
echo "[5/5] Stopping cloud-sql-proxy (PID=${PROXY_PID})..."
kill "${PROXY_PID}" 2>/dev/null || true
wait "${PROXY_PID}" 2>/dev/null || true
echo "Proxy stopped."

if [ "${MIGRATION_EXIT}" -ne 0 ]; then
  echo "ERROR: Migrations failed with exit code ${MIGRATION_EXIT}"
  exit "${MIGRATION_EXIT}"
fi

echo ""
echo "=== Migrations complete ==="
echo "All migrations applied to ${INSTANCE_CONNECTION}"
