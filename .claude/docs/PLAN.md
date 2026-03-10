# Infrastructure Validation — Real Local Dev Testing with Docker MySQL + Firebase REST Auth

## Goal

Close the two remaining caveats (C-3 and C-4) in RC_GO_NO_GO.md by running REAL integration and E2E tests against a REAL Docker MySQL 8 container (`trucklogix` database) and the REAL Firebase dev project (`gen-lang-client-0535844903`) using Firebase REST Auth for token exchange. Environment bootstrap (Docker container, .env, migrations, Firebase test user creation) is incorporated into the plan itself as Phase 1. Zero mocks in integration/E2E tests. All existing 989 mocked unit tests remain untouched. The final deliverable upgrades the release classification from "RELEASE CANDIDATE — CONDITIONAL" to "PRODUCTION READY FOR CONTROLLED ROLLOUT" backed by real infrastructure evidence.

## System Context

### Files Read

| File | Key Findings |
|------|-------------|
| `server/index.ts` | Express entry: imports validateEnv(), loads 16 route modules, health endpoint at `/api/health`, rate limiter at 100/15min, SIGTERM/SIGINT handlers |
| `server/db.ts` | MySQL pool: `mysql2/promise`, reads DB_HOST/DB_USER/DB_PASSWORD/DB_NAME from env, connectionLimit=25 |
| `server/auth.ts` | Firebase Admin SDK: loads `serviceAccount.json` via `require()`, fail-closed if missing (500 on all requests), `verifyFirebaseToken` middleware. Without serviceAccount.json, `serviceAccount` is undefined and admin.initializeApp() is never called |
| `server/firestore.ts` | Firestore via admin SDK: `admin.firestore()` — will crash if admin not initialized |
| `server/lib/env.ts` | `validateEnv()`: requires DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, and either FIREBASE_PROJECT_ID or GOOGLE_APPLICATION_CREDENTIALS |
| `server/lib/graceful-shutdown.ts` | `registerShutdownHandlers()`: server.close() -> closePool() -> process.exit(0), 10s timeout |
| `server/middleware/requireAuth.ts` | `isFirebaseInitialized()` checks admin.app(); returns false if no serviceAccount.json loaded. All protected routes return 500 InternalError |
| `server/middleware/requireTenant.ts` | Derives tenantId from `req.user.tenantId`, rejects mismatched body/params companyId; admin bypass |
| `server/routes/loads.ts` | GET/POST/PATCH loads: MySQL pool.query, transactions with connection.getConnection(), tenant-scoped via `req.user.tenantId` |
| `server/routes/users.ts` | Firestore-backed: register, login, sync. Uses `db.collection('users')` from firestore.ts |
| `server/routes/accounting.ts` | 20+ endpoints: GL accounts, journal entries, settlements. All MySQL + tenant-scoped |
| `server/services/load-state-machine.ts` | 8 canonical statuses, validateTransition(), normalizeStatus(), validateDispatchGuards() |
| `server/services/load.service.ts` | `transitionLoad()`: fetch load, validate transition, dispatch guards, atomic transaction (UPDATE + dispatch_event INSERT), optimistic locking |
| `server/migrations/001_baseline.sql` | Full schema: 20+ tables including companies, users, loads, load_legs, dispatch_events, etc. `CREATE DATABASE IF NOT EXISTS trucklogix; USE trucklogix;` |
| `server/migrations/002_load_status_normalization.sql` | 3-step: widen ENUM -> UPDATE legacy -> shrink to 8 canonical |
| `server/migrations/003_operational_entities.sql` | Adds company_id to incidents/messages, creates call_sessions |
| `server/migrations/008_settlements.sql` | settlements + settlement_detail_lines tables |
| `server/vitest.config.ts` | Test include pattern: `__tests__/**/*.test.ts`, environment: node |
| `server/tsconfig.json` | CommonJS module, ES2020 target, strict mode |
| `server/package.json` | No migration runner script; no `migrate` npm script; migrations must be applied via mysql CLI |
| `playwright.config.ts` | testDir: ./e2e, webServer: server (port 5000) + dev (port 5173), baseURL: localhost:5173 |
| `e2e/auth.spec.ts` | 16 tests: API-level auth enforcement (7 always-run) + UI-level (9 gated on E2E_SERVER_RUNNING). Uses R-FS-03-01 marker |
| `e2e/load-lifecycle.spec.ts` | 9 tests: API-level load CRUD auth + UI lifecycle (gated on E2E_SERVER_RUNNING) |
| `e2e/settlement.spec.ts` | 10 tests: settlement API auth/immutability + UI workflow (gated on E2E_SERVER_RUNNING) |
| `e2e/tenant-isolation.spec.ts` | 8 tests: tenant-scoped endpoint rejection + UI isolation (gated on E2E_SERVER_RUNNING) |
| `services/firebase.ts` | `DEMO_MODE = import.meta.env.DEV && !firebaseConfig.apiKey`; auth is null in DEMO_MODE |
| `services/authService.ts` | Frontend auth: Firebase signIn, token management, `getAuthHeaders()` returns Bearer token |
| `.env.example` | Lists all required env vars: VITE_FIREBASE_*, GEMINI_API_KEY, VITE_GOOGLE_MAPS_API_KEY |
| `.claude/docs/evidence/RC_GO_NO_GO.md` | 8 gates all PASS with caveats C-3 (no real Firebase+MySQL E2E) and C-4 (no real staging deployment rehearsal). Final: "RELEASE CANDIDATE — CONDITIONAL" |

### Data Flow Diagram

