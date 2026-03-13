#!/usr/bin/env bash
# gate-b-pilot.sh — Gate B: Route 10% traffic to latest production revision.
# Pilot tenant phase. Requires Gate A to have been completed successfully.
#
# Usage: bash scripts/gate-b-pilot.sh
#
# What this does:
#   1. Verifies Gate A was previously run (GATE_A_PASSED env flag or checks for evidence)
#   2. Logs gate entry timestamp
#   3. Identifies the latest revision of loadpilot-api-prod
#   4. Routes 10% traffic to latest revision
#   5. Runs smoke tests against the production URL
#   6. Auto-rollbacks to previous stable split on smoke test failure
#   7. Logs gate exit timestamp and result
#   8. Prints 24h soak period recommendation and Gate C instructions
#
# Gate sequence: Gate A (5%) → Gate B (10%) → Gate C (50%) → Gate D (100%)
# Soak schedule: Gate A 2h → Gate B 24h → Gate C 24h → Gate D after 48h at 50%

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────

SERVICE_NAME="${SERVICE_NAME:-loadpilot-api-prod}"
REGION="${REGION:-us-central1}"
if [[ -z "${PROD_PROJECT_ID:-}" ]]; then
  echo "ERROR: PROD_PROJECT_ID env var required. Set to your production GCP project ID." >&2
  echo "  Example: export PROD_PROJECT_ID='my-loadpilot-prod'" >&2
  exit 1
fi
PROJECT="${PROD_PROJECT_ID}"
PRODUCTION_URL="${PRODUCTION_URL:-https://app.loadpilot.com}"
GATE_NAME="gate-b-pilot"
TRAFFIC_PCT=10
ROLLOUT_EVIDENCE="${ROLLOUT_EVIDENCE:-docs/deployment/ROLLOUT_EVIDENCE.md}"

# ─── Helpers ──────────────────────────────────────────────────────────────────

log() {
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [GATE-B] $*"
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

# ─── Gate A prerequisite check ────────────────────────────────────────────────

GATE_START=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
log "=== Gate B: Pilot Tenant (${TRAFFIC_PCT}% traffic) ==="
log "Entry timestamp: ${GATE_START}"

# Require Gate A to have been run — check GATE_A_PASSED env flag or evidence file
if [[ "${GATE_A_PASSED:-}" != "true" ]]; then
  # Check if evidence file contains Gate A passage record
  if [[ -f "${ROLLOUT_EVIDENCE}" ]] && grep -q "Gate A" "${ROLLOUT_EVIDENCE}" 2>/dev/null; then
    log "Gate A evidence found in ${ROLLOUT_EVIDENCE}. Proceeding."
  else
    log "WARNING: Gate A completion not confirmed."
    log "Set GATE_A_PASSED=true to skip this check, or ensure ${ROLLOUT_EVIDENCE} contains Gate A evidence."
    error "Gate B requires Gate A to be completed first. Run: bash scripts/gate-a-internal.sh"
  fi
fi

log "Gate A prerequisite: satisfied"

# ─── Preflight ────────────────────────────────────────────────────────────────

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
PRE_HEALTH=$(check_health "${PRODUCTION_URL}" "pre-gate-b")

if [[ "${PRE_HEALTH}" != "PASS" ]]; then
  error "Production service not healthy before Gate B. Aborting."
fi

# ─── Step 3: Route 10% traffic to latest revision ─────────────────────────────

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
  log "Smoke tests FAILED (exit code ${SMOKE_EXIT}). Initiating auto-rollback..."

  # Auto-rollback: route all traffic to stable (previous) revision
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
    log "WARNING: Could not identify stable revision for rollback. Using --to-latest..."
    gcloud run services update-traffic "${SERVICE_NAME}" \
      --region="${REGION}" \
      --project="${PROJECT}" \
      --to-latest
  fi

  GATE_END=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  log "=== Gate B FAILED and rolled back at ${GATE_END} ==="
  error "Gate B FAILED: smoke tests did not pass. Traffic rolled back. Fix issues before re-running."
fi

# ─── Step 5: Log gate exit ────────────────────────────────────────────────────

GATE_END=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
log "Smoke tests PASSED."
log "=== Gate B PASSED ==="
log "Entry:    ${GATE_START}"
log "Exit:     ${GATE_END}"
log "Traffic:  ${TRAFFIC_PCT}% on ${LATEST_REVISION}"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║               Gate B: PASSED (${TRAFFIC_PCT}% traffic)              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Evidence to record in docs/deployment/ROLLOUT_EVIDENCE.md:"
echo "  Gate B timestamp (entry):  ${GATE_START}"
echo "  Gate B timestamp (exit):   ${GATE_END}"
echo "  Revision:                  ${LATEST_REVISION}"
echo "  Traffic %:                 ${TRAFFIC_PCT}%"
echo "  Health check:              PASS"
echo "  Smoke test:                PASS"
echo ""
echo "REQUIRED: Allow a 24-hour soak period at ${TRAFFIC_PCT}% before proceeding to Gate C."
echo "  - Monitor Cloud Logging for errors: gcloud logging read resource.type=cloud_run_revision"
echo "  - Check Cloud Monitoring dashboards for latency/error rate regressions"
echo "  - Review pilot tenant feedback"
echo "  - Do NOT proceed to Gate C until 24h has elapsed with clean metrics"
echo ""
echo "Next step — Gate C (Broader Rollout, 50% traffic):"
echo "  After 24h soak with no issues:"
echo "  bash scripts/gate-c-broader.sh"
echo ""

exit 0
