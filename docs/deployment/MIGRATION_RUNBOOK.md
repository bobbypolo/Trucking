# Migration Runbook — LoadPilot (DisbatchMe)

> Version: 1.0 | Target: Cloud SQL for MySQL (staging + production) | Updated: 2026-03-11

This runbook covers the full migration lifecycle for LoadPilot: pre-flight checks, backup,
apply, validate, rollback, and post-migration smoke queries. Two rehearsal types are documented:
**Fresh-DB** (blank database from scratch) and **Prod-like-snapshot** (applying pending
migrations to an existing database that mirrors production state).

---

## Rehearsal Types

| Type                   | When to Use                                                 | Script                                        |
| ---------------------- | ----------------------------------------------------------- | --------------------------------------------- |
| **Fresh-DB replay**    | New environments, CI, verifying full chain from scratch     | `bash server/scripts/migration-dry-run.sh`    |
| **Prod-like-snapshot** | Staging upgrade with existing data before production deploy | `npx tsx server/scripts/staging-rehearsal.ts` |

---

## 1. Pre-flight Checks

Run these checks before applying any migrations to staging or production.

### 1.1 Verify migration chain

```bash
# List all numbered migration files (should end at 015)
ls server/migrations/*.sql | sort

# Confirm the highest-numbered migration is 015_add_users_phone
ls server/migrations/015_add_users_phone.sql && echo "015 present"

# Confirm 014 is present
ls server/migrations/014_companies_visibility_settings.sql && echo "014 present"
```

### 1.2 Check pending migrations

```bash
# Run dry-run to see pending migrations without applying them
DB_HOST=<host> DB_USER=<user> DB_PASSWORD=<pass> DB_NAME=<dbname> \
  npx tsx server/scripts/staging-rehearsal.ts --dry-run
```

Expected output contains `"overallPassed": true`.

### 1.3 Verify database connectivity

```bash
# Test connection (uses Node.js — no mysql CLI required)
node -e "
  require('dotenv').config({ path: 'server/.env' });
  const m = require('mysql2/promise');
  m.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  }).then(c => c.query('SELECT 1')).then(() => { console.log('OK'); process.exit(0); })
    .catch(e => { console.error(e.message); process.exit(1); });
"
```

### 1.4 Check current table count

```bash
# Expected: 48 tables after full migration chain 001-015
node -e "
  require('dotenv').config({ path: 'server/.env' });
  const m = require('mysql2/promise');
  m.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  }).then(c => c.query(\"SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'\"))
    .then(([r]) => { console.log('Tables:', r[0].cnt); process.exit(0); })
    .catch(e => { console.error(e.message); process.exit(1); });
"
```

---

## 2. Backup

**Always take a backup before applying migrations to production.**

### 2.1 Full database backup (mysqldump)

```bash
# Set these from your environment or Secret Manager
export DB_HOST=<cloud-sql-host-or-socket>
export DB_USER=<db-user>
export DB_PASSWORD=<db-password>
export DB_NAME=<db-name>
export BACKUP_FILE="loadpilot_backup_$(date +%Y%m%d_%H%M%S).sql.gz"

# Create compressed backup
mysqldump \
  -h "${DB_HOST}" \
  -u "${DB_USER}" \
  -p"${DB_PASSWORD}" \
  --single-transaction \
  --routines \
  --triggers \
  --set-gtid-purged=OFF \
  "${DB_NAME}" | gzip > "${BACKUP_FILE}"

echo "Backup written to: ${BACKUP_FILE}"
```

### 2.2 Verify backup integrity

```bash
# Check file size > 0
ls -lh "${BACKUP_FILE}"
wc -c < "${BACKUP_FILE}" | xargs -I{} test {} -gt 0 && echo "Backup size OK" || echo "ERROR: Backup is empty"

# Spot-check table count from backup
zcat "${BACKUP_FILE}" | grep -c "^CREATE TABLE" && echo "table definitions found in backup"

# Verify backup is readable (test decompression)
zcat "${BACKUP_FILE}" | head -20
```

### 2.3 Cloud SQL snapshot (Cloud Run environments)

For Cloud SQL, prefer an **automated snapshot** via the Cloud Console before migration:

```bash
# Cloud SQL backup via gcloud
gcloud sql backups create \
  --instance=<CLOUD_SQL_INSTANCE_NAME> \
  --description="pre-migration-$(date +%Y%m%d_%H%M%S)"

# Verify backup was created
gcloud sql backups list --instance=<CLOUD_SQL_INSTANCE_NAME> --limit=5
```

---

## 3. Apply

### 3.1 Fresh-DB replay (CI / new environments)

```bash
# Creates temp DB, runs full chain 001-015, drops temp DB
DB_USER=<user> DB_PASSWORD=<pass> DB_HOST=<host> \
  bash server/scripts/migration-dry-run.sh
```

Expected: exits 0 with `PASS — Migration chain 001-015 validated on fresh DB`.

### 3.2 Prod-like-snapshot apply (staging / production upgrade)

```bash
# Connect to target database and apply pending migrations
DB_HOST=<host> DB_USER=<user> DB_PASSWORD=<pass> DB_NAME=<dbname> \
  npx tsx server/scripts/staging-rehearsal.ts
```

This applies pending migrations via `MigrationRunner.up()`, validates row conservation,
checks no legacy PascalCase statuses remain, verifies table count, and checks checksum
integrity. Exits 0 on PASS, 1 on FAIL.

### 3.3 Manual sequential apply (fallback)

If the rehearsal script is unavailable:

```bash
DB_USER=<user> DB_PASSWORD=<pass> DB_HOST=<host> DB_NAME=<dbname> \
  bash server/scripts/apply-migrations.sh
```

---

## 4. Validate

After applying migrations, run these validation queries.

### 4.1 Table count

```sql
-- Expected: 48 tables after full migration chain 001-015
SELECT COUNT(*) AS table_count
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_type = 'BASE TABLE';
```

### 4.2 No legacy PascalCase statuses

```sql
-- Expected: 0 rows
SELECT COUNT(*) AS legacy_count
FROM loads
WHERE status IN (
  'Planned','Booked','Active','Departed','Arrived',
  'Docked','Unloaded','Delivered','Invoiced','Settled',
  'Cancelled','CorrectionRequested'
);
```

### 4.3 All statuses are canonical

```sql
-- Expected: 0 rows
SELECT COUNT(*) AS non_canonical_count
FROM loads
WHERE status NOT IN (
  'draft','planned','dispatched','in_transit',
  'arrived','delivered','completed','cancelled'
);
```

### 4.4 Migration tracking table integrity

```sql
-- Shows applied migrations — should include 001 through 015
SELECT name, applied_at, checksum
FROM _migrations
ORDER BY applied_at;
```

### 4.5 Key tables present

```sql
-- Verify core tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN ('loads','companies','users','settlements','documents','_migrations')
ORDER BY table_name;
```

---

## 5. Rollback

### 5.1 When to rollback

Rollback if:

- Post-migration validation fails (row count mismatch, legacy statuses present)
- Application smoke tests fail after migration
- Checksum mismatches detected in `_migrations` table

### 5.2 Database rollback via MigrationRunner

```bash
# Roll back the most recently applied migration
DB_HOST=<host> DB_USER=<user> DB_PASSWORD=<pass> DB_NAME=<dbname> \
  node -e "
    require('dotenv').config({ path: 'server/.env' });
    const { MigrationRunner } = require('./server/lib/migrator');
    const mysql = require('mysql2/promise');
    const path = require('path');
    (async () => {
      const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      });
      const runner = new MigrationRunner(conn, path.resolve('server/migrations'));
      const result = await runner.down();
      console.log('Rolled back:', result.rolledBack);
      await conn.end();
    })().catch(e => { console.error(e.message); process.exit(1); });
  "
```

### 5.3 Cloud Run traffic rollback (no DB rollback needed)

If only the application code changed (no schema migration):

```bash
# Roll back Cloud Run traffic to previous revision
gcloud run services update-traffic loadpilot-api \
  --to-revisions=PREVIOUS=100 \
  --region=<REGION>
```

### 5.4 Cloud SQL point-in-time restore (last resort)

```bash
# Restore from automated backup (use the backup ID from Step 2.3)
gcloud sql backups restore <BACKUP_ID> \
  --restore-instance=<CLOUD_SQL_INSTANCE_NAME> \
  --backup-instance=<CLOUD_SQL_INSTANCE_NAME>
```

**Warning**: Point-in-time restore replaces the entire database. Use only when migration
rollback is insufficient.

---

## 6. Post-Migration Smoke Queries

Run these after a successful migration to verify the application is healthy.

### 6.1 Health endpoint

```bash
curl -f https://<your-cloud-run-url>/api/health && echo "Health OK"
```

Expected response: `{"status":"ok"}`

### 6.2 Auth endpoint responds

```bash
curl -s -o /dev/null -w "%{http_code}" \
  https://<your-cloud-run-url>/api/auth/login
# Expected: 400 (missing body) or 401 (not 500 or 404)
```

### 6.3 Protected endpoint requires auth

```bash
curl -s -o /dev/null -w "%{http_code}" \
  https://<your-cloud-run-url>/api/loads
# Expected: 401 (not 500)
```

### 6.4 Database smoke — loads query

```sql
-- Should return quickly with canonical statuses only
SELECT status, COUNT(*) AS cnt
FROM loads
GROUP BY status
ORDER BY cnt DESC
LIMIT 10;
```

### 6.5 Settlements integrity smoke

```sql
-- Expected: 0 orphaned settlements
SELECT COUNT(*) AS orphaned_settlements
FROM settlements s
LEFT JOIN loads l ON s.load_id = l.id
WHERE l.id IS NULL;
```

---

## Appendix: Rehearsal Script Reference

| Script                                                | Purpose                                | When to Run                             |
| ----------------------------------------------------- | -------------------------------------- | --------------------------------------- |
| `server/scripts/staging-rehearsal.ts --dry-run`       | Connect + snapshot only, no migrations | Pre-migration connectivity check        |
| `server/scripts/staging-rehearsal.ts`                 | Apply + validate against target DB     | Staging/prod migration execution        |
| `server/scripts/staging-rehearsal.ts --rollback-test` | Apply + rollback + re-apply round-trip | Rollback validation drill               |
| `server/scripts/migration-dry-run.sh`                 | Fresh-DB full chain 001-015            | CI, new environments, pre-staging proof |
| `server/scripts/apply-migrations.sh`                  | Sequential apply via mysql CLI         | Fallback when tsx unavailable           |

---

## Emergency Contacts

| Role             | Contact     | Responsibility                               |
| ---------------- | ----------- | -------------------------------------------- |
| DB Owner         | TBD         | Migration execution, rollback authority      |
| On-call Engineer | TBD         | Post-deploy monitoring, smoke test execution |
| Cloud Platform   | GCP Console | Cloud SQL access, Cloud Run traffic control  |
