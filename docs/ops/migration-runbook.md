# Migration Runbook — LoadPilot Production Operations

> Version: 2.0 | Database: MySQL 8 (Cloud SQL) | Migration runner: server/lib/migrator.ts
>
> Current chain: 001_baseline.sql through 042_add_documents_is_locked.sql (42 files)

This runbook provides copy-pasteable commands for every migration operation.
All environment-specific values use `$VARIABLE` syntax sourced from your `.env`
file or shell exports. No placeholders require manual interpretation.

---

## Prerequisites

Before running any migration command, source your environment:

```bash
# Load environment variables from .env
set -a && source .env && set +a
```

Required variables (see `.env.example`):

| Variable       | Example                  | Purpose                              |
|----------------|--------------------------|--------------------------------------|
| `DB_HOST`      | `127.0.0.1`              | MySQL host (or Cloud SQL proxy host) |
| `DB_PORT`      | `3306`                   | MySQL port                           |
| `DB_USER`      | `loadpilot_user`         | MySQL username                       |
| `DB_PASSWORD`  | (from Secret Manager)    | MySQL password                       |
| `DB_NAME`      | `loadpilot_production`   | Target database name                 |

---

## 1. Check Pending Migrations

Show which migrations have been applied and which are pending:

```bash
DB_HOST=$DB_HOST DB_USER=$DB_USER DB_PASSWORD=$DB_PASSWORD DB_NAME=$DB_NAME \
  npx tsx server/scripts/staging-rehearsal.ts --dry-run
```

To list migration files on disk vs what is recorded in the `_migrations` table:

```bash
# List all migration files on disk (sorted alphabetically — execution order)
ls server/migrations/*.sql | sort

# Check which migrations are recorded as applied in the database
node -e "
  require('dotenv').config({ path: 'server/.env' });
  const mysql = require('mysql2/promise');
  (async () => {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    const [rows] = await conn.query('SELECT name, applied_at FROM _migrations ORDER BY applied_at');
    rows.forEach(r => console.log(r.applied_at.toISOString().slice(0,19), r.name));
    console.log('Total applied:', rows.length);
    await conn.end();
  })().catch(e => { console.error(e.message); process.exit(1); });
"
```

---

## 2. Apply All Pending Migrations

This applies every migration file that has not yet been recorded in the
`_migrations` table. Each migration runs inside a transaction.

```bash
DB_HOST=$DB_HOST DB_USER=$DB_USER DB_PASSWORD=$DB_PASSWORD DB_NAME=$DB_NAME \
  npx tsx server/scripts/staging-rehearsal.ts
```

Expected output on success: `overallPassed: true` and exit code 0.

**Alternative** (shell script, uses `mysql` CLI directly):

```bash
DB_USER=$DB_USER DB_PASSWORD=$DB_PASSWORD DB_HOST=$DB_HOST DB_NAME=$DB_NAME \
  bash server/scripts/apply-migrations.sh
```

---

## 3. Apply a Single Migration

To apply one specific migration file without running the full chain:

```bash
# Set the migration filename (example: 042_add_documents_is_locked.sql)
MIGRATION_FILE="042_add_documents_is_locked.sql"

node -e "
  require('dotenv').config({ path: 'server/.env' });
  const mysql = require('mysql2/promise');
  const fs = require('fs');
  const path = require('path');
  (async () => {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    const filePath = path.join('server/migrations', '${MIGRATION_FILE}');
    const content = fs.readFileSync(filePath, 'utf-8');
    const upSection = content.split('-- DOWN')[0].replace(/^-- UP\n?/, '');
    const stmts = upSection.split(';').map(s => s.trim()).filter(s => s && !s.startsWith('--'));
    await conn.beginTransaction();
    try {
      for (const stmt of stmts) { await conn.query(stmt); }
      const crypto = require('crypto');
      const checksum = crypto.createHash('sha256').update(content).digest('hex');
      await conn.query(
        'INSERT INTO _migrations (name, checksum, applied_at) VALUES (?, ?, NOW())',
        ['${MIGRATION_FILE}', checksum]
      );
      await conn.commit();
      console.log('Applied:', '${MIGRATION_FILE}');
    } catch (e) {
      await conn.rollback();
      console.error('FAILED:', e.message);
      process.exit(1);
    }
    await conn.end();
  })().catch(e => { console.error(e.message); process.exit(1); });
"
```

