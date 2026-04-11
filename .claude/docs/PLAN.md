# Sprint F — Push Notifications Foundation + Driver Profile + Settings

> **Active sprint plan.** Full program roadmap: `docs/PLAN-trucker-app-master.md`
>
> This file contains ONLY the Sprint F execution contract. After F merges,
> the handoff script replaces this file with Sprint G's contract.

## Context

Sprints A–E shipped the SaaS baseline, infrastructure hardening, mobile
bootstrap, trip workspace, document capture, and offline queue. PR #69
merged on 2026-04-11.

Sprint F is the **driver identity + notification plumbing** sprint. It
adds the end-to-end Expo push pipeline that every future real-time
feature depends on (messaging, GPS alerts, load-assignment pings),
replaces the Profile tab placeholder with a real screen, and adds a
complete Settings screen with notification preferences, sign-out, and
version display.

**Target branch**: `mobile/trucker-app`
**Feature branch**: `ralph/trucker-app-sprint-f` cut from `mobile/trucker-app@c59f8b1`

## Goal

Ship a production-ready Expo Push pipeline end-to-end, including the
reliability work that makes it safe to run in production:

1. Mobile permission + token retrieval (with EAS projectId) → server
   registration → trigger hooks inside `POST /api/loads` (create),
   `PATCH /api/loads/:id` (reassignment — new in this sprint),
   and `PATCH /api/loads/:id/status` (dispatcher update) → delivery via
   Expo Push API → mobile tap handler that deep-links into
   `/loads/[id]`.
2. **Token rotation handling** — Expo rotates push tokens periodically;
   the mobile app listens for rotation and re-registers the new token
   so delivery never silently breaks.
3. **Logout cleanup** — on driver sign-out, the device's token is
   unregistered so a subsequent driver on the same device does not
   receive the previous driver's notifications (privacy + correctness).
4. Real driver profile screen backed by new `GET/PATCH /api/drivers/me`
   endpoints.
5. Complete Settings screen (notification category toggles persisted
   to AsyncStorage, sign-out with confirmation, app version display).

## Locked decisions

1. **Expo Push API** is the sender. Calls `https://exp.host/--/api/v2/push/send` over HTTPS from the server. No direct FCM/APNs, no `EXPO_ACCESS_TOKEN`.
2. **Mobile test pattern**: static `scripts/verify-*.cjs` scripts reading production files via `fs.readFileSync` + regex (matching Sprint C+D+E). No new test runner added to `apps/trucker/`.
3. **Server test pattern**: Vitest + supertest, mocking at architectural boundaries ONLY (`vi.mock("../db")` for `pool`, `vi.mock("../lib/expo-push")` for `sendPush` when testing a consumer). This matches the established project convention in `server/__tests__/helpers/route-test-setup.ts` which the team built explicitly for this purpose. No test self-mocks the function under test (Precedence Rule 4). CI has a real MySQL service reserved for smoke tests, not unit tests — deliberately so, to keep unit tests fast and isolated.
4. **Migration number**: `055_push_tokens.sql`.
5. **Driver profile data source**: reuse `users` table — no schema change. `PATCH /api/drivers/me` allows self-editing of `phone` only; hard-coded single-column `UPDATE users SET phone = ?` prevents privilege escalation.
6. **Settings storage**: notification prefs in `AsyncStorage` keyed by `"@loadpilot/notification-prefs"`. Server not involved.
7. **Navigation**: Settings is a Stack route at `app/settings.tsx` navigated from Profile. NO 5th tab.
8. **Token lifecycle** (reliability model):
   - Registered on successful login via `AuthContext` useEffect.
   - A rotation listener (`attachTokenRefreshListener`) re-registers automatically if Expo rotates the token.
   - Logout calls `unregisterPushToken(currentToken)` BEFORE Firebase `signOut()` so the device's specific token is marked disabled on the server — this prevents cross-driver notification bleed when a second driver signs in on the same device.
9. **Load creation trigger**: fires inside `POST /api/loads` handler (line 167). Hook is "new load created with `driver_id` set, and caller is NOT that driver".
10. **Load reassignment trigger**: fires inside `PATCH /api/loads/:id` partial-update handler (line 358). Sprint F adds `driver_id` to this handler's allowlist. Hook is "PATCH changed `driver_id` from `A` to `B` (distinct), and caller is NOT `B`".
11. **Status update trigger**: fires inside `PATCH /api/loads/:id/status` handler (line 479). Hook is "transition succeeded AND load has a `driver_id` AND `req.user.id !== load.driver_id`".
12. **Self-ping prevention**: all three triggers use identity comparison `req.user.id !== load.driver_id` rather than role checks, because `loads.ts` has no role gate (the SaaS design is role-agnostic transitions).
13. **Notification body format**: `${load_number} — ${pickup_city} to ${dropoff_city}`. `load_number` from `loads` row; pickup/dropoff city from a JOIN on `load_legs` (first Pickup leg, last Dropoff leg ordered by `sequence_order`).
14. **DB access**: `import pool from "../db"`. Query pattern: `await pool.query<RowDataPacket[]>(sql, params)` with `?` placeholders.
15. **`expo-router`**: `useRouter()` hook (consistent with `login.tsx`, `LoadCard.tsx`). Do NOT use the global `import { router }` form.
16. **Expo projectId**: `getExpoPushTokenAsync` in SDK 55 requires a `{ projectId }` argument. Read from `Constants.expoConfig?.extra?.eas?.projectId`. `app.json` adds the key as a placeholder `"PLACEHOLDER-SET-VIA-EAS"`; an operator release-checklist row requires replacing it with the real EAS project id before store submission.
17. **Operator gates**: real APNs/FCM device delivery on physical devices, EAS project linking (replacing the placeholder), app-store push entitlement review are release-checklist rows, NOT Ralph R-markers.

## System Context

### Files Read

| File | Lines | Key Findings |
|------|------:|--------------|
| `apps/trucker/src/app/(tabs)/profile.tsx` | 29 | Placeholder — safe to rewrite entirely |
| `apps/trucker/src/app/(tabs)/_layout.tsx` | 27 | 4 tabs. Untouched this sprint. |
| `apps/trucker/src/app/_layout.tsx` | — | Uses `Slot`, `Redirect`, `useSegments` from `expo-router`. MODIFY target for Phase 8 (push listener) and Phase 11 (Stack.Screen settings) — both additive. |
| `apps/trucker/src/contexts/AuthContext.tsx` | 117 | Exports `AuthProvider`, `useAuth`. MODIFY target for token registration, rotation listener, and logout cleanup. |
| `apps/trucker/src/services/api.ts` | 152 | Typed wrapper over `fetch`; `api.get/post/put/patch/delete/uploadFile`. |
| `apps/trucker/app.json` | 40 | Has `expo-camera` plugin. Needs `expo-notifications` plugin + `extra.eas.projectId` key. |
| `apps/trucker/package.json` | — | Has `expo@~55.0.0`, `expo-constants@~17.1.0`, `@react-native-async-storage/async-storage@~2.1.0`. Needs `expo-notifications@~0.31.0`. |
| `apps/trucker/src/components/LoadCard.tsx` | — | Uses `useRouter()` hook pattern (canonical). |
| `server/routes/loads.ts` | 970+ | `import pool from "../db"` (line 9). `POST /api/loads` @167 creates a load with `driver_id` (line 221) via `REPLACE INTO`. `PATCH /api/loads/:id` @358 is a partial-update handler that currently does NOT accept `driver_id` — Sprint F Phase 6 adds it to the allowlist. `PATCH /api/loads/:id/status` @479 calls `loadService.transitionLoad(loadId, status, companyId, userId)`. `load_legs` stores stops with `type` ENUM (Pickup/Dropoff). |
| `server/routes/users.ts` | 150+ | Pattern: `router.METHOD("/api/path", requireAuth, requireTenant, validateBody(schema), handler)`. |
| `server/routes/feature-flags.ts` | 100 | Reference pattern (no requireTenant, just requireAuth + db). |
| `server/middleware/requireAuth.ts` | 148 | Sets `req.user` with `{id, uid, tenantId, companyId, role, email, firebaseUid}`. |
| `server/index.ts` | — | 39 route imports mounted via `app.use(...)`. |
| `server/migrations/015_add_users_phone.sql` | — | Confirms `users.phone` exists. |
| `server/migrations/054_feature_flags.sql` | — | Latest existing migration. |
| `server/__tests__/helpers/route-test-setup.ts` | — | **The project's canonical mock-boundary helper.** Explicitly documents `vi.mock("../../db")` + `vi.mock("../../middleware/requireAuth")` as the established pattern. All new route tests in this sprint use this helper. |
| `server/__tests__/routes/loads-partial-update.test.ts` | — | Reference pattern for testing `loads.ts` mutations. |
| `.github/workflows/ci.yml` | — | Has a MySQL 8.0 service (line 212) for smoke tests. Unit tests use the mocked pattern, not this service. |
| `scripts/verify-trip-workspace.cjs` | — | Canonical `.cjs` verification pattern. |

