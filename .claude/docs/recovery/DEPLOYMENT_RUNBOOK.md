# Deployment Runbook

> Generated: 2026-03-07 | Story: R-P0-05
> Applies to: LoadPilot Recovery Program (Phases 1-6)
> References: MIGRATION_STRATEGY.md, RISK_REGISTER.md, TEST_STRATEGY.md, OBSERVABILITY_BASELINE.md

## 1. Deployment Architecture Overview

### Current Components

| Component | Technology | Hosting | Deploy Method |
|-----------|-----------|---------|---------------|
| **Frontend** | React 19 + TypeScript + Vite | Firebase Hosting | `firebase deploy --only hosting` |
| **Backend API** | Node.js + Express + TypeScript | TBD (manual) | Manual process restart |
| **Database** | MySQL | Cloud MySQL instance | Ad-hoc upgrade scripts (see MIGRATION_STRATEGY.md) |
| **Auth Provider** | Firebase Auth | Firebase (managed) | Firebase Console / CLI |
| **Firestore** | Firebase Firestore | Firebase (managed) | Firebase Console / CLI |

### Target Deploy Architecture (Post-Recovery)

| Component | Technology | Hosting | Deploy Method |
|-----------|-----------|---------|---------------|
| **Frontend** | React 19 + Vite (no localStorage) | Firebase Hosting | CI/CD pipeline -> `firebase deploy` |
| **Backend API** | Node.js + Express (modularized) | Cloud VM / Container | CI/CD pipeline -> rolling restart |
| **Database** | MySQL | Cloud MySQL | Versioned migrations via `npm run migrate` |
| **Auth Provider** | Firebase Auth (identity only) | Firebase (managed) | No deploy needed (managed service) |

---

## 2. Pre-Deployment Checklist

### 2.1 Code Quality Gates

All gates must pass BEFORE deployment begins. Any failure is an automatic NO-GO.

| # | Check | Command | Pass Criteria | Owner |
|---|-------|---------|---------------|-------|
| 1 | TypeScript compiles (frontend) | `npx tsc --noEmit` | Zero errors | Frontend Lead |
| 2 | TypeScript compiles (server) | `cd server && npx tsc --noEmit` | Zero errors | Backend Lead |
| 3 | Unit tests pass (frontend) | `npx vitest run` | All pass, coverage >= phase target | QA Lead |
| 4 | Unit tests pass (server) | `cd server && npx vitest run` | All pass, coverage >= phase target | QA Lead |
| 5 | Integration tests pass | `cd server && npx vitest run --config vitest.integration.config.ts` | All pass | QA Lead |
| 6 | Smoke tests pass | `npx vitest run --config vitest.smoke.config.ts` | All 10 critical paths pass | QA Lead |
| 7 | No secrets in code | `grep -rn "password\|secret\|api_key" --include="*.ts" --include="*.tsx" \| grep -v node_modules \| grep -v ".env"` | No hardcoded credentials | Security Lead |
| 8 | No mock data references | `grep -rn "seedMockData\|seedDatabase\|seedDemoLoads\|seedSafetyData\|seedIncidents" --include="*.ts" --include="*.tsx" \| grep -v node_modules \| grep -v __tests__ \| grep -v .test.` | Zero matches in production code (Phase 2+) | Frontend Lead |
| 9 | No localStorage usage | `grep -rn "localStorage\." --include="*.ts" --include="*.tsx" \| grep -v node_modules \| grep -v __tests__` | Zero matches in production code (Phase 2+) | Frontend Lead |
| 10 | Lint passes | Configured linter command | Zero errors (warnings acceptable with review) | QA Lead |

### 2.2 Environment Verification

| # | Check | How to Verify | Pass Criteria |
|---|-------|---------------|---------------|
| 1 | `.env` files present on target | SSH to server; verify `.env` and `server/.env` exist | All required vars set (see `.env.example`) |
| 2 | Database connectivity | `npm run migrate:status` from target server | Returns current migration version; no connection errors |
| 3 | Firebase project configured | `firebase projects:list` | Correct project ID for environment (staging/prod) |
| 4 | Firebase service account | Verify `server/serviceAccount.json` exists on target | File present and valid (not expired) |
| 5 | External API keys valid | Test Gemini/Maps/Azure endpoints with curl | 200 response from each enabled service |
| 6 | SSL certificate valid | `curl -vI https://[domain]` | Certificate not expiring within 30 days |
| 7 | Disk space sufficient | `df -h` on target server | > 20% free space |
| 8 | Node.js version correct | `node --version` on target | Matches `.nvmrc` or `engines` in package.json |

