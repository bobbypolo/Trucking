# Controlled Traffic Rollout Evidence

> **Plan:** Production Go-Live Qualification
> **Service:** `loadpilot-api-prod` (Cloud Run, `us-central1`)
> **Gate sequence:** Gate A (10%) → Gate B (25%) → Gate C (50%) → Gate D (100%)
>
> Record evidence for each gate as it is completed.
> Rollback events (if any) are documented in the Rollback Events section at the bottom.

---

## Gate A — Internal Testing (10% Traffic)

> Run: `bash scripts/gate-a-internal.sh`

| Field | Value |
|-------|-------|
| Status | PENDING |
| Timestamp (entry) | _______________ |
| Timestamp (exit) | _______________ |
| Revision | _______________ |
| Traffic % | 10% |
| Health check result | _______________ |
| Smoke test result | _______________ |
| Executed by | _______________ |

### Gate A Notes

_Record any observations from internal testing here._

---

## Gate B — Pilot Tenant (25% Traffic)

> Run: `bash scripts/gate-b-pilot.sh`
> Recommended: 24-hour soak period at 25% before proceeding to Gate C.

| Field | Value |
|-------|-------|
| Status | PENDING |
| Timestamp (entry) | _______________ |
| Timestamp (exit) | _______________ |
| Revision | _______________ |
| Traffic % | 25% |
| Health check result | _______________ |
| Smoke test result | _______________ |
| Soak period start | _______________ |
| Soak period end | _______________ |
| Soak period notes | _______________ |
| Executed by | _______________ |

### Gate B Notes

_Record pilot tenant feedback, error rates, and latency observations here._

---

## Gate C — Broader Rollout (50% Traffic)

> Run: `bash scripts/gate-c-broader.sh`

| Field | Value |
|-------|-------|
| Status | PENDING |
| Timestamp (entry) | _______________ |
| Timestamp (exit) | _______________ |
| Revision | _______________ |
| Traffic % | 50% |
| Health check result | _______________ |
| Smoke test result | _______________ |
| verify-production.sh result | _______________ |
| Error rate (Cloud Monitoring) | _______________ |
| p99 latency (Cloud Monitoring) | _______________ |
| Executed by | _______________ |

### Gate C Notes

_Record verify-production.sh output summary and any issues here._

---

## Gate D — General Availability (100% Traffic)

> Run: `bash scripts/gate-d-ga.sh`
> **FINAL GATE** — no auto-rollback after this step.
> For emergency rollback after GA: `bash scripts/rollback-drill.sh`

| Field | Value |
|-------|-------|
| Status | PENDING |
| Timestamp (entry) | _______________ |
| Timestamp (exit) | _______________ |
| Revision (GA) | _______________ |
| Traffic % | 100% |
| Health check result | _______________ |
| Smoke test result | _______________ |
| verify-production.sh result | _______________ |
| Final traffic config | _______________ |
| Production URL | https://app.loadpilot.com |
| Executed by | _______________ |

### Gate D Sign-Off

| Role | Name | Timestamp |
|------|------|-----------|
| Release engineer | _______________ | _______________ |
| Operator review | _______________ | _______________ |
| Final approver | _______________ | _______________ |

### Gate D Notes

_Record final GA evidence, traffic configuration snapshot, and go-live declaration here._

---

## Rollback Events

_If any rollback occurred during the rollout, document it here._

| Gate | Timestamp | Reason | Revision rolled back to | Executed by |
|------|-----------|--------|------------------------|-------------|
| | | | | |

### Rollback Notes

_Record root cause analysis, remediation steps, and re-rollout timeline here._

---

## Overall Rollout Summary

| Gate | Status | Traffic % | Timestamp |
|------|--------|-----------|-----------|
| Gate A (Internal) | PENDING | 10% | _______________ |
| Gate B (Pilot) | PENDING | 25% | _______________ |
| Gate C (Broader) | PENDING | 50% | _______________ |
| Gate D (GA) | PENDING | 100% | _______________ |

**Final verdict:** PENDING

---

*Template populated by STORY-005 (Controlled Rollout Gate Scripts).*
*Commands: `gate-a-internal.sh`, `gate-b-pilot.sh`, `gate-c-broader.sh`, `gate-d-ga.sh`*