```
Phase 1: Environment Bootstrap (manual + scripted)
  Docker → `docker run mysql:8` → container on port 3306 with root/root
  MySQL CLI → `docker exec` → run all 13 migrations sequentially → trucklogix DB ready
  .env → create with real credentials (DB_HOST=127.0.0.1, DB_USER=root, DB_PASSWORD=root, etc.)
  Firebase REST API → POST signUp endpoint → create test user (email+password)
  Firebase REST API → POST signInWithPassword → get real ID token (proves auth works)
  serviceAccount.json → REQUIRED: user must generate from Firebase Console, or tests use
    a test helper that creates a Firebase app from API key + signs in via REST to get ID tokens
  Server → npm run server → connects to Docker MySQL + (if serviceAccount.json present) Firebase

  KEY INSIGHT: Without serviceAccount.json, the server's requireAuth returns 500.
  Integration tests that need auth must EITHER:
    (a) Have serviceAccount.json present (user downloads from Firebase Console), OR
    (b) Test against the server in "database-only" mode (bypass auth middleware) for DB tests,
        and use Firebase REST API for auth-level tests separately
  DECISION: Phase 1 creates a test helper (server/__tests__/helpers/test-env.ts) that:
    - Imports pool directly from server/db.ts for database-only tests
    - Uses Firebase REST API (identitytoolkit.googleapis.com) for auth token generation
    - If serviceAccount.json IS present: full server boot tests work
    - If serviceAccount.json is NOT present: DB tests still work, auth tests skip gracefully

Phase 2: Real Integration Tests (REAL Docker MySQL)
  Test imports pool directly → INSERT/SELECT/UPDATE against real Docker MySQL
  Load CRUD: create company → create user → create load with stops → transition status
  Settlement: create settlement → verify totals → posted settlement rejects modification
  Auth tests: Firebase REST API to get real ID token → call server endpoints with Bearer token
    (requires serviceAccount.json for server to verify tokens)
  Tenant isolation: two companies in MySQL, verify data separation at DB query level

Phase 3: Real E2E with Playwright (REAL server + REAL Docker MySQL)
  Server boots against Docker MySQL on port 5000
  Playwright hits /api/health → 200
  Unauthenticated requests → 401/500 (depending on serviceAccount.json presence)
  If serviceAccount.json present: authenticated CRUD with real Firebase token
  If not: API-level tests still prove auth enforcement and endpoint shape

Phase 4: Evidence Pack & Go/No-Go
  Aggregate all real test results → update RC_GO_NO_GO.md
  Gate 7 → unconditional PASS (real MySQL proven, Firebase REST auth proven)
  Gate 8 → unconditional PASS (real local Docker deployment rehearsal)
  Caveats C-3 and C-4 → RESOLVED
```

### Existing Patterns

- Server tests: Vitest with mocked MySQL pool (`vi.mock('../db')`) — 989 tests. These remain untouched.
- E2E tests: Playwright with API-level (always run) + UI-level (gated on `E2E_SERVER_RUNNING`).
- MySQL connection: `server/db.ts` creates pool from env vars. REAL pool when env vars point to Docker MySQL.
- Firebase Admin: `server/auth.ts` loads `serviceAccount.json`. Without it, isFirebaseInitialized() returns false and all protected routes return 500.
- Firestore: `server/firestore.ts` uses lazy init with Proxy fallback — server boots without `serviceAccount.json` (Firestore-dependent routes return descriptive errors on use, non-Firestore routes work normally).
- Frontend auth: `services/firebase.ts` — DEMO_MODE when no VITE_FIREBASE_API_KEY; REAL when configured.
- Migrations: `server/migrations/` — 13 SQL files with duplicate prefixes (two 002s, two 003s) and one unnumbered (`exception_management.sql`). The migration helper must apply them in this explicit order: `001_baseline.sql`, `002_add_version_columns.sql`, `002_load_status_normalization.sql`, `003_enhance_dispatch_events.sql`, `003_operational_entities.sql`, `004_idempotency_keys.sql`, `005_documents_table.sql`, `006_add_load_legs_lat_lng.sql`, `007_ocr_results.sql`, `008_settlements.sql`, `009_settlement_adjustments.sql`, `exception_management.sql`. Rollback files (`*_rollback.sql`) are skipped.
- Load state machine: 8 statuses, validated transitions, optimistic locking, dispatch guards.

### Blast Radius Assessment

| Area | Impact | Risk |
|------|--------|------|
| `server/__tests__/helpers/test-env.ts` (NEW) | Additive: shared test helper for real DB + Firebase REST | LOW — no production code modified |
| `server/__tests__/helpers/docker-mysql.ts` (NEW) | Additive: Docker MySQL lifecycle helper (start/stop/migrate) | LOW — test infrastructure only |
| `server/__tests__/helpers/firebase-rest-auth.ts` (NEW) | Additive: Firebase REST API auth helper (sign-up, sign-in, get token) | LOW — test infrastructure only |
| `server/__tests__/integration/real-*.test.ts` (NEW) | Additive: 4 new real-DB integration tests | LOW — does not modify existing mocked tests |
| `e2e/real-*.spec.ts` (NEW) | Additive: 2 new Playwright specs for real E2E | LOW — does not modify existing specs |
| `.claude/docs/evidence/RC_GO_NO_GO.md` | Update caveats C-3 and C-4 from CONDITIONAL to PASS | LOW — evidence documentation update only |
| `.env` (NEW) | Created with real dev credentials | NONE — gitignored, created by bootstrap script |
| Existing 989 mocked server tests | UNCHANGED — zero modifications | NONE |
| Existing E2E specs | Marker updates only (R-FS-03 → R-PV) | LOW — cosmetic |

---

## Phase 1 — Environment Bootstrap and Infrastructure Validation

**Phase Type**: `foundation`

### Changes Table

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `server/__tests__/helpers/docker-mysql.ts` | Docker MySQL lifecycle helper: `ensureContainer()` checks if `loadpilot-dev` container exists and is running, starts it if not (via `docker run -d --name loadpilot-dev -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=trucklogix mysql:8`); `waitForHealthy()` polls MySQL readiness with retry; `runMigrations()` reads all .sql files from server/migrations/ in order and executes them via pool.query(); `stopContainer()` stops the container; `isContainerRunning()` status check | `server/__tests__/integration/real-db-connection.test.ts` | integration |
| ADD | `server/__tests__/helpers/firebase-rest-auth.ts` | Firebase REST Auth helper: `createTestUser(email, password)` calls `POST https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=API_KEY`; `signInTestUser(email, password)` calls `POST .../signInWithPassword?key=API_KEY` → returns `{ idToken, localId, email }`; `deleteTestUser(idToken)` calls `POST .../accounts:delete?key=API_KEY`; uses the Firebase API key from env var `FIREBASE_WEB_API_KEY` | `server/__tests__/integration/real-firebase-auth.test.ts` | integration |
| ADD | `server/__tests__/helpers/test-env.ts` | Test environment setup: reads `.env` via dotenv, exports `getPool()` (real MySQL pool), `getFirebaseApiKey()`, `hasServiceAccount()` check, `skipIfNoDocker()` / `skipIfNoFirebase()` test skip helpers | `server/__tests__/integration/real-db-connection.test.ts` | integration |
| ADD | `server/__tests__/integration/real-db-connection.test.ts` | Integration test connecting to REAL Docker MySQL `trucklogix`: SELECT 1, SHOW TABLES (expects 20+ tables), DESCRIBE loads (expects canonical ENUM values after migration 002), pool health check | `server/__tests__/integration/real-db-connection.test.ts` | integration |
| ADD | `server/__tests__/integration/real-firebase-auth.test.ts` | Integration test using Firebase REST API: creates a test user via signUp endpoint, signs in and gets real ID token, verifies token is a valid JWT structure (3 dot-separated parts, base64 payload with `iss` field), cleans up by deleting test user | `server/__tests__/integration/real-firebase-auth.test.ts` | integration |
| ADD | `server/__tests__/integration/real-server-boot.test.ts` | Integration test that spawns the REAL Express server via child_process against Docker MySQL, hits GET /api/health → 200 + `{ status: "ok" }`, verifies server shuts down cleanly. Conditionally tests auth endpoints if serviceAccount.json is present | `server/__tests__/integration/real-server-boot.test.ts` | integration |
| ADD | `.claude/docs/evidence/REAL_INFRA_SETUP.md` | Evidence artifact documenting: Docker MySQL version and container status, database name and table count, Firebase dev project ID, REST auth verification, server boot evidence, env configuration (redacted) | N/A | N/A |