### 2.3 Database Pre-Deploy

| # | Check | Command | Pass Criteria |
|---|-------|---------|---------------|
| 1 | Backup completed | `mysqldump -u [user] -p [db_name] > backup_$(date +%Y%m%d_%H%M%S).sql` | Backup file size > 0; spot-check table counts |
| 2 | Migration status current | `npm run migrate:status` | No pending migrations from previous deploy |
| 3 | Pending migrations reviewed | Read each new migration file in `server/migrations/` | SQL reviewed by 2 engineers; UP and DOWN sections present |
| 4 | Migration rehearsal passed | Run on staging/test DB (see Section 5) | All migrations apply cleanly; rollback works |
| 5 | Schema snapshot taken | `mysqldump --no-data [db_name] > schema_before.sql` | Schema diff baseline for post-deploy verification |

---

## 3. Deployment Steps

### 3.1 Frontend Deployment (Firebase Hosting)

```
STEP 1: Build frontend
  $ npm run build
  VERIFY: dist/ directory created with index.html and hashed JS/CSS bundles
  VERIFY: No .env or serviceAccount files in dist/

STEP 2: Preview build locally
  $ npm run preview
  VERIFY: Application loads at http://localhost:4173
  VERIFY: Login page renders; no console errors

STEP 3: Deploy to Firebase Hosting
  $ firebase deploy --only hosting
  VERIFY: Firebase CLI reports "Deploy complete!"
  VERIFY: Hosting URL accessible in browser

STEP 4: Post-deploy smoke test
  VERIFY: Login page loads at production URL
  VERIFY: Static assets load (no 404s in Network tab)
  VERIFY: API calls reach backend (check /api/health from browser console)

ROLLBACK: See Section 4.1
```

### 3.2 Database Migration

```
STEP 1: Verify backup exists (from Pre-Deploy checklist)
  VERIFY: Backup file from Section 2.3 step 1 is accessible

STEP 2: Check current migration state
  $ npm run migrate:status
  RECORD: Current version number: ___

STEP 3: Apply pending migrations
  $ npm run migrate
  VERIFY: Each migration reports "Applied successfully"
  VERIFY: No errors in output
  RECORD: New version number: ___

STEP 4: Verify schema changes
  $ mysqldump --no-data [db_name] > schema_after.sql
  $ diff schema_before.sql schema_after.sql
  VERIFY: Only expected changes appear in diff

STEP 5: Verify data integrity
  $ mysql -e "SELECT COUNT(*) FROM loads; SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM companies;" [db_name]
  VERIFY: Row counts match pre-migration counts (no data loss)

ROLLBACK: See Section 4.2
```

### 3.3 Backend Deployment

```
STEP 1: Pull latest code on server
  $ cd /path/to/loadpilot && git pull origin [release-branch]
  VERIFY: No merge conflicts

STEP 2: Install dependencies
  $ cd server && npm ci
  VERIFY: No npm ERR! messages; lockfile matches

STEP 3: Compile TypeScript
  $ cd server && npx tsc
  VERIFY: Zero errors; dist/ directory updated

STEP 4: Run database migrations (if not done in 3.2)
  $ npm run migrate
  VERIFY: All migrations applied or already current

STEP 5: Restart server process
  $ pm2 restart loadpilot-api   # or: systemctl restart loadpilot
  VERIFY: Process shows "online" status
  VERIFY: No crash loops in first 30 seconds

STEP 6: Health check
  $ curl -s http://localhost:5000/api/health | python -m json.tool
  VERIFY: status = "healthy"
  VERIFY: mysql check = "healthy"
  VERIFY: firebase_auth check = "healthy"

STEP 7: Smoke test critical paths
  $ curl -s http://localhost:5000/api/health
  VERIFY: 200 response
  $ curl -s -H "Authorization: Bearer [test-token]" http://localhost:5000/api/users/me
  VERIFY: 200 response with user data (not 401 or 500)

ROLLBACK: See Section 4.3
```

### 3.4 Deployment Order

Deployments MUST follow this order to prevent breaking changes:

```
1. Database migrations   (schema must support both old and new code)
2. Backend API           (new code reads/writes new schema)
3. Frontend              (new UI calls new API endpoints)
```