### Data Flow Diagram

```
┌──────────────────── MOBILE (apps/trucker) ────────────────────┐
│                                                                 │
│  LOGIN:    AuthContext.useEffect([isAuthenticated])            │
│              ─> requestPushPermissions()                        │
│              ─> getPushToken({projectId})                       │
│              ─> registerPushToken(token, platform)              │
│              ─> attachTokenRefreshListener(onRotated)           │
│                                                                 │
│  ROTATION: onRotated(newToken) ─> registerPushToken(…)         │
│                                                                 │
│  LOGOUT:   logout() ─> unregisterPushToken(currentToken)       │
│              ─> Firebase signOut()                              │
│                                                                 │
│  TAP:      Notifications.addNotificationResponseReceived...    │
│              ─> router.push(`/loads/${data.loadId}`)            │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         │ api.post("/push-tokens", …)
                         │ api.post("/push-tokens/unregister", {token})
                         ▼
┌──────────────────── SERVER (server/) ────────────────────────┐
│                                                                 │
│  POST   /api/push-tokens         ─> INSERT/UPSERT enabled=1    │
│  POST   /api/push-tokens/unregister ─> UPDATE enabled=0        │
│                                                                 │
│         push_tokens (MySQL)                                     │
│                   ▲                                             │
│                   │                                             │
│  POST /api/loads           (on commit, driver_id set,          │
│                             caller != driver_id)               │
│  PATCH /api/loads/:id      (driver_id changed,                 │
│                             new driver != caller)              │
│  PATCH /api/loads/:id/status (role-agnostic,                   │
│                               caller != driver)                 │
│                   │                                             │
│                   ▼                                             │
│  server/lib/expo-push.ts  sendPush()                            │
│     batch 100 ─> fetch "https://exp.host/--/api/v2/push/send"  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
                [Expo Push → FCM/APNs → device]
```

### Existing Patterns

- **Server route**: `router.METHOD("/api/path", requireAuth, requireTenant, validateBody(schema), async (req: AuthenticatedRequest, res, next) => {...})`. Errors via `next(error)`.
- **Server DB**: `import pool from "../db"` then `await pool.query<RowDataPacket[]>(sql, params)` with `?` placeholders.
- **Server logging**: `const log = createRequestLogger(req, "METHOD /api/path")`.
- **Server tests**: via `route-test-setup.ts` helper — `vi.hoisted({mockQuery})` + `vi.mock("../../db", () => ({default: {query: mockQuery}}))` + `vi.mock("../../middleware/requireAuth")`. Boundary mocking only; never self-mocks handlers.
- **Mobile API call**: `import api from "../services/api"; await api.post<T>("/path", body)`.
- **Mobile router**: `const router = useRouter(); router.push("/loads/123")`.
- **Mobile verification**: `scripts/verify-*.cjs` in repo root, `fs.readFileSync` + regex, exits non-zero on failure.

### API Contracts

Sprint F adds four new endpoints and extends three EXISTING `loads.ts` handlers with side-effects (push notifications). Request/response schemas:

| Method | Path | Auth | Request Body | 2xx Response | Errors |
|--------|------|------|--------------|--------------|--------|
| POST | `/api/push-tokens` | requireAuth | `{token: string, platform: "ios" \| "android"}` | `201 {id}` | `400` missing token; `401` |
| POST | `/api/push-tokens/unregister` | requireAuth | `{token: string}` | `204` empty body | `400` missing token; `401` |
| GET | `/api/drivers/me` | requireAuth | none | `200 {id, name, email, phone, role, companyId}` | `401`; `404` user row missing |
| PATCH | `/api/drivers/me` | requireAuth | `{phone: string}` | `200 {id, phone}` | `400` invalid phone; `401` |
| POST | `/api/loads` **(EXISTING, additively extended)** | requireAuth + requireTenant | existing `createLoadSchema` | existing `201 {message}` | existing; push errors logged |
| PATCH | `/api/loads/:id` **(EXISTING, additively extended)** | requireAuth + requireTenant | existing `partialUpdateLoadSchema` **+ new `driver_id` field** | existing response | existing; push errors logged |
| PATCH | `/api/loads/:id/status` **(EXISTING, additively extended)** | requireAuth + requireTenant | existing `updateLoadStatusSchema` | existing response | existing; push errors logged |

### Blast Radius Assessment

| Area | Action | Risk |
|------|--------|------|
| `apps/trucker/package.json` | ADD `expo-notifications@~0.31.0` | LOW |
| `apps/trucker/app.json` | MODIFY — plugin + `extra.eas.projectId` placeholder | LOW |
| `apps/trucker/src/services/pushNotifications.ts` | NEW — all 5 functions in a single file (requestPermissions, getToken, register, unregister, attachTokenRefreshListener, attachNotificationResponseHandler) | LOW |
| `apps/trucker/src/contexts/AuthContext.tsx` | MODIFY — useEffect for register + rotation listener + logout cleanup | MEDIUM |
| `apps/trucker/src/app/_layout.tsx` | MODIFY — push response listener useEffect + Stack.Screen for settings | LOW |
| `apps/trucker/src/app/(tabs)/profile.tsx` | REWRITE placeholder | LOW |
| `apps/trucker/src/types/driver.ts` | NEW | LOW |
| `apps/trucker/src/app/settings.tsx` | NEW — complete screen (prefs + sign-out + version) | LOW |
| `server/migrations/055_push_tokens.sql` | NEW | LOW |
| `server/routes/push-tokens.ts` | NEW — POST register + POST unregister | LOW |
| `server/routes/drivers.ts` | NEW | LOW |
| `server/lib/expo-push.ts` | NEW | LOW |
| `server/routes/loads.ts` | MODIFY — push triggers in POST, PATCH, PATCH-status handlers; adds `driver_id` to partial-update allowlist | MEDIUM |
| `server/index.ts` | MODIFY — mount push-tokens and drivers routers | LOW |
| `server/schemas/loads.ts` | MODIFY — extend `partialUpdateLoadSchema` to accept `driver_id` | LOW |

### Dispatch Order (Explicit Dependencies)

Sprint F's `prd.json` is augmented with explicit compile-time import dependencies the file-overlap generator cannot detect. The DAG dispatches in 6 waves:

**Wave 1 — Foundations (parallel):**
- STORY-001 (pushNotifications service, all 5 functions) — no deps
- STORY-003 (Migration 055 push_tokens) — no deps
- STORY-004 (push-tokens routes + sendPush + mount) — no deps

**Wave 2 — First consumers:**
- STORY-002 (AuthContext wiring: login + rotation + logout cleanup) — depends on STORY-001, STORY-004
- STORY-005 (POST create trigger) — depends on STORY-003, STORY-004
- STORY-007 (mobile deep-link listener wiring) — depends on STORY-001
- STORY-008 (drivers/me endpoints) — depends on STORY-004 (server/index.ts overlap)

**Wave 3 — Trigger chain (sequential on loads.ts):**
- STORY-006 (PATCH reassignment trigger) — depends on STORY-005 (loads.ts overlap)

**Wave 4:**
- STORY-010 (status trigger) — depends on STORY-006 (loads.ts overlap) + STORY-003 + STORY-004
- STORY-009 (mobile Profile screen) — depends on STORY-008

**Wave 5:**
- STORY-011 (Settings screen + layout registration) — depends on STORY-007 + STORY-002

**Wave 6 — Sprint closer:**
- STORY-012 (combined verification + sprint history) — depends on all phases above

**Dependency rationale (compile-time):**
- STORY-002 → STORY-001: AuthContext imports 5 functions from pushNotifications.ts
- STORY-002 → STORY-004: logout calls unregisterPushToken which hits the /unregister endpoint
- STORY-005 → STORY-003/004: trigger uses push_tokens table + sendPush utility
- STORY-006 → STORY-005: sequential ownership of loads.ts modifications
- STORY-010 → STORY-006: sequential ownership of loads.ts modifications
- STORY-007 → STORY-001: _layout.tsx imports attachNotificationResponseHandler
- STORY-008 → STORY-004: both modify server/index.ts mount block
- STORY-009 → STORY-008: profile.tsx calls /drivers/me endpoint
- STORY-011 → STORY-007 + STORY-002: both touch files used by the settings screen chain
- STORY-012 → everything: combined verify script references all sub-scripts