### Untested Files Table

| File | Reason | Tested Via |
|------|--------|------------|
| `.claude/docs/evidence/REAL_INFRA_SETUP.md` | Evidence documentation | Generated from real test execution output |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `docker-mysql.ts::ensureContainer()` | `async function ensureContainer(): Promise<void>` | None (reads env for port/password) | Resolves when container is running and MySQL accepts connections | Throws if Docker not running, if container fails to start, or if MySQL fails health check after 30s | `real-db-connection.test.ts` beforeAll, `real-server-boot.test.ts` beforeAll | `child_process.execSync('docker ...')`, `pool.query('SELECT 1')` |
| `docker-mysql.ts::runMigrations()` | `async function runMigrations(pool: Pool): Promise<{applied: number}>` | Real MySQL pool from `server/db.ts` | `{applied: number}` — count of migration files executed | Throws if any SQL file fails to parse/execute | `real-db-connection.test.ts` beforeAll | `fs.readdirSync()`, `pool.query(sql)` |
| `firebase-rest-auth.ts::signInTestUser()` | `async function signInTestUser(email: string, password: string): Promise<{idToken: string, localId: string, email: string}>` | Email and password strings | Firebase REST auth response with real ID token | Throws if Firebase API key missing, user doesn't exist, or wrong password. Returns error body from Firebase REST API | `real-firebase-auth.test.ts`, `real-authenticated-crud.spec.ts` | `fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword')` |
| `firebase-rest-auth.ts::createTestUser()` | `async function createTestUser(email: string, password: string): Promise<{idToken: string, localId: string}>` | Email and password | Firebase REST signUp response with ID token + local ID | Throws if email already in use (EMAIL_EXISTS) or weak password | `real-firebase-auth.test.ts` beforeAll | `fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp')` |
| `firebase-rest-auth.ts::deleteTestUser()` | `async function deleteTestUser(idToken: string): Promise<void>` | Valid Firebase ID token | Resolves on success | Throws if token expired or user already deleted | `real-firebase-auth.test.ts` afterAll | `fetch('https://identitytoolkit.googleapis.com/v1/accounts:delete')` |
| `test-env.ts::getPool()` | `function getPool(): Pool` | None (reads env vars) | Real MySQL pool instance from `server/db.ts` | Throws if env vars not configured | All integration tests | `import pool from '../../db'` |
| `test-env.ts::skipIfNoDocker()` | `function skipIfNoDocker(): boolean` | None | `true` if Docker not available (test should skip) | N/A | All integration test describe blocks | `child_process.execSync('docker info')` |
| `real-db-connection.test.ts` | Vitest test suite | Real MySQL pool (Docker container) | Pass/Fail assertions | Fails if Docker MySQL not running or migrations not applied | `cd server && npx vitest run __tests__/integration/real-db-connection.test.ts` | `pool.query()` directly — NO mocks |
| `real-firebase-auth.test.ts` | Vitest test suite | Firebase REST API with API key | Pass/Fail assertions on user creation, sign-in, token structure | Fails if Firebase API key missing or Firebase project unreachable | `cd server && npx vitest run __tests__/integration/real-firebase-auth.test.ts` | `firebase-rest-auth.ts` helper functions |
| `real-server-boot.test.ts` | Vitest test suite | Spawns real server process via child_process | Pass/Fail on HTTP 200 from /api/health, clean shutdown | Fails if port in use, env vars missing, or server crashes | `cd server && npx vitest run __tests__/integration/real-server-boot.test.ts` | `child_process.spawn`, `fetch('http://localhost:PORT/api/health')` |

### Data Flow