**Rationale**: Database changes are applied first because they must be backward-compatible (old server code still runs during deploy). The backend is deployed next to serve new API contracts. The frontend is deployed last since it depends on new API endpoints being available.

**Forward-compatible migration rule**: Every migration must work with BOTH the current AND the next version of the backend code. This means:

- ADD COLUMN with DEFAULT value (old code ignores new column)
- Never DROP COLUMN in the same deploy that stops writing to it
- Two-phase column removal: Phase 1 = stop writing; Phase 2 (next deploy) = drop column

---

## 4. Rollback Procedures

### 4.1 Frontend Rollback (Firebase Hosting)

**Time to rollback**: < 2 minutes

```
OPTION A: Firebase Console rollback
  1. Go to Firebase Console -> Hosting
  2. Click on previous release in release history
  3. Click "Rollback" button
  VERIFY: Previous version is live

OPTION B: CLI rollback
  1. List recent deploys:
     $ firebase hosting:channel:list
  2. Redeploy previous version:
     $ git checkout [previous-tag]
     $ npm run build
     $ firebase deploy --only hosting
  VERIFY: Previous version is live

OPTION C: Instant rollback (if previous dist/ saved)
  1. $ cp -r dist_backup/ dist/
  2. $ firebase deploy --only hosting
```

### 4.2 Database Rollback

**Time to rollback**: 2-15 minutes depending on data volume

```
OPTION A: Migration rollback (preferred)
  1. Identify how many migrations to reverse:
     $ npm run migrate:status
  2. Roll back one migration at a time:
     $ npm run migrate:down
     REPEAT until at target version
  3. Verify schema:
     $ mysqldump --no-data [db_name] > schema_rolledback.sql
     $ diff schema_before.sql schema_rolledback.sql
     VERIFY: Schema matches pre-deploy state

OPTION B: Full database restore (emergency only)
  WARNING: This will lose all data written since the backup was taken.
  1. Confirm data loss window is acceptable
  2. Stop backend server:
     $ pm2 stop loadpilot-api
  3. Restore from backup:
     $ mysql -u [user] -p [db_name] < backup_YYYYMMDD_HHMMSS.sql
  4. Restart backend:
     $ pm2 start loadpilot-api
  5. Verify:
     $ npm run migrate:status
     VERIFY: Version matches pre-deploy state
```

### 4.3 Backend Rollback

**Time to rollback**: < 5 minutes

```
STEP 1: Identify previous version
  $ git log --oneline -5
  RECORD: Previous commit/tag: ___

STEP 2: Revert to previous code
  $ git checkout [previous-tag-or-commit]

STEP 3: Reinstall dependencies (if package.json changed)
  $ cd server && npm ci

STEP 4: Recompile
  $ cd server && npx tsc

STEP 5: Restart
  $ pm2 restart loadpilot-api

STEP 6: Verify
  $ curl -s http://localhost:5000/api/health
  VERIFY: 200 response; all checks healthy
```

### 4.4 Full Stack Rollback (Emergency)

When all three layers must be rolled back simultaneously:

```
STEP 1: Stop traffic (if load balancer available)
  Set backend health check to return 503

STEP 2: Roll back database
  $ npm run migrate:down  (repeat as needed)
  OR: restore from backup

STEP 3: Roll back backend
  $ git checkout [previous-tag]
  $ cd server && npm ci && npx tsc
  $ pm2 restart loadpilot-api

STEP 4: Roll back frontend
  Firebase Console -> Hosting -> Rollback to previous release

STEP 5: Resume traffic
  Re-enable health check

STEP 6: Post-rollback verification
  Run all 10 smoke test scenarios from TEST_STRATEGY.md
```

---

## 5. Migration Rehearsal

### 5.1 Rehearsal Environment Setup

Before any production migration, rehearse on a staging database that mirrors production:

```
STEP 1: Create staging database from production backup
  $ mysqldump -u [user] -p [prod_db] > prod_snapshot.sql
  $ mysql -u [user] -p -e "CREATE DATABASE IF NOT EXISTS [staging_db]"
  $ mysql -u [user] -p [staging_db] < prod_snapshot.sql

STEP 2: Verify staging matches production
  $ mysql -e "SELECT COUNT(*) FROM loads" [staging_db]
  $ mysql -e "SELECT COUNT(*) FROM loads" [prod_db]
  VERIFY: Row counts match for key tables (loads, users, companies, ar_invoices, driver_settlements)

STEP 3: Record pre-migration state
  $ mysqldump --no-data [staging_db] > staging_schema_before.sql
  $ npm run migrate:status  (pointed at staging_db via .env override)
  RECORD: Starting migration version: ___
```