---

## Phase 1: Expo Notifications service (complete, all 5 functions)

**Phase Type**: `foundation`

Install `expo-notifications`, configure the plugin and EAS projectId
placeholder in `app.json`, create `apps/trucker/src/services/pushNotifications.ts`
with ALL 5 public functions: `requestPushPermissions`, `getPushToken`,
`registerPushToken`, `unregisterPushToken`, `attachTokenRefreshListener`,
`attachNotificationResponseHandler`. Single-phase file ownership.

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `apps/trucker/package.json` | Add `"expo-notifications": "~0.31.0"` to `dependencies` | `scripts/verify-push-service.cjs` | unit |
| MODIFY | `apps/trucker/app.json` | Add `"expo-notifications"` plugin entry; add `"extra": { "eas": { "projectId": "PLACEHOLDER-SET-VIA-EAS" } }` | `scripts/verify-push-service.cjs` | unit |
| ADD | `apps/trucker/src/services/pushNotifications.ts` | Export 6 functions: `requestPushPermissions` (calls `requestPermissionsAsync`), `getPushToken` (reads `Constants.expoConfig?.extra?.eas?.projectId` and calls `getExpoPushTokenAsync({projectId})`), `registerPushToken(token, platform)` (calls `api.post("/push-tokens", {token, platform})`), `unregisterPushToken(token)` (calls `api.post("/push-tokens/unregister", {token})`), `attachTokenRefreshListener(callback)` (wraps `addPushTokenListener`), `attachNotificationResponseHandler(router)` (wraps `addNotificationResponseReceivedListener` and deep-links to `/loads/${loadId}`). | `scripts/verify-push-service.cjs` | unit |

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|--------------|---------------|-----------|
| package.json has `expo-notifications@~0.31.x` | unit | Real | file is the spec | `scripts/verify-push-service.cjs` |
| app.json has `expo-notifications` plugin entry | unit | Real | file is the spec | `scripts/verify-push-service.cjs` |
| app.json has `extra.eas.projectId` | unit | Real | file is the spec | `scripts/verify-push-service.cjs` |
| `requestPushPermissions` exported + calls requestPermissionsAsync | unit | Real | regex on source | `scripts/verify-push-service.cjs` |
| `getPushToken` exported + calls getExpoPushTokenAsync with projectId | unit | Real | regex | `scripts/verify-push-service.cjs` |
| `registerPushToken` exported + calls api.post("/push-tokens") | unit | Real | regex | `scripts/verify-push-service.cjs` |
| `unregisterPushToken` exported + calls api.post("/push-tokens/unregister") | unit | Real | regex | `scripts/verify-push-service.cjs` |
| `attachTokenRefreshListener` exported + calls addPushTokenListener | unit | Real | regex | `scripts/verify-push-service.cjs` |
| `attachNotificationResponseHandler` exported + calls addNotificationResponseReceivedListener | unit | Real | regex | `scripts/verify-push-service.cjs` |

### Acceptance criteria (R-markers)

- R-P1-01 [frontend] [unit]: `apps/trucker/package.json` contains `"expo-notifications"` in `dependencies` with a version string starting with `"~0.31."`; verified via `fs.readFileSync` + `JSON.parse` + `deps["expo-notifications"].startsWith("~0.31.")`.
- R-P1-02 [frontend] [unit]: `apps/trucker/app.json` plugins array contains an `"expo-notifications"` entry (bare string or array whose first element is the string); verified via `JSON.parse` + `plugins.some` predicate.
- R-P1-03 [frontend] [unit]: `apps/trucker/app.json` contains `extra.eas.projectId` as a non-empty string; verified via `typeof expo.extra.eas.projectId === "string" && length > 0`.
- R-P1-04 [frontend] [unit]: `pushNotifications.ts` exports `async function requestPushPermissions` calling `Notifications.requestPermissionsAsync`; verified via two regex matches.
- R-P1-05 [frontend] [unit]: `pushNotifications.ts` exports `async function getPushToken` that reads `Constants.expoConfig?.extra?.eas?.projectId` AND calls `Notifications.getExpoPushTokenAsync` with an object argument whose `projectId` key is set; verified via regex for both `Constants\.expoConfig\?\.extra\?\.eas\?\.projectId` and `getExpoPushTokenAsync\s*\(\s*\{\s*projectId`.
- R-P1-06 [frontend] [unit]: `pushNotifications.ts` exports `async function registerPushToken(token, platform)` calling `api.post` with the literal path `"/push-tokens"` and a body containing `token` and `platform`; verified via regex.
- R-P1-07 [frontend] [unit]: `pushNotifications.ts` exports `async function unregisterPushToken(token)` calling `api.post` with the literal path `"/push-tokens/unregister"` and a body containing `token`; verified via regex `/export\s+async\s+function\s+unregisterPushToken/` and `/api\.post\s*<[^>]*>\s*\(\s*["']\/push-tokens\/unregister["']/`.
- R-P1-08 [frontend] [unit]: `pushNotifications.ts` exports `attachTokenRefreshListener(callback)` calling `Notifications.addPushTokenListener` and passing the callback through; verified via regex `/export\s+function\s+attachTokenRefreshListener/` and `/Notifications\.addPushTokenListener\s*\(/`.
- R-P1-09 [frontend] [unit]: `pushNotifications.ts` exports `attachNotificationResponseHandler(router)` calling `Notifications.addNotificationResponseReceivedListener` and, inside the listener callback, reading `response.notification.request.content.data?.loadId` and calling `router.push` with a template literal containing `/loads/`; verified via multiline regex.

### Verification Command

```
node scripts/verify-push-service.cjs
```

---

## Phase 2: AuthContext wiring (register + rotation + logout cleanup)

**Phase Type**: `module`

Wire the full token lifecycle into `AuthContext`: on login, register the
token AND attach the rotation listener (re-register on rotation). On
logout, unregister the current token BEFORE calling Firebase signOut.
All async calls wrapped in try/catch so failure is non-fatal.

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `apps/trucker/src/contexts/AuthContext.tsx` | Import `requestPushPermissions`, `getPushToken`, `registerPushToken`, `unregisterPushToken`, `attachTokenRefreshListener` from `"../services/pushNotifications"` and `Platform` from `"react-native"`. In the provider component, store the current token in a ref `const currentTokenRef = useRef<string \| null>(null)`. Add `useEffect([isAuthenticated])`: on `true`, run `requestPushPermissions → getPushToken → registerPushToken → attachTokenRefreshListener(newToken => { currentTokenRef.current = newToken; registerPushToken(newToken, Platform.OS); })` inside a try/catch. Modify the `logout` function so that BEFORE calling `signOut(auth)`, it runs `if (currentTokenRef.current) { try { await unregisterPushToken(currentTokenRef.current); } catch (_) {} }`. | `scripts/verify-auth-push-wiring.cjs` | unit |

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|--------------|---------------|-----------|
| AuthContext imports all 5 push service functions | unit | Real | regex | `scripts/verify-auth-push-wiring.cjs` |
| AuthContext useEffect wires register + rotation listener | unit | Real | multiline regex | `scripts/verify-auth-push-wiring.cjs` |
| The useEffect chain is wrapped in try/catch | unit | Real | multiline regex | `scripts/verify-auth-push-wiring.cjs` |
| Rotation listener callback re-invokes registerPushToken with the new token | unit | Real | multiline regex | `scripts/verify-auth-push-wiring.cjs` |
| logout calls unregisterPushToken before signOut | unit | Real | multiline regex with ordering | `scripts/verify-auth-push-wiring.cjs` |

### Acceptance criteria (R-markers)

- R-P2-01 [frontend] [unit]: `AuthContext.tsx` imports `requestPushPermissions`, `getPushToken`, `registerPushToken`, `unregisterPushToken`, and `attachTokenRefreshListener` from `"../services/pushNotifications"` in a single import statement; verified via multi-identifier regex.
- R-P2-02 [frontend] [unit]: `AuthContext.tsx` contains a `useEffect` whose callback body calls `requestPushPermissions`, `getPushToken`, `registerPushToken`, and `attachTokenRefreshListener` IN THAT ORDER, and whose dependency array includes `isAuthenticated`; verified via multiline regex matching the ordered sequence.
- R-P2-03 [frontend] [unit]: the `registerPushToken` call chain inside `AuthContext.tsx` is wrapped in a `try { ... } catch` block; verified via multiline regex `/try\s*\{[\s\S]{0,500}registerPushToken[\s\S]{0,200}\}\s*catch/`.
- R-P2-04 [frontend] [unit]: the `attachTokenRefreshListener` call inside `AuthContext.tsx` passes a callback that invokes `registerPushToken` with the rotated token; verified via multiline regex matching `attachTokenRefreshListener\s*\(\s*(?:async\s*)?\(?[^)]*\)?\s*=>\s*\{[\s\S]{0,200}registerPushToken`.
- R-P2-05 [frontend] [unit]: the `logout` function in `AuthContext.tsx` calls `unregisterPushToken` BEFORE it calls `signOut(auth)`; verified via multiline regex `/async\s+function\s+logout[\s\S]*?unregisterPushToken[\s\S]*?signOut\s*\(\s*auth\s*\)/`.

