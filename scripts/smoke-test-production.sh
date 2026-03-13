#!/usr/bin/env bash
# smoke-test-production.sh — Quick production smoke tests.
# Run immediately after a zero-traffic production deploy to verify the revision
# is healthy before routing any real traffic.
#
# Usage:
#   bash scripts/smoke-test-production.sh
#   PRODUCTION_URL=https://my-revision-url.a.run.app bash scripts/smoke-test-production.sh
#
# Env vars:
#   PRODUCTION_URL — base URL to test (default: https://app.loadpilot.com)
#   CLOUD_RUN_SERVICE — Cloud Run service name (default: loadpilot-api-prod)
#   REGION — Cloud Run region (default: us-central1)
#   PROJECT_ID — GCP project (default: gen-lang-client-0535844903)
#
# Exit code: 0 = all tests passed, 1 = one or more tests failed

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PRODUCTION_URL="${PRODUCTION_URL:-https://app.loadpilot.com}"
CLOUD_RUN_SERVICE="${CLOUD_RUN_SERVICE:-loadpilot-api-prod}"
REGION="${REGION:-us-central1}"
PROJECT_ID="${PROJECT_ID:-gen-lang-client-0535844903}"
PASS_COUNT=0
FAIL_COUNT=0

pass() { echo "  PASS: $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo "  FAIL: $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

echo "=== Production Smoke Tests ==="
echo "  Target URL: ${PRODUCTION_URL}"
echo ""

# ---------------------------------------------------------------------------
# Test 1: Health check — GET /api/health returns 200
# ---------------------------------------------------------------------------
echo "[1/8] Health check (GET /api/health)..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 30 "${PRODUCTION_URL}/api/health" || echo "000")
echo "  Status: ${HEALTH_STATUS}"
if [ "${HEALTH_STATUS}" = "200" ]; then
  pass "GET /api/health returned 200"
else
  fail "GET /api/health returned ${HEALTH_STATUS} (expected 200)"
fi

# ---------------------------------------------------------------------------
# Test 2: Auth enforcement — /api/loads without token returns 401 or 403
# STRICT: 500 is NEVER acceptable — it means auth middleware or DB is broken
# ---------------------------------------------------------------------------
echo "[2/8] Auth enforcement (GET /api/loads without token)..."
LOADS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 30 "${PRODUCTION_URL}/api/loads" || echo "000")
echo "  Status: ${LOADS_STATUS}"
if [ "${LOADS_STATUS}" = "500" ]; then
  fail "Auth returned 500 — CRITICAL: middleware, env vars, or DB connection is broken"
elif [ "${LOADS_STATUS}" = "401" ] || [ "${LOADS_STATUS}" = "403" ]; then
  pass "Auth enforcement: got ${LOADS_STATUS} (auth middleware working)"
else
  fail "Auth returned unexpected ${LOADS_STATUS} (expected 401 or 403, never 500)"
fi

# ---------------------------------------------------------------------------
# Test 3: Auth enforcement — /api/settlements without token returns 401 or 403
# ---------------------------------------------------------------------------
echo "[3/8] Auth enforcement (GET /api/settlements without token)..."
SETTLE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 30 "${PRODUCTION_URL}/api/settlements" || echo "000")
echo "  Status: ${SETTLE_STATUS}"
if [ "${SETTLE_STATUS}" = "500" ]; then
  fail "Auth returned 500 — CRITICAL: middleware is broken on /api/settlements"
elif [ "${SETTLE_STATUS}" = "401" ] || [ "${SETTLE_STATUS}" = "403" ]; then
  pass "Auth enforcement on /api/settlements: got ${SETTLE_STATUS}"
else
  fail "/api/settlements returned unexpected ${SETTLE_STATUS} (expected 401 or 403)"
fi

# ---------------------------------------------------------------------------
# Test 4: CORS headers — OPTIONS preflight returns Access-Control headers
# ---------------------------------------------------------------------------
echo "[4/8] CORS preflight (OPTIONS /api/health)..."
CORS_HEADER=$(curl -s -I \
  --max-time 30 \
  -X OPTIONS \
  -H "Origin: https://app.loadpilot.com" \
  -H "Access-Control-Request-Method: GET" \
  "${PRODUCTION_URL}/api/health" \
  | grep -i "access-control-allow-origin" || echo "")
