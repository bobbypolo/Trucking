# Playwright Environment Status

Date: 2026-03-11
Audit stage reached: Stage 1 rerun after live local auth/runtime closure
Overall environment status: PASS

## Runtime used

| Item | Expected | Actual | Status | Evidence |
| --- | --- | --- | --- | --- |
| Frontend URL | Local Vite dev app | `http://127.0.0.1:4173/` | PASS | Live HTTP 200 during browser validation |
| Backend URL | Local API | `http://127.0.0.1:5000/api` | PASS | `GET /api/health` returned `{"status":"ok","message":"LoadPilot API is running","database":"MySQL + Firebase"}` |
| Dev database | Local MySQL dev DB | Docker MySQL `loadpilot-dev`, DB `trucklogix` on `127.0.0.1:3306` | PASS | Live MySQL probe succeeded; schema applied with runtime-required tables present |
| Auth mode | Real Firebase client auth and backend token verification | Real Firebase Email/Password auth + backend Firebase Admin verification | PASS | Firebase sign-in for `test123@test.com` succeeded; backend accepted the real token |
| `DEMO_MODE` | OFF | OFF | PASS | Real Vite Firebase config present in `.env`; browser login used the live path |
| Test credentials | Real local/dev test user | `test123@test.com / Test123` | PASS | Firebase Identity Toolkit returned a real ID token |
| Tenant/company | Real backend-resolved tenant | SQL user `live-test123-001` on `dev-company-001` | PASS | `/api/auth/login` returned 200 with resolved SQL user and company ID |

## Exact findings

### Frontend

- Root `.env` contains the live Vite Firebase config and `VITE_API_URL=http://localhost:5000/api`.
- The browser login page loaded on `http://127.0.0.1:4173/`.
- Real UI login with `test123@test.com / Test123` succeeded.
- The protected shell loaded with `Unified Command Center` visible.
- Screenshot evidence saved as `live-frontend-auth-success-2026-03-11T21-38-22-990Z.png`.

### Backend

- `server/.env` contains:
  - `DB_HOST=127.0.0.1`
  - `DB_PORT=3306`
  - `DB_PASSWORD=root`
  - `FIREBASE_PROJECT_ID=gen-lang-client-0535844903`
  - `GOOGLE_APPLICATION_CREDENTIALS` configured for the project-local Firebase Admin JSON
- Backend booted locally and served `/api/health`.
- Firebase Admin initialized successfully from application default credentials using `GOOGLE_APPLICATION_CREDENTIALS`.
- Real backend auth checks after the schema fix:
  - `POST /api/users` returned `201`
  - `POST /api/auth/login` returned `200`
  - `GET /api/users/me` returned `200`
  - invalid token on `GET /api/users/me` returned `401`

### Database

- Local MySQL is reachable on `127.0.0.1:3306`.
- `trucklogix` contains the runtime-required schema, including `users.firebase_uid` and the live-fix `users.phone` column.
- Live SQL linkage for the authenticated Firebase user is present:
  - email: `test123@test.com`
  - firebase UID: `2DILtuoO1KV1YuQzKRj0jcMta3F2`
  - SQL user id: `live-test123-001`
  - company id: `dev-company-001`

## Auth / session evidence

### Real Firebase credential proof

- Direct Firebase REST sign-in succeeded for:
  - `test123@test.com / Test123`
- Result:
  - real `idToken` returned
  - Firebase UID: `2DILtuoO1KV1YuQzKRj0jcMta3F2`
  - Firebase project confirmed live: `gen-lang-client-0535844903`

### Backend auth proof

- Negative control without token:
  - protected route returned missing-auth / invalid-auth failure
- Real-token checks:
  - `POST /api/auth/login` returned `200`
  - `GET /api/users/me` returned `200`
  - invalid token returned `401`

### UI auth proof

- Browser-visible result:
  - login page submitted real Firebase credentials
  - authenticated shell loaded
  - visible user label: `Test123 User`
  - visible role label: `admin`
  - visible workspace label: `Unified Command Center`
- Network/API proof from the browser session:
  - `POST http://localhost:5000/api/auth/login` → `200`
  - `GET http://localhost:5000/api/users/me` → `200`

## Required services

| Service | Required | Running during validation | Notes |
| --- | --- | --- | --- |
| Vite frontend | Yes | Yes | Served on `4173` during browser validation |
| API backend | Yes | Yes | Health endpoint and protected routes responded |
| MySQL / dev DB | Yes | Yes | Local Docker DB reachable |
| Firebase client auth config | Yes | Yes | Vite Firebase vars present and used |
| Firebase Admin credentials | Yes | Yes | Provided through `GOOGLE_APPLICATION_CREDENTIALS` |

## Stage 1 verdict

Stage 1 passed.

Why it passes:

1. Real Firebase Email/Password sign-in succeeded against the configured project.
2. The local backend verified the real token with Firebase Admin and resolved the SQL principal by `firebase_uid`.
3. The browser login reached the protected shell on the live local frontend + backend + DB stack.
4. The schema/runtime defect exposed by live validation (`users.phone` missing) was fixed via `server/migrations/015_add_users_phone.sql`.

Residual non-blocking caveat:

- `exception_management.sql` still emits parse warnings in the migration runner. This did not block auth/runtime closure, but it should be cleaned up before making broader rollout-hardening claims.