### Verification Command

```
node scripts/verify-auth-push-wiring.cjs
```

---

## Phase 3: Migration 055 push_tokens table

**Phase Type**: `module`

Create the `push_tokens` table with a unique constraint on
`(user_id, expo_push_token)` so the upsert + unregister operations
work with a deterministic key.

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `server/migrations/055_push_tokens.sql` | UP: `CREATE TABLE IF NOT EXISTS push_tokens` with columns `id VARCHAR(36) PRIMARY KEY`, `user_id VARCHAR(36) NOT NULL`, `expo_push_token VARCHAR(255) NOT NULL`, `platform ENUM('ios','android') NOT NULL`, `enabled TINYINT(1) NOT NULL DEFAULT 1`, `created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`, `updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`, plus `UNIQUE KEY uniq_user_token (user_id, expo_push_token)`. DOWN: `DROP TABLE IF EXISTS push_tokens`. | `server/__tests__/migrations/055_push_tokens.test.ts` | unit |
| ADD | `server/__tests__/migrations/055_push_tokens.test.ts` | Vitest reads SQL file via `fs.readFileSync` and asserts structure via regex. | N/A (self) | unit |

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|--------------|---------------|-----------|
| UP creates `push_tokens` with required columns | unit | Real | SQL file is the spec | `server/__tests__/migrations/055_push_tokens.test.ts` |
| UNIQUE KEY on `(user_id, expo_push_token)` | unit | Real | regex | `server/__tests__/migrations/055_push_tokens.test.ts` |
| DOWN drops the table exactly once | unit | Real | regex count | `server/__tests__/migrations/055_push_tokens.test.ts` |
| `platform` column is `ENUM('ios','android') NOT NULL` | unit | Real | regex | `server/__tests__/migrations/055_push_tokens.test.ts` |

### Acceptance criteria (R-markers)

- R-P3-01 [backend] [unit]: SQL file contains exactly one `CREATE TABLE IF NOT EXISTS push_tokens` statement AND a `UNIQUE KEY` clause referencing `(user_id, expo_push_token)`; verified via two regex matches.
- R-P3-02 [backend] [unit]: DOWN section contains exactly one `DROP TABLE IF EXISTS push_tokens` statement and zero other `DROP TABLE` occurrences; verified via regex count.
- R-P3-03 [backend] [unit]: UP section declares the `platform` column as `ENUM('ios','android')` with `NOT NULL`; verified via regex `/platform\s+ENUM\s*\(\s*'ios'\s*,\s*'android'\s*\)\s+NOT\s+NULL/i`.

### Verification Command

```
bash -c "cd server && npx vitest run __tests__/migrations/055_push_tokens.test.ts"
```

---

## Phase 4: push-tokens routes (register + unregister) + Expo Push sender + mount

**Phase Type**: `integration`

Server endpoints for mobile token register AND unregister, the
`sendPush` utility, and the mount lines in `server/index.ts`.

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `server/routes/push-tokens.ts` | `Router()` with two handlers. `POST /api/push-tokens` with `requireAuth`: validates `req.body.token` as non-empty string and `req.body.platform` in `{"ios","android"}`, executes `INSERT INTO push_tokens (id, user_id, expo_push_token, platform, enabled) VALUES (?,?,?,?,1) ON DUPLICATE KEY UPDATE enabled = 1, updated_at = CURRENT_TIMESTAMP` via `pool.query`, returns `201 {id}`. `POST /api/push-tokens/unregister` with `requireAuth`: validates `req.body.token` as non-empty, executes `UPDATE push_tokens SET enabled = 0 WHERE user_id = ? AND expo_push_token = ?`, returns `204`. Both use `createRequestLogger`. | `server/__tests__/routes/push-tokens.test.ts` | integration |
| ADD | `server/lib/expo-push.ts` | Export `async function sendPush(tokens: string[], title: string, body: string, data?: Record<string, unknown>): Promise<{sent: number, errors: Array<{token: string, reason: string}>}>`. Batches into chunks of 100, issues one `fetch("https://exp.host/--/api/v2/push/send", ...)` per chunk, records errors on non-2xx, never throws. | `server/__tests__/lib/expo-push.test.ts` | integration |
| MODIFY | `server/index.ts` | Add `import pushTokensRouter from "./routes/push-tokens"` and `app.use(pushTokensRouter)`. | `server/__tests__/index.push-tokens-mount.test.ts` | unit |

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|--------------|---------------|-----------|
| POST /api/push-tokens upserts for authenticated user | integration | Mock | Established project pattern: `vi.mock("../../db")` from `route-test-setup.ts`. Mocks the DB driver boundary, NOT the handler under test | `server/__tests__/routes/push-tokens.test.ts` |
| POST /api/push-tokens with missing token → 400, no query | integration | Mock | error-path at boundary | `server/__tests__/routes/push-tokens.test.ts` |
| POST /api/push-tokens without auth → 401 | integration | Mock | auth-negative | `server/__tests__/routes/push-tokens.test.ts` |
| POST /api/push-tokens/unregister sets enabled=0 for matching row | integration | Mock | behavior via SQL inspection | `server/__tests__/routes/push-tokens.test.ts` |
| POST /api/push-tokens/unregister with missing token → 400 | integration | Mock | error-path | `server/__tests__/routes/push-tokens.test.ts` |
| POST /api/push-tokens/unregister without auth → 401 | integration | Mock | auth-negative | `server/__tests__/routes/push-tokens.test.ts` |
| sendPush posts correct payload to Expo API | integration | Mock | `fetch` is the network boundary; test sendPush itself (no self-mock) | `server/__tests__/lib/expo-push.test.ts` |
| sendPush batches 150 tokens into 2 fetch calls | integration | Mock | behavior verification | `server/__tests__/lib/expo-push.test.ts` |
| sendPush returns errors on non-2xx | integration | Mock | error-path | `server/__tests__/lib/expo-push.test.ts` |
| server/index.ts imports and mounts pushTokensRouter | unit | Real | regex on source | `server/__tests__/index.push-tokens-mount.test.ts` |

### Acceptance criteria (R-markers)

- R-P4-01 [backend] [integration]: authenticated `POST /api/push-tokens` with body `{token: "ExponentPushToken[abc]", platform: "ios"}` returns 201 with a JSON body containing an `id` string AND triggers exactly one `pool.query` call whose SQL matches `/INSERT INTO push_tokens/i`; verified via supertest + `vi.mocked(pool.query)` inspection.
- R-P4-02 [backend] [integration]: `POST /api/push-tokens` without `Authorization` header returns 401 AND does NOT call `pool.query`; verified via supertest + `expect(pool.query).not.toHaveBeenCalled()`.
- R-P4-03 [backend] [integration]: `POST /api/push-tokens` with body `{platform: "ios"}` (missing `token`) returns 400 AND does NOT call `pool.query`; verified via supertest status + spy assertion.
- R-P4-04 [backend] [integration]: authenticated `POST /api/push-tokens/unregister` with body `{token: "ExponentPushToken[abc]"}` returns 204 AND triggers exactly one `pool.query` call whose SQL matches `/UPDATE push_tokens SET enabled = 0/i` with params containing `req.user.id` and the token; verified via supertest + spy inspection.
- R-P4-05 [backend] [integration]: `POST /api/push-tokens/unregister` without auth returns 401; verified via supertest.
- R-P4-06 [backend] [integration]: `sendPush(["t1","t2"], "Title", "Body", {foo: "bar"})` issues exactly one `fetch` call to `https://exp.host/--/api/v2/push/send`; the parsed request body is a JSON array of 2 objects each with keys `to`, `title`, `body`, `data`; verified via `vi.fn()` replacing global `fetch` and `JSON.parse(fetch.mock.calls[0][1].body)` deep-equal check.
- R-P4-07 [backend] [integration]: calling `sendPush` with 150 tokens issues exactly 2 `fetch` calls (chunks of 100 + 50); verified via `expect(fetch.mock.calls.length).toBe(2)`.
- R-P4-08 [backend] [integration]: when `fetch` is mocked to return a `Response` with status 500, `sendPush` resolves with an `errors` array whose length equals the number of tokens passed, and never throws; verified via `.resolves` assertion.
- R-P4-09 [backend] [unit]: `server/index.ts` contains both `import pushTokensRouter from "./routes/push-tokens"` AND `app.use(pushTokensRouter)`; verified via `fs.readFileSync` + two regex matches.

