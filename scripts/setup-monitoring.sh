#!/usr/bin/env bash
# setup-monitoring.sh — Configure Cloud Monitoring alerts for LoadPilot
#
# Usage:
#   NOTIFICATION_EMAIL=oncall@example.com bash scripts/setup-monitoring.sh
#
# Prerequisites:
#   - gcloud CLI authenticated and project configured
#   - Cloud Monitoring API enabled: gcloud services enable monitoring.googleapis.com
#   - NOTIFICATION_EMAIL environment variable set
#
# What this does:
#   1. Generates JSON policy file for error rate alert (> 5% over 5 min on loadpilot-api)
#   2. Generates JSON policy file for p99 latency alert (> 3s over 5 min on loadpilot-api)
#   3. Creates alert policies via: gcloud monitoring policies create --policy-from-file=...
#      (stable GA CLI — uses the stable monitoring command, not the alpha CLI)
#   4. Creates notification channel (email) via: gcloud beta monitoring channels create
#      (beta required — no stable GA equivalent for channel creation)
#   5. Links alert policies to notification channel

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────

if [[ -z "${PROD_PROJECT_ID:-}" ]]; then
  echo "ERROR: PROD_PROJECT_ID env var required. Set to your production GCP project ID." >&2
  echo "  Example: export PROD_PROJECT_ID='my-loadpilot-prod'" >&2
  exit 1
fi
PROJECT="${PROD_PROJECT_ID}"
SERVICE_NAME="${SERVICE_NAME:-loadpilot-api-prod}"
NOTIFICATION_EMAIL="${NOTIFICATION_EMAIL:-}"

# Thresholds
ERROR_RATE_THRESHOLD="0.05"       # 5% error rate
ERROR_RATE_DURATION="300s"        # 5 minutes
LATENCY_P99_THRESHOLD_MS="3000"   # 3000ms = 3s p99 latency
LATENCY_DURATION="300s"           # 5 minutes

TMPDIR_POLICIES=$(mktemp -d)
trap 'rm -rf "$TMPDIR_POLICIES"' EXIT

# ─── Helpers ──────────────────────────────────────────────────────────────────

log() {
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"
}

error() {
  echo "[ERROR] $*" >&2
  exit 1
}

# ─── Preflight ────────────────────────────────────────────────────────────────

if [[ -z "$PROJECT" ]]; then
  error "GCP project not set. Run: gcloud config set project <PROJECT_ID>"
fi

if [[ -z "$NOTIFICATION_EMAIL" ]]; then
  error "NOTIFICATION_EMAIL environment variable is required. Example: NOTIFICATION_EMAIL=oncall@example.com bash scripts/setup-monitoring.sh"
fi

log "Setting up Cloud Monitoring for project: ${PROJECT}"
log "Notification email: ${NOTIFICATION_EMAIL}"

# ─── Step 1: Generate error rate alert policy JSON ────────────────────────────

ERROR_POLICY_FILE="${TMPDIR_POLICIES}/error-rate-policy.json"

log "Step 1: Generating error rate alert policy (threshold: ${ERROR_RATE_THRESHOLD} over ${ERROR_RATE_DURATION})"

cat > "${ERROR_POLICY_FILE}" << POLICY_EOF
{
  "displayName": "LoadPilot API — High Error Rate",
  "documentation": {
    "content": "Alert when the error rate for the loadpilot-api Cloud Run service exceeds 5% over a 5-minute window. Investigate Cloud Logging for 5xx errors.",
    "mimeType": "text/markdown"
  },
  "conditions": [
    {
      "displayName": "Cloud Run error rate > 5%",
      "conditionThreshold": {
        "filter": "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${SERVICE_NAME}\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.labels.response_code_class=\"5xx\"",
        "aggregations": [
          {
            "alignmentPeriod": "${ERROR_RATE_DURATION}",
            "perSeriesAligner": "ALIGN_RATE",
            "crossSeriesReducer": "REDUCE_SUM",
            "groupByFields": ["resource.labels.service_name"]
          }
        ],
        "comparison": "COMPARISON_GT",
        "thresholdValue": ${ERROR_RATE_THRESHOLD},
        "duration": "${ERROR_RATE_DURATION}",
        "trigger": {
          "count": 1
        }
      }
    }
  ],
  "alertStrategy": {
    "notificationRateLimit": {
      "period": "3600s"
    }
  },
  "combiner": "OR",
  "enabled": true
}
POLICY_EOF

log "Error rate policy file written: ${ERROR_POLICY_FILE}"

# ─── Step 2: Generate p99 latency alert policy JSON ───────────────────────────

LATENCY_POLICY_FILE="${TMPDIR_POLICIES}/latency-p99-policy.json"

log "Step 2: Generating p99 latency alert policy (threshold: ${LATENCY_P99_THRESHOLD_MS}ms over ${LATENCY_DURATION})"

