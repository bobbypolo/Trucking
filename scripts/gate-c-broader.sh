#!/usr/bin/env bash
# gate-c-broader.sh — Gate C: Route 50% traffic to latest production revision.
# Broader rollout phase. Runs smoke tests AND full verify-production.sh.
#
# Usage: bash scripts/gate-c-broader.sh
#
# What this does:
#   1. Logs gate entry timestamp
#   2. Identifies the latest revision of loadpilot-api-prod
#   3. Health check before routing traffic
#   4. Routes 50% traffic to latest revision
#   5. Runs smoke tests (quick pass/fail)
#   6. Runs verify-production.sh (comprehensive checks)
#   7. Auto-rollbacks to stable revision on any failure
#   8. Logs gate exit timestamp and result
#   9. Prints Gate D instructions
#
# Gate sequence: Gate A (5%) → Gate B (10%) → Gate C (50%) → Gate D (100%)
# Soak schedule: Gate A 2h → Gate B 24h → Gate C 24h → Gate D after 48h at 50%

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────

SERVICE_NAME="${SERVICE_NAME:-loadpilot-api-prod}"
REGION="${REGION:-us-central1}"
PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null || echo "")}"
PRODUCTION_URL="${PRODUCTION_URL:-https://app.loadpilot.com}"
GATE_NAME="gate-c-broader"
TRAFFIC_PCT=50

# ─── Helpers ──────────────────────────────────────────────────────────────────

log() {
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [GATE-C] $*"
}

error() {
  echo "[ERROR] $*" >&2
  exit 1
}

check_health() {
  local url="$1"
  local label="$2"
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" "${url}/api/health" --max-time 15 || echo "000")
  if [[ "$http_code" == "200" ]]; then
    log "Health check ${label}: PASS (HTTP ${http_code})"
    echo "PASS"
  else
    log "Health check ${label}: FAIL (HTTP ${http_code})"
    echo "FAIL"
  fi
}

rollback_on_failure() {
  local reason="$1"
  log "FAILURE: ${reason}. Initiating auto-rollback..."

  STABLE_REVISION=$(gcloud run revisions list \
    --service="${SERVICE_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT}" \
    --format="value(metadata.name)" \
    --sort-by="~metadata.creationTimestamp" 2>/dev/null | sed -n '2p')

  if [[ -n "${STABLE_REVISION}" ]]; then
    log "Rolling back: routing 100% traffic to stable revision ${STABLE_REVISION}..."
    gcloud run services update-traffic "${SERVICE_NAME}" \
      --region="${REGION}" \
      --project="${PROJECT}" \
      --to-revisions="${STABLE_REVISION}=100"
    log "Rollback complete: 100% traffic on ${STABLE_REVISION}"
  else
    log "WARNING: Could not identify stable revision. Using --to-latest as fallback..."
    gcloud run services update-traffic "${SERVICE_NAME}" \
      --region="${REGION}" \
      --project="${PROJECT}" \
      --to-latest
  fi

  GATE_END=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  log "=== Gate C FAILED and rolled back at ${GATE_END} ==="
  error "Gate C FAILED: ${reason}. Traffic rolled back to stable revision."
}

# ─── Preflight ────────────────────────────────────────────────────────────────

GATE_START=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
log "=== Gate C: Broader Rollout (${TRAFFIC_PCT}% traffic) ==="
log "Entry timestamp: ${GATE_START}"
log "Service: ${SERVICE_NAME} in ${REGION}"

if [[ -z "${PROJECT}" ]]; then
  error "GCP project not set. Run: gcloud config set project <PROJECT_ID>"
fi

# ─── Step 1: Identify latest revision ─────────────────────────────────────────

log "Step 1: Identifying latest revision of ${SERVICE_NAME}..."
LATEST_REVISION=$(gcloud run revisions list \
  --service="${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT}" \
  --format="value(metadata.name)" \
  --sort-by="~metadata.creationTimestamp" \
  --limit=1 2>/dev/null) || error "Could not list revisions for ${SERVICE_NAME}"

if [[ -z "${LATEST_REVISION}" ]]; then
  error "No revisions found for service ${SERVICE_NAME}."
fi

log "Latest revision: ${LATEST_REVISION}"

# ─── Step 2: Health check before routing traffic ──────────────────────────────

log "Step 2: Health check before routing traffic..."
PRE_HEALTH=$(check_health "${PRODUCTION_URL}" "pre-gate-c")

if [[ "${PRE_HEALTH}" != "PASS" ]]; then
  error "Production service not healthy before Gate C. Aborting."
fi

# ─── Step 3: Route 50% traffic to latest revision ─────────────────────────────

log "Step 3: Routing ${TRAFFIC_PCT}% traffic to ${LATEST_REVISION}..."
gcloud run services update-traffic "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT}" \
  --to-revisions="${LATEST_REVISION}=${TRAFFIC_PCT}"

log "Traffic update complete. Waiting 15s for propagation..."
sleep 15

log "Traffic config: ${TRAFFIC_PCT}% to ${LATEST_REVISION}"

# ─── Step 4: Run smoke tests ──────────────────────────────────────────────────

log "Step 4: Running smoke tests..."
SMOKE_EXIT=0
PRODUCTION_URL="${PRODUCTION_URL}" bash scripts/smoke-test-production.sh 2>&1 || SMOKE_EXIT=$?

if [[ "${SMOKE_EXIT}" -ne 0 ]]; then
  rollback_on_failure "smoke tests failed (exit ${SMOKE_EXIT})"
fi

log "Smoke tests PASSED."

# ─── Step 5: Run comprehensive verify-production.sh ──────────────────────────

log "Step 5: Running comprehensive verify-production.sh..."
VERIFY_EXIT=0
PRODUCTION_URL="${PRODUCTION_URL}" bash scripts/verify-production.sh 2>&1 || VERIFY_EXIT=$?

if [[ "${VERIFY_EXIT}" -ne 0 ]]; then
  rollback_on_failure "verify-production.sh failed (exit ${VERIFY_EXIT})"
fi

log "verify-production.sh PASSED."

# ─── Step 6: Log gate exit ────────────────────────────────────────────────────

GATE_END=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
log "=== Gate C PASSED ==="
log "Entry:    ${GATE_START}"
log "Exit:     ${GATE_END}"
log "Traffic:  ${TRAFFIC_PCT}% on ${LATEST_REVISION}"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║               Gate C: PASSED (${TRAFFIC_PCT}% traffic)              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Evidence to record in docs/deployment/ROLLOUT_EVIDENCE.md:"
echo "  Gate C timestamp (entry):       ${GATE_START}"
echo "  Gate C timestamp (exit):        ${GATE_END}"
echo "  Revision:                       ${LATEST_REVISION}"
echo "  Traffic %:                      ${TRAFFIC_PCT}%"
echo "  Health check:                   PASS"
echo "  Smoke test:                     PASS"
echo "  verify-production.sh:           PASS"
echo ""
echo "REQUIRED: Allow a 24-hour soak period at ${TRAFFIC_PCT}% before proceeding to Gate D."
echo "  - Monitor Cloud Logging, dashboards, and user feedback"
echo "  - Gate D requires 48 hours total clean time at 50% before GA"
echo "  - Do NOT proceed to Gate D until 48h has elapsed with clean metrics"
echo ""
echo "Next step — Gate D (General Availability, 100% traffic):"
echo "  After 48h clean at 50%:"
echo "  bash scripts/gate-d-ga.sh"
echo ""

exit 0
