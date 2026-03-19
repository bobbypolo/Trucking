# LoadPilot Rollback Procedure

This document describes the step-by-step procedure for rolling back a LoadPilot deployment.

## Prerequisites

- Access to the Firebase console and Firebase CLI
- Access to the MySQL database host (direct or via SSH tunnel)
- The git tag or commit hash of the last known-good release
- Environment variables: see `.env.example`

## Step 1: Verify the Problem

1. Check the health endpoint:

   ```
   curl https://your-domain/api/health
   ```

   - If `status` is `"degraded"`, identify which dependency is unhealthy (`mysql` or `firebase`).

2. Check application logs (server stdout / Firebase Hosting logs).
3. Confirm the incident is caused by the new deployment, not an external dependency outage.

## Step 2: Notify Stakeholders

1. Post in your ops channel: "Initiating rollback of LoadPilot to [previous version]. ETA: ~15 minutes."
2. Note the incident start time and the failing build/commit.

## Step 3: Roll Back the Frontend (Firebase Hosting)

List recent releases:

```
firebase hosting:releases:list
```

Roll back to the previous release:

```
firebase hosting:rollback --project YOUR_PROJECT_ID
```

Or deploy the last known-good build manually:

```
git checkout LAST_GOOD_TAG
npm ci
npm run build
firebase deploy --only hosting --project YOUR_PROJECT_ID
```

## Step 4: Roll Back the API Server

If the server is deployed as a Node.js process (PM2):

```
pm2 stop loadpilot-server
git checkout LAST_GOOD_TAG
cd server && npm ci --omit=dev
pm2 start loadpilot-server
```

If deployed as a Docker container:

```
docker pull REGISTRY/loadpilot-server:PREVIOUS_TAG
docker stop loadpilot-server
docker rm loadpilot-server
docker run -d --name loadpilot-server --env-file .env -p 3001:3001 REGISTRY/loadpilot-server:PREVIOUS_TAG
```

## Step 5: Roll Back Database Migrations (if needed)

Warning: Only roll back migrations if the new migration caused the incident.
Rolling back may destroy data added since the migration ran.

1. Identify the migration that was applied by checking `server/migrations/`.
2. Manually reverse the migration on the MySQL host. Example:

   ```sql
   ALTER TABLE loads DROP COLUMN new_column;
   ```

3. There is no automated down-migration tooling — perform this step with a DBA.

## Step 6: Verify the Rollback

1. Hit the health endpoint:

   ```
   curl https://your-domain/api/health
   ```

   Expect: `{ "status": "ok", "mysql": "connected", "firebase": "ready", "uptime": <seconds> }`

2. Smoke-test critical flows: login, load list, create a load, accounting summary.
3. Confirm monitoring / alerting is green.

## Step 7: Post-Incident

1. Update stakeholders: "Rollback complete. System is stable."
2. Write a brief incident report (what failed, why, what was rolled back).
3. Open a bug ticket for the root cause before re-deploying the failed change.

## Contacts

| Role             | Contact                             |
| ---------------- | ----------------------------------- |
| On-call engineer | (configure in your ops runbook)     |
| Firebase support | https://firebase.google.com/support |
| MySQL DBA        | (configure in your ops runbook)     |
