# Environment Variable Inventory

> Generated: 2026-03-11
> Sprint: Deployment Preparation & Staging Qualification
> Status: Authoritative reference for all environments (dev / staging / prod)

## Data Sensitivity Classification

| Level | Meaning                                                                                    |
| ----- | ------------------------------------------------------------------------------------------ |
| P0    | **Critical secret** — credential, key, or token. Never log. Rotate on breach.              |
| P1    | **Sensitive config** — host/endpoint that reveals infrastructure. Do not log in plaintext. |
| P2    | **Internal config** — safe to log in structured logs, not in browser console.              |
| P3    | **Public config** — exposed in browser bundle or public documentation.                     |
| P4    | **Tuning param** — non-sensitive operational setting (limits, flags).                      |

---

## Frontend Variables (VITE\_\* — included in browser bundle)

| Variable                            | Required | Default                     | Sensitivity | Dev Source | Staging/Prod Source   | Notes                                                                   |
| ----------------------------------- | -------- | --------------------------- | ----------- | ---------- | --------------------- | ----------------------------------------------------------------------- |
| `VITE_FIREBASE_API_KEY`             | Required | —                           | P0          | `.env`     | GCP Secret Manager    | Firebase client SDK key                                                 |
| `VITE_FIREBASE_AUTH_DOMAIN`         | Required | —                           | P3          | `.env`     | `.env.staging`        | e.g. `project.firebaseapp.com`                                          |
| `VITE_FIREBASE_PROJECT_ID`          | Required | —                           | P3          | `.env`     | `.env.staging`        | Firebase project identifier                                             |
| `VITE_FIREBASE_STORAGE_BUCKET`      | Required | —                           | P3          | `.env`     | `.env.staging`        | e.g. `project.appspot.com`                                              |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Required | —                           | P3          | `.env`     | `.env.staging`        | FCM sender ID                                                           |
| `VITE_FIREBASE_APP_ID`              | Required | —                           | P3          | `.env`     | `.env.staging`        | Firebase app registration ID                                            |
| `VITE_API_URL`                      | Optional | `http://localhost:5000/api` | P3          | `.env`     | Cloud Run service URL | Backend API base URL. **Must be set** to Cloud Run URL in staging/prod. |
| `VITE_GOOGLE_MAPS_API_KEY`          | Optional | —                           | P0          | `.env`     | GCP Secret Manager    | Google Maps JavaScript API key                                          |
| `VITE_WEATHER_API_KEY`              | Optional | —                           | P0          | `.env`     | GCP Secret Manager    | Azure Maps subscription key                                             |

---

## Backend Variables (server-only — never in browser bundle)

### Database (Cloud SQL for MySQL in staging/prod)

| Variable      | Required | Default | Sensitivity | Dev Source             | Staging/Prod Source | Notes                                                                      |
| ------------- | -------- | ------- | ----------- | ---------------------- | ------------------- | -------------------------------------------------------------------------- |
| `DB_HOST`     | Required | —       | P1          | `.env` / `server/.env` | GCP Secret Manager  | MySQL host. Cloud SQL: use Cloud SQL Auth Proxy socket path or private IP. |
| `DB_USER`     | Required | —       | P1          | `.env` / `server/.env` | GCP Secret Manager  | MySQL username                                                             |
| `DB_PASSWORD` | Required | —       | P0          | `.env` / `server/.env` | GCP Secret Manager  | MySQL password. Never log.                                                 |
| `DB_NAME`     | Required | —       | P2          | `.env` / `server/.env` | GCP Secret Manager  | Database name (e.g. `trucklogix`, `trucklogix_staging`)                    |

### Firebase / Google Cloud Authentication

| Variable                         | Required   | Default | Sensitivity | Dev Source                        | Staging/Prod Source                          | Notes                                                                                                                            |
| -------------------------------- | ---------- | ------- | ----------- | --------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `FIREBASE_PROJECT_ID`            | Required\* | —       | P2          | `.env` / `server/.env`            | GCP Secret Manager                           | Firebase project ID. \*One of FIREBASE_PROJECT_ID or GOOGLE_APPLICATION_CREDENTIALS must be set.                                 |
| `GOOGLE_APPLICATION_CREDENTIALS` | Required\* | —       | P0          | `server/serviceAccount.json` path | Cloud Run: auto-injected via service account | Path to Firebase Admin SDK service account JSON. \*Alternative to FIREBASE_PROJECT_ID. Cloud Run: use Workload Identity instead. |

### AI / External APIs

| Variable         | Required | Default | Sensitivity | Dev Source | Staging/Prod Source | Notes                                                                                  |
| ---------------- | -------- | ------- | ----------- | ---------- | ------------------- | -------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY` | Optional | —       | P0          | `.env`     | GCP Secret Manager  | Google Gemini AI key. Server-only (never VITE\_). AI endpoints unavailable if missing. |

### Server Configuration

| Variable         | Required                     | Default          | Sensitivity | Dev Source | Staging/Prod Source | Notes                                                                                                                             |
| ---------------- | ---------------------------- | ---------------- | ----------- | ---------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`       | Required (staging/prod)      | `development`    | P4          | `.env`     | Cloud Run env var   | `development` / `staging` / `production` / `test`. **Fail-closed**: in staging/prod, missing critical vars cause startup failure. |
| `CORS_ORIGIN`    | **Required in staging/prod** | `*` (permissive) | P2          | `.env`     | GCP Secret Manager  | Frontend domain(s). **Fail-closed**: missing in staging/prod causes server startup THROW. e.g. `https://app.loadpilot.com`        |
| `RATE_LIMIT_MAX` | Optional                     | `100`            | P4          | `.env`     | Cloud Run env var   | Max requests per IP per 15 min on `/api` routes                                                                                   |

