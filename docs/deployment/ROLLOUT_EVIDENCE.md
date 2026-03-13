# Controlled Traffic Rollout Evidence

> **Plan:** Production Go-Live Qualification
> **Service:** `loadpilot-api-prod` (Cloud Run, `us-central1`)
> **Gate sequence:** Gate A (5%) → Gate B (10%) → Gate C (50%) → Gate D (100%)
> **Soak schedule:** Gate A 2h → Gate B 24h → Gate C 24h → Gate D after 48h at 50%
>
> Record evidence for each gate as it is completed.
> Rollback events (if any) are documented in the Rollback Events section at the bottom.

---

## Gate A — Internal Testing (5% Traffic)

> Run: `bash scripts/gate-a-internal.sh`
> **Required:** 2-hour soak period at 5% before proceeding to Gate B.

| Field               | Value   |
| ------------------- | ------- |
| Status              | PENDING |
| Timestamp (entry)   | TBD     |
| Timestamp (exit)    | TBD     |
| Revision            | TBD     |
| Traffic %           | 5%      |
| Health check result | TBD     |
| Smoke test result   | TBD     |
| Soak period (2h)    | TBD     |
| Executed by         | TBD     |

### Gate A Notes

_Record any observations from internal testing. 2-hour soak required before Gate B._

---

## Gate B — Pilot Tenant (10% Traffic)

> Run: `bash scripts/gate-b-pilot.sh`
> **Required:** 24-hour soak period at 10% before proceeding to Gate C.

| Field               | Value   |
| ------------------- | ------- |
| Status              | PENDING |
| Timestamp (entry)   | TBD     |
| Timestamp (exit)    | TBD     |
| Revision            | TBD     |
| Traffic %           | 10%     |
| Health check result | TBD     |
| Smoke test result   | TBD     |
| Soak period start   | TBD     |
| Soak period end     | TBD     |
| Soak period notes   | TBD     |
| Executed by         | TBD     |

### Gate B Notes

_Record pilot tenant feedback, error rates, and latency observations here._

---

## Gate C — Broader Rollout (50% Traffic)

> Run: `bash scripts/gate-c-broader.sh`
> **Required:** 24-hour soak, then 48 hours total clean at 50% before Gate D.

| Field                          | Value   |
| ------------------------------ | ------- |
| Status                         | PENDING |
| Timestamp (entry)              | TBD     |
| Timestamp (exit)               | TBD     |
| Revision                       | TBD     |
| Traffic %                      | 50%     |
| Health check result            | TBD     |
| Smoke test result              | TBD     |
| verify-production.sh result    | TBD     |
| Error rate (Cloud Monitoring)  | TBD     |
| p99 latency (Cloud Monitoring) | TBD     |
| Soak period start (24h)        | TBD     |
| Soak period end                | TBD     |
| 48h clean checkpoint           | TBD     |
| Executed by                    | TBD     |

### Gate C Notes

_Record verify-production.sh output. 48 hours clean at 50% required before Gate D._

---

## Gate D — General Availability (100% Traffic)

> Run: `bash scripts/gate-d-ga.sh`
> **FINAL GATE** — no auto-rollback after this step.
> **Prerequisite:** 48 hours clean at 50% (Gate C).
> For emergency rollback after GA: `bash scripts/rollback-drill.sh`

| Field                       | Value                     |
| --------------------------- | ------------------------- |
| Status                      | PENDING                   |
| Timestamp (entry)           | TBD                       |
| Timestamp (exit)            | TBD                       |
| Revision (GA)               | TBD                       |
| Traffic %                   | 100%                      |
| Health check result         | TBD                       |
| Smoke test result           | TBD                       |
| verify-production.sh result | TBD                       |
| Final traffic config        | TBD                       |
| Production URL              | https://app.loadpilot.com |
| Executed by                 | TBD                       |

### Gate D Sign-Off

| Role             | Name | Timestamp |
| ---------------- | ---- | --------- |
| Release engineer | TBD  | TBD       |
| Operator review  | TBD  | TBD       |
| Final approver   | TBD  | TBD       |

### Gate D Notes

_Record final GA evidence, traffic configuration snapshot, and go-live declaration here._

---

## Rollback Events

_If any rollback occurred during the rollout, document it here._

| Gate | Timestamp | Reason | Revision rolled back to | Executed by |
| ---- | --------- | ------ | ----------------------- | ----------- |
|      |           |        |                         |             |

### Rollback Notes

_Record root cause analysis, remediation steps, and re-rollout timeline here._

---

## Overall Rollout Summary

| Gate              | Status  | Traffic % | Soak             | Timestamp |
| ----------------- | ------- | --------- | ---------------- | --------- |
| Gate A (Internal) | PENDING | 5%        | 2h               | TBD       |
| Gate B (Pilot)    | PENDING | 10%       | 24h              | TBD       |
| Gate C (Broader)  | PENDING | 50%       | 24h + 48h clean  | TBD       |
| Gate D (GA)       | PENDING | 100%      | after 48h at 50% | TBD       |

**Final verdict:** PENDING

---

_Template populated by STORY-005 (Controlled Rollout Gate Scripts)._
_Updated with operator decisions 2026-03-13: separate prod project, revised soak schedule._
_Commands: `gate-a-internal.sh`, `gate-b-pilot.sh`, `gate-c-broader.sh`, `gate-d-ga.sh`_
