# LoadPilot Rollback Procedure

> **Audience**: SRE, Lead Engineer, On-Call
> **Applies to**: Production environment only unless stated otherwise
> **Last reviewed**: 2026-03-17

---

## 1. Schema Rollback

### Staging: DOWN Migrations

Each migration in `server/migrations/` has a companion DOWN block for staging use only.

```bash
# Run the DOWN script for the most recent migration
# Adjust the migration number to the one being reverted
cd server
npx ts-node scripts/migrate.ts down --to 021
```

> **Warning**: DOWN migrations are destructive. Always take a snapshot first in staging.

Migration history (most recent first):

| #       | File                          | Purpose                                        |
| ------- | ----------------------------- | ---------------------------------------------- |
| 021     | 021_work_items_kci.sql        | Work items, KCI requests, service tickets      |
| 020     | 020_crisis_tasks.sql          | Crisis actions, tasks                          |
| 019     | 019_messages_calls.sql        | Messages, call sessions                        |
| 018     | 018_quotes_leads_bookings.sql | Quotes, leads, bookings                        |
| 017     | 017_contacts_providers.sql    | Contacts, providers                            |
| 001-016 | baseline + features           | Core schema, users, loads, equipment, dispatch |

### Production: Point-In-Time Recovery (PITR)

In production, **never run DOWN migrations**. Use Cloud SQL PITR:

1. Open GCP Console > Cloud SQL > loadpilot-prod
2. Select **Restore** > **Restore to a point in time**
3. Enter the timestamp just before the bad migration ran
4. Restore to a **new** Cloud SQL instance (never restore over prod in place)
5. Verify data integrity on the clone
6. Promote the clone via DNS cutover or Cloud SQL proxy update

> PITR retention window: 7 days (configured on instance creation).

---

## 2. Feature Rollback

### Step A: Disable via Feature Flags

Feature flags are controlled by environment variables. Set in Cloud Run:

```bash
# Disable a feature without a code deploy
gcloud run services update loadpilot-api \
  --region us-central1 \
  --set-env-vars FEATURE_AI_PARSING=false
```

Common feature flag variables:

| Variable                | Effect when false                                   |
| ----------------------- | --------------------------------------------------- |
| FEATURE_AI_PARSING      | AI BOL/Rate-Con parsing disabled; manual entry only |
| FEATURE_MAPS_ENABLED    | Map views hidden; address text only                 |
| FEATURE_WEATHER_ENABLED | Weather widget hidden                               |

### Step B: Code Rollback

If a flag is insufficient, roll back the deployment:

```bash
# List recent Cloud Run revisions
gcloud run revisions list --service loadpilot-api --region us-central1

# Roll back to a specific revision
gcloud run services update-traffic loadpilot-api \
  --region us-central1 \
  --to-revisions REVISION_NAME=100
```

### NEVER Re-enable DEMO_MODE

**DEMO_MODE has been permanently removed** from the codebase (STORY-019).
Re-enabling it would inject fake seed data into a production database, corrupting tenant records.

If you see `DEMO_MODE` referenced anywhere in production code, treat it as a **P0 security incident**.

---

## 3. Data Rollback

### Partial Migration Recovery

If a frontend localStorage-to-API migration was incomplete at the time of rollback:

1. **Do not delete localStorage**: Browsers still hold unimported data under keys prefixed with the tenant's `companyId`.
2. **Re-run the import**: Navigate to the import wizard; it reads localStorage and submits to the API.
3. **Verify completeness**: Check the relevant table row counts match the user's expected data set.

### Manual Data Recovery

For individual record recovery from PITR clone:

```sql
-- Example: recover a load record from the PITR clone
INSERT INTO loads SELECT * FROM pitr_clone.loads WHERE id = ? AND tenant_id = ?;
```

Always run recovery queries in a transaction and verify before commit.

---

## 4. Rollback Checklist

- [ ] Notify stakeholders of rollback window (5-15 min expected)
- [ ] Take Cloud SQL snapshot before any schema change
- [ ] Use PITR for production schema rollback (never DOWN scripts)
- [ ] Use feature flags first before code rollback
- [ ] Verify health endpoint returns `"status": "ok"` after rollback
- [ ] Run smoke test: login, view loads list, create a load
- [ ] Confirm monitoring alerts return to green within 5 minutes
- [ ] Post incident summary within 24 hours
