# Worktree Boot Checklist

Date: 2026-03-24
Owner: Team 1
Status: Canonical reference for all teams

## Purpose

This document tells any team how to boot a working frontend + backend pair from a fresh git worktree. Follow every step in order. If a step fails, stop and fix before continuing.

## Prerequisites

- Node.js 18+ installed
- npm 9+ installed
- MySQL 8+ running on localhost:3306 (or Cloud SQL Proxy if deployed)
- Firebase project created with Auth enabled
- `.env` file from the main repo (see Step 2)

## Step 1: Create the Worktree

From the main repository (`F:\Trucking\DisbatchMe`):

```bash
# If branch exists:
git worktree add F:\Trucking\worktrees\<team-name> <branch-name>

# If branch does not exist:
git worktree add F:\Trucking\worktrees\<team-name> -b <branch-name> HEAD
```

Naming convention:

- `team01-platform-core` on `team01/platform-core-implementation`
- `team02-loads-dispatch` on `team02/loads-dispatch-implementation`
- `team03-tracking-map` on `team03/tracking-map-implementation`
- `team04-financials-docs` on `team04/financials-docs-implementation`
- `team05-entities-ops` on `team05/entities-ops-implementation`

## Step 2: Copy Environment Configuration

The `.env` file is gitignored. Copy it from the main repo:

```bash
cp F:\Trucking\DisbatchMe\.env F:\Trucking\worktrees\<team-name>\.env
```

If you need a fresh `.env`, copy from the template:

```bash
cp .env.example .env
```

### Required Environment Variables

**Minimum for frontend + backend to start:**

| Variable                            | Required | Source                              |
| ----------------------------------- | -------- | ----------------------------------- |
| `VITE_FIREBASE_API_KEY`             | Yes      | Firebase Console > Project Settings |
| `VITE_FIREBASE_AUTH_DOMAIN`         | Yes      | Firebase Console > Project Settings |
| `VITE_FIREBASE_PROJECT_ID`          | Yes      | Firebase Console > Project Settings |
| `VITE_FIREBASE_STORAGE_BUCKET`      | Yes      | Firebase Console > Project Settings |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes      | Firebase Console > Project Settings |
| `VITE_FIREBASE_APP_ID`              | Yes      | Firebase Console > Project Settings |
| `DB_HOST`                           | Yes      | Default: `127.0.0.1`                |
| `DB_PORT`                           | Yes      | Default: `3306`                     |
| `DB_USER`                           | Yes      | Your MySQL user                     |
| `DB_PASSWORD`                       | Yes      | Your MySQL password                 |
| `DB_NAME`                           | Yes      | Default: `loadpilot_production`     |

**Optional but recommended:**

| Variable                   | Purpose                                           |
| -------------------------- | ------------------------------------------------- |
| `VITE_GOOGLE_MAPS_API_KEY` | Fleet map rendering                               |
| `GEMINI_API_KEY`           | AI document parsing                               |
| `VITE_API_URL`             | Override API URL (default: `/api` via Vite proxy) |

Firebase Admin SDK credentials are resolved automatically:

- **Local dev**: Place `serviceAccount.json` in `server/` (auto-detected)
- **Cloud Run**: Set `FIREBASE_PROJECT_ID` env var

## Step 3: Install Dependencies

```bash
cd F:\Trucking\worktrees\<team-name>

# Root (frontend) dependencies
npm install

# Server dependencies
cd server
npm install
cd ..
```

Both `npm install` commands must complete without errors.

## Step 4: Set Up the Database

Ensure MySQL is running and the target database exists:

```sql
CREATE DATABASE IF NOT EXISTS loadpilot_production;
```

Run migrations:

```bash
cd server
npx ts-node scripts/migrate.ts up
```

Verify migration state:

```bash
npx ts-node scripts/migrate.ts status
```

Expected output: all migrations (001 through 038+) show `applied` status with no checksum mismatches.
Example:

```
001_baseline.sql                              APPLIED  2026-03-24T...
002_add_version_columns.sql                   APPLIED  2026-03-24T...
002_load_status_normalization.sql             APPLIED  2026-03-24T...
003_enhance_dispatch_events.sql               APPLIED  2026-03-24T...
003_operational_entities.sql                  APPLIED  2026-03-24T...
...
038_accounting_tenant_to_company_id.sql       APPLIED  2026-03-24T...
```