### 5.2 Rehearsal Execution

```
STEP 4: Apply migrations to staging
  $ DB_NAME=[staging_db] npm run migrate
  RECORD: Time to complete: ___ seconds
  RECORD: Any warnings or errors: ___
  VERIFY: All migrations apply without error

STEP 5: Verify schema changes
  $ mysqldump --no-data [staging_db] > staging_schema_after.sql
  $ diff staging_schema_before.sql staging_schema_after.sql
  VERIFY: Only expected changes appear

STEP 6: Run application tests against staging DB
  $ DB_NAME=[staging_db] npm run test:integration
  VERIFY: All integration tests pass

STEP 7: Test rollback
  $ DB_NAME=[staging_db] npm run migrate:down  (for each new migration)
  $ mysqldump --no-data [staging_db] > staging_schema_rolledback.sql
  $ diff staging_schema_before.sql staging_schema_rolledback.sql
  VERIFY: Schema returns to pre-migration state

STEP 8: Re-apply migrations (confirm idempotency)
  $ DB_NAME=[staging_db] npm run migrate
  VERIFY: Migrations apply cleanly again

STEP 9: Rehearsal sign-off
  RECORD: Rehearsal date: ___
  RECORD: Rehearsal engineer: ___
  RECORD: Pass/Fail: ___
  RECORD: Issues found: ___
```

### 5.3 Data Migration Rehearsal (Phase 2: Status Reconciliation)

The load status reconciliation (MIGRATION_STRATEGY.md Section 6) requires special rehearsal because it transforms existing data:

```
STEP 1: Count loads by current status
  $ mysql -e "SELECT status, COUNT(*) FROM loads GROUP BY status" [staging_db]
  RECORD: Row counts per status: ___

STEP 2: Apply status reconciliation migration
  $ DB_NAME=[staging_db] npm run migrate
  (Migration 009_load_status_reconcile.sql)

STEP 3: Verify status mapping
  $ mysql -e "SELECT status, COUNT(*) FROM loads GROUP BY status" [staging_db]
  VERIFY: All statuses are in canonical set (planned, booked, dispatched, in_transit, delivered, invoiced, settled, completed, cancelled)
  VERIFY: No NULL or empty status values
  VERIFY: Total row count matches pre-migration count

STEP 4: Test rollback of status reconciliation
  $ DB_NAME=[staging_db] npm run migrate:down
  $ mysql -e "SELECT status, COUNT(*) FROM loads GROUP BY status" [staging_db]
  VERIFY: Statuses restored to original values and counts
```

---

## 6. Go/No-Go Criteria

### 6.1 Go Criteria (ALL must be YES)

Every criterion must be independently verified and signed off before deployment proceeds.

| # | Category | Criterion | Verified By | How Measured |
|---|----------|-----------|-------------|-------------|
| 1 | **Code** | All CI/CD pipeline stages pass (build, test, lint) | QA Lead | CI pipeline green; build artifact produced |
| 2 | **Code** | TypeScript compiles with zero errors on both frontend and server | QA Lead | `npx tsc --noEmit` exit code 0 |
| 3 | **Tests** | Unit test coverage meets phase target (see TEST_STRATEGY.md Section 3) | QA Lead | Vitest coverage report |
| 4 | **Tests** | All integration tests pass | QA Lead | `vitest run --config vitest.integration.config.ts` exit code 0 |
| 5 | **Tests** | All smoke tests pass against staging environment | QA Lead | 10 critical paths verified |
| 6 | **Security** | No hardcoded credentials in codebase | Security Lead | Grep scan returns zero matches |
| 7 | **Security** | All API routes have auth middleware (Phase 1+) | Security Lead | Route audit confirms 0 AUTH-MISSING (except /api/health and /api/auth/login) |
| 8 | **Security** | Tenant isolation enforced on all data routes (Phase 1+) | Security Lead | Route audit confirms 0 TENANT-MISSING and 0 TENANT-LEAK |
| 9 | **Database** | Migration rehearsal passed on staging (Section 5) | Backend Lead | Rehearsal sign-off recorded |
| 10 | **Database** | Database backup taken and verified | Backend Lead | Backup file exists; spot-check row counts |
| 11 | **Database** | Rollback tested and verified (Section 5.2 Step 7) | Backend Lead | Schema returns to pre-migration state cleanly |
| 12 | **Monitoring** | Health check endpoint returns healthy (Section 5 of OBSERVABILITY_BASELINE.md) | Ops Lead | `curl /api/health` returns all checks healthy |
| 13 | **Monitoring** | Alert rules configured and tested | Ops Lead | Test alert fires and reaches notification channel |
| 14 | **Release** | Release notes written | Product Lead | Changelog documents all user-facing changes |
| 15 | **Release** | Rollback plan reviewed and rehearsed | Ops Lead | All team members know rollback steps |

