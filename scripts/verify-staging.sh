#!/usr/bin/env bash
# verify-staging.sh - Verify staging deployment: health checks, auth enforcement,
# CORS headers, Cloud Logging errors, and frontend localhost sanity check.
#
# Usage: bash scripts/verify-staging.sh
# Requires: gcloud auth, curl
#
# STRICT auth enforcement: HTTP 500 is FAIL (indicates broken middleware/env/DB),
# only 401 or 403 are acceptable responses for unauthenticated requests.
#
# GCP Project: gen-lang-client-0535844903
# Cloud Run Service: loadpilot-api

set -euo pipefail

# -- Configuration
PROJECT_ID="gen-lang-client-0535844903"
REGION="us-central1"
SERVICE_NAME="loadpilot-api"
FIREBASE_HOSTING_URL="https://${PROJECT_ID}.web.app"
PASS_COUNT=0
FAIL_COUNT=0

pass() { echo "  PASS: $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo "  FAIL: $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

# -- Step 1: Get Cloud Run service URL
echo "[1/7] Getting Cloud Run service URL..."
CLOUD_RUN_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(status.url)" 2>/dev/null || echo "")

if [ -z "${CLOUD_RUN_URL}" ]; then
  echo "ERROR: Could not get Cloud Run URL. Is ${SERVICE_NAME} deployed?"
  exit 1
fi
echo "Cloud Run URL: ${CLOUD_RUN_URL}"

# -- Step 2: Health check via Cloud Run URL
echo "[2/7] Health check via Cloud Run /api/health..."
CR_HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 30 "${CLOUD_RUN_URL}/api/health" || echo "000")
echo "  Status: ${CR_HEALTH_STATUS}"
if [ "${CR_HEALTH_STATUS}" = "200" ]; then
  pass "Cloud Run /api/health returned 200"
else
  fail "Cloud Run /api/health returned ${CR_HEALTH_STATUS} (expected 200)"
fi

# -- Step 3: Health check via Firebase Hosting URL (tests rewrite)
echo "[3/7] Health check via Firebase Hosting /api/health..."
FB_HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 30 "${FIREBASE_HOSTING_URL}/api/health" || echo "000")
echo "  Status: ${FB_HEALTH_STATUS}"
if [ "${FB_HEALTH_STATUS}" = "200" ]; then
  pass "Firebase Hosting /api/health returned 200 (rewrite working)"
else
  fail "Firebase Hosting /api/health returned ${FB_HEALTH_STATUS} (expected 200)"
fi

# -- Step 4: Auth enforcement check (STRICT: 401/403 OK, 500 = FAIL)
echo "[4/7] Auth enforcement check (GET /api/loads without token)..."
AUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 30 "${CLOUD_RUN_URL}/api/loads" || echo "000")
echo "  Status: ${AUTH_STATUS}"

# STRICT enforcement: 500 is never acceptable - means auth/middleware/DB is broken
if [ "${AUTH_STATUS}" = "500" ]; then
  fail "Auth returned 500 - CRITICAL: middleware, env vars, or DB connection is broken. 500 is NOT an auth response."
elif [ "${AUTH_STATUS}" = "401" ] || [ "${AUTH_STATUS}" = "403" ]; then
  pass "Auth enforcement: got ${AUTH_STATUS} (auth middleware working correctly)"
else
  fail "Auth returned unexpected status ${AUTH_STATUS} (expected 401 or 403)"
fi

# -- Step 5: CORS header check
echo "[5/7] CORS header check..."
CORS_HEADER=$(curl -s -I --max-time 30 \
  -H "Origin: ${FIREBASE_HOSTING_URL}" \
  "${CLOUD_RUN_URL}/api/health" | grep -i "access-control-allow-origin" || echo "")
if [ -n "${CORS_HEADER}" ]; then
  pass "CORS header present: ${CORS_HEADER}"
else
  fail "CORS header missing for origin ${FIREBASE_HOSTING_URL}"
fi

# -- Step 6: Cloud Logging error check (last 15 minutes)
echo "[6/7] Checking Cloud Logging for recent errors (last 15 min)..."
ERROR_COUNT=$(gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=${SERVICE_NAME} AND severity>=ERROR" \
  --project="${PROJECT_ID}" \
  --freshness=15m \
  --format="value(timestamp)" 2>/dev/null | wc -l | tr -d ' ')
echo "  Error log entries: ${ERROR_COUNT}"
if [ "${ERROR_COUNT}" = "0" ]; then
  pass "No errors in Cloud Logging (last 15 min)"
else
  fail "${ERROR_COUNT} error(s) found in Cloud Logging (last 15 min) - check: gcloud logging read"
fi

# -- Step 7: Frontend localhost sanity check
# Verify built dist/ does NOT contain localhost references (confirms VITE_API_URL=/api worked)
echo "[7/7] Frontend localhost sanity check..."
if [ -d "dist" ]; then
  LOCALHOST_HITS=$(grep -r "localhost" dist/assets/ 2>/dev/null | grep -v "node_modules" | wc -l | tr -d ' ')
  echo "  localhost occurrences in dist/assets: ${LOCALHOST_HITS}"
  if [ "${LOCALHOST_HITS}" = "0" ]; then
    pass "No localhost references in built frontend (VITE_API_URL=/api applied correctly)"
  else
    fail "Found ${LOCALHOST_HITS} localhost reference(s) in dist/assets - VITE_API_URL may not have applied"
    echo "  Run: grep -r 'localhost' dist/assets/ to inspect"
  fi
else
  echo "  WARNING: dist/ directory not found - run 'npm run build' with .env.staging first"
  fail "dist/ not found - cannot verify localhost absence"
fi

# -- Summary
echo ""
echo "=== Staging Verification Summary ==="
echo "  PASS: ${PASS_COUNT}"
echo "  FAIL: ${FAIL_COUNT}"
echo "  Cloud Run URL: ${CLOUD_RUN_URL}"
echo "  Firebase URL:  ${FIREBASE_HOSTING_URL}"

if [ "${FAIL_COUNT}" -gt 0 ]; then
  echo ""
  echo "VERDICT: FAIL (${FAIL_COUNT} check(s) failed)"
  exit 1
fi

echo ""
echo "VERDICT: PASS - Staging is healthy"