Note: Duplicate 002/003 prefixes are intentional and sort alphabetically. See `server/migrations/README.md`.

## Step 5: Start the Backend

```bash
cd server
npm run dev
```

The server starts on `http://localhost:5000`.

### Health Check

```bash
curl http://localhost:5000/api/health
```

Expected: `200 OK` with JSON health response.

## Step 6: Start the Frontend

In a separate terminal:

```bash
cd F:\Trucking\worktrees\<team-name>
npm run dev
```

The frontend starts on `http://localhost:3000`.

### Verify Vite Proxy

The Vite dev server proxies `/api/*` to `http://localhost:5000`. This means:

- Frontend fetches `/api/health` → Vite forwards to `http://localhost:5000/api/health`
- No CORS issues in development
- Bearer tokens pass through transparently

Open `http://localhost:3000` in browser. You should see the login screen.

## Step 7: Run Tests (Proof of Clean Boot)

Tests must pass before any feature work begins. Run from the worktree root:

```bash
# Frontend TypeScript check (expect: 0 errors)
npx tsc --noEmit

# Frontend tests (expect: ~3,500+ passed, 0 failed)
npx vitest run

# Server TypeScript check (expect: 0 errors)
cd server && npx tsc --noEmit

# Server tests (expect: ~2,200+ passed, 0 failed)
npx vitest run
```

If any test fails, stop and investigate before proceeding. Pre-existing flaky tests
(e.g., Settlements PDF on Windows) may time out in full-suite runs but pass in isolation.

## Step 8: Verify Clean Boot

Check these indicators:

1. **No console errors** in browser DevTools
2. **No SQL errors** in server terminal
3. **Login works** with a valid Firebase Auth user
4. **Health endpoint responds**: `http://localhost:5000/api/health`
5. **Migration status is clean**: `npx ts-node scripts/migrate.ts status` shows all applied
6. **Tests pass**: Step 7 completed with 0 failures

## Port Ownership

| Port | Service                      | Process                    |
| ---- | ---------------------------- | -------------------------- |
| 3000 | Vite dev server (frontend)   | `npm run dev`              |
| 5000 | Express API server (backend) | `cd server && npm run dev` |
| 3306 | MySQL                        | System service             |

### Port Conflict Resolution

If a port is already in use:

**Frontend (3000)**:

- Check: `netstat -ano | findstr :3000`
- Kill: `taskkill /PID <pid> /F`
- Or change port in `vite.config.ts` → `server.port`

**Backend (5000)**:

- Check: `netstat -ano | findstr :5000`
- Kill: `taskkill /PID <pid> /F`
- Or set `PORT=5001` in `.env`

**Multiple worktrees**: Each worktree needs its own port pair. Adjust `.env` and `vite.config.ts` per worktree if running multiple simultaneously.

## Running Tests

### Frontend Tests

```bash
# From worktree root
npx vitest run
```

### Server Tests

```bash
cd server
npx vitest run
```

### Python Hook Tests

```bash
python -m pytest .claude/hooks/tests/ -v
```

### TypeScript Check

```bash
# Frontend
npx tsc --noEmit

# Server
cd server && npx tsc --noEmit
```

## Troubleshooting

### "Firebase credentials not found"

- Ensure all 6 `VITE_FIREBASE_*` vars are set in `.env`
- For server: place `serviceAccount.json` in `server/` or set `GOOGLE_APPLICATION_CREDENTIALS`

### "ECONNREFUSED 127.0.0.1:3306"

- MySQL is not running. Start it: `net start mysql` (Windows) or `sudo systemctl start mysql` (Linux)

### "ER_ACCESS_DENIED_ERROR"

- Check `DB_USER` and `DB_PASSWORD` in `.env`

### "Migration checksum mismatch"

- A migration file was modified after being applied. Do NOT modify applied migrations.
- Check: `npx ts-node scripts/migrate.ts status`

### "Cannot find module" on server start

- Run `cd server && npm install` again

### DEMO_MODE active

- If `VITE_FIREBASE_API_KEY` is not set in development, the app enters DEMO_MODE
- This is a local-only auth mode that bypasses Firebase
- Production builds crash if DEMO_MODE activates (safety guard)