### Verification Command

```
bash -c "cd server && npx vitest run __tests__/routes/push-tokens.test.ts __tests__/lib/expo-push.test.ts __tests__/index.push-tokens-mount.test.ts"
```

---

## Phase 5: Server push trigger on new load creation

**Phase Type**: `integration`

When a new load is created via `POST /api/loads` with `driver_id` set,
and the caller is NOT that driver, fire a push to the assigned driver.

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `server/routes/loads.ts` | Add `import { sendPush } from "../lib/expo-push"`. Inside `POST /api/loads` (line 167), AFTER `await connection.commit()` (line ~294) and AFTER the existing email notification block (line ~302), add a try/catch: if `driver_id` truthy AND `driver_id !== req.user!.id`, SELECT `expo_push_token` from `push_tokens` WHERE `user_id=driver_id AND enabled=1`, SELECT `city, type` from `load_legs` WHERE `load_id=id ORDER BY sequence_order`, derive `pickupCity` from first row with `type='Pickup'` and `dropoffCity` from last row with `type='Dropoff'`, call `await sendPush(tokens, "New load assigned", \`${load_number} — ${pickupCity} to ${dropoffCity}\`, {loadId: id})`. Catch logs via `log.error` and does NOT propagate. | `server/__tests__/routes/loads.push-on-create.test.ts` | integration |

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|--------------|---------------|-----------|
| Create with `driver_id` distinct from caller fires sendPush | integration | Mock | `vi.mock("../db")` + `vi.mock("../lib/expo-push")` — both at architectural boundaries, NOT self-mocking | `server/__tests__/routes/loads.push-on-create.test.ts` |
| Create where driver_id equals req.user.id (self) does NOT fire sendPush | integration | Mock | prevents self-ping | `server/__tests__/routes/loads.push-on-create.test.ts` |
| Create where driver has zero tokens does NOT fire sendPush | integration | Mock | no-op path | `server/__tests__/routes/loads.push-on-create.test.ts` |
| When sendPush rejects, POST still returns 201 | integration | Mock | resilience | `server/__tests__/routes/loads.push-on-create.test.ts` |

### Acceptance criteria (R-markers)

- R-P5-01 [backend] [integration]: `POST /api/loads` with body containing `driver_id: "driver-abc"` distinct from `req.user.id` fires exactly one `sendPush` call whose first argument is a string array containing the driver's registered token, whose second argument equals `"New load assigned"`, and whose fourth argument has `loadId === body.id`; verified via `vi.mocked(sendPush)` inspection after successful POST.
- R-P5-02 [backend] [integration]: `POST /api/loads` with `driver_id` equal to the authenticated caller's id does NOT call `sendPush`; verified via `expect(vi.mocked(sendPush)).not.toHaveBeenCalled()`.
- R-P5-03 [backend] [integration]: `POST /api/loads` when the push_tokens query returns `[[], []]` does NOT call `sendPush`; verified via spy assertion.
- R-P5-04 [backend] [integration]: when `sendPush` is mocked to reject with `new Error("expo down")`, `POST /api/loads` still returns HTTP 201 and `pool.query` REPLACE INTO loads fired before the push trigger; verified via supertest response + spy ordering.

### Verification Command

```
bash -c "cd server && npx vitest run __tests__/routes/loads.push-on-create.test.ts"
```

---

## Phase 6: Server push trigger on driver reassignment (PATCH)

**Phase Type**: `integration`

Extend the existing `PATCH /api/loads/:id` partial-update handler to
accept `driver_id` in the allowlist, and fire a push to the new driver
when it changes to a distinct value. This closes the gap where a
dispatcher reassigns a driver post-creation and the new driver gets no
notification.

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `server/schemas/loads.ts` | Extend `partialUpdateLoadSchema` to accept an optional `driver_id: z.string().uuid().optional()` (or nullable if the schema permits). | `server/__tests__/routes/loads.push-on-reassign.test.ts` | integration |
| MODIFY | `server/routes/loads.ts` | Inside the `PATCH /api/loads/:id` handler (line 358), destructure `driver_id` from `req.body`. Before the existing UPDATE, SELECT `driver_id AS old_driver_id FROM loads WHERE id = ? AND company_id = ?` to capture the previous value. Add `driver_id` to the `updates`/`params` if provided. After the UPDATE, in a try/catch: if `driver_id !== undefined && driver_id !== old_driver_id && driver_id !== null && driver_id !== req.user!.id`, SELECT tokens for the new `driver_id`, SELECT legs, call `sendPush(tokens, "Load reassigned to you", \`${load.load_number} — ${pickupCity} to ${dropoffCity}\`, {loadId: loadId})`. Catch logs and does NOT propagate. | `server/__tests__/routes/loads.push-on-reassign.test.ts` | integration |

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|--------------|---------------|-----------|
| PATCH accepts `driver_id` in partial update body (schema change) | integration | Mock | `vi.mock("../db")` + spy on UPDATE SQL | `server/__tests__/routes/loads.push-on-reassign.test.ts` |
| PATCH changing driver_id to a distinct value fires sendPush to new driver | integration | Mock | same pattern as Phase 5 | `server/__tests__/routes/loads.push-on-reassign.test.ts` |
| PATCH where driver_id is unchanged (same value) does NOT fire sendPush | integration | Mock | idempotency | `server/__tests__/routes/loads.push-on-reassign.test.ts` |
| PATCH where driver_id is set to the caller (self-assign) does NOT fire sendPush | integration | Mock | prevents self-ping | `server/__tests__/routes/loads.push-on-reassign.test.ts` |
| PATCH without driver_id in body does NOT modify driver_id column | integration | Mock | ensures existing partial-update behavior is preserved | `server/__tests__/routes/loads.push-on-reassign.test.ts` |

### Acceptance criteria (R-markers)

- R-P6-01 [backend] [integration]: authenticated `PATCH /api/loads/load-123` with body `{driver_id: "driver-new"}` triggers a `pool.query` UPDATE whose SQL contains the substring `driver_id = ?` and whose params include `"driver-new"`; verified via `vi.mocked(pool.query)` call inspection on the UPDATE call.
- R-P6-02 [backend] [integration]: the same PATCH where `driver_id` changes from `"driver-old"` to `"driver-new"` (distinct, non-null, not the caller) fires exactly one `sendPush` call whose second argument equals the exact string `"Load reassigned to you"` and whose fourth argument has `loadId === "load-123"`; verified via `vi.mocked(sendPush)` inspection.
- R-P6-03 [backend] [integration]: PATCH where the new `driver_id` equals the pre-existing value (no change) does NOT fire `sendPush`; verified via `expect(vi.mocked(sendPush)).not.toHaveBeenCalled()`.
- R-P6-04 [backend] [integration]: PATCH where the new `driver_id` equals `req.user.id` (the caller assigns themselves) does NOT fire `sendPush`; verified via spy assertion.
- R-P6-05 [backend] [integration]: PATCH without `driver_id` in the body (e.g. `{weight: 500}`) does NOT modify the `driver_id` column — the pool.query UPDATE SQL does not contain the substring `driver_id = ?`; verified via `expect(sqlString.includes("driver_id = ?")).toBe(false)`.

### Verification Command

```
bash -c "cd server && npx vitest run __tests__/routes/loads.push-on-reassign.test.ts"
```

---

## Phase 7: Server push trigger on dispatcher status update

**Phase Type**: `integration`

When a load's status is transitioned via `PATCH /api/loads/:id/status`
and the caller is NOT the assigned driver, fire a push to the driver.

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `server/routes/loads.ts` | Inside `PATCH /api/loads/:id/status` (line 479), AFTER the successful `loadService.transitionLoad(...)` call AND BEFORE `res.json(result)`, add a try/catch: SELECT `id, driver_id, load_number FROM loads WHERE id = ? AND company_id = ?` for `loadId + companyId`. If `load.driver_id` truthy AND `load.driver_id !== req.user!.id`, SELECT tokens for `load.driver_id`, call `sendPush(tokens, "Load status changed", \`${load.load_number} is now ${status}\`, {loadId: load.id})`. Catch logs and does NOT propagate. | `server/__tests__/routes/loads.push-on-status.test.ts` | integration |

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|--------------|---------------|-----------|
| Dispatcher PATCH (caller != driver) fires sendPush | integration | Mock | same pattern | `server/__tests__/routes/loads.push-on-status.test.ts` |
| Driver PATCH (caller == driver) does NOT fire | integration | Mock | self-ping prevention | `server/__tests__/routes/loads.push-on-status.test.ts` |
| Load with NULL driver_id does NOT fire | integration | Mock | null guard | `server/__tests__/routes/loads.push-on-status.test.ts` |
| sendPush rejection does NOT fail the PATCH | integration | Mock | resilience | `server/__tests__/routes/loads.push-on-status.test.ts` |