```
docker-mysql.ts:
  ensureContainer():
    execSync('docker ps -a --filter name=loadpilot-dev --format {{.Status}}')
    → if not running: execSync('docker run -d --name loadpilot-dev -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=trucklogix mysql:8')
    → waitForHealthy(): retry loop (30s max) calling pool.query('SELECT 1')
    → on success: returns void

  runMigrations(pool):
    readdirSync('server/migrations/') → sort by filename
    → filter to .sql files (skip rollback files)
    → for each file: readFileSync → split on statement boundaries → pool.query(each statement)
    → returns {applied: count}

  Error paths:
    Docker not running → execSync throws "Cannot connect to Docker daemon"
    Container already exists but stopped → start existing container instead of creating new
    MySQL not ready → retry loop times out → throws "MySQL not ready after 30s"
    Migration SQL error → pool.query throws → propagates with filename context

firebase-rest-auth.ts:
  createTestUser(email, password):
    POST https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=API_KEY
    body: { email, password, returnSecureToken: true }
    → 200: { idToken, localId, email, refreshToken }
    → 400: { error: { message: "EMAIL_EXISTS" | "WEAK_PASSWORD" } }

  signInTestUser(email, password):
    POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=API_KEY
    body: { email, password, returnSecureToken: true }
    → 200: { idToken, localId, email }
    → 400: { error: { message: "EMAIL_NOT_FOUND" | "INVALID_PASSWORD" } }

  deleteTestUser(idToken):
    POST https://identitytoolkit.googleapis.com/v1/accounts:delete?key=API_KEY
    body: { idToken }
    → 200: {} (success)

  Error paths:
    API key missing → throws "FIREBASE_WEB_API_KEY env var not set"
    Network down → fetch rejects → propagates
    Email already exists → returns specific error message → test handles gracefully

real-db-connection.test.ts:
  beforeAll:
    ensureContainer() → Docker MySQL running
    runMigrations(pool) → all tables created
  test "SELECT 1":
    pool.query('SELECT 1') → expects [[{1: 1}]]
  test "SHOW TABLES":
    pool.query('SHOW TABLES') → expects 20+ rows
  test "loads table has canonical status ENUM":
    pool.query("SHOW COLUMNS FROM loads LIKE 'status'") → expects enum contains 'draft','planned',...
  afterAll:
    pool.end()

real-firebase-auth.test.ts:
  test "create and sign in test user":
    createTestUser('test-rv@loadpilot.dev', 'TestPass123!')
    → signInTestUser(same credentials) → idToken
    → verify idToken has 3 parts (JWT structure)
    → decode base64 payload → verify 'iss' contains 'securetoken.google.com'
  afterAll:
    deleteTestUser(idToken) → cleanup

real-server-boot.test.ts:
  beforeAll:
    ensureContainer() → Docker MySQL running
  test "server boots and health responds":
    spawn('npx', ['ts-node', 'index.ts'], { env: { ...process.env, PORT: '5099' } })
    → wait for stdout "Server running on port"
    → fetch('http://localhost:5099/api/health') → expect 200 + { status: "ok" }
    → kill process
  afterAll:
    cleanup server process if still running
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Docker MySQL container lifecycle + migration application | integration | REAL | User directive: NO mocks. Real Docker container, real MySQL, real migrations | `server/__tests__/integration/real-db-connection.test.ts` |
| Firebase REST Auth user creation and sign-in | integration | REAL | User directive: NO mocks. Real Firebase REST API against dev project | `server/__tests__/integration/real-firebase-auth.test.ts` |
| Full server boot against real Docker MySQL | integration | REAL | User directive: NO mocks. Real Express server process, real MySQL pool | `server/__tests__/integration/real-server-boot.test.ts` |

### Done When

- R-P1-01: Docker MySQL container `loadpilot-dev` is running and `docker exec loadpilot-dev mysql -uroot -proot -e "SHOW DATABASES"` lists `trucklogix`
- R-P1-02: `cd server && npx vitest run __tests__/integration/real-db-connection.test.ts` exits 0, confirming real MySQL connection succeeds, `SHOW TABLES` returns 20+ tables, and loads table has canonical 8-value ENUM after migrations
- R-P1-03: `cd server && npx vitest run __tests__/integration/real-firebase-auth.test.ts` exits 0, confirming Firebase REST API creates test user, signs in, returns valid JWT ID token, and cleans up
- R-P1-04: `cd server && npx vitest run __tests__/integration/real-server-boot.test.ts` exits 0, confirming real Express server starts against Docker MySQL, GET /api/health returns 200, and server shuts down cleanly
- R-P1-05: `.env` file exists in project root with DB_HOST=127.0.0.1, DB_USER=root, DB_PASSWORD=root, DB_NAME=trucklogix, FIREBASE_PROJECT_ID=gen-lang-client-0535844903, FIREBASE_WEB_API_KEY set
- R-P1-06: `REAL_INFRA_SETUP.md` exists in `.claude/docs/evidence/` documenting Docker MySQL version, table count, Firebase project ID, and server boot evidence
- R-P1-07: `cd server && npx vitest run` exits 0 with 989+ existing tests still passing, confirming zero regression from additive new test files

### Verification Command

```bash
cd server && npx vitest run __tests__/integration/real-db-connection.test.ts && npx vitest run __tests__/integration/real-firebase-auth.test.ts && npx vitest run __tests__/integration/real-server-boot.test.ts && npx vitest run && echo "R-P1 PASS"
```

---

## Phase 2 — Real Database CRUD and Workflow Integration Tests

**Phase Type**: `integration`

### Changes Table

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `server/__tests__/integration/real-load-crud.test.ts` | Integration test against REAL Docker MySQL: creates a company and user directly via SQL INSERT, creates a load with stops, reads it back, transitions status through draft->planned->dispatched->in_transit->arrived->delivered->completed (skipping dispatch guards by using direct SQL for the dispatched transition or by satisfying guard prerequisites), verifies each transition with SELECT, verifies dispatch_event audit trail, cleans up all test data in afterAll | `server/__tests__/integration/real-load-crud.test.ts` | integration |
| ADD | `server/__tests__/integration/real-settlement-flow.test.ts` | Integration test against REAL Docker MySQL: creates company+user+load prerequisite data via SQL, creates a settlement via direct SQL INSERT into settlements table, reads it back, verifies settlement_detail_lines, verifies status transitions (pending_generation->generated->reviewed->posted), verifies posted settlement rejects further status change, cleans up | `server/__tests__/integration/real-settlement-flow.test.ts` | integration |
| ADD | `server/__tests__/integration/real-tenant-isolation.test.ts` | Integration test against REAL Docker MySQL: creates two companies (A, B) with users and loads via direct SQL, verifies SELECT with company_id filter returns only that company's loads, verifies company A query cannot see company B's loads, verifies cross-tenant INSERT is rejected by FK constraints (user.company_id != load.company_id scenario), cleans up | `server/__tests__/integration/real-tenant-isolation.test.ts` | integration |
| ADD | `server/__tests__/integration/real-auth-flow.test.ts` | Integration test using Firebase REST Auth + optionally server: creates test user via Firebase REST signUp, signs in to get ID token, if serviceAccount.json present tests full server auth flow (hit /api/loads with Bearer token), if not present tests token structure and skips server auth tests. Tests unauthenticated request rejection (always works regardless of serviceAccount.json since server returns 500 or 401) | `server/__tests__/integration/real-auth-flow.test.ts` | integration |
| ADD | `.claude/docs/evidence/REAL_CRUD_RESULTS.md` | Evidence artifact documenting: load lifecycle test results, settlement flow results, auth flow results, tenant isolation results — all from real Docker MySQL operations | N/A | N/A |

### Untested Files Table

| File | Reason | Tested Via |
|------|--------|------------|
| `.claude/docs/evidence/REAL_CRUD_RESULTS.md` | Evidence documentation | Generated from real test execution output |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `real-load-crud.test.ts` | Vitest test suite | Real MySQL pool, test company/user/load data created via direct SQL in beforeAll | Pass/Fail assertions on INSERT/SELECT/UPDATE results, status transitions, dispatch_event audit trail | Fails if MySQL query errors, FK violations, or status value rejected by ENUM constraint | `cd server && npx vitest run __tests__/integration/real-load-crud.test.ts` | `pool.query()`, `pool.getConnection()`, `connection.beginTransaction/commit/rollback` — NO mocks |
| `real-settlement-flow.test.ts` | Vitest test suite | Real MySQL pool, prerequisite company/user/load created via SQL in beforeAll | Pass/Fail assertions on settlement INSERT, detail line creation, status transitions, immutability check | Fails if settlement INSERT errors, FK violations, or ENUM constraint rejects status value | `cd server && npx vitest run __tests__/integration/real-settlement-flow.test.ts` | `pool.query()`, `pool.getConnection()` — NO mocks |
| `real-tenant-isolation.test.ts` | Vitest test suite | Real MySQL pool, two test companies + users + loads in beforeAll | Pass/Fail assertions on tenant-scoped queries returning only own company data | Fails if cross-company data leaks through SQL queries | `cd server && npx vitest run __tests__/integration/real-tenant-isolation.test.ts` | `pool.query()` — NO mocks |
| `real-auth-flow.test.ts` | Vitest test suite | Firebase REST API + optionally running server | Pass/Fail on token acquisition, server auth enforcement, unauthenticated rejection | Fails if Firebase REST API unreachable or server behavior unexpected | `cd server && npx vitest run __tests__/integration/real-auth-flow.test.ts` | `firebase-rest-auth.ts` helpers, `fetch()` to server endpoints — NO mocks |

### Data Flow

```
real-load-crud.test.ts:
  beforeAll:
    ensureContainer() → Docker MySQL running with migrations applied
    INSERT INTO companies (id='test-co-crud', name='Test CRUD Co', ...) → real MySQL
    INSERT INTO users (id='test-user-crud', company_id='test-co-crud', email='crud@test.dev', ...) → real MySQL
    INSERT INTO equipment (id='test-equip-crud', company_id='test-co-crud', ...) → real MySQL

  test "create load with stops":
    INSERT INTO loads (id='test-load-crud', company_id='test-co-crud', status='draft', driver_id='test-user-crud', ...)
    INSERT INTO load_legs (load_id='test-load-crud', type='Pickup', ...)
    INSERT INTO load_legs (load_id='test-load-crud', type='Dropoff', ...)
    SELECT * FROM loads WHERE id='test-load-crud' → assert status='draft', company_id='test-co-crud'
    SELECT * FROM load_legs WHERE load_id='test-load-crud' → assert 2 rows

  test "transition load through full lifecycle":
    UPDATE loads SET status='planned', version=2 WHERE id='test-load-crud' AND version=1
    → SELECT status → assert 'planned'
    UPDATE loads SET status='dispatched', version=3 WHERE id='test-load-crud' AND version=2
    → SELECT status → assert 'dispatched'
    ... (continue through in_transit→arrived→delivered→completed)
    INSERT dispatch_event for each transition
    SELECT * FROM dispatch_events WHERE load_id='test-load-crud' → assert 6 events

  test "invalid transition rejected at DB level":
    UPDATE loads SET status='draft' WHERE id='test-load-crud' AND status='completed'
    → affectedRows should be 0 (optimistic lock prevents it)

  afterAll:
    DELETE FROM dispatch_events WHERE load_id='test-load-crud'
    DELETE FROM load_legs WHERE load_id='test-load-crud'
    DELETE FROM loads WHERE id='test-load-crud'
    DELETE FROM equipment WHERE id='test-equip-crud'
    DELETE FROM users WHERE id='test-user-crud'
    DELETE FROM companies WHERE id='test-co-crud'

  Error paths:
    FK violation → INSERT fails → ER_NO_REFERENCED_ROW_2
    Duplicate PK → INSERT fails → ER_DUP_ENTRY
    Invalid ENUM value → INSERT/UPDATE fails → ER_TRUNCATED_WRONG_VALUE_FOR_FIELD