### Cloud Run Specific Variables

| Variable                | Required | Default | Sensitivity | Dev Source | Staging/Prod Source        | Notes                                                                                |
| ----------------------- | -------- | ------- | ----------- | ---------- | -------------------------- | ------------------------------------------------------------------------------------ |
| `CLOUD_RUN_SERVICE_URL` | Optional | —       | P2          | N/A        | Auto-injected by Cloud Run | Full HTTPS URL of the Cloud Run service. Set automatically by the Cloud Run runtime. |
| `PORT`                  | Optional | `8080`  | P4          | N/A        | Auto-set by Cloud Run      | Cloud Run always sets PORT=8080. Do not override unless testing locally.             |
| `K_SERVICE`             | Optional | —       | P4          | N/A        | Auto-injected by Cloud Run | Cloud Run service name. Useful for structured logging context.                       |
| `K_REVISION`            | Optional | —       | P4          | N/A        | Auto-injected by Cloud Run | Cloud Run revision name. Useful for deployment tracking in logs.                     |

### Cloud SQL Specific Variables

| Variable                    | Required               | Default | Sensitivity | Dev Source | Staging/Prod Source | Notes                                                                                                               |
| --------------------------- | ---------------------- | ------- | ----------- | ---------- | ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `CLOUD_SQL_CONNECTION_NAME` | Required for Cloud SQL | —       | P1          | N/A        | GCP Secret Manager  | Cloud SQL instance connection name: `PROJECT:REGION:INSTANCE`. Used by Cloud SQL Auth Proxy.                        |
| `DB_SOCKET_PATH`            | Optional               | —       | P1          | N/A        | Cloud Run env var   | Unix socket path for Cloud SQL Auth Proxy connection (alternative to TCP). e.g. `/cloudsql/PROJECT:REGION:INSTANCE` |

---

## Known Unnumbered Migration: exception_management.sql

**File**: `server/migrations/exception_management.sql`

**Status**: Active — creates the exception management tables (`exception_status`, `exceptions`).

**Issue**: This migration file is not part of the numbered chain (001–015). It was created independently and is not tracked by `MigrationRunner` or included in `apply-migrations.sh`.

**Owner**: Backend team

**Resolution path**: Before Gate 1 (first staging deploy), this file must be either:

1. **Numbered** as `016_exception_management.sql` and added to `MigrationRunner` and `apply-migrations.sh`, OR
2. **Documented as out-of-band** schema with explicit manual apply instructions in `STAGING_SETUP.md` and `MIGRATION_RUNBOOK.md`

**Blocked by**: This does not block Phase 2 documentation, but must be resolved before Gate 1 (staging deploy). See PLAN.md Known Issues.

---

## Environment Setup by Environment

### Development

```bash
# Copy and fill in real values
cp .env.example .env

# Required backend vars (add to .env or server/.env)
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=your_local_password
DB_NAME=trucklogix
FIREBASE_PROJECT_ID=your-firebase-project
# OR: GOOGLE_APPLICATION_CREDENTIALS=server/serviceAccount.json

NODE_ENV=development
# CORS_ORIGIN is optional in dev — defaults to permissive *
```

### Staging (Cloud Run + Cloud SQL)

All secrets are stored in GCP Secret Manager and injected into Cloud Run at deploy time.

```bash
# Cloud Run environment variables (set via gcloud or Secret Manager)
NODE_ENV=staging
DB_HOST=/cloudsql/PROJECT:REGION:INSTANCE   # Cloud SQL socket
DB_USER=trucklogix_staging
DB_PASSWORD=<from Secret Manager>
DB_NAME=trucklogix_staging
FIREBASE_PROJECT_ID=loadpilot-staging       # Separate Firebase project
CORS_ORIGIN=https://staging.loadpilot.com   # Required — fail-closed
GEMINI_API_KEY=<from Secret Manager>
CLOUD_SQL_CONNECTION_NAME=PROJECT:REGION:INSTANCE
```

### Production (Cloud Run + Cloud SQL)

```bash
NODE_ENV=production
DB_HOST=/cloudsql/PROJECT:REGION:INSTANCE
DB_USER=trucklogix_prod
DB_PASSWORD=<from Secret Manager>
DB_NAME=trucklogix_prod
FIREBASE_PROJECT_ID=loadpilot-prod
CORS_ORIGIN=https://app.loadpilot.com       # Required — fail-closed
GEMINI_API_KEY=<from Secret Manager>
CLOUD_SQL_CONNECTION_NAME=PROJECT:REGION:INSTANCE
VITE_API_URL=https://api.loadpilot.com/api  # Build-time, not runtime
```

---

## Security Notes

1. **P0 secrets** (DB_PASSWORD, API keys) must never appear in logs, error messages, or git history.
2. **VITE\_\*** variables are bundled into the frontend build and are visible to all users. Never put server secrets in VITE\_\* vars.
3. **GEMINI_API_KEY** was previously exposed as `VITE_GEMINI_API_KEY` (security issue fixed in Phase 1). The key must only be in server-side `.env`.
4. **GOOGLE_APPLICATION_CREDENTIALS** in Cloud Run should use Workload Identity Federation instead of a key file where possible.
5. **CORS_ORIGIN** is fail-closed in staging/prod — the server will refuse to start if it is unset.