---

## 4. Rollback a Single Migration

Roll back the most recently applied migration using its `-- DOWN` section:

```bash
node -e "
  require('dotenv').config({ path: 'server/.env' });
  const mysql = require('mysql2/promise');
  const fs = require('fs');
  const path = require('path');
  (async () => {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    const [rows] = await conn.query(
      'SELECT name FROM _migrations ORDER BY applied_at DESC LIMIT 1'
    );
    if (rows.length === 0) { console.log('No migrations to roll back.'); process.exit(0); }
    const migName = rows[0].name;
    console.log('Rolling back:', migName);
    const filePath = path.join('server/migrations', migName);
    const content = fs.readFileSync(filePath, 'utf-8');
    const downIdx = content.indexOf('-- DOWN');
    if (downIdx === -1) { console.error('No -- DOWN section in', migName); process.exit(1); }
    const downSection = content.slice(downIdx + '-- DOWN'.length);
    const stmts = downSection.split(';').map(s => s.trim()).filter(s => s && !s.startsWith('--'));
    await conn.beginTransaction();
    try {
      for (const stmt of stmts) { await conn.query(stmt); }
      await conn.query('DELETE FROM _migrations WHERE name = ?', [migName]);
      await conn.commit();
      console.log('Rolled back:', migName);
    } catch (e) {
      await conn.rollback();
      console.error('Rollback FAILED:', e.message);
      process.exit(1);
    }
    await conn.end();
  })().catch(e => { console.error(e.message); process.exit(1); });
"
```

To roll back a **specific** migration by name:

```bash
# Set the migration to roll back
MIGRATION_FILE="042_add_documents_is_locked.sql"

node -e "
  require('dotenv').config({ path: 'server/.env' });
  const mysql = require('mysql2/promise');
  const fs = require('fs');
  const path = require('path');
  (async () => {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    const filePath = path.join('server/migrations', '${MIGRATION_FILE}');
    const content = fs.readFileSync(filePath, 'utf-8');
    const downIdx = content.indexOf('-- DOWN');
    if (downIdx === -1) { console.error('No -- DOWN section in ${MIGRATION_FILE}'); process.exit(1); }
    const downSection = content.slice(downIdx + '-- DOWN'.length);
    const stmts = downSection.split(';').map(s => s.trim()).filter(s => s && !s.startsWith('--'));
    await conn.beginTransaction();
    try {
      for (const stmt of stmts) { await conn.query(stmt); }
      await conn.query('DELETE FROM _migrations WHERE name = ?', ['${MIGRATION_FILE}']);
      await conn.commit();
      console.log('Rolled back:', '${MIGRATION_FILE}');
    } catch (e) {
      await conn.rollback();
      console.error('Rollback FAILED:', e.message);
      process.exit(1);
    }
    await conn.end();
  })().catch(e => { console.error(e.message); process.exit(1); });
"
```

---

## 5. Staging Rehearsal

A staging rehearsal validates the full migration chain against a staging
database before applying to production.

### 5.1 Required Environment Variables for Staging

```bash
export DB_HOST=127.0.0.1
export DB_PORT=3307
export DB_USER=trucklogix_staging
export DB_PASSWORD=$DB_PASSWORD
export DB_NAME=trucklogix_staging
```

### 5.2 Create a Database Snapshot Before Rehearsal

**Cloud SQL snapshot:**

```bash
gcloud sql backups create \
  --instance=$CLOUD_SQL_INSTANCE \
  --project=$GCP_PROJECT_ID \
  --description="pre-rehearsal-$(date -u +%Y%m%dT%H%M%SZ)"
```

**mysqldump snapshot (local or remote):**

```bash
mysqldump \
  -h "$DB_HOST" \
  -P "$DB_PORT" \
  -u "$DB_USER" \
  -p"$DB_PASSWORD" \
  --single-transaction \
  --routines \
  --triggers \
  --set-gtid-purged=OFF \
  "$DB_NAME" | gzip > "staging_snapshot_$(date +%Y%m%d_%H%M%S).sql.gz"
```

### 5.3 Run the Staging Migration

```bash
DB_HOST=$DB_HOST DB_PORT=$DB_PORT DB_USER=$DB_USER DB_PASSWORD=$DB_PASSWORD DB_NAME=$DB_NAME \
  npx tsx server/scripts/staging-rehearsal.ts
```