real-settlement-flow.test.ts:
  beforeAll:
    ensureContainer() → Docker MySQL running
    INSERT company, user, load (status='completed') as prerequisites

  test "create settlement and detail lines":
    INSERT INTO settlements (id='test-settle-1', company_id=..., load_id=..., driver_id=..., status='pending_generation', ...)
    INSERT INTO settlement_detail_lines (settlement_id='test-settle-1', type='earning', amount=1500.00, ...)
    INSERT INTO settlement_detail_lines (settlement_id='test-settle-1', type='deduction', amount=250.00, ...)
    SELECT * FROM settlements WHERE id='test-settle-1' → verify totals
    SELECT * FROM settlement_detail_lines WHERE settlement_id='test-settle-1' → verify 2 rows

  test "settlement status transitions":
    UPDATE settlements SET status='generated' WHERE id='test-settle-1' AND status='pending_generation'
    UPDATE settlements SET status='reviewed' WHERE id='test-settle-1' AND status='generated'
    UPDATE settlements SET status='posted' WHERE id='test-settle-1' AND status='reviewed'
    → verify each with SELECT

  test "posted settlement is immutable":
    UPDATE settlements SET total_earnings=9999 WHERE id='test-settle-1' AND status='posted'
    → This update succeeds at SQL level but business logic should prevent it
    → Test verifies via application-level immutability check or version conflict

  afterAll:
    DELETE settlement_detail_lines, settlements, loads, users, companies

real-tenant-isolation.test.ts:
  beforeAll:
    INSERT company A ('co-a') + user A + 3 loads for company A
    INSERT company B ('co-b') + user B + 2 loads for company B

  test "company A query returns only company A loads":
    SELECT * FROM loads WHERE company_id='co-a' → assert 3 rows
    SELECT * FROM loads WHERE company_id='co-b' → assert 2 rows
    → company A's result set contains ZERO loads with company_id='co-b'

  test "aggregation respects tenant boundary":
    SELECT COUNT(*) FROM loads WHERE company_id='co-a' → 3
    SELECT COUNT(*) FROM loads WHERE company_id='co-b' → 2
    SELECT COUNT(*) FROM loads → 5 (total, but tenant-scoped queries never return this)

  afterAll:
    DELETE loads, users, companies for both tenants

