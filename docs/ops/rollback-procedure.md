# LoadPilot Rollback Procedure

> Version: 2.0 | Updated: 2026-03-28
>
> All commands are copy-pasteable. Environment-specific values use `$VARIABLE`
> syntax sourced from your `.env` file or shell exports.

## Prerequisites

```bash
# Load environment variables
set -a && source .env && set +a

# Required variables (verify these are set)
echo "SERVICE_URL: $SERVICE_URL"
echo "GCP_PROJECT_ID: $GCP_PROJECT_ID"
echo "CLOUD_SQL_INSTANCE: $CLOUD_SQL_INSTANCE"
echo "DB_HOST: $DB_HOST"
echo "DB_NAME: $DB_NAME"
```

| Variable             | Purpose                                  |
|----------------------|------------------------------------------|
| `SERVICE_URL`        | Cloud Run service URL (auto-detected)    |
| `GCP_PROJECT_ID`     | GCP project ID                           |
| `CLOUD_SQL_INSTANCE` | Cloud SQL instance name                  |
| `DB_HOST`            | MySQL host (127.0.0.1 via proxy)         |
| `DB_PORT`            | MySQL port (3306 default)                |
| `DB_USER`            | MySQL username                           |
| `DB_PASSWORD`        | MySQL password (from Secret Manager)     |
| `DB_NAME`            | Target database name                     |

---

## Step 1: Verify the Problem

```bash
# Check health endpoint
curl -sf https://$SERVICE_URL/api/health | python3 -m json.tool

# Check Cloud Run logs (last 50 lines)
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=loadpilot-api-prod" \
  --project=$GCP_PROJECT_ID \
  --limit=50 \
  --format="table(timestamp, textPayload)"
```

If `status` is `"degraded"`, identify which dependency is unhealthy (`mysql` or `firebase`).
Confirm the incident is caused by the new deployment, not an external dependency outage.

---

## Step 2: Notify Stakeholders

```bash
echo "Initiating rollback of LoadPilot at $(date -u +%Y%m%dT%H%M%SZ). ETA: ~15 minutes."
```

Post this message in your ops channel. Note the incident start time and the failing build/commit.

---

## Step 3: Roll Back the Frontend (Firebase Hosting)

```bash
# List recent hosting releases
firebase hosting:releases:list --project $GCP_PROJECT_ID

# Roll back to the previous release
firebase hosting:rollback --project $GCP_PROJECT_ID
```

Or deploy the last known-good build manually:

```bash
git checkout $LAST_GOOD_TAG
npm ci
npm run build
firebase deploy --only hosting --project $GCP_PROJECT_ID
```

---

## Step 4: Roll Back the API Server (Cloud Run)

Roll back Cloud Run traffic to the previous revision:

```bash
# List revisions (most recent first)
gcloud run revisions list \
  --service=loadpilot-api-prod \
  --region=us-central1 \
  --project=$GCP_PROJECT_ID \
  --format="table(metadata.name, status.conditions[0].status, metadata.creationTimestamp)" \
  --sort-by="~metadata.creationTimestamp" \
  --limit=5

# Identify the previous good revision
PREVIOUS_REVISION=$(gcloud run revisions list \
  --service=loadpilot-api-prod \
  --region=us-central1 \
  --project=$GCP_PROJECT_ID \
  --format="value(metadata.name)" \
  --sort-by="~metadata.creationTimestamp" \
  --limit=2 | tail -1)

echo "Rolling back to: $PREVIOUS_REVISION"

# Route 100% traffic to the previous revision
gcloud run services update-traffic loadpilot-api-prod \
  --to-revisions=$PREVIOUS_REVISION=100 \
  --region=us-central1 \
  --project=$GCP_PROJECT_ID

# Wait for propagation
sleep 15

# Verify health after rollback
curl -sf https://$SERVICE_URL/api/health && echo "Health: OK" || echo "Health: FAILED"
```

---

## Step 5: Roll Back Database Migrations (if needed)

**Warning**: Only roll back migrations if the new migration caused the incident.
Rolling back may destroy data added since the migration ran.

### 5.1 Identify the last applied migration

```bash
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
      'SELECT name, applied_at FROM _migrations ORDER BY applied_at DESC LIMIT 5'
    );
    rows.forEach(r => console.log(r.applied_at.toISOString().slice(0,19), r.name));
    await conn.end();
  })().catch(e => { console.error(e.message); process.exit(1); });
"
```

### 5.2 Roll back the most recent migration

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

### 5.3 Cloud SQL point-in-time restore (last resort)

```bash
# List available backups
gcloud sql backups list \
  --instance=$CLOUD_SQL_INSTANCE \
  --project=$GCP_PROJECT_ID \
  --limit=5

# Restore from a specific backup (replace $BACKUP_ID with the backup ID from the list above)
gcloud sql backups restore $BACKUP_ID \
  --restore-instance=$CLOUD_SQL_INSTANCE \
  --backup-instance=$CLOUD_SQL_INSTANCE \
  --project=$GCP_PROJECT_ID
```

**Warning**: Point-in-time restore replaces the entire database. Use only when
migration rollback via `-- DOWN` is insufficient.

---

## Step 6: Verify the Rollback

```bash
# Health endpoint
curl -sf https://$SERVICE_URL/api/health | python3 -m json.tool

# Auth endpoint responds (expect 401, not 500 or 404)
curl -s -o /dev/null -w "Auth endpoint: HTTP %{http_code}\n" https://$SERVICE_URL/api/auth/login

# Protected endpoint requires auth (expect 401, not 500)
curl -s -o /dev/null -w "Loads endpoint: HTTP %{http_code}\n" https://$SERVICE_URL/api/loads

# Database connectivity check
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
    const [rows] = await conn.query('SELECT 1 AS ok');
    console.log('Database: OK');
    await conn.end();
  })().catch(e => { console.error('Database: FAILED -', e.message); process.exit(1); });
"
```

Smoke-test critical flows: login, load list, create a load, accounting summary.
Confirm monitoring/alerting is green.

---

## Step 7: Post-Incident

```bash
echo "Rollback complete at $(date -u +%Y%m%dT%H%M%SZ). System is stable."
```

1. Post the above message to your ops channel.
2. Write a brief incident report (what failed, why, what was rolled back).
3. Open a bug ticket for the root cause before re-deploying the failed change.

---

## Contacts

| Role             | Contact                             |
|------------------|-------------------------------------|
| On-call engineer | (configure in your ops runbook)     |
| Firebase support | https://firebase.google.com/support |
| GCP Console      | https://console.cloud.google.com    |
