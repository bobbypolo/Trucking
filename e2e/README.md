# E2E Test Environment

Playwright-based end-to-end tests for LoadPilot. Tests are organized into four execution modes depending on available credentials and infrastructure.

## Execution Modes

| Mode | Name | Credentials Required | Approx. Tests | Use Case |
|------|------|---------------------|---------------|----------|
| A | API-only | None | ~135 | CI default, no Firebase creds |
| B | API + Firebase | Firebase Web API key + test user creds | ~270 | Authenticated API testing |
| C | Full UI | All of B + `E2E_SERVER_RUNNING=1` | ~50 browser tests | Full browser interaction |
| D | Auth Emulator | `FIREBASE_AUTH_EMULATOR_HOST` | ~10 lifecycle tests | Auth flow isolation |

Tests that require credentials unavailable in the current mode are automatically skipped.

## Environment Variables by Mode

### Mode A (CI default)

No environment variables required. The Playwright config starts the Express server automatically. Unauthenticated API endpoint tests run; authenticated tests skip.

### Mode B (API + Firebase)

| Variable | Description |
|----------|-------------|
| `FIREBASE_WEB_API_KEY` | Firebase project web API key |
| `E2E_ADMIN_EMAIL` | Admin test user email |
| `E2E_ADMIN_PASSWORD` | Admin test user password |
| `E2E_DISPATCHER_EMAIL` | Dispatcher test user email |
| `E2E_DISPATCHER_PASSWORD` | Dispatcher test user password |
| `E2E_DRIVER_EMAIL` | Driver test user email |
| `E2E_DRIVER_PASSWORD` | Driver test user password |

### Mode C (Full UI)

All Mode B variables plus:

| Variable | Description |
|----------|-------------|
| `E2E_SERVER_RUNNING` | Set to `1` to enable Vite dev server alongside Express |

### Mode D (Auth Emulator)

| Variable | Description |
|----------|-------------|
| `FIREBASE_AUTH_EMULATOR_HOST` | Emulator address, typically `localhost:9099` |

## Commands

```bash
# Mode A (CI default) -- API-only, no credentials needed
npx playwright test

# Mode B -- API + Firebase authenticated tests
FIREBASE_WEB_API_KEY=xxx \
E2E_ADMIN_EMAIL=admin@test.com E2E_ADMIN_PASSWORD=secret \
E2E_DISPATCHER_EMAIL=dispatch@test.com E2E_DISPATCHER_PASSWORD=secret \
E2E_DRIVER_EMAIL=driver@test.com E2E_DRIVER_PASSWORD=secret \
npx playwright test

# Mode C -- Full UI (browser + API + Firebase)
E2E_SERVER_RUNNING=1 \
FIREBASE_WEB_API_KEY=xxx \
E2E_ADMIN_EMAIL=admin@test.com E2E_ADMIN_PASSWORD=secret \
npx playwright test

# Mode D -- Auth emulator lifecycle tests
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
npx playwright test e2e/auth-lifecycle.spec.ts
```

On Windows (cmd), set variables with `set VAR=value` before the command, or use a `.env` file.

## Skip Expectations

| Mode | What runs | What skips |
|------|-----------|------------|
| A | Health checks, public API endpoints, schema validation, unauthenticated routes | All authenticated CRUD, UI interaction, auth lifecycle |
| B | All of A + authenticated API CRUD, role-based access, tenant isolation | UI interaction tests, browser rendering |
| C | All of B + browser navigation, form submission, UI rendering | Auth emulator tests |
| D | Auth signup/login/token-refresh lifecycle | Everything else |

## Canonical URLs

| Service | Default URL | Override Variable |
|---------|------------|-------------------|
| API (Express) | `http://localhost:5000` | `E2E_API_URL` |
| App (Vite) | `http://localhost:3101` | `E2E_APP_URL` |

The Playwright config (`playwright.config.ts`) uses `baseURL: http://localhost:3101` and starts the Express server on port 5000 automatically. Override `PORT` to change the Express port.

A `e2e/fixtures/urls.ts` module will centralize these URLs once the fixture layer is complete.

## CI Integration

The `e2e-api-smoke` job in `.github/workflows/ci.yml` runs Mode A after server and frontend tests pass. It installs Playwright Chromium, sets minimal env vars (`PORT`, `NODE_ENV`, `JWT_SECRET`, `FIREBASE_SERVICE_ACCOUNT`), and runs `npx playwright test`.

## Adding New Tests

1. Create a `*.spec.ts` file in `e2e/`
2. Use `test.skip()` with environment checks for tests requiring credentials not available in all modes
3. Use fixtures from `e2e/fixtures/` for test data and auth helpers
4. Run `npx playwright test --list` to verify test discovery