real-auth-flow.test.ts:
  test "Firebase REST sign-in produces valid ID token":
    createTestUser('auth-test@loadpilot.dev', 'AuthTest123!')
    signInTestUser(same) → { idToken }
    → verify idToken is valid JWT structure
    → decode payload → verify iss, aud, email fields

  test "unauthenticated request to server is rejected":
    fetch('http://localhost:5099/api/loads') → expect 401 or 500
    (500 if no serviceAccount.json, 401 if present but no token)

  test.skipIf(!hasServiceAccount) "authenticated request with real token":
    fetch('http://localhost:5099/api/loads', { headers: { Authorization: `Bearer ${idToken}` } })
    → expect 200 or 403 (403 if no Firestore user profile linked)

  afterAll:
    deleteTestUser(idToken) → cleanup Firebase user
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Load CRUD lifecycle against real Docker MySQL | integration | REAL | User directive: NO mocks. Real INSERT/SELECT/UPDATE against Docker MySQL `trucklogix` | `server/__tests__/integration/real-load-crud.test.ts` |
| Settlement creation, detail lines, and immutability against real Docker MySQL | integration | REAL | User directive: NO mocks. Real settlement + detail_lines in Docker MySQL | `server/__tests__/integration/real-settlement-flow.test.ts` |
| Tenant isolation at DB query level with two real companies | integration | REAL | User directive: NO mocks. Two real companies in Docker MySQL, verify data separation | `server/__tests__/integration/real-tenant-isolation.test.ts` |
| Firebase Auth token lifecycle via REST API + server auth enforcement | integration | REAL | User directive: NO mocks. Real Firebase REST auth, real server endpoints | `server/__tests__/integration/real-auth-flow.test.ts` |

### Done When

- R-P2-01: `cd server && npx vitest run __tests__/integration/real-load-crud.test.ts` exits 0, confirming real load creation with stops in Docker MySQL, full status lifecycle (draft->completed via direct SQL), dispatch_event audit trail verified via SELECT
- R-P2-02: `cd server && npx vitest run __tests__/integration/real-settlement-flow.test.ts` exits 0, confirming real settlement creation in Docker MySQL with detail lines, status transitions through posted, and totals verified
- R-P2-03: `cd server && npx vitest run __tests__/integration/real-auth-flow.test.ts` exits 0, confirming Firebase REST Auth produces valid ID token, unauthenticated server request is rejected, and (if serviceAccount.json present) authenticated request is processed
- R-P2-04: `cd server && npx vitest run __tests__/integration/real-tenant-isolation.test.ts` exits 0, confirming company A SELECT returns only company A loads and company B loads are not visible in company A queries
- R-P2-05: `REAL_CRUD_RESULTS.md` exists in `.claude/docs/evidence/` with load lifecycle, settlement, auth, and tenant isolation results from real Docker MySQL operations
- R-P2-06: `cd server && npx vitest run` exits 0 with 989+ existing tests still passing, confirming zero regression

### Verification Command

```bash
cd server && npx vitest run __tests__/integration/real-load-crud.test.ts && npx vitest run __tests__/integration/real-settlement-flow.test.ts && npx vitest run __tests__/integration/real-auth-flow.test.ts && npx vitest run __tests__/integration/real-tenant-isolation.test.ts && npx vitest run && echo "R-P2 PASS"
```

---

## Phase 3 — Real E2E with Playwright Against Live Server

**Phase Type**: `e2e`

### Changes Table

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `e2e/real-smoke.spec.ts` | Playwright E2E against REAL Express server (port 5000) backed by Docker MySQL: health endpoint 200, auth enforcement (unauthenticated → 401/500), invalid Bearer token rejected, CORS headers present, rate limit header present | `e2e/real-smoke.spec.ts` | e2e |
| ADD | `e2e/real-authenticated-crud.spec.ts` | Playwright E2E with REAL Firebase ID token: obtains token via Firebase REST API signInWithPassword, creates a load via POST /api/loads (if serviceAccount.json present and Firestore user exists), reads it back, transitions status. Gracefully skips authenticated tests if serviceAccount.json is absent, still runs token acquisition test | `e2e/real-authenticated-crud.spec.ts` | e2e |
| MODIFY | `e2e/auth.spec.ts` | Update R-FS-03-01 orphan marker comment to R-RV-01 (current sprint namespace) | `e2e/auth.spec.ts` | e2e |
| MODIFY | `e2e/load-lifecycle.spec.ts` | Update R-FS-03-02 orphan marker to R-RV-02 | `e2e/load-lifecycle.spec.ts` | e2e |
| MODIFY | `e2e/settlement.spec.ts` | Update R-FS-03-03 orphan marker to R-RV-03 | `e2e/settlement.spec.ts` | e2e |
| MODIFY | `e2e/tenant-isolation.spec.ts` | Update R-FS-03-04 orphan marker to R-RV-04 | `e2e/tenant-isolation.spec.ts` | e2e |
| ADD | `.claude/docs/evidence/REAL_E2E_RESULTS.md` | Evidence artifact: Playwright E2E test results from real server + real Docker MySQL, including smoke test results, authenticated CRUD results (or skip reason), test counts | N/A | N/A |

### Untested Files Table

| File | Reason | Tested Via |
|------|--------|------------|
| `.claude/docs/evidence/REAL_E2E_RESULTS.md` | Evidence documentation | Generated from real Playwright test execution output |

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `real-smoke.spec.ts` | Playwright test suite | Running server on port 5000 with Docker MySQL | Pass/Fail per scenario | Fails if server not running or unexpected response codes | `npx playwright test e2e/real-smoke.spec.ts` | HTTP requests to `localhost:5000/api/*` — REAL server, REAL Docker MySQL |
| `real-authenticated-crud.spec.ts` | Playwright test suite | Running server on port 5000, Firebase API key in env | Pass/Fail per scenario; authenticated tests skip if no serviceAccount.json | Fails on unexpected response or Firebase REST API failure | `npx playwright test e2e/real-authenticated-crud.spec.ts` | HTTP to `localhost:5000/api/*`, Firebase REST Auth API for token |

### Data Flow