cat > "${LATENCY_POLICY_FILE}" << POLICY_EOF
{
  "displayName": "LoadPilot API — High p99 Latency",
  "documentation": {
    "content": "Alert when p99 request latency for the loadpilot-api Cloud Run service exceeds 3 seconds over a 5-minute window. Investigate slow queries or memory pressure.",
    "mimeType": "text/markdown"
  },
  "conditions": [
    {
      "displayName": "Cloud Run p99 latency > 3s",
      "conditionThreshold": {
        "filter": "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${SERVICE_NAME}\" AND metric.type=\"run.googleapis.com/request_latencies\"",
        "aggregations": [
          {
            "alignmentPeriod": "${LATENCY_DURATION}",
            "perSeriesAligner": "ALIGN_PERCENTILE_99",
            "crossSeriesReducer": "REDUCE_MAX",
            "groupByFields": ["resource.labels.service_name"]
          }
        ],
        "comparison": "COMPARISON_GT",
        "thresholdValue": ${LATENCY_P99_THRESHOLD_MS},
        "duration": "${LATENCY_DURATION}",
        "trigger": {
          "count": 1
        }
      }
    }
  ],
  "alertStrategy": {
    "notificationRateLimit": {
      "period": "3600s"
    }
  },
  "combiner": "OR",
  "enabled": true
}
POLICY_EOF

log "Latency policy file written: ${LATENCY_POLICY_FILE}"

# ─── Step 3: Create alert policies via stable gcloud monitoring CLI ───────────
# Uses: gcloud monitoring policies create --policy-from-file=<file>
# This is the stable GA command (monitoring, not the alpha/beta release track).

log "Step 3: Creating error rate alert policy"
ERROR_POLICY_NAME=$(gcloud monitoring policies create \
  --policy-from-file="${ERROR_POLICY_FILE}" \
  --project="${PROJECT}" \
  --format="value(name)" 2>&1)

if [[ -z "$ERROR_POLICY_NAME" ]]; then
  error "Failed to create error rate alert policy. Check that Cloud Monitoring API is enabled."
fi
log "Error rate policy created: ${ERROR_POLICY_NAME}"

log "Creating p99 latency alert policy"
LATENCY_POLICY_NAME=$(gcloud monitoring policies create \
  --policy-from-file="${LATENCY_POLICY_FILE}" \
  --project="${PROJECT}" \
  --format="value(name)" 2>&1)

if [[ -z "$LATENCY_POLICY_NAME" ]]; then
  error "Failed to create latency alert policy."
fi
log "Latency policy created: ${LATENCY_POLICY_NAME}"

# ─── Step 4: Create notification channel via gcloud beta monitoring channels ───
# Uses: gcloud beta monitoring channels create
# Note: Google's Monitoring API docs reference the beta command for channel creation.
# There is no stable GA equivalent for this operation.

log "Step 4: Creating email notification channel for ${NOTIFICATION_EMAIL}"

CHANNEL_DESCRIPTOR_FILE="${TMPDIR_POLICIES}/notification-channel.json"

cat > "${CHANNEL_DESCRIPTOR_FILE}" << CHANNEL_EOF
{
  "displayName": "LoadPilot On-Call Email",
  "type": "email",
  "labels": {
    "email_address": "${NOTIFICATION_EMAIL}"
  },
  "enabled": true
}
CHANNEL_EOF

CHANNEL_NAME=$(gcloud beta monitoring channels create \
  --channel-content-from-file="${CHANNEL_DESCRIPTOR_FILE}" \
  --project="${PROJECT}" \
  --format="value(name)" 2>&1)

if [[ -z "$CHANNEL_NAME" ]]; then
  error "Failed to create notification channel. Check that the Monitoring API is enabled and gcloud beta is available."
fi
log "Notification channel created: ${CHANNEL_NAME}"

# ─── Step 5: Link notification channel to alert policies ──────────────────────
# The notificationChannels field is updated on the existing policies.

log "Step 5: Linking notification channel to alert policies"

gcloud monitoring policies update "${ERROR_POLICY_NAME}" \
  --project="${PROJECT}" \
  --add-notification-channels="${CHANNEL_NAME}"

gcloud monitoring policies update "${LATENCY_POLICY_NAME}" \
  --project="${PROJECT}" \
  --add-notification-channels="${CHANNEL_NAME}"

log "Notification channel linked to both alert policies"

# ─── Summary ──────────────────────────────────────────────────────────────────

log "Cloud Monitoring setup complete."
echo ""
echo "============================================================"
echo "  LoadPilot Monitoring Setup — Summary"
echo "============================================================"
echo "  Project:              ${PROJECT}"
echo "  Service monitored:    ${SERVICE_NAME}"
echo "  Notification email:   ${NOTIFICATION_EMAIL}"
echo "  Error rate policy:    ${ERROR_POLICY_NAME}"
echo "  Latency p99 policy:   ${LATENCY_POLICY_NAME}"
echo "  Notification channel: ${CHANNEL_NAME}"
echo "============================================================"
echo ""
echo "Alert thresholds:"
echo "  - Error rate: > ${ERROR_RATE_THRESHOLD} (5%) over ${ERROR_RATE_DURATION}"
echo "  - p99 latency: > ${LATENCY_P99_THRESHOLD_MS}ms over ${LATENCY_DURATION}"
echo ""
echo "To verify, run:"
echo "  gcloud monitoring policies list --project=${PROJECT}"
echo "  gcloud beta monitoring channels list --project=${PROJECT}"

exit 0
