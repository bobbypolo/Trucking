# Data Protection Policy — LoadPilot Production

> **Version:** 1.0 | **Effective:** 2026-03-13
> **Owner:** Engineering Lead | **Review cycle:** Quarterly
> **Applies to:** LoadPilot SaaS production environment (`gen-lang-client-0535844903`)

## 1. Purpose

This policy defines how LoadPilot protects production data against loss, corruption, and
unauthorized access. It establishes backup schedules, recovery objectives, responsibilities,
and testing requirements for the Cloud SQL MySQL instance `loadpilot-prod`.

---

## 2. Backup Strategy

### 2.1 Automated Daily Backups

| Parameter | Value |
|-----------|-------|
| Backup type | Cloud SQL automated backup |
| Schedule | Daily at **03:00 UTC** (low-traffic window) |
| Retention | **7 days** (rolling) |
| Configuration script | `scripts/backup-setup.sh` |

Automated backups capture a consistent snapshot of the entire `loadpilot-prod` instance.
The 7-day retention window ensures recovery from incidents discovered up to one week later.

### 2.2 Point-in-Time Recovery (PITR)

| Parameter | Value |
|-----------|-------|
| Mechanism | MySQL binary logging (`--enable-bin-log`) |
| Window | **7 days** of transaction logs retained |
| Granularity | Per-second recovery within the window |
| RPO | **< 5 minutes** |

PITR allows recovery to any point within the last 7 days, enabling precise recovery after
accidental data modifications or deployments with bad migrations.

### 2.3 On-Demand Backups

Operators may create on-demand backups before major deployments or migrations:

```bash
gcloud sql backups create \
  --instance=loadpilot-prod \
  --project=gen-lang-client-0535844903 \
  --description="Pre-deployment backup: [reason]"
```

---

## 3. Recovery Objectives

| Metric | Target | Mechanism |
|--------|--------|-----------|
| **RTO** (Recovery Time Objective) | **< 15 minutes** | Automated restore via gcloud CLI |
| **RPO** (Recovery Point Objective) | **< 5 minutes** | PITR with binary logging |
| RPO (backup-only fallback) | < 24 hours | Daily automated backup |

These targets apply to the restore procedure documented in `docs/deployment/RESTORE_PROCEDURE.md`.

---

## 4. Testing Schedule

### 4.1 Monthly Backup Restore Test

Frequency: **Monthly** (first Tuesday of each month)

Procedure:
1. List available backups: `gcloud sql backups list --instance=loadpilot-prod`
2. Restore a recent backup to the staging instance
3. Run integrity checks (row counts, application health)
4. Document results in the incident/operations log
5. Delete the test restore instance

Success criteria: restore completes within RTO target, row counts match production.

### 4.2 Quarterly Disaster Recovery Drill

Frequency: **Quarterly** (first month of each quarter)

Scope:
- Full PITR restore drill to a target timestamp
- Application failover verification
- RTO/RPO measurement and comparison against targets
- Restore procedure review and update if gaps found

Participants: Engineering Lead, at least one on-call engineer.

---

## 5. Responsibilities

| Role | Responsibility |
|------|---------------|
| **Engineering Lead** | Policy owner; approves changes; runs quarterly DR drills |
| **On-call Engineer** | First responder; executes restore procedures during incidents |
| **DevOps / Release Engineer** | Runs `backup-setup.sh` after provisioning; verifies backup health weekly |
| **All Engineers** | Report data anomalies immediately; never delete production data without approval |

### Access Controls

- Only engineers with `roles/cloudsql.admin` may initiate restores
- Restore operations are logged in Cloud Audit Logs
- Credentials for `loadpilot-prod` are stored in Secret Manager — never in code or .env files

---

## 6. Compliance Notes

### Data Retention

- Customer data is retained for the life of the contract plus 90 days post-termination
- Backup retention (7 days) is operational only; it does not satisfy contract data retention
- Long-term retention requires separate Cloud Storage export procedures (not yet implemented)

### Data Deletion

- Customer data deletion requests must be processed within 30 days
- Deletion must be applied to live database AND any point-in-time restore window data
- After 7 days post-deletion, PITR window naturally expires
- Contact Engineering Lead for deletion procedures

### Encryption

- All Cloud SQL data is encrypted at rest by default (Google-managed keys)
- All backup data is encrypted at rest (same policy)
- Data in transit uses TLS 1.2+ enforced by Cloud SQL proxy

---

## 7. Related Documents

- `scripts/backup-setup.sh` — Backup configuration script
- `docs/deployment/RESTORE_PROCEDURE.md` — Step-by-step restore procedures
- `docs/deployment/ROLLBACK_PROCEDURE.md` — Application-level rollback
- `docs/deployment/GO_NO_GO_CHECKLIST.md` — Production go/no-go checklist