### Acceptance criteria (R-markers)

- R-P7-01 [backend] [integration]: `PATCH /api/loads/load-123/status` with body `{status: "dispatched"}` made by user `"dispatcher-x"` where the load's `driver_id` is `"driver-y"` fires exactly one `sendPush` call whose `data.loadId === "load-123"` and whose second argument equals `"Load status changed"`; verified via `vi.mocked(sendPush)` inspection.
- R-P7-02 [backend] [integration]: the same PATCH made by user `"driver-y"` (the assigned driver) does NOT fire `sendPush`; verified via spy assertion.
- R-P7-03 [backend] [integration]: PATCH against a load whose `driver_id` column is NULL does NOT fire `sendPush`; verified via spy assertion.
- R-P7-04 [backend] [integration]: when `sendPush` is mocked to reject, the PATCH response still returns HTTP 200 with the result of `loadService.transitionLoad`; verified via supertest.

### Verification Command

```
bash -c "cd server && npx vitest run __tests__/routes/loads.push-on-status.test.ts"
```

---

## Phase 8: Mobile notification tap handler wiring in _layout.tsx

**Phase Type**: `integration`

Wire `attachNotificationResponseHandler` into the root layout so
tapping a push notification deep-links into `/loads/[id]`.

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `apps/trucker/src/app/_layout.tsx` | Import `useRouter` from `"expo-router"` and `attachNotificationResponseHandler` from `"../services/pushNotifications"`. Inside the root component: `const router = useRouter()`, then `useEffect(() => { const sub = attachNotificationResponseHandler(router); return () => sub.remove(); }, [router])`. | `scripts/verify-push-deep-link.cjs` | unit |

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|--------------|---------------|-----------|
| _layout.tsx imports useRouter from expo-router | unit | Real | regex | `scripts/verify-push-deep-link.cjs` |
| _layout.tsx imports attachNotificationResponseHandler | unit | Real | regex | `scripts/verify-push-deep-link.cjs` |
| _layout.tsx useEffect calls the handler and cleans up | unit | Real | multiline regex | `scripts/verify-push-deep-link.cjs` |

### Acceptance criteria (R-markers)

- R-P8-01 [frontend] [unit]: `_layout.tsx` imports `useRouter` from `"expo-router"`; verified via regex `/import\s*\{[^}]*useRouter[^}]*\}\s*from\s*["']expo-router["']/`.
- R-P8-02 [frontend] [unit]: `_layout.tsx` imports `attachNotificationResponseHandler` from `"../services/pushNotifications"`; verified via regex.
- R-P8-03 [frontend] [unit]: `_layout.tsx` has a `useEffect` whose body calls `attachNotificationResponseHandler(router)` and whose cleanup function calls `.remove()` on the return value; verified via multiline regex.

### Verification Command

```
node scripts/verify-push-deep-link.cjs
```

---

## Phase 9: GET/PATCH /api/drivers/me endpoints

**Phase Type**: `module`

Server endpoints for driver-self profile read/write. PATCH is limited
to `phone` only via a hard-coded single-column UPDATE (privilege-
escalation guard).

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `server/routes/drivers.ts` | `Router()` exporting `GET /api/drivers/me` and `PATCH /api/drivers/me` (both with `requireAuth`). GET SELECTs `id, name, email, phone, role, company_id AS companyId` from users for `req.user!.id`, returns the row or 404. PATCH validates `req.body.phone` against `/^[0-9+\-\(\)\s]{7,20}$/`, then executes `UPDATE users SET phone = ? WHERE id = ?` (hard-coded single-column). | `server/__tests__/routes/drivers.test.ts` | integration |
| MODIFY | `server/index.ts` | Add `import driversRouter from "./routes/drivers"` and `app.use(driversRouter)`. | `server/__tests__/index.drivers-mount.test.ts` | unit |

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|--------------|---------------|-----------|
| GET /me returns user fields | integration | Mock | `vi.mock("../db")` boundary | `server/__tests__/routes/drivers.test.ts` |
| GET /me where row missing → 404 | integration | Mock | error-path | `server/__tests__/routes/drivers.test.ts` |
| GET /me without auth → 401 | integration | Mock | auth-negative | `server/__tests__/routes/drivers.test.ts` |
| PATCH /me with valid phone updates column | integration | Mock | behavior | `server/__tests__/routes/drivers.test.ts` |
| PATCH /me with invalid phone → 400 | integration | Mock | error-path | `server/__tests__/routes/drivers.test.ts` |
| PATCH /me with extra role field → role NOT in SQL | integration | Mock | privilege-escalation guard | `server/__tests__/routes/drivers.test.ts` |
| server/index.ts mounts driversRouter | unit | Real | regex | `server/__tests__/index.drivers-mount.test.ts` |

### Acceptance criteria (R-markers)

- R-P9-01 [backend] [integration]: authenticated `GET /api/drivers/me` returns 200 with JSON body whose sorted keys deep-equal `["companyId","email","id","name","phone","role"]`; verified via supertest + `Object.keys` check.
- R-P9-02 [backend] [integration]: `GET /api/drivers/me` when `pool.query` returns `[[], []]` returns 404; verified via supertest.
- R-P9-03 [backend] [integration]: `GET /api/drivers/me` without `Authorization` → 401; verified via supertest.
- R-P9-04 [backend] [integration]: `PATCH /api/drivers/me` with body `{phone: "555-123-4567"}` returns 200 AND triggers exactly one `pool.query` whose SQL matches `/UPDATE users SET phone = \?/i` with params containing `"555-123-4567"`; verified via spy inspection.
- R-P9-05 [backend] [integration]: `PATCH /api/drivers/me` with body `{phone: "not-a-phone-!!"}` rejects with 400 and does NOT call `pool.query`; verified via supertest status + spy assertion.
- R-P9-06 [backend] [integration]: `PATCH /api/drivers/me` with body `{phone: "555-1234567", role: "admin"}` returns 200 but the `pool.query` SQL string does NOT contain the substring `role` (case-insensitive); verified via `expect(sql.toLowerCase()).not.toContain("role")`.
- R-P9-07 [backend] [unit]: `server/index.ts` contains `import driversRouter from "./routes/drivers"` AND `app.use(driversRouter)`; verified via two regex matches.

### Verification Command

```
bash -c "cd server && npx vitest run __tests__/routes/drivers.test.ts __tests__/index.drivers-mount.test.ts"
```

---

## Phase 10: Mobile Profile screen

**Phase Type**: `module`

Replace the 29-line placeholder with a real screen.

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `apps/trucker/src/app/(tabs)/profile.tsx` | Rewrite. On mount, `api.get<DriverProfile>("/drivers/me")` into state. Render loading/error/success branches. Fields: read-only `name`/`email`/`role`; editable `phone` `<TextInput>`. Save `<Pressable>` calls `api.patch<{id:string,phone:string}>("/drivers/me", {phone})`. Settings `<Pressable>` calls `router.push("/settings")` via `useRouter()`. | `scripts/verify-profile-screen.cjs` | unit |
| ADD | `apps/trucker/src/types/driver.ts` | Export `interface DriverProfile { id: string; name: string; email: string; phone: string \| null; role: string; companyId: string; }`. | `scripts/verify-profile-screen.cjs` | unit |

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|--------------|---------------|-----------|
| profile.tsx imports api and calls api.get("/drivers/me") | unit | Real | regex | `scripts/verify-profile-screen.cjs` |
| profile.tsx has phone TextInput with value+onChangeText | unit | Real | regex | `scripts/verify-profile-screen.cjs` |
| profile.tsx Save handler calls api.patch("/drivers/me", {phone}) | unit | Real | regex | `scripts/verify-profile-screen.cjs` |
| profile.tsx has Settings navigation via router.push | unit | Real | regex | `scripts/verify-profile-screen.cjs` |
| profile.tsx renders loading, error, and success states | unit | Real | regex | `scripts/verify-profile-screen.cjs` |
| types/driver.ts defines DriverProfile with 6 fields | unit | Real | regex per field | `scripts/verify-profile-screen.cjs` |

