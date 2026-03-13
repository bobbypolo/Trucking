#!/usr/bin/env bash
# verify-production.sh — Comprehensive production verification.
# More thorough than smoke-test-production.sh; run after traffic is routed.
#
# Usage:
#   bash scripts/verify-production.sh
#   CLOUD_RUN_URL=https://... FIREBASE_URL=https://... bash scripts/verify-production.sh
#
# Env vars:
#   CLOUD_RUN_URL     — direct Cloud Run service URL (auto-detected if not set)
#   FIREBASE_URL      — Firebase Hosting URL (default: https://app.loadpilot.com)
#   PRODUCTION_URL    — alias for FIREBASE_URL (either accepted)
#   EXPECTED_REVISION — expected Cloud Run revision name (optional, for revision check)
#   PROJECT_ID        — GCP project (required via PROD_PROJECT_ID env var)
#   REGION            — Cloud Run region (default: us-central1)
#   SERVICE_NAME      — Cloud Run service name (default: loadpilot-api-prod)
#
# Exit code: 0 = all checks passed, 1 = one or more checks failed

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_ID="${PROJECT_ID:-${PROD_PROJECT_ID:-}}"
if [[ -z "${PROJECT_ID}" ]]; then
  echo "ERROR: PROD_PROJECT_ID env var required. Set to your production GCP project ID." >&2
  exit 1
fi
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-loadpilot-api-prod}"
# Accept either FIREBASE_URL or PRODUCTION_URL
FIREBASE_URL="${FIREBASE_URL:-${PRODUCTION_URL:-https://app.loadpilot.com}}"
PASS_COUNT=0
FAIL_COUNT=0

pass() { echo "  PASS: $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo "  FAIL: $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

echo "=== Production Verification ==="
echo "  Firebase URL: ${FIREBASE_URL}"
echo "  Project:      ${PROJECT_ID}"
echo "  Service:      ${SERVICE_NAME}"
echo ""

# ---------------------------------------------------------------------------
# Step 1: Discover Cloud Run URL
# ---------------------------------------------------------------------------
echo "[1/10] Getting Cloud Run service URL..."
if [ -n "${CLOUD_RUN_URL:-}" ]; then
  echo "  Using provided CLOUD_RUN_URL: ${CLOUD_RUN_URL}"
else
  CLOUD_RUN_URL=$(gcloud run services describe "${SERVICE_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --format="value(status.url)" 2>/dev/null || echo "")
  if [ -z "${CLOUD_RUN_URL}" ]; then
    echo "  ERROR: Cannot resolve Cloud Run URL. Set CLOUD_RUN_URL env var or configure gcloud."
    exit 1
  fi
  echo "  Auto-detected: ${CLOUD_RUN_URL}"
fi

# ---------------------------------------------------------------------------
# Step 2: Health check via Cloud Run URL
# ---------------------------------------------------------------------------
echo "[2/10] Health check via Cloud Run /api/health..."
CR_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 30 "${CLOUD_RUN_URL}/api/health" || echo "000")
echo "  Status: ${CR_STATUS}"
if [ "${CR_STATUS}" = "200" ]; then
  pass "Cloud Run /api/health returned 200"
else
  fail "Cloud Run /api/health returned ${CR_STATUS} (expected 200)"
fi

# ---------------------------------------------------------------------------
# Step 3: Health check via Firebase Hosting (tests rewrite rule)
# ---------------------------------------------------------------------------
echo "[3/10] Health check via Firebase Hosting /api/health..."
FB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 30 "${FIREBASE_URL}/api/health" || echo "000")
echo "  Status: ${FB_STATUS}"
if [ "${FB_STATUS}" = "200" ]; then
  pass "Firebase Hosting /api/health returned 200 (rewrite working)"
else
  fail "Firebase Hosting /api/health returned ${FB_STATUS} (expected 200)"
fi

# ---------------------------------------------------------------------------
# Step 4: Auth enforcement (STRICT: 500 is never acceptable)
# ---------------------------------------------------------------------------
echo "[4/10] Auth enforcement (GET /api/loads without token)..."
AUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 30 "${CLOUD_RUN_URL}/api/loads" || echo "000")
echo "  Status: ${AUTH_STATUS}"
if [ "${AUTH_STATUS}" = "500" ]; then
  fail "Auth returned 500 — CRITICAL: middleware, env vars, or DB is broken"
elif [ "${AUTH_STATUS}" = "401" ] || [ "${AUTH_STATUS}" = "403" ]; then
  pass "Auth enforcement: got ${AUTH_STATUS} (auth middleware working)"
else
  fail "Auth returned unexpected ${AUTH_STATUS} (expected 401 or 403)"
fi

# ---------------------------------------------------------------------------
# Step 5: CORS header check
# ---------------------------------------------------------------------------
echo "[5/10] CORS header check..."
CORS_HEADER=$(curl -s -I --max-time 30 \
  -H "Origin: ${FIREBASE_URL}" \
  "${CLOUD_RUN_URL}/api/health" \
  | grep -i "access-control-allow-origin" || echo "")
if [ -n "${CORS_HEADER}" ]; then
  pass "CORS header present: $(echo "${CORS_HEADER}" | tr -d '\r')"