### 5.4 Full Staging Rehearsal via Cloud SQL Proxy

For Cloud SQL staging environments, use the staging migration script which
handles proxy lifecycle automatically:

```bash
DB_PASSWORD=$DB_PASSWORD bash scripts/run-staging-migrations.sh
```

This script:
1. Downloads Cloud SQL Auth Proxy if not present
2. Starts the proxy on port 3307
3. Runs `staging-rehearsal.ts` against the staging database
4. Stops the proxy
5. Reports success or failure

### 5.5 Validate After Rehearsal

```bash
# Verify table count
node -e "
  require('dotenv').config({ path: 'server/.env' });
  const mysql = require('mysql2/promise');
  (async () => {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    const [rows] = await conn.query(
      \"SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'\"
    );
    console.log('Tables:', rows[0].cnt);
    await conn.end();
  })().catch(e => { console.error(e.message); process.exit(1); });
"

# Verify migration tracking integrity
node -e "
  require('dotenv').config({ path: 'server/.env' });
  const mysql = require('mysql2/promise');
  (async () => {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    const [rows] = await conn.query('SELECT COUNT(*) AS cnt FROM _migrations');
    console.log('Applied migrations:', rows[0].cnt);
    await conn.end();
  })().catch(e => { console.error(e.message); process.exit(1); });
"

# Run health endpoint smoke test
curl -sf http://localhost:$PORT/api/health && echo "Health: OK" || echo "Health: FAILED"
```

---

## 6. Production Migration Procedure

Step-by-step production migration with pre-flight, backup, apply, and validate.

### Step 1: Pre-flight

```bash
set -a && source .env && set +a
ls server/migrations/*.sql | sort | tail -5
```

### Step 2: Create pre-migration backup

```bash
gcloud sql backups create \
  --instance=$CLOUD_SQL_INSTANCE \
  --project=$GCP_PROJECT_ID \
  --description="pre-migration-$(date -u +%Y%m%dT%H%M%SZ)"
```

### Step 3: Check pending migrations

```bash
DB_HOST=$DB_HOST DB_USER=$DB_USER DB_PASSWORD=$DB_PASSWORD DB_NAME=$DB_NAME \
  npx tsx server/scripts/staging-rehearsal.ts --dry-run
```

### Step 4: Apply all pending migrations

```bash
DB_HOST=$DB_HOST DB_USER=$DB_USER DB_PASSWORD=$DB_PASSWORD DB_NAME=$DB_NAME \
  npx tsx server/scripts/staging-rehearsal.ts
```

### Step 5: Validate

```bash
curl -sf https://$SERVICE_URL/api/health && echo "Health: OK"
```

### Step 6: Notify stakeholders

```bash
echo "Migration complete at $(date -u +%Y%m%dT%H%M%SZ). All pending migrations applied."
```

---

## Reference: Migration File Format

Every migration file uses this format:

```sql
-- UP
CREATE TABLE example (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL
);

-- DOWN
DROP TABLE IF EXISTS example;
```

The runner applies everything between `-- UP` and `-- DOWN` during forward
migration, and everything after `-- DOWN` during rollback.

---

## Reference: Migration Runner Behavior

| Behavior           | Detail                                                       |
|--------------------|--------------------------------------------------------------|
| File pattern       | `/^\d{3}_.*\.sql$/`                                          |
| Sort order         | Alphabetical by filename                                     |
| Tracking table     | `_migrations` (name, checksum, applied_at)                   |
| Checksum algorithm | SHA-256 of full file content                                 |
| Transaction scope  | Each migration runs in its own transaction                   |
| Failure handling   | Transaction rollback on error; subsequent migrations skipped |

---

## Troubleshooting

**"Table _migrations does not exist"**
The tracking table is created by the first migration (001_baseline.sql).
Run the full migration chain from the beginning.

**"Checksum mismatch for migration X"**
A migration file was modified after being applied. Do NOT re-apply.
Verify the file content matches what was originally applied. If the change is
intentional, create a new migration file instead of modifying the existing one.

**"Connection refused on port 3307/3308"**
The Cloud SQL Auth Proxy is not running. Start it with:
```bash
./cloud-sql-proxy $CLOUD_SQL_INSTANCE --port $DB_PORT &
```