### Acceptance criteria (R-markers)

- R-P10-01 [frontend] [unit]: `profile.tsx` imports `api` from `"../../services/api"` AND calls `api.get` with path `"/drivers/me"`; verified via two regex matches.
- R-P10-02 [frontend] [unit]: `profile.tsx` has a `<TextInput` with both `value={...}` and `onChangeText={...}` in the same element; verified via multiline regex.
- R-P10-03 [frontend] [unit]: `profile.tsx` calls `api.patch` with path `"/drivers/me"` and an object literal containing `phone`; verified via regex.
- R-P10-04 [frontend] [unit]: `profile.tsx` calls `router.push("/settings")` AND imports `useRouter` from `"expo-router"`; verified via two regex matches.
- R-P10-05 [frontend] [unit]: `profile.tsx` renders a loading branch (conditional on `loading` identifier) AND an error branch (conditional on `error` identifier); verified via two regex matches for `{loading` and `{error` patterns.
- R-P10-06 [frontend] [unit]: `types/driver.ts` declares `interface DriverProfile` with fields `id`, `name`, `email`, `phone`, `role`, `companyId`; verified via one regex for the interface + six field-name regexes.

### Verification Command

```
node scripts/verify-profile-screen.cjs
```

---

## Phase 11: Settings screen (complete) + layout registration

**Phase Type**: `module`

Single-file complete settings screen: 3 notification toggles, confirmed
sign-out, version display. `_layout.tsx` gets the Stack.Screen entry.

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `apps/trucker/src/app/settings.tsx` | Functional component importing `AsyncStorage`, `useAuth`, `Alert`, `Switch` (from `react-native`), `useRouter`, `Constants` (from `expo-constants`). Loads prefs from `AsyncStorage.getItem("@loadpilot/notification-prefs")` in `useEffect` on mount; persists on toggle via `AsyncStorage.setItem`. Renders exactly 3 `<Switch>` ("New load assignments", "Status updates", "Quiet hours"). Sign-out `<Pressable>` calls `Alert.alert("Sign out?", ..., [{text:"Cancel",style:"cancel"},{text:"Sign out",style:"destructive",onPress: async () => { await logout(); router.replace("/"); }}])`. About section displays `Constants.expoConfig?.version`. | `scripts/verify-settings-screen.cjs` | unit |
| MODIFY | `apps/trucker/src/app/_layout.tsx` | Add `<Stack.Screen name="settings" options={{ title: "Settings" }} />`. | `scripts/verify-settings-screen.cjs` | unit |

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|--------------|---------------|-----------|
| settings.tsx imports AsyncStorage + uses the prefs key | unit | Real | regex | `scripts/verify-settings-screen.cjs` |
| useEffect calls getItem on mount | unit | Real | multiline regex | `scripts/verify-settings-screen.cjs` |
| setItem on toggle handler | unit | Real | regex | `scripts/verify-settings-screen.cjs` |
| Exactly 3 Switch components | unit | Real | regex count | `scripts/verify-settings-screen.cjs` |
| useAuth + logout in onPress | unit | Real | multiline regex | `scripts/verify-settings-screen.cjs` |
| Alert.alert with destructive button | unit | Real | multiline regex | `scripts/verify-settings-screen.cjs` |
| Constants.expoConfig?.version read | unit | Real | regex | `scripts/verify-settings-screen.cjs` |
| router.replace("/") after logout | unit | Real | regex | `scripts/verify-settings-screen.cjs` |
| _layout.tsx Stack.Screen settings | unit | Real | regex | `scripts/verify-settings-screen.cjs` |

### Acceptance criteria (R-markers)

- R-P11-01 [frontend] [unit]: `settings.tsx` imports `AsyncStorage` from `@react-native-async-storage/async-storage` AND uses the literal key `"@loadpilot/notification-prefs"`; verified via two regex matches.
- R-P11-02 [frontend] [unit]: `settings.tsx` has a `useEffect` calling `AsyncStorage.getItem("@loadpilot/notification-prefs")`; verified via multiline regex.
- R-P11-03 [frontend] [unit]: `settings.tsx` calls `AsyncStorage.setItem("@loadpilot/notification-prefs", JSON.stringify(...))`; verified via regex.
- R-P11-04 [frontend] [unit]: `settings.tsx` renders exactly 3 `<Switch` elements; verified via `(content.match(/<Switch[\s>]/g) \|\| []).length === 3`.
- R-P11-05 [frontend] [unit]: `settings.tsx` imports `useAuth` from `"../contexts/AuthContext"`, destructures `logout`, and calls `logout(` inside an `onPress` arrow-function body; verified via three regex matches.
- R-P11-06 [frontend] [unit]: `settings.tsx` imports `Alert` from `"react-native"` AND contains an `Alert.alert` call whose options include an object with `style: "destructive"`; verified via multiline regex.
- R-P11-07 [frontend] [unit]: `settings.tsx` imports `Constants` from `"expo-constants"` AND reads `Constants.expoConfig?.version` or `.expoConfig.version`; verified via two regex matches.
- R-P11-08 [frontend] [unit]: `settings.tsx` contains a `router.replace("/")` call AND imports `useRouter`; verified via two regex matches.
- R-P11-09 [frontend] [unit]: `_layout.tsx` contains `<Stack.Screen name="settings"`; verified via regex.

### Verification Command

```
node scripts/verify-settings-screen.cjs
```

---

## Phase 12: Sprint F combined verification + sprint history update

**Phase Type**: `e2e`

Single orchestration script that runs every Sprint F verify script and
appends the sprint-history entry.

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| ADD | `scripts/verify-sprint-f.cjs` | Orchestrator using `child_process.spawnSync("node", [script])` to run each Sprint F mobile verify script (`verify-push-service.cjs`, `verify-auth-push-wiring.cjs`, `verify-push-deep-link.cjs`, `verify-profile-screen.cjs`, `verify-settings-screen.cjs`). Exits non-zero on any failure. Reads `docs/trucker-app-sprint-history.md` via `fs.readFileSync` and asserts `## Sprint F` heading. | N/A (self) | unit |
| MODIFY | `docs/trucker-app-sprint-history.md` | Append `## Sprint F — Push Notifications + Driver Profile + Settings` section. | `scripts/verify-sprint-f.cjs` | unit |

### Testing Strategy

| What | Type | Real vs Mock | Justification | Test File |
|------|------|--------------|---------------|-----------|
| verify-sprint-f.cjs references all 5 mobile verify scripts | unit | Real | regex count | `scripts/verify-sprint-f.cjs` |
| verify-sprint-f.cjs calls process.exit with non-zero in error branch | unit | Real | regex | `scripts/verify-sprint-f.cjs` |
| docs/trucker-app-sprint-history.md has `## Sprint F` heading | unit | Real | regex | `scripts/verify-sprint-f.cjs` |

### Acceptance criteria (R-markers)

- R-P12-01 [integration] [unit]: `scripts/verify-sprint-f.cjs` source contains all 5 substrings: `verify-push-service.cjs`, `verify-auth-push-wiring.cjs`, `verify-push-deep-link.cjs`, `verify-profile-screen.cjs`, `verify-settings-screen.cjs`; verified via 5 regex matches.
- R-P12-02 [integration] [unit]: `scripts/verify-sprint-f.cjs` contains a `process.exit` call with a non-zero integer argument; verified via regex `/process\.exit\s*\(\s*[1-9]\d*\s*\)/`.
- R-P12-03 [integration] [unit]: `docs/trucker-app-sprint-history.md` contains an H2 heading starting with `## Sprint F`; verified via regex `/^## Sprint F/m`.

### Verification Command

```
node scripts/verify-sprint-f.cjs
```

---

## Files NOT touched

- `apps/trucker/src/app/(tabs)/index.tsx`, `loads/**`, `queue.tsx`, `(camera)/**` — FROZEN
- All mobile services except new `pushNotifications.ts` — FROZEN
- `server/migrations/001_baseline.sql` through `054_feature_flags.sql` — FROZEN
- All existing server routes except `loads.ts` (additively modified) and new files — FROZEN
- `server/services/load.service.ts`, `load-state-machine.ts` — FROZEN
- `server/lib/sentry.ts`, `logger.ts`, `env.ts` — FROZEN
- `server/middleware/requireAuth.ts`, `requireTenant.ts` — FROZEN
- Anything under root `src/` or `components/` (web app) — FROZEN
- Anything under `packages/shared/` — FROZEN

## Targeted verification command (Windows-safe)