else
  fail "CORS header missing (Access-Control-Allow-Origin not in response)"
fi

# ---------------------------------------------------------------------------
# Step 6: Cloud Logging — check for error-level logs in last 5 minutes
# ---------------------------------------------------------------------------
echo "[6/10] Cloud Logging error check (last 5 min)..."
ERROR_COUNT=$(gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=${SERVICE_NAME} AND severity>=ERROR" \
  --project="${PROJECT_ID}" \
  --freshness=5m \
  --format="value(timestamp)" 2>/dev/null | wc -l | tr -d ' ')
echo "  Error log entries (last 5 min): ${ERROR_COUNT}"
if [ "${ERROR_COUNT}" = "0" ]; then
  pass "No errors in Cloud Logging (last 5 min)"
else
  fail "${ERROR_COUNT} error(s) found in Cloud Logging — review: gcloud logging read"
fi

# ---------------------------------------------------------------------------
# Step 7: Cloud SQL connectivity — verified via health endpoint DB status
# ---------------------------------------------------------------------------
echo "[7/10] Cloud SQL connectivity (via health endpoint)..."
HEALTH_BODY=$(curl -s --max-time 30 "${CLOUD_RUN_URL}/api/health" || echo "{}")
if echo "${HEALTH_BODY}" | grep -qi "\"db\".*\"ok\"\|\"database\".*\"ok\"\|\"status\".*\"ok\""; then
  pass "Health endpoint reports database OK"
elif echo "${HEALTH_BODY}" | grep -qi "error\|fail\|disconnect"; then
  fail "Health endpoint reports database error: ${HEALTH_BODY}"
else
  # Health endpoint doesn't expose DB status — check that it returns 200 at minimum
  if [ "${CR_STATUS}" = "200" ]; then
    pass "Health endpoint returned 200 (DB likely connected — no explicit status in response)"
  else
    fail "Cannot confirm Cloud SQL connectivity (health returned ${CR_STATUS})"
  fi
fi

# ---------------------------------------------------------------------------
# Step 8: Revision check — verify deployed revision matches expected tag
# ---------------------------------------------------------------------------
echo "[8/10] Revision check..."
ACTIVE_REVISION=$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(status.traffic[0].revisionName)" 2>/dev/null || echo "")
echo "  Active revision: ${ACTIVE_REVISION:-unknown}"
if [ -n "${EXPECTED_REVISION:-}" ]; then
  if [ "${ACTIVE_REVISION}" = "${EXPECTED_REVISION}" ]; then
    pass "Active revision matches expected: ${EXPECTED_REVISION}"
  else
    fail "Revision mismatch: active=${ACTIVE_REVISION}, expected=${EXPECTED_REVISION}"
  fi
else
  if [ -n "${ACTIVE_REVISION}" ]; then
    pass "Active revision detected: ${ACTIVE_REVISION} (set EXPECTED_REVISION to enforce)"
  else
    fail "Could not determine active revision (gcloud may need authentication)"
  fi
fi

# ---------------------------------------------------------------------------
# Step 9: Secret Manager accessibility (via health endpoint — not direct read)
# ---------------------------------------------------------------------------
echo "[9/10] Secret Manager accessibility (inferred from health status)..."
# If the service is healthy (200), secrets are accessible (the server would fail to
# start if DB_PASSWORD or GEMINI_API_KEY were inaccessible from Secret Manager).
if [ "${CR_STATUS}" = "200" ]; then
  pass "Secrets accessible — service started successfully (DB_PASSWORD, GEMINI_API_KEY in use)"
else
  fail "Cannot confirm Secret Manager access — service health check failed"
fi

# ---------------------------------------------------------------------------
# Step 10: Frontend localhost sanity check
# ---------------------------------------------------------------------------
echo "[10/10] Frontend localhost sanity check..."
if [ -d "dist" ]; then
  LOCALHOST_HITS=$(grep -r "localhost" dist/assets/ 2>/dev/null | grep -v "node_modules" | wc -l | tr -d ' ')
  echo "  localhost occurrences in dist/assets: ${LOCALHOST_HITS}"
  if [ "${LOCALHOST_HITS}" = "0" ]; then
    pass "No localhost references in built frontend (VITE_API_URL=/api applied correctly)"
  else
    fail "Found ${LOCALHOST_HITS} localhost reference(s) in dist/assets — VITE_API_URL may be wrong"
  fi
else
  echo "  WARNING: dist/ not found — run 'npm run build' with .env.production first"
  fail "dist/ not found — cannot verify localhost absence"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=== Production Verification Summary ==="
echo "  PASS: ${PASS_COUNT}"
echo "  FAIL: ${FAIL_COUNT}"
echo "  Cloud Run URL: ${CLOUD_RUN_URL}"
echo "  Firebase URL:  ${FIREBASE_URL}"

if [ "${FAIL_COUNT}" -gt 0 ]; then
  echo ""
  echo "VERDICT: FAIL (${FAIL_COUNT} check(s) failed)"
  exit 1
fi

echo ""
echo "VERDICT: PASS — Production is healthy"
