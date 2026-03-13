# Restore Procedure — LoadPilot Production Database

> **Version:** 1.0 | **Updated:** 2026-03-13
> **Applies to:** Cloud SQL MySQL instance `loadpilot-prod`, project `$PROD_PROJECT_ID` (separate from staging)
>
> **Note:** Replace `$PROD_PROJECT_ID` with your production GCP project ID in all commands below.
> **RTO Target:** < 15 minutes | **RPO Target:** < 5 minutes (with PITR)

## Purpose and Scope

This document provides step-by-step procedures for restoring the LoadPilot production database
from Cloud SQL automated backups or via Point-in-Time Recovery (PITR). It covers three scenarios:

1. Full restore from an automated backup (RPO: up to 24 hours)
2. Point-in-Time Recovery to a specific timestamp (RPO: < 5 minutes)
3. Emergency restore to staging for investigation without affecting production

## Prerequisites

Before starting any restore procedure:

- [ ] Authenticated with gcloud: `gcloud auth login`
- [ ] Correct project active: `gcloud config set project gen-lang-client-0535844903`
- [ ] Required IAM role: **Cloud SQL Admin** (`roles/cloudsql.admin`)
- [ ] Incident channel open (notify team before starting)
- [ ] Note the incident start time and estimated data loss window

---

## Procedure 1: Restore from Automated Backup

Use when: data corruption or accidental deletion is detected and the target state is a known
daily backup point.

### Step 1 — List available backups

```bash
gcloud sql backups list \
  --instance=loadpilot-prod \
  --project=gen-lang-client-0535844903
```

Note the `BACKUP_ID` of the backup closest to (but before) the incident.

### Step 2 — Restore from selected backup

```bash
gcloud sql backups restore BACKUP_ID \
  --restore-instance=loadpilot-prod \
  --project=gen-lang-client-0535844903
```

> **Warning:** This operation overwrites all data in `loadpilot-prod` with the backup contents.
> It cannot be undone. If unsure, use Procedure 3 (restore to staging) first to verify.

Wait for the operation to complete (typically 5-10 minutes for production-sized databases).

### Step 3 — Verify restored data

```bash
# Connect via Cloud SQL Auth Proxy
cloud_sql_proxy -instances=gen-lang-client-0535844903:us-central1:loadpilot-prod=tcp:3306

# Run integrity checks
mysql -u root -p -h 127.0.0.1 trucklogix_prod <<'EOF'
SELECT COUNT(*) AS load_count FROM loads;
SELECT COUNT(*) AS user_count FROM users;
SELECT COUNT(*) AS company_count FROM companies;
SELECT MAX(created_at) AS newest_record FROM loads;
EOF
```

---

## Procedure 2: Point-in-Time Recovery (PITR)

Use when: precise recovery to a specific timestamp is required (e.g., "restore to 14:32 UTC
before the bad deployment").

**Prerequisite:** PITR requires binary logging to be enabled (configured by `backup-setup.sh`).
The recovery window is the last 7 days.

### Step 1 — Identify target timestamp

Determine the exact UTC timestamp to recover to. Use application logs or monitoring dashboards
to find the last known-good state. Format: `YYYY-MM-DDTHH:MM:SSZ`

Example: `2026-03-13T14:30:00Z`

### Step 2 — Create PITR clone

```bash
gcloud sql instances clone loadpilot-prod loadpilot-prod-restored \
  --point-in-time=2026-03-13T14:30:00Z \
  --project=gen-lang-client-0535844903
```

This creates a new instance `loadpilot-prod-restored` with data at the specified timestamp.
The original `loadpilot-prod` instance is **not affected**.

### Step 3 — Validate restored data

```bash
cloud_sql_proxy -instances=gen-lang-client-0535844903:us-central1:loadpilot-prod-restored=tcp:3307

mysql -u root -p -h 127.0.0.1 -P 3307 trucklogix_prod <<'EOF'
SELECT COUNT(*) AS load_count FROM loads;
SELECT MAX(created_at) AS newest_record FROM loads;
-- Verify the bad data is absent
SELECT COUNT(*) FROM loads WHERE created_at > '2026-03-13 14:30:00';
EOF
```

### Step 4 — Swap traffic or export/import

**Option A — Export and import (lower risk, longer RTO):**

```bash
# Export from restored instance
gcloud sql export sql loadpilot-prod-restored \
  gs://loadpilot-prod-backups/pitr-restore-$(date +%Y%m%d).sql \
  --database=trucklogix_prod \
  --project=gen-lang-client-0535844903

# Import into production instance
gcloud sql import sql loadpilot-prod \
  gs://loadpilot-prod-backups/pitr-restore-$(date +%Y%m%d).sql \
  --database=trucklogix_prod \
  --project=gen-lang-client-0535844903
```

**Option B — Rename and swap (faster, higher risk):**

```bash
# Rename production to backup
gcloud sql instances patch loadpilot-prod --new-name=loadpilot-prod-damaged \
  --project=gen-lang-client-0535844903

# Rename restored to production
gcloud sql instances patch loadpilot-prod-restored --new-name=loadpilot-prod \
  --project=gen-lang-client-0535844903
```

### Step 5 — Clean up restored instance

After confirming production is healthy:

```bash
gcloud sql instances delete loadpilot-prod-restored \
  --project=gen-lang-client-0535844903
```

---

## Procedure 3: Emergency Restore to Staging

Use when: you need to investigate a production data issue without affecting the live system,
or when validating a backup before restoring to production.

### Step 1 — Clone production backup to staging

```bash
gcloud sql backups restore BACKUP_ID \
  --restore-instance=loadpilot-staging \
  --project=gen-lang-client-0535844903
```

### Step 2 — Connect to staging and investigate

```bash
cloud_sql_proxy -instances=gen-lang-client-0535844903:us-central1:loadpilot-staging=tcp:3307

mysql -u root -p -h 127.0.0.1 -P 3307 trucklogix_staging
```

---

## Verification Steps (Post-Restore)

After any restore, verify the following before marking the incident resolved:

1. **Row counts match expectations**

   ```sql
   SELECT table_name, table_rows
   FROM information_schema.tables
   WHERE table_schema = 'trucklogix_prod'
   ORDER BY table_name;
   ```

2. **Application health check passes**

   ```bash
   curl -sf https://loadpilot-api-[HASH]-uc.a.run.app/api/health | jq .
   ```

3. **No 500 errors in Cloud Logging** (check last 15 minutes)

   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND severity=ERROR" \
     --limit=20 --project=$PROD_PROJECT_ID
   ```

4. **Authentication still works** — perform a test login via staging/production URL

---

## Post-Restore Checklist

- [ ] Notify team in incident channel: "Restore complete, production healthy"
- [ ] Update incident log with: restore start time, backup ID used, validation results
- [ ] Verify monitoring/alerting is still active (Cloud Monitoring)
- [ ] Schedule post-incident review within 24 hours
- [ ] Clean up any temporary instances created during restore
- [ ] Update this runbook if the procedure needs correction

---

## Recovery Objectives

| Metric            | Target       | Notes                                          |
| ----------------- | ------------ | ---------------------------------------------- |
| RTO               | < 15 minutes | From decision to restore to production healthy |
| RPO               | < 5 minutes  | With PITR + binary logging enabled             |
| RPO (backup only) | < 24 hours   | Without PITR, using daily automated backup     |