### 6.2 No-Go Criteria (ANY triggers NO-GO)

If any of these conditions are true, deployment MUST NOT proceed.

| # | Condition | Reason | Resolution |
|---|-----------|--------|------------|
| 1 | Any Critical risk (RISK-001 through RISK-006) not mitigated for this phase | Data integrity or security exposure | Complete risk mitigation per RISK_REGISTER.md |
| 2 | Test coverage below phase target | Insufficient validation of changes | Write missing tests; achieve coverage target |
| 3 | Migration rehearsal failed or not performed | Unknown schema change behavior | Run rehearsal; fix migration issues |
| 4 | Database backup not taken or not verified | No recovery point if deploy fails | Take and verify backup |
| 5 | Staging smoke tests failing | Production will likely fail too | Fix failing tests before deploy |
| 6 | Active P1 or P2 incident in production | Deploy could compound existing issues | Resolve incident first |
| 7 | On-call engineer unavailable | No one to respond to deploy issues | Schedule deploy when on-call is staffed |
| 8 | Deploy window conflicts with peak traffic | Increased blast radius | Deploy during low-traffic window (see Section 7) |
| 9 | Mock data references found in production code (Phase 2+) | Users would see fake data | Remove all mock/seed calls |
| 10 | localStorage usage found in production code (Phase 2+) | Data loss and consistency risks | Replace with API client calls |

### 6.3 Phase-Specific Go/No-Go Additions

| Phase | Additional Go Criteria |
|-------|----------------------|
| Phase 1 (Foundation) | Vitest configured and running; migration runner operational; auth middleware on all routes |
| Phase 2 (Core Slice) | Zero localStorage references in production code; load state machine enforced server-side; mock data fully removed |
| Phase 3 (Integration) | External API circuit breakers operational; IntelligenceHub decomposed (no file > 300 lines) |
| Phase 4 (Financial) | Journal balance validation at 100%; settlement state machine enforced; GL posting idempotency verified |
| Phase 5 (Stabilize) | SLO targets met for 7 consecutive days on staging; error budget > 50% |
| Phase 6 (Deploy) | Full stack smoke test passes on production-mirror staging; all 21 risks in RISK_REGISTER.md mitigated or accepted |

---

## 7. Deploy Window and Communication

### 7.1 Deploy Window

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Preferred day** | Tuesday or Wednesday | Avoids Monday catch-up and Friday risk |
| **Preferred time** | 10:00 AM - 2:00 PM local time | Engineers available for monitoring; not end-of-day |
| **Avoid** | Friday deploys, holiday eves, after 4 PM | Reduced staffing for incident response |
| **Maximum deploy duration** | 1 hour | If not complete in 1 hour, roll back and investigate |
| **Monitoring period** | 2 hours post-deploy | Observe metrics, logs, and alerts for anomalies |

### 7.2 Communication Plan

| When | What | Channel | Who |
|------|------|---------|-----|
| 24 hours before | Deploy announcement with scope and timing | Team Slack channel | Release Manager |
| 1 hour before | Go/No-Go decision meeting | Video call | All leads (Frontend, Backend, QA, Ops, Product) |
| Deploy start | "Deploy in progress" status | Status page + Slack | Ops Lead |
| Deploy complete | "Deploy complete, monitoring" status | Status page + Slack | Ops Lead |
| Monitoring period end | "Deploy verified" or "Rollback initiated" | Status page + Slack | Ops Lead |
| Post-deploy (24h) | Deploy retrospective notes | Confluence/docs | Release Manager |

---

## 8. Post-Deployment Verification

### 8.1 Immediate Checks (First 15 Minutes)