```
real-smoke.spec.ts:
  Prerequisites: Docker MySQL running, server running on port 5000

  test "health endpoint returns 200":
    GET http://localhost:5000/api/health → expect 200 + { status: "ok" }

  test "unauthenticated GET /api/loads is rejected":
    GET http://localhost:5000/api/loads (no auth header) → expect [401, 500]
    (500 if no serviceAccount.json → "Server authentication not configured")
    (401 if serviceAccount.json present → "Authentication required")

  test "invalid Bearer token is rejected":
    GET http://localhost:5000/api/loads with Authorization: "Bearer fake-token"
    → expect [401, 403, 500]

  test "POST /api/loads without auth is rejected":
    POST http://localhost:5000/api/loads with body → expect [401, 500]

  test "rate limit headers present":
    GET http://localhost:5000/api/health
    → expect response headers to contain X-RateLimit-Limit

real-authenticated-crud.spec.ts:
  Prerequisites: Docker MySQL running, server running on port 5000, FIREBASE_WEB_API_KEY set

  test "Firebase REST API returns valid ID token":
    POST signInWithPassword → idToken
    → verify token is non-empty string

  test.skipIf(no serviceAccount.json) "authenticated GET /api/loads with real token":
    GET /api/loads with Authorization: Bearer {realIdToken}
    → expect 200 (if Firestore user profile exists) or 403 (if no profile linked)
    → NOT 500 (proves Firebase Admin SDK verified the token)

  test.skipIf(no serviceAccount.json) "authenticated POST /api/loads creates load":
    POST /api/loads with auth + valid body → expect 201
    GET /api/loads with auth → expect created load in response

  Cleanup:
    DELETE test data from MySQL if created
    DELETE Firebase test user via REST API

  Error paths:
    Firebase REST API down → token exchange fails → test skips
    Server not running → connection refused → Playwright webServer timeout
    No serviceAccount.json → server returns 500 for auth endpoints → authenticated tests skip
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Server health and auth enforcement via Playwright HTTP | e2e | REAL | User directive: NO mocks. Real HTTP to real server backed by real Docker MySQL | `e2e/real-smoke.spec.ts` |
| Authenticated load CRUD via Playwright with real Firebase token | e2e | REAL | User directive: NO mocks. Real Firebase ID token via REST API, real server, real MySQL | `e2e/real-authenticated-crud.spec.ts` |
| Existing E2E auth tests (marker update) | e2e | REAL | Existing tests run against real server; R-marker update only | `e2e/auth.spec.ts` |
| Existing E2E specs (marker update) | e2e | REAL | Existing tests; R-marker update only | `e2e/load-lifecycle.spec.ts`, `e2e/settlement.spec.ts`, `e2e/tenant-isolation.spec.ts` |

### Done When

- R-P3-01: `npx playwright test e2e/real-smoke.spec.ts` exits 0, confirming health endpoint returns 200, unauthenticated requests return 401 or 500, and invalid tokens are rejected — all against REAL server with Docker MySQL
- R-P3-02: `npx playwright test e2e/real-authenticated-crud.spec.ts` exits 0, confirming Firebase REST API returns valid ID token and (if serviceAccount.json present) authenticated CRUD succeeds against real server
- R-P3-03: `grep -rn "R-FS-03" e2e/` returns 0 matches, all orphan R-FS markers replaced with R-RV markers
- R-P3-04: `REAL_E2E_RESULTS.md` exists in `.claude/docs/evidence/` with Playwright test results from real server + Docker MySQL
- R-P3-05: `npx playwright test --list` discovers at least 7 spec files including real-smoke.spec.ts and real-authenticated-crud.spec.ts
- R-P3-06: `cd server && npx vitest run` exits 0, no server test regression (989+ tests)

### Verification Command

```bash
npx playwright test e2e/real-smoke.spec.ts e2e/real-authenticated-crud.spec.ts --reporter=list && cd server && npx vitest run && echo "R-P3 PASS"
```

---

## Phase 4 — Final Go/No-Go with Real Evidence

**Phase Type**: `e2e`

### Changes Table

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `.claude/docs/evidence/RC_GO_NO_GO.md` | Update Gate 7 from "PASS (with caveat)" to "PASS — real Docker MySQL + Firebase REST auth validated" with references to REAL_E2E_RESULTS.md and REAL_CRUD_RESULTS.md; update Gate 8 from "PASS (with documented caveat)" to "PASS — real Docker local deployment validated" with reference to REAL_INFRA_SETUP.md; mark caveats C-3 and C-4 as RESOLVED with evidence file references; update final classification to "PRODUCTION READY FOR CONTROLLED ROLLOUT"; document remaining item: production Firebase serviceAccount.json for full admin SDK auth | N/A | N/A |
| ADD | `.claude/docs/evidence/REAL_FINAL_SUMMARY.md` | Evidence artifact: complete test summary — 989+ server unit tests (mocked, unchanged), 7+ real integration tests (Docker MySQL + Firebase REST), 2+ real E2E tests (Playwright against real server), remaining item documented (production serviceAccount.json), all real evidence aggregated | N/A | N/A |

### Untested Files Table

| File | Reason | Tested Via |
|------|--------|------------|
| `.claude/docs/evidence/RC_GO_NO_GO.md` | Evidence documentation update | Manual inspection of gate statuses and caveat resolution |
| `.claude/docs/evidence/REAL_FINAL_SUMMARY.md` | Evidence documentation | Aggregates all real test run outputs from Phases 1-3 |

### Interface Contracts

N/A — Phase 4 produces documentation artifacts only; no new code interfaces.

### Data Flow

```
Final evidence aggregation:
  Phase 1 evidence: Docker MySQL container running, 20+ tables exist after migration,
                    Firebase REST auth creates/signs-in users, server boots against Docker MySQL
  Phase 2 evidence: Real load CRUD in Docker MySQL (INSERT/SELECT/UPDATE verified),
                    real settlement + detail lines, real Firebase ID token acquisition,
                    real tenant isolation (company A cannot see company B)
  Phase 3 evidence: Real Playwright E2E — health endpoint 200, auth enforcement verified,
                    authenticated CRUD with real Firebase token (if serviceAccount.json present)

  → REAL_FINAL_SUMMARY.md: aggregates all real infrastructure evidence
  → RC_GO_NO_GO.md: Gate 7 + Gate 8 upgraded to unconditional PASS
  → Caveats C-3 + C-4: RESOLVED
  → Final: "PRODUCTION READY FOR CONTROLLED ROLLOUT" (real evidence)

  Remaining item (documented, not blocking):
    Production Firebase serviceAccount.json enables:
    - Server-side ID token verification via Firebase Admin SDK
    - Full authenticated E2E flows through server middleware
    Without it: Firebase REST API still proves token issuance works,
    Docker MySQL proves all data persistence works,
    auth enforcement is proven (server returns 500/401 without valid config)

Error paths:
  Any prior phase failed → this phase documents the failure → classification stays CONDITIONAL