```
cd apps/trucker && npm ci && cd ../..
bash -c "cd server && npm ci && npx vitest run __tests__/migrations/055_push_tokens.test.ts __tests__/routes/push-tokens.test.ts __tests__/routes/drivers.test.ts __tests__/routes/loads.push-on-create.test.ts __tests__/routes/loads.push-on-reassign.test.ts __tests__/routes/loads.push-on-status.test.ts __tests__/lib/expo-push.test.ts __tests__/index.push-tokens-mount.test.ts __tests__/index.drivers-mount.test.ts && npx tsc --noEmit"
node scripts/verify-sprint-f.cjs
```

## Exit artifact

- PR: `Sprint F — Push Notifications + Driver Profile + Settings` targeting `mobile/trucker-app`
- All R-markers green across 12 phases:
  - Phase 1 — Expo Notifications Service: R-P1-01..09 (9)
  - Phase 2 — AuthContext Wiring: R-P2-01..05 (5)
  - Phase 3 — Migration 055: R-P3-01..03 (3)
  - Phase 4 — push-tokens routes + sender + mount: R-P4-01..09 (9)
  - Phase 5 — Create Push Trigger: R-P5-01..04 (4)
  - Phase 6 — Reassignment Push Trigger: R-P6-01..05 (5)
  - Phase 7 — Status Push Trigger: R-P7-01..04 (4)
  - Phase 8 — Mobile Deep-Link Wiring: R-P8-01..03 (3)
  - Phase 9 — drivers/me Route: R-P9-01..07 (7)
  - Phase 10 — Profile Screen: R-P10-01..06 (6)
  - Phase 11 — Settings Screen: R-P11-01..09 (9)
  - Phase 12 — Combined Verification: R-P12-01..03 (3)
- Total: 67 R-markers across 12 phases
- `docs/trucker-app-sprint-history.md` appended with Sprint F merge SHA
- Release-checklist row recorded: "Replace `extra.eas.projectId` placeholder in app.json with real EAS project id before store submission"

## V-Model Guarantee

Every sprint traverses the full V: requirements (R-markers) → design
(file inventory + API Contracts) → implementation (Ralph stories with
4-checkpoint TDD) → unit tests → integration tests → system tests
(`/verify` + `/audit`) → acceptance tests (release checklist).

**R-markers are Ralph-automatable only.** Real-device push delivery,
APNs certificate rotation, FCM project config, physical-device tap-
through validation, EAS project id replacement, and app-store push
entitlement review are **release checklist rows**, NOT Ralph R-markers.

## Ralph dispatch invariants

1. Worktree isolation per story worker
2. Checkpoint hash before each story
3. Feature branch `ralph/trucker-app-sprint-f` cut from `mobile/trucker-app`
4. 4-checkpoint TDD (Red → Green → Refactor → Gate)
5. Selective staging (no `git add -A`)
6. Format before commit
7. Fixture validation (collect-only)
8. Circuit breaker (3 consecutive skips → halt)
9. `needs_verify` cleared before next sprint dispatch
10. `npm ci` (not `npm install`) in all verifications
11. All R-marker assertions use `fs.readFileSync` + regex (no shell grep)
12. Mobile stories verified via `scripts/verify-*.cjs`; server stories via vitest
13. Sequential dispatch for stories that touch `server/routes/loads.ts`: STORY-005 → STORY-006 → STORY-007
14. Sequential dispatch for stories that touch `server/index.ts`: STORY-004 → STORY-009
15. Sequential dispatch for stories that touch `apps/trucker/src/app/_layout.tsx`: STORY-008 → STORY-011
16. Mocks are boundary-only: DB driver (`vi.mock("../db")`) and HTTP client (`vi.mock("../lib/expo-push")` or global `fetch`). **No test mocks the function or handler it is verifying.** Matches the established project pattern in `server/__tests__/helpers/route-test-setup.ts`.

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Expo Push API rate-limit on dispatcher burst | LOW | MEDIUM | Batch 100/call; document 429 backoff as a Sprint G add-on |
| AsyncStorage corruption wipes notification prefs | LOW | LOW | Defaults to all-enabled on `JSON.parse` exception |
| `_layout.tsx` modification breaks existing routes | LOW | HIGH | Additive only; existing entries untouched |
| Push trigger inside `loads.ts` breaks SaaS dispatcher flow | MEDIUM | HIGH | try/catch so push failure NEVER blocks the request; Phase 5/6/7 integration tests prove this |
| `expo-notifications` 0.31 drift from Expo SDK 55 | LOW | MEDIUM | Pin to `~0.31.0` |
| Driver PATCH bypass allows role escalation via `/drivers/me` | LOW | HIGH | R-P9-06 asserts the PATCH SQL does not contain `role` |
| Concurrent modification of `loads.ts` by parallel workers | MEDIUM | HIGH | Invariant 13: sequential STORY-005 → STORY-006 → STORY-007 |
| EAS projectId left as placeholder in prod build | MEDIUM | HIGH | Release checklist row: operator must replace before store submission |
| Token rotation silently breaks push delivery | MEDIUM | HIGH | Phase 1 + Phase 2: `attachTokenRefreshListener` re-registers the new token automatically |
| Cross-driver notification bleed when a second driver logs into same device | MEDIUM | HIGH (privacy) | Phase 2 + Phase 4: logout calls `unregisterPushToken(currentToken)` before Firebase signOut; server marks that specific token `enabled=0` |
| Dispatcher reassigns driver post-creation → new driver never learns | HIGH | MEDIUM | Phase 6: `PATCH /api/loads/:id` with `driver_id` fires push to the new driver |

## Dependencies

### Internal

- Sprints A–E merged (PR #69 2026-04-11 confirmed at `c59f8b1`)
- `users` table from baseline migration (unchanged)
- `AuthContext` from Sprint B2 (additively modified)
- `api.ts` from Sprint B2 (unchanged, consumed)
- `scripts/verify-*.cjs` pattern established in Sprints C+D+E
- `server/routes/loads.ts` POST + PATCH + PATCH status handlers (additively hooked)
- `server/services/load.service.ts` `transitionLoad` (unchanged)
- `server/__tests__/helpers/route-test-setup.ts` (consumed for mock factories)

### External

- `expo-notifications@~0.31.0` (NEW mobile dep)
- `expo-constants@~17.1.0` (already present)
- `@react-native-async-storage/async-storage@~2.1.0` (already present)
- `expo-router@~5.0.0` (already present — `useRouter()` hook)
- Expo Push API `https://exp.host/--/api/v2/push/send` (public HTTPS)

## Rollback Plan

1. `git revert -m 1 <merge-sha>` on `mobile/trucker-app`
2. `cd server && node scripts/migrate.cjs down 055`
3. `expo-notifications` dep stays in package.json (harmless)
4. Revert `app.json` plugin entry if Expo Go issues
5. AsyncStorage data on devices is orphaned but harmless
6. Record rollback in `docs/trucker-app-sprint-history.md`

## Open Questions

None blocking. The items genuinely out of scope (deferred to future work):

- Geofence-triggered pushes → Sprint G (GPS)
- In-app notification center UI → Sprint H (messaging)
- Admin-side push composer → post-Sprint H
- Rich notifications (images, actions) → deferred; no production impact
- Silent / background data-only pushes → deferred; no production impact
- Device fingerprint heuristics for truly stale tokens → deferred; low-impact hygiene (logout cleanup from Sprint F covers the privacy case)
- Load reassignment that ALSO reuses the existing PATCH status handler (e.g., re-route in transit) → Sprint F covers the driver-change case only

## Issues resolved IN Sprint F (previously deferred)

- ✅ **Load reassignment** — Phase 6 adds `driver_id` to the `PATCH /api/loads/:id` allowlist and fires a push to the new driver
- ✅ **Token rotation** — Phase 1 exports `attachTokenRefreshListener`; Phase 2 wires it so rotation triggers re-registration
- ✅ **Logout cleanup** — Phase 1 exports `unregisterPushToken`; Phase 2 `logout` calls it before signOut; Phase 4 adds the `/api/push-tokens/unregister` endpoint

## Sprint Handoff

After Sprint F merges:

1. Record merge SHA in `docs/trucker-app-sprint-history.md`
2. Extract Sprint G section from `docs/PLAN-trucker-app-master.md` (GPS / location tracking)
3. Replace this file (`.claude/docs/PLAN.md`) with Sprint G contract
4. Regenerate `.claude/prd.json` for Sprint G
5. Reset `.claude/.workflow-state.json`
6. Create branch `ralph/trucker-app-sprint-g` from `mobile/trucker-app`
7. Dispatch `/ralph`
