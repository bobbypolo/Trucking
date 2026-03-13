#!/usr/bin/env bash
# gate-d-ga.sh — Gate D: Route 100% traffic to latest production revision.
# General Availability phase. Final gate — no auto-rollback after this step.
#
# Usage: bash scripts/gate-d-ga.sh
#
# What this does:
#   1. Logs gate entry timestamp
#   2. Identifies the latest revision of loadpilot-api-prod
#   3. Health check before routing traffic
#   4. Routes 100% traffic to latest revision
#   5. Runs full verification suite (smoke + verify-production.sh)
#   6. Outputs final GA evidence (timestamp, revision, traffic config)
#   7. NOTE: No auto-rollback — this is the final GA state.
#            For rollback after GA, use: bash scripts/rollback-drill.sh
#
# Gate sequence: Gate A (10%) → Gate B (25%) → Gate C (50%) → Gate D (100%)

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────

SERVICE_NAME="${SERVICE_NAME:-loadpilot-api-prod}"
REGION="${REGION:-us-central1}"
PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null || echo "")}"
PRODUCTION_URL="${PRODUCTION_URL:-https://app.loadpilot.com}"
GATE_NAME="gate-d-ga"
TRAFFIC_PCT=100

# ─── Helpers ──────────────────────────────────────────────────────────────────

log() {
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [GATE-D] $*"
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

# ─── Preflight ────────────────────────────────────────────────────────────────

GATE_START=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
log "=== Gate D: General Availability (${TRAFFIC_PCT}% traffic) ==="
log "Entry timestamp: ${GATE_START}"
log "Service: ${SERVICE_NAME} in ${REGION}"
log "NOTE: This is the final gate. No auto-rollback after traffic is routed."

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

log "Step 2: Health check before routing 100% traffic..."
PRE_HEALTH=$(check_health "${PRODUCTION_URL}" "pre-gate-d")

if [[ "${PRE_HEALTH}" != "PASS" ]]; then
  error "Production service not healthy before Gate D. Aborting — do NOT route 100% to unhealthy revision."
fi

# ─── Step 3: Route 100% traffic to latest revision ────────────────────────────

log "Step 3: Routing ${TRAFFIC_PCT}% traffic to ${LATEST_REVISION}..."
gcloud run services update-traffic "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT}" \
  --to-revisions="${LATEST_REVISION}=${TRAFFIC_PCT}"

log "Traffic update complete. Waiting 15s for propagation..."
sleep 15

log "Traffic config: ${TRAFFIC_PCT}% on ${LATEST_REVISION} — GA traffic live"

# ─── Step 4: Capture final traffic configuration ──────────────────────────────

log "Step 4: Capturing final traffic configuration..."
TRAFFIC_CONFIG=$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT}" \
  --format="value(status.traffic)" 2>/dev/null || echo "unavailable")

log "Traffic config: ${TRAFFIC_CONFIG}"

# ─── Step 5: Run smoke tests ──────────────────────────────────────────────────

log "Step 5: Running smoke tests (post-GA)..."
SMOKE_EXIT=0
PRODUCTION_URL="${PRODUCTION_URL}" bash scripts/smoke-test-production.sh 2>&1 || SMOKE_EXIT=$?

if [[ "${SMOKE_EXIT}" -ne 0 ]]; then
  log "WARNING: Smoke tests FAILED after GA traffic routing (exit ${SMOKE_EXIT})."
  log "Traffic is at ${TRAFFIC_PCT}% — no auto-rollback in Gate D."
  log "If rollback is required, run: bash scripts/rollback-drill.sh"
  error "Gate D post-GA smoke tests failed. Assess and rollback manually if needed."
fi

log "Smoke tests PASSED."

# ─── Step 6: Run full verification suite ─────────────────────────────────────

log "Step 6: Running full verify-production.sh..."
VERIFY_EXIT=0
PRODUCTION_URL="${PRODUCTION_URL}" bash scripts/verify-production.sh 2>&1 || VERIFY_EXIT=$?

if [[ "${VERIFY_EXIT}" -ne 0 ]]; then
  log "WARNING: verify-production.sh FAILED after GA routing (exit ${VERIFY_EXIT})."
  log "Traffic is at ${TRAFFIC_PCT}% — no auto-rollback in Gate D."
  log "If rollback is required, run: bash scripts/rollback-drill.sh"
  error "Gate D post-GA verification failed. Assess and rollback manually if needed."
fi

log "verify-production.sh PASSED."

# ─── Step 7: Output final GA evidence ────────────────────────────────────────

GATE_END=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
log "=== Gate D PASSED — LoadPilot is LIVE at General Availability ==="
log "Entry:    ${GATE_START}"
log "Exit:     ${GATE_END}"
log "Revision: ${LATEST_REVISION}"
log "Traffic:  ${TRAFFIC_PCT}% (GA)"

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║          Gate D: PASSED (${TRAFFIC_PCT}% traffic) — GENERAL AVAILABILITY  ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "=== FINAL GA EVIDENCE ==="
echo "  Timestamp (entry):    ${GATE_START}"
echo "  Timestamp (exit):     ${GATE_END}"
echo "  Service:              ${SERVICE_NAME}"
echo "  Region:               ${REGION}"
echo "  GCP Project:          ${PROJECT}"
echo "  Revision (GA):        ${LATEST_REVISION}"
echo "  Traffic %:            ${TRAFFIC_PCT}%"
echo "  Smoke test:           PASS"
echo "  verify-production.sh: PASS"
echo "  Production URL:       ${PRODUCTION_URL}"
echo ""
echo "Record this evidence in: docs/deployment/ROLLOUT_EVIDENCE.md"
echo ""
echo "LoadPilot is now live at General Availability."
echo "Monitor Cloud Logging and dashboards for any issues."
echo "For emergency rollback: bash scripts/rollback-drill.sh"
echo ""

exit 0