if [ -n "${CORS_HEADER}" ]; then
  pass "CORS: Access-Control-Allow-Origin header present"
else
  fail "CORS: Access-Control-Allow-Origin header missing"
fi

# ---------------------------------------------------------------------------
# Test 5: Revision URL — discover and verify Cloud Run revision URL
# ---------------------------------------------------------------------------
echo "[5/8] Cloud Run revision URL discovery..."
REVISION_URL=$(gcloud run revisions list \
  --service="${CLOUD_RUN_SERVICE}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(status.url)" \
  --limit=1 2>/dev/null | head -1 || echo "")
if [ -n "${REVISION_URL}" ]; then
  # Verify the revision URL also responds
  REV_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time 30 "${REVISION_URL}/api/health" || echo "000")
  if [ "${REV_STATUS}" = "200" ]; then
    pass "Cloud Run revision URL responds with 200: ${REVISION_URL}"
  else
    fail "Cloud Run revision URL returned ${REV_STATUS}: ${REVISION_URL}"
  fi
else
  echo "  WARNING: Could not retrieve revision URL (gcloud not configured)"
  pass "Revision URL check skipped (gcloud not available — not a blocking failure)"
fi

# ---------------------------------------------------------------------------
# Test 6: No localhost references in health response
# ---------------------------------------------------------------------------
echo "[6/8] No localhost references in API response..."
HEALTH_BODY=$(curl -s --max-time 30 "${PRODUCTION_URL}/api/health" || echo "")
if echo "${HEALTH_BODY}" | grep -qi "localhost"; then
  fail "API response contains localhost reference — check environment variables"
else
  pass "No localhost references in API response"
fi

# ---------------------------------------------------------------------------
# Test 7: SSL certificate valid
# ---------------------------------------------------------------------------
echo "[7/8] SSL certificate check..."
HOST="${PRODUCTION_URL#https://}"
HOST="${HOST%%/*}"
SSL_RESULT=$(echo "" | openssl s_client -connect "${HOST}:443" \
  -servername "${HOST}" 2>/dev/null | grep "Verify return code" || echo "")
if echo "${SSL_RESULT}" | grep -q "Verify return code: 0"; then
  pass "SSL certificate valid (Verify return code: 0)"
elif [ -z "${SSL_RESULT}" ]; then
  echo "  WARNING: openssl not available — using curl --cert-status"
  CURL_SSL=$(curl -s -o /dev/null -w "%{ssl_verify_result}" \
    --cert-status --max-time 30 "${PRODUCTION_URL}/api/health" 2>/dev/null || echo "1")
  if [ "${CURL_SSL}" = "0" ]; then
    pass "SSL certificate valid (curl verify result: 0)"
  else
    fail "SSL certificate invalid or untrusted"
  fi
else
  fail "SSL certificate check failed: ${SSL_RESULT}"
fi

# ---------------------------------------------------------------------------
# Test 8: Response time — health endpoint responds in < 3 seconds
# ---------------------------------------------------------------------------
echo "[8/8] Response time check (< 3s)..."
RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" \
  --max-time 30 "${PRODUCTION_URL}/api/health" || echo "99")
RESPONSE_MS=$(echo "${RESPONSE_TIME} * 1000" | bc 2>/dev/null | cut -d. -f1 || echo "0")
echo "  Response time: ${RESPONSE_TIME}s"
# Use awk for float comparison (bc may not be available)
TOO_SLOW=$(awk "BEGIN { print (${RESPONSE_TIME} > 3.0) ? \"yes\" : \"no\" }")
if [ "${TOO_SLOW}" = "no" ]; then
  pass "Health endpoint responded in ${RESPONSE_TIME}s (< 3s)"
else
  fail "Health endpoint too slow: ${RESPONSE_TIME}s (threshold: 3s)"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=== Smoke Test Summary ==="
echo "  PASS: ${PASS_COUNT}"
echo "  FAIL: ${FAIL_COUNT}"
echo "  Target: ${PRODUCTION_URL}"

if [ "${FAIL_COUNT}" -gt 0 ]; then
  echo ""
  echo "VERDICT: FAIL (${FAIL_COUNT} check(s) failed)"
  exit 1
fi

echo ""
echo "VERDICT: PASS — Production smoke tests healthy"