| # | Check | Method | Pass Criteria |
|---|-------|--------|---------------|
| 1 | Health endpoint | `curl /api/health` | All dependency checks healthy |
| 2 | Login flow | Manual login via UI | User can log in and see dashboard |
| 3 | Error rate | Check `http_request_errors_total` | 5xx rate < 1% |
| 4 | Latency | Check `http_request_duration_seconds` | p95 < 1s for read endpoints |
| 5 | Database connections | Check `db_pool_connections_active` | No connection starvation |
| 6 | Log output | Tail application logs | No repeated errors; structured JSON format |

### 8.2 Extended Monitoring (2 Hours Post-Deploy)

| # | Check | Method | Pass Criteria |
|---|-------|--------|---------------|
| 1 | Smoke test scenarios | Run all 10 from TEST_STRATEGY.md | All pass |
| 2 | State machine enforcement | Create test load, advance through lifecycle | All transitions validate correctly |
| 3 | Financial operations | Create test invoice on staging tenant | GL journal entry posted correctly |
| 4 | No alert fires | Monitor alert channels | Zero P1 or P2 alerts |
| 5 | Memory stability | Check `process_memory_bytes` trend | No upward trend (memory leak indicator) |
| 6 | Error log review | Search logs for new error patterns | No novel error categories |

### 8.3 24-Hour Check

| # | Check | Method | Pass Criteria |
|---|-------|--------|---------------|
| 1 | Nightly reconciliation | MySQL vs Firestore record comparison | Zero divergences for dual-write entities |
| 2 | SLO tracking | Review availability and latency SLOs | All SLOs within target |
| 3 | Error budget | Check burn rate | Not burning error budget faster than normal |
| 4 | User feedback | Check support channels | No new issues attributed to deploy |

---

## 9. Incident Response During Deploy

### 9.1 Decision Tree

```
Deploy issue detected
  |
  +--> Is the issue blocking user access?
  |     |
  |     YES --> Rollback immediately (Section 4.4)
  |     |
  |     NO --> Is data integrity at risk?
  |            |
  |            YES --> Stop deploy; investigate; do not proceed
  |            |
  |            NO --> Is the issue cosmetic/non-critical?
  |                   |
  |                   YES --> Log issue; continue monitoring; fix in next deploy
  |                   |
  |                   NO --> Assess within 15 minutes; rollback if no fix found
```

### 9.2 Escalation Path

| Time Elapsed | Action | Who Decides |
|-------------|--------|-------------|
| 0-5 min | Deploy engineer investigates | Deploy engineer |
| 5-15 min | Escalate to team lead | Team lead |
| 15-30 min | Go/No-Go on rollback | Ops Lead + Backend Lead |
| 30+ min | Mandatory rollback | Ops Lead (unilateral authority) |

---

## 10. Appendix: Environment Variables Reference

### Required for All Deploys

| Variable | Component | Description | Example |
|----------|-----------|-------------|---------|
| `DB_HOST` | Server | MySQL hostname | `mysql.example.com` |
| `DB_PORT` | Server | MySQL port | `3306` |
| `DB_USER` | Server | MySQL username | `loadpilot_app` |
| `DB_PASSWORD` | Server | MySQL password | (from secrets manager) |
| `DB_NAME` | Server | MySQL database name | `trucklogix` |
| `FIREBASE_PROJECT_ID` | Server | Firebase project ID | `loadpilot-prod` |
| `PORT` | Server | Express listen port | `5000` |
| `LOG_LEVEL` | Server | Minimum log level | `info` |
| `APP_VERSION` | Server | Deploy version tag | `1.0.0` |
| `VITE_FIREBASE_API_KEY` | Frontend | Firebase client API key | (from Firebase Console) |
| `VITE_FIREBASE_AUTH_DOMAIN` | Frontend | Firebase auth domain | `loadpilot-prod.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Frontend | Firebase project ID | `loadpilot-prod` |
| `VITE_GOOGLE_MAPS_API_KEY` | Frontend | Google Maps API key | (from GCP Console) |
| `VITE_WEATHER_API_KEY` | Frontend | Azure Maps API key | (from Azure Portal) |

### Optional / Phase-Specific

| Variable | Phase | Description |
|----------|-------|-------------|
| `FIREBASE_AUTH_EMULATOR_HOST` | Dev/Test | Firebase Auth emulator address |
| `GEMINI_API_KEY` | Phase 3+ | Google Gemini AI API key for OCR |
| `SENTRY_DSN` | Phase 5+ | Error tracking service DSN |
| `PAGERDUTY_API_KEY` | Phase 6 | Alert routing to PagerDuty |
