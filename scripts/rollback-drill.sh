#!/usr/bin/env bash
# rollback-drill.sh — Cloud Run traffic rollback drill for LoadPilot staging
#
# Usage: bash scripts/rollback-drill.sh
#
# Prerequisites:
#   - gcloud CLI authenticated and project configured
#   - Cloud Run service loadpilot-api deployed with at least 2 revisions
#   - SERVICE_URL env var set to the Cloud Run service URL (or auto-detected)
#
# What this does:
#   1. Records pre-rollback health check result
#   2. Lists Cloud Run revisions and identifies current and previous
#   3. Rolls back Cloud Run traffic to the previous revision
#   4. Verifies health after rollback
#   5. Restores traffic to the original (current) revision
#   6. Verifies health after restore
#   7. Appends structured evidence to docs/deployment/ROLLBACK_DRILL_EVIDENCE.md

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────

SERVICE_NAME="${SERVICE_NAME:-loadpilot-api}"
REGION="${REGION:-us-central1}"
PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
EVIDENCE_FILE="${EVIDENCE_FILE:-docs/deployment/ROLLBACK_DRILL_EVIDENCE.md}"

# ─── Helpers ──────────────────────────────────────────────────────────────────

log() {
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"
}

error() {
  echo "[ERROR] $*" >&2
  exit 1
}

check_health() {
  local url="$1"
  local label="$2"
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" "${url}/api/health" --max-time 10 || true)
  if [[ "$http_code" == "200" ]]; then
    log "Health check ${label}: PASS (HTTP ${http_code})"
    echo "PASS"
  else
    log "Health check ${label}: FAIL (HTTP ${http_code})"
    echo "FAIL"
  fi
}

# ─── Preflight ────────────────────────────────────────────────────────────────

log "Starting rollback drill for service: ${SERVICE_NAME} in ${REGION}"

if [[ -z "$PROJECT" ]]; then
  error "GCP project not set. Run: gcloud config set project <PROJECT_ID>"
fi

# Auto-detect service URL if not provided
if [[ -z "${SERVICE_URL:-}" ]]; then
  SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT}" \
    --format="value(status.url)" 2>/dev/null) || error "Could not describe service ${SERVICE_NAME}"
fi

log "Service URL: ${SERVICE_URL}"

# ─── Step 1: Pre-rollback health check ────────────────────────────────────────

DRILL_START=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
log "Step 1: Pre-rollback health check at ${SERVICE_URL}/api/health"
PRE_HEALTH=$(check_health "${SERVICE_URL}" "pre-rollback")

if [[ "$PRE_HEALTH" != "PASS" ]]; then
  log "WARNING: Service is not healthy before rollback — drill may not be meaningful"
fi

# ─── Step 2: List revisions and identify current + previous ───────────────────

log "Step 2: Listing Cloud Run revisions for ${SERVICE_NAME}"
REVISIONS=$(gcloud run revisions list \
  --service="${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT}" \
  --format="value(metadata.name)" \
  --sort-by="~metadata.creationTimestamp" 2>/dev/null)

if [[ -z "$REVISIONS" ]]; then
  error "No revisions found for service ${SERVICE_NAME}"
fi

CURRENT_REVISION=$(echo "$REVISIONS" | head -1)
PREVIOUS_REVISION=$(echo "$REVISIONS" | sed -n '2p')

if [[ -z "$PREVIOUS_REVISION" ]]; then
  error "Only one revision found for ${SERVICE_NAME}. Cannot roll back — need at least 2 revisions."
fi

log "Current revision:  ${CURRENT_REVISION}"
log "Previous revision: ${PREVIOUS_REVISION}"

# ─── Step 3: Roll back traffic to previous revision ───────────────────────────

ROLLBACK_TIME=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
log "Step 3: Rolling back traffic to ${PREVIOUS_REVISION}"
gcloud run services update-traffic "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT}" \
  --to-revisions="${PREVIOUS_REVISION}=100"

log "Rollback traffic update complete. Waiting 15s for propagation..."
sleep 15

# ─── Step 4: Verify health after rollback ─────────────────────────────────────

log "Step 4: Health check at ${SERVICE_URL}/api/health after rollback"
POST_ROLLBACK_HEALTH=$(check_health "${SERVICE_URL}" "post-rollback")

if [[ "$POST_ROLLBACK_HEALTH" != "PASS" ]]; then
  log "WARNING: Service unhealthy after rollback. Attempting restore anyway..."
fi

# ─── Step 5: Restore traffic to current revision ──────────────────────────────

RESTORE_TIME=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
log "Step 5: Restoring traffic to ${CURRENT_REVISION}"
gcloud run services update-traffic "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT}" \
  --to-revisions="${CURRENT_REVISION}=100"

log "Restore traffic update complete. Waiting 15s for propagation..."
sleep 15

# ─── Step 6: Verify health after restore ──────────────────────────────────────

log "Step 6: Health check at ${SERVICE_URL}/api/health after restore"
POST_RESTORE_HEALTH=$(check_health "${SERVICE_URL}" "post-restore")

# ─── Step 7: Append structured evidence to ROLLBACK_DRILL_EVIDENCE.md ─────────

DRILL_END=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

if [[ "$POST_ROLLBACK_HEALTH" == "PASS" && "$POST_RESTORE_HEALTH" == "PASS" ]]; then
  DRILL_RESULT="PASS"
else
  DRILL_RESULT="FAIL"
fi

log "Step 7: Appending evidence to ${EVIDENCE_FILE}"

cat >> "${EVIDENCE_FILE}" << EOF

---

## Phase 2 (Staging) — Cloud Run Traffic Rollback Drill

> Drill executed: ${DRILL_START}
> Drill completed: ${DRILL_END}
> Status: ${DRILL_RESULT}

### Environment

| Field | Value |
|-------|-------|
| GCP Project | ${PROJECT} |
| Cloud Run Service | ${SERVICE_NAME} |
| Region | ${REGION} |
| Service URL | ${SERVICE_URL} |

### Drill Timeline

| Step | Timestamp (UTC) | Details | Result |
|------|----------------|---------|--------|
| 1. Pre-rollback health check | ${DRILL_START} | GET ${SERVICE_URL}/api/health | ${PRE_HEALTH} |
| 2. Identify revisions | ${DRILL_START} | Current: ${CURRENT_REVISION} / Previous: ${PREVIOUS_REVISION} | OK |
| 3. Rollback traffic | ${ROLLBACK_TIME} | gcloud run services update-traffic --to-revisions=${PREVIOUS_REVISION}=100 | OK |
| 4. Post-rollback health check | ${ROLLBACK_TIME} | GET ${SERVICE_URL}/api/health | ${POST_ROLLBACK_HEALTH} |
| 5. Restore traffic | ${RESTORE_TIME} | gcloud run services update-traffic --to-revisions=${CURRENT_REVISION}=100 | OK |
| 6. Post-restore health check | ${DRILL_END} | GET ${SERVICE_URL}/api/health | ${POST_RESTORE_HEALTH} |

### Sign-Off

| Role | Name | Date |
|------|------|------|
| Drill executor | ______________ | ${DRILL_START} |
| Operator review | ______________ | ______________ |

EOF

log "Drill complete. Result: ${DRILL_RESULT}"
log "Evidence appended to ${EVIDENCE_FILE}"

if [[ "$DRILL_RESULT" != "PASS" ]]; then
  error "Rollback drill FAILED. Check evidence file for details."
fi

exit 0