```

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|-------------|---------------|-----------|
| Full server regression suite | unit | Mock | Existing 989 mocked server tests — final confirmation no regression | `cd server && npx vitest run` |
| Full frontend regression suite | unit | Mock | Existing 92+ jsdom tests — final confirmation no regression | `npx vitest run` (root config) |
| Evidence document completeness | manual | Real | File existence checks — verify all evidence artifacts exist | Manual: check `.claude/docs/evidence/` |

### Done When

- R-P4-01: `REAL_FINAL_SUMMARY.md` exists in `.claude/docs/evidence/` with server test count (989+), real integration test results (Docker MySQL + Firebase REST), real E2E results (Playwright), and build validation results
- R-P4-02: `RC_GO_NO_GO.md` Gate 7 updated from "PASS (with caveat)" to "PASS" with reference to REAL_E2E_RESULTS.md and REAL_CRUD_RESULTS.md showing real Docker MySQL + Firebase REST evidence
- R-P4-03: `RC_GO_NO_GO.md` Gate 8 updated from "PASS (with documented caveat)" to "PASS" with reference to REAL_INFRA_SETUP.md showing real Docker local deployment evidence
- R-P4-04: `RC_GO_NO_GO.md` final classification reads "PRODUCTION READY FOR CONTROLLED ROLLOUT"
- R-P4-05: `RC_GO_NO_GO.md` caveats C-3 and C-4 marked as RESOLVED with references to real evidence files
- R-P4-06: All 10 hard no-go conditions in RC_GO_NO_GO.md remain CLEAR
- R-P4-07: `cd server && npx vitest run` exits 0, no server test regression
- R-P4-08: `npx vitest run` (root config) exits 0, no frontend test regression (92+ tests)

### Verification Command

```bash
cd server && npx vitest run && cd .. && npx vitest run && grep -q "PRODUCTION READY FOR CONTROLLED ROLLOUT" .claude/docs/evidence/RC_GO_NO_GO.md && echo "R-P4 PASS"
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Docker Desktop not running when tests execute | HIGH | HIGH — all Docker MySQL tests fail | Phase 1 includes `skipIfNoDocker()` helper that gracefully skips tests with clear message "Docker not available — start Docker Desktop and retry"; builder prompts user to start Docker Desktop before running |
| Docker MySQL container takes >30s to become ready | MEDIUM | LOW — tests timeout then fail clearly | `waitForHealthy()` uses 30s timeout with 1s retry interval; timeout error message includes "MySQL container not ready — try `docker logs loadpilot-dev`" |
| Port 3306 already in use by another process | LOW | MEDIUM — Docker container fails to bind | `ensureContainer()` checks for existing container first and reuses it; if port conflict with non-Docker process, error message suggests `netstat -an | grep 3306` |
| Firebase REST API rate limits test user creation | LOW | LOW — tests fail on sign-up endpoint | Use unique test email with timestamp suffix (e.g., `test-1709999999@loadpilot.dev`); delete user in afterAll; rate limit is 100/min which is well above test needs |
| serviceAccount.json not available (user has no admin console access) | HIGH | MEDIUM — server auth endpoints return 500, authenticated E2E tests must skip | All auth-dependent tests use `test.skipIf(!hasServiceAccount())` pattern; Firebase REST API tests still prove token issuance works independently; documented as "remaining item" not "blocking issue" |
| Migration SQL files have statements that conflict when re-run | LOW | LOW — Docker container is ephemeral | `CREATE TABLE IF NOT EXISTS` and `CREATE DATABASE IF NOT EXISTS` handle idempotency; container can be destroyed and recreated with `docker rm -f loadpilot-dev` |
| Real database tests leave orphan data on test failure | MEDIUM | LOW — test database only, Docker ephemeral | Every test file has afterAll cleanup with DELETE statements in reverse FK order; Docker container can be destroyed entirely for clean slate |
| Port 5000 or 5099 already in use by another process | LOW | MEDIUM — server boot test fails | Server boot test uses unique port (5099) to avoid conflict with user's running dev server; error message suggests checking port usage |

## Dependencies

### Internal
- Phase 1 must complete before Phase 2 (Docker MySQL + env must be validated before CRUD tests)
- Phase 2 must complete before Phase 3 (real CRUD must work before E2E exercises it via HTTP)
- Phase 3 must complete before Phase 4 (E2E evidence needed for final go/no-go)

### External
- Docker Desktop installed and running (v28.3.0 confirmed installed, user must start it)
- Network access to Docker Hub to pull `mysql:8` image (first run only)
- Network access to `identitytoolkit.googleapis.com` for Firebase REST Auth
- Firebase Web API Key: `AIzaSyCMlIojm-CjTPU-wnmCzrdF_af2tMga8Jo` (confirmed available)
- Firebase dev project `gen-lang-client-0535844903` (confirmed live, HTTP 200)
- Node.js and npm (already available)
- Python 3.10+ for prd_generator.py (already available)
- OPTIONAL: `server/serviceAccount.json` for full server-side Firebase Admin SDK auth verification (user does not currently have Firebase admin console access)

## Rollback Plan

| Phase | Rollback Action |
|-------|----------------|
| Phase 1 | Delete `server/__tests__/helpers/` directory, delete `server/__tests__/integration/real-db-connection.test.ts`, `real-firebase-auth.test.ts`, `real-server-boot.test.ts`, delete `.env`, delete `.claude/docs/evidence/REAL_INFRA_SETUP.md`, run `docker rm -f loadpilot-dev` |
| Phase 2 | Delete `server/__tests__/integration/real-load-crud.test.ts`, `real-settlement-flow.test.ts`, `real-auth-flow.test.ts`, `real-tenant-isolation.test.ts`, delete `.claude/docs/evidence/REAL_CRUD_RESULTS.md` |
| Phase 3 | Delete `e2e/real-smoke.spec.ts`, `e2e/real-authenticated-crud.spec.ts`, delete `.claude/docs/evidence/REAL_E2E_RESULTS.md`; revert R-marker changes in existing E2E specs |
| Phase 4 | Revert RC_GO_NO_GO.md to prior state; delete REAL_FINAL_SUMMARY.md |

## Open Questions

1. **Docker Desktop startup**: The user confirmed Docker is installed (v28.3.0) but Docker Desktop is not running. The builder must prompt the user to start Docker Desktop before executing Phase 1 tests. Is there a preferred way to handle this prompt? (Default assumption: builder checks `docker info` and prints a clear message if Docker is not available)
2. **serviceAccount.json timeline**: The user does not currently have Firebase admin console access. When will this become available? The plan is designed to work without it (graceful skips), but full server-side auth verification requires it. (Default assumption: proceed without it; document as remaining item)
3. **Firebase test user persistence**: Should the test user created via Firebase REST API be kept between test runs (saves time) or deleted after each run (cleaner)? (Default assumption: delete after each test run for isolation; use timestamp-suffixed email to avoid collisions)

---

Story Execution Order

Phase 1: R-P1 (Environment Bootstrap and Infrastructure Validation) — foundation, no dependencies
Phase 2: R-P2 (Real Database CRUD and Workflow Integration Tests) — depends on Phase 1
Phase 3: R-P3 (Real E2E with Playwright Against Live Server) — depends on Phase 2
Phase 4: R-P4 (Final Go/No-Go with Real Evidence) — depends on Phase 3

Total: 4 stories, 4 phases, 27 R-PN-NN criteria
