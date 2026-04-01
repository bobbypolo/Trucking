# Plan: Production Readiness Remediation

## Goal

Remediate 10 production-readiness gaps identified by comprehensive security/ops audit, organized into 5 phases for Ralph orchestration. All security issues are mandatory. Phases sequenced: server-side hardening first, then auth, frontend resilience, validation + team features, accessibility.

Brainstorm: N/A (derived from 4-agent production readiness audit conducted 2026-03-31)

## System Context

### Files Read

| File | Findings |
|------|----------|
| `components/ErrorBoundary.tsx` | Three classes: ErrorBoundary (legacy root), PageErrorBoundary (full-screen), ComponentErrorBoundary (inline card, lines 84-122). ComponentErrorBoundary UNUSED in production. |
| `App.tsx` | Root ErrorBoundary wraps app (lines 1107-1148). 12+ lazy components have NO intermediate boundary. |
| `server/index.ts` | `app.use(helmet())` line 61 with no options. No explicit HSTS. Rate limiter in-memory (lines 70-77). |
| `server/middleware/requireAuth.ts` | `verifyIdToken()` line 67. No revocation check. No `emailVerified` check. |
| `server/middleware/validate.ts` | `validateBody(schema)` factory (lines 12-45). Used in 15+ routes. |
| `server/routes/incidents.ts` | 4 write endpoints (POST incident, POST action, PATCH, POST charge) with zero Zod validation. |
| `server/routes/quickbooks.ts` | 2 write endpoints (sync-invoice, sync-bill) with zero Zod validation. |
| `server/schemas/` | 29 schema files. Convention: `z.object`, named exports. |
| `services/authService.ts` | `registerCompany()` line 626: no `sendEmailVerification()`. `login()` line 454: no `emailVerified` check. Second signup at line 863. |
| `components/EditLoadForm.tsx` | `validateForm()` lines 158-189: no rate or date validation. `carrierRate`/`driverPay` accept negatives. |
| `hooks/useFocusTrap.ts` | Used in 6 modals (EditUserModal, ExportModal, LoadSetupModal, ConfirmDialog, InputDialog, SessionExpiredModal). Missing from BrokerManager, CalendarView, FileVault, ExceptionConsole, IFTAManager, LoadDetailView. |
| `server/services/notification-delivery.service.ts` | `sendEmail({to, subject, body, html})` ready via nodemailer. |
| `server/migrations/044_loads_composite_index.sql` | Latest migration 044. Next available: 045. |

### Existing Patterns

- Zod: `validateBody(schema)` middleware in `server/middleware/validate.ts`. 15+ routes use it.
- Error boundary: `ComponentErrorBoundary` lines 84-122 in `components/ErrorBoundary.tsx`, defined but unused.
- Focus trap: `useFocusTrap(ref, active, onClose)` in `hooks/useFocusTrap.ts`.
- Email: `sendEmail({to, subject, body, html})` via nodemailer in notification-delivery.service.ts.
- Migrations: `-- UP` / `-- DOWN` blocks. Numbered `NNN_name.sql`. Checksum-tracked.

### Blast Radius Assessment

| File / Module | Impact | Risk |
|---------------|--------|------|
| `server/index.ts` | Helmet config + Sentry import + invitation router | Low |
| `server/middleware/requireAuth.ts` | Revocation check + email_verified check | Medium -- affects all authenticated requests |
| `server/routes/incidents.ts` | Add `validateBody` x4 | Low |
| `server/routes/quickbooks.ts` | Add `validateBody` x2 | Low |
| `services/authService.ts` | `sendEmailVerification` + `emailVerified` gate | Medium -- affects signup/login flow |
| `components/ErrorBoundary.tsx` | Add Sentry `captureException` | Low |
| `App.tsx` | Wrap 12 lazy components with `ComponentErrorBoundary` | Low |
| `components/EditLoadForm.tsx` | Rate/date validation | Low |

---

## Phase 0 -- Server-Side Security Hardening

**Phase Type**: `foundation`

### Rationale

All three stories harden server-side security: HSTS headers, token revocation, and input validation on unprotected endpoints. These are prerequisites for auth changes in Phase 1 since S-002 and S-004 both modify `requireAuth.ts`.

### Story S-001: HSTS Security Headers

#### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `server/index.ts` | Replace `helmet()` with `helmet({ hsts: { maxAge: 31536000, includeSubDomains: true, preload: true } })` | `server/__tests__/middleware/security-headers.test.ts` | integration |
| CREATE | `server/__tests__/middleware/security-headers.test.ts` | Test HSTS header presence and values on API responses | -- | -- |

#### Done When

- R-SEC-01: `server/index.ts` calls `helmet({` with `hsts:` config (not bare `helmet()`)
- R-SEC-02: Response header `strict-transport-security` contains `max-age=31536000`
- R-SEC-03: Header contains `includeSubDomains`
- R-SEC-04: Header contains `preload`
- R-SEC-05: `cd server && npx vitest run __tests__/middleware/security-headers.test.ts` exits 0

#### Verification Command

```bash
cd server && grep -n "hsts:" index.ts && npx vitest run __tests__/middleware/security-headers.test.ts --reporter=verbose
```

---

### Story S-002: Token Revocation Table + Middleware Check

#### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| CREATE | `server/migrations/045_revoked_tokens.sql` | `CREATE TABLE revoked_tokens` (id PK, user_id, firebase_uid INDEXED, revoked_at, reason) | `server/__tests__/middleware/token-revocation.test.ts` | unit |
| CREATE | `server/lib/token-revocation.ts` | `isTokenRevoked(firebaseUid)` queries table; `revokeUserTokens(userId, firebaseUid, reason)` inserts + calls Firebase `revokeRefreshTokens()` | `server/__tests__/middleware/token-revocation.test.ts` | unit |
| MODIFY | `server/middleware/requireAuth.ts` | After `verifyIdToken()`, call `isTokenRevoked(decodedToken.uid)`. If true, return 401 `AUTH_REVOKED_001` | same | unit |
| MODIFY | `server/routes/users.ts` | Add `POST /api/users/:id/revoke` (admin-only) calling `revokeUserTokens()` | `server/__tests__/routes/user-revocation.test.ts` | unit |

#### Interface Contracts

| Function | Signature | Behavior |
|----------|-----------|----------|
| `isTokenRevoked` | `(firebaseUid: string) => Promise<boolean>` | `SELECT 1 FROM revoked_tokens WHERE firebase_uid = ? LIMIT 1` |
| `revokeUserTokens` | `(userId: string, firebaseUid: string, reason: string) => Promise<void>` | INSERT row + `admin.auth().revokeRefreshTokens(firebaseUid)` |
| `POST /api/users/:id/revoke` | Body: `{ reason: string }` | Returns 204; admin-only via `requireAuth + requireTenant` |

#### Data Flow

```
Admin clicks "Revoke" on user → POST /api/users/:id/revoke
  → requireAuth → requireTenant → admin role check
  → revokeUserTokens(userId, firebaseUid, reason)
    → INSERT INTO revoked_tokens
    → admin.auth().revokeRefreshTokens(firebaseUid)
  → 204 No Content

Subsequent request from revoked user:
  → requireAuth → verifyIdToken(token) → decodedToken.uid
  → isTokenRevoked(uid) → SELECT from revoked_tokens → true
  → 401 AUTH_REVOKED_001 "Access revoked"
```

#### Done When

- R-SEC-06: `045_revoked_tokens.sql` has `CREATE TABLE` with `firebase_uid` column + INDEX
- R-SEC-07: `token-revocation.ts` exports `isTokenRevoked`
- R-SEC-08: `token-revocation.ts` exports `revokeUserTokens`
- R-SEC-09: `requireAuth.ts` calls `isTokenRevoked` -- grep returns 1+ match
- R-SEC-10: Revoked user gets 401 with `REVOKED` in error code -- test assertion
- R-SEC-11: `POST /api/users/:id/revoke` exists in `users.ts` -- grep 1+ match
- R-SEC-12: `cd server && npx vitest run __tests__/middleware/token-revocation.test.ts __tests__/routes/user-revocation.test.ts` exits 0

#### Verification Command

```bash
cd server && grep -n "isTokenRevoked" middleware/requireAuth.ts && npx vitest run __tests__/middleware/token-revocation.test.ts __tests__/routes/user-revocation.test.ts --reporter=verbose
```

---

### Story S-003: Zod Schemas for Incidents + QuickBooks

#### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| CREATE | `server/schemas/incident.ts` | `createIncidentSchema` (type, severity, description required; location_lat/lng optional numbers), `createIncidentActionSchema` (action, actor_name required), `patchIncidentSchema` (all optional), `createIncidentChargeSchema` (category, amount >= 0 required) | `server/__tests__/schemas/incident.test.ts` | unit |
| CREATE | `server/schemas/quickbooks.ts` | `syncInvoiceSchema` (loadId, totalAmount required), `syncBillSchema` (vendorId, totalAmount required) | `server/__tests__/schemas/quickbooks.test.ts` | unit |
| MODIFY | `server/routes/incidents.ts` | Wire `validateBody` on all 4 write endpoints (POST incident, POST action, PATCH, POST charge) | `server/__tests__/routes/incidents-validation.test.ts` | integration |
| MODIFY | `server/routes/quickbooks.ts` | Wire `validateBody` on both sync endpoints | `server/__tests__/routes/quickbooks-validation.test.ts` | integration |

#### Done When

- R-SEC-13: `server/schemas/incident.ts` exports 4 schemas
- R-SEC-14: `server/schemas/quickbooks.ts` exports `syncInvoiceSchema`, `syncBillSchema`
- R-SEC-15: `incidents.ts` imports `validateBody`
- R-SEC-16: `grep -c validateBody server/routes/incidents.ts` returns 4
- R-SEC-17: `quickbooks.ts` imports `validateBody`
- R-SEC-18: `grep -c validateBody server/routes/quickbooks.ts` returns 2
- R-SEC-19: POST `/api/incidents` with empty body returns 400 VALIDATION error
- R-SEC-20: POST `/api/incidents/:id/charges` with `amount: -5` returns 400
- R-SEC-21: `cd server && npx vitest run __tests__/schemas/incident.test.ts __tests__/schemas/quickbooks.test.ts` exits 0
- R-SEC-22: `cd server && npx vitest run __tests__/routes/incidents-validation.test.ts __tests__/routes/quickbooks-validation.test.ts` exits 0

#### Verification Command

```bash
cd server && grep -c "validateBody" routes/incidents.ts && grep -c "validateBody" routes/quickbooks.ts && npx vitest run __tests__/schemas/incident.test.ts __tests__/schemas/quickbooks.test.ts __tests__/routes/incidents-validation.test.ts __tests__/routes/quickbooks-validation.test.ts --reporter=verbose
```

---

## Phase 1 -- Auth Hardening (Email Verification)

**Phase Type**: `module`

### Rationale

Email verification prevents fake account registration and is a security requirement. Must run after Phase 0 because both S-002 and S-004 modify `server/middleware/requireAuth.ts`.

### Story S-004: Email Verification on Signup + Login Gate

#### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `services/authService.ts` | Import `sendEmailVerification` from `firebase/auth`. Call after `createUserWithEmailAndPassword()` at line 626 AND line 863. In `login()` (line 459), after `signInWithEmailAndPassword`, check `userCredential.user.emailVerified`; if false, call `signOut(auth)` and throw `"Please verify your email before logging in"`. | `src/__tests__/services/authService.emailVerify.test.ts` | unit |
| MODIFY | `server/middleware/requireAuth.ts` | After `verifyIdToken()`, check `decodedToken.email_verified`. If false (and `NODE_ENV !== "test"`), return 401 `AUTH_EMAIL_UNVERIFIED_001`. | `server/__tests__/middleware/email-verification.test.ts` | unit |
| MODIFY | `components/Auth.tsx` | After registration success, show notice: "Verification email sent. Check your inbox." Do NOT auto-login after signup. | `src/__tests__/components/Auth.emailVerify.test.tsx` | unit |

#### Data Flow

```
Signup:
  registerCompany() → createUserWithEmailAndPassword()
    → sendEmailVerification(user) → Firebase sends email
    → Auth.tsx shows "Verification email sent" notice
    → User must click email link before login works

Login (unverified):
  login() → signInWithEmailAndPassword()
    → check user.emailVerified === false
    → signOut(auth) → throw "Please verify your email"
    → Auth.tsx shows error message

Login (verified):
  login() → signInWithEmailAndPassword()
    → user.emailVerified === true → proceed normally

Server-side double-check:
  requireAuth → verifyIdToken → decodedToken.email_verified
    → if false → 401 AUTH_EMAIL_UNVERIFIED_001
```

#### Done When

- R-AUTH-01: `authService.ts` imports `sendEmailVerification` -- grep 1+ match
- R-AUTH-02: `sendEmailVerification` called after `createUserWithEmailAndPassword` in `registerCompany()` -- 1+ match
- R-AUTH-03: 2+ total `sendEmailVerification` calls in `authService.ts` (both signup paths)
- R-AUTH-04: `login()` checks `emailVerified` -- grep 1+ match
- R-AUTH-05: `requireAuth.ts` checks `email_verified` -- grep 1+ match
- R-AUTH-06: Unverified login throws error containing "verify" -- test assertion
- R-AUTH-07: Auth component shows verification notice after signup -- test assertion
- R-AUTH-08: `npx vitest run src/__tests__/services/authService.emailVerify.test.ts` exits 0
- R-AUTH-09: `cd server && npx vitest run __tests__/middleware/email-verification.test.ts` exits 0
- R-AUTH-10: `npx vitest run src/__tests__/components/Auth.emailVerify.test.tsx` exits 0

#### Verification Command

```bash
grep -c "sendEmailVerification" services/authService.ts && grep -n "emailVerified\|email_verified" services/authService.ts server/middleware/requireAuth.ts && npx vitest run src/__tests__/services/authService.emailVerify.test.ts src/__tests__/components/Auth.emailVerify.test.tsx && cd server && npx vitest run __tests__/middleware/email-verification.test.ts
```

---

## Phase 2 -- Frontend Error Resilience

**Phase Type**: `module`

### Story S-005: Wrap Data-Fetching Components with ComponentErrorBoundary

#### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `App.tsx` | Import `ComponentErrorBoundary` from `./components/ErrorBoundary`. Wrap 12 data-fetching lazy components with `<ComponentErrorBoundary>` OUTSIDE their `<Suspense>`: AccountingPortal, BookingPortal, QuoteManager, BrokerManager, AnalyticsDashboard, CalendarView, AuditLogs, IntelligenceHub, ExceptionConsole, LoadDetailView, SafetyView, EditLoadForm. | `src/__tests__/components/ErrorBoundary.wrap.test.tsx` | unit |

#### Done When

- R-ERR-01: `App.tsx` imports `ComponentErrorBoundary`
- R-ERR-02: `grep -c "ComponentErrorBoundary" App.tsx` returns 12+
- R-ERR-03: AccountingPortal rendering block wrapped -- grep confirms `ComponentErrorBoundary` near `AccountingPortal`
- R-ERR-04: Test: throwing child renders error card (not blank page) -- test assertion
- R-ERR-05: `npx vitest run src/__tests__/components/ErrorBoundary.wrap.test.tsx` exits 0

#### Verification Command

```bash
grep -c "ComponentErrorBoundary" App.tsx && npx vitest run src/__tests__/components/ErrorBoundary.wrap.test.tsx --reporter=verbose
```

---

### Story S-006: Sentry APM Integration (Client + Server)

#### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `package.json` | Add `@sentry/react` to dependencies | -- | -- |
| MODIFY | `server/package.json` | Add `@sentry/node` to dependencies | -- | -- |
| CREATE | `services/sentry.ts` | Client Sentry init with `VITE_SENTRY_DSN`. Export `captureException`, `setUser`. Graceful no-op when DSN not set. | `src/__tests__/services/sentry.test.ts` | unit |
| CREATE | `server/lib/sentry.ts` | Server Sentry init with `SENTRY_DSN`. Export `captureException`. Graceful no-op when DSN not set. | `server/__tests__/lib/sentry.test.ts` | unit |
| MODIFY | `components/ErrorBoundary.tsx` | Add `captureException(error)` to all 3 `componentDidCatch` methods | `src/__tests__/components/ErrorBoundary.sentry.test.tsx` | unit |
| MODIFY | `server/middleware/errorHandler.ts` | Add `captureException(err)` after logging, before response | `server/__tests__/middleware/errorHandler.sentry.test.ts` | unit |

#### Done When

- R-ERR-06: `@sentry/react` in `package.json` dependencies
- R-ERR-07: `@sentry/node` in `server/package.json` dependencies
- R-ERR-08: `services/sentry.ts` exists and exports `captureException`
- R-ERR-09: `server/lib/sentry.ts` exists and exports `captureException`
- R-ERR-10: `ErrorBoundary.tsx` imports from `sentry`
- R-ERR-11: `grep -c "captureException" components/ErrorBoundary.tsx` returns 3+
- R-ERR-12: `errorHandler.ts` calls `captureException`
- R-ERR-13: When DSN is not set, `captureException` is a no-op -- test assertion
- R-ERR-14: `npx vitest run src/__tests__/services/sentry.test.ts` exits 0
- R-ERR-15: `cd server && npx vitest run __tests__/lib/sentry.test.ts` exits 0

#### Verification Command

```bash
grep "@sentry/react" package.json && grep "@sentry/node" server/package.json && grep -c "captureException" components/ErrorBoundary.tsx server/middleware/errorHandler.ts && npx vitest run src/__tests__/services/sentry.test.ts && cd server && npx vitest run __tests__/lib/sentry.test.ts
```

---

## Phase 3 -- Form Validation + Team Invites

**Phase Type**: `module`

### Story S-007: EditLoadForm Carrier Rate + Date Validation

#### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `components/EditLoadForm.tsx` | In `validateForm()` (line 158): (1) if `carrierRate < 0`, push error "Carrier rate cannot be negative". (2) if `driverPay < 0`, push error "Driver pay cannot be negative". (3) Extract first pickup date and last dropoff date; if `pickup > dropoff`, push error "Pickup date must be before dropoff date". Add `min="0"` to rate `<input>` elements. | `src/__tests__/components/EditLoadForm.validation.test.tsx` | unit |

#### Done When

- R-VAL-01: `validateForm()` checks `carrierRate < 0` -- grep confirms
- R-VAL-02: `validateForm()` checks `driverPay < 0` -- grep confirms
- R-VAL-03: `validateForm()` compares pickup/dropoff dates
- R-VAL-04: Rate inputs have `min="0"` or `min={0}` attribute
- R-VAL-05: Negative carrier rate shows error message -- test assertion
- R-VAL-06: Invalid date range (pickup after dropoff) shows error -- test assertion
- R-VAL-07: `npx vitest run src/__tests__/components/EditLoadForm.validation.test.tsx` exits 0

#### Verification Command

```bash
grep -n "carrierRate.*< 0\|driverPay.*< 0" components/EditLoadForm.tsx && npx vitest run src/__tests__/components/EditLoadForm.validation.test.tsx --reporter=verbose
```

---

### Story S-008: Team Invitation Flow

#### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| CREATE | `server/migrations/046_invitations.sql` | `CREATE TABLE invitations` (id PK, company_id FK, email, role, token UNIQUE, status ENUM('pending','accepted','expired','cancelled'), invited_by, expires_at, accepted_at, created_at) | `server/__tests__/routes/invitations.test.ts` | integration |
| CREATE | `server/schemas/invitation.ts` | `createInvitationSchema` ({email, role}), `acceptInvitationSchema` ({name, password}) | `server/__tests__/schemas/invitation.test.ts` | unit |
| CREATE | `server/services/invitation.service.ts` | `createInvitation(companyId, email, role, invitedBy)` generates token, sends email via notification service, inserts row. `acceptInvitation(token, name, password)` validates token+expiry, creates Firebase user, creates SQL user, marks accepted. `getCompanyInvitations(companyId)` lists. | `server/__tests__/services/invitation.test.ts` | unit |
| CREATE | `server/routes/invitations.ts` | 4 endpoints (see Interface Contracts) | `server/__tests__/routes/invitations.test.ts` | integration |
| MODIFY | `server/index.ts` | Register `invitationsRouter` | -- | -- |

#### Interface Contracts

| Endpoint | Auth | Body | Response |
|----------|------|------|----------|
| `POST /api/invitations` | admin + requireTenant | `{email, role}` | 201 `{id, token, email, role, status, expires_at}` |
| `GET /api/invitations` | authenticated + requireTenant | -- | 200 `[{id, email, role, status, expires_at}]` |
| `POST /api/invitations/:token/accept` | public (rate-limited: 5/15min) | `{name, password}` | 201 `{user}` |
| `DELETE /api/invitations/:id` | admin + requireTenant | -- | 204 |

#### Data Flow

```
Admin invites team member:
  POST /api/invitations {email: "driver@co.com", role: "driver"}
    → createInvitation(companyId, email, role, adminId)
    → Generate crypto.randomUUID() token
    → INSERT INTO invitations (token, status='pending', expires_at=now+7d)
    → sendEmail({to: email, subject: "You've been invited to LoadPilot", body: acceptUrl})
    → 201 {id, token, email, status}

Driver accepts:
  POST /api/invitations/:token/accept {name: "John", password: "..."}
    → SELECT invitation WHERE token=? AND status='pending' AND expires_at > NOW()
    → If expired: 410 Gone
    → If already accepted: 409 Conflict
    → createUserWithEmailAndPassword(email, password) in Firebase
    → sendEmailVerification(user)
    → INSERT INTO users (companyId from invitation, role from invitation)
    → UPDATE invitations SET status='accepted', accepted_at=NOW()
    → 201 {user}
```

#### Done When

- R-INV-01: `046_invitations.sql` has `CREATE TABLE invitations` with `token` UNIQUE column
- R-INV-02: `invitation.service.ts` exports `createInvitation` and `acceptInvitation`
- R-INV-03: `invitations.ts` has 4 route handlers (POST create, GET list, POST accept, DELETE cancel)
- R-INV-04: POST create uses `validateBody(createInvitationSchema)`
- R-INV-05: POST accept is rate-limited (5 req / 15 min)
- R-INV-06: Acceptance creates user with correct `company_id` from invitation -- test assertion
- R-INV-07: Expired invitation returns 410 Gone -- test assertion
- R-INV-08: Already-accepted invitation returns 409 Conflict -- test assertion
- R-INV-09: `server/index.ts` registers `invitationsRouter` -- grep confirms
- R-INV-10: `cd server && npx vitest run __tests__/services/invitation.test.ts` exits 0
- R-INV-11: `cd server && npx vitest run __tests__/routes/invitations.test.ts` exits 0

#### Verification Command

```bash
cd server && grep "invitationsRouter" index.ts && npx vitest run __tests__/services/invitation.test.ts __tests__/routes/invitations.test.ts --reporter=verbose
```

---

## Phase 4 -- Accessibility

**Phase Type**: `module`

### Story S-009: Icon Button aria-labels + Status Indicator Text

#### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | 12+ component files | Add `aria-label` to all icon-only buttons: X (Close), Trash2 (Delete), Plus (Add), Filter, Search, MoreHorizontal (More options), ChevronLeft/Right (Navigate), RefreshCw (Refresh). Target files: LoadList, LoadDetailView, BookingPortal, QuoteManager, BrokerManager, ExceptionConsole, FileVault, IFTAManager, CommandCenterView, OperationalMessaging, CalendarView, DataImportWizard. | `src/__tests__/accessibility/icon-buttons.test.tsx` | unit |
| MODIFY | Status display components | Add `<span className="sr-only">` text alongside color-only status dots in LoadList, BookingPortal, CalendarView, DispatcherTimeline. | `src/__tests__/accessibility/status-indicators.test.tsx` | unit |

#### Done When

- R-A11Y-01: Zero `<button>` with only an icon child (X, Trash2, Plus, etc.) lacking `aria-label` in target files
- R-A11Y-02: All Trash2/delete buttons have `aria-label` containing "delete" or "remove"
- R-A11Y-03: Color-only status dots have adjacent `sr-only` text -- test assertion
- R-A11Y-04: 30+ new `aria-label` attributes added across codebase (grep count increase)
- R-A11Y-05: `npx vitest run src/__tests__/accessibility/icon-buttons.test.tsx` exits 0
- R-A11Y-06: `npx vitest run src/__tests__/accessibility/status-indicators.test.tsx` exits 0

#### Verification Command

```bash
grep -rc "aria-label" components/ | sort -t: -k2 -rn | head -20 && npx vitest run src/__tests__/accessibility/icon-buttons.test.tsx src/__tests__/accessibility/status-indicators.test.tsx --reporter=verbose
```

---

### Story S-010: Modal Focus Trapping

#### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `components/BrokerManager.tsx` | Import `useFocusTrap`, add to broker detail modal ref | `src/__tests__/accessibility/focus-trap.test.tsx` | unit |
| MODIFY | `components/CalendarView.tsx` | Add `useFocusTrap` to event detail modal | same | unit |
| MODIFY | `components/FileVault.tsx` | Add `useFocusTrap` to file preview modal | same | unit |
| MODIFY | `components/ExceptionConsole.tsx` | Add `useFocusTrap` to exception detail modal | same | unit |
| MODIFY | `components/IFTAManager.tsx` | Add `useFocusTrap` to IFTA detail modal | same | unit |
| MODIFY | `components/LoadDetailView.tsx` | Add `useFocusTrap` to detail overlay | same | unit |

#### Done When

- R-A11Y-07: `BrokerManager.tsx` imports and calls `useFocusTrap` -- grep 1+ match
- R-A11Y-08: `CalendarView.tsx` imports and calls `useFocusTrap` -- grep 1+ match
- R-A11Y-09: `FileVault.tsx` imports and calls `useFocusTrap` -- grep 1+ match
- R-A11Y-10: `ExceptionConsole.tsx` imports and calls `useFocusTrap` -- grep 1+ match
- R-A11Y-11: 11+ components total import `useFocusTrap` (up from 6)
- R-A11Y-12: `npx vitest run src/__tests__/accessibility/focus-trap.test.tsx` exits 0

#### Verification Command

```bash
grep -rl "useFocusTrap" components/ hooks/ | wc -l && npx vitest run src/__tests__/accessibility/focus-trap.test.tsx --reporter=verbose
```

---

## Phase Dependencies

- **Phase 0** (S-001, S-002, S-003): All 3 stories can run in **parallel** -- no shared file modifications.
- **Phase 1** (S-004): Must run **after Phase 0** -- both S-002 and S-004 modify `server/middleware/requireAuth.ts`.
- **Phase 2** (S-005, S-006): Can run in **parallel** with each other. Can start after Phase 0 (no dependency on Phase 1).
- **Phase 3** (S-007, S-008): Can run in **parallel** with each other. S-008 depends on Phase 1 (invitation acceptance calls `sendEmailVerification`).
- **Phase 4** (S-009, S-010): Can run in **parallel**. No dependencies on earlier phases.

## Out of Scope

- Rate limiting Redis store (document limitation for PoC; Redis for scale)
- Frontend invitation UI (backend API is critical path; UI is follow-up sprint)
- Full WCAG 2.1 AA audit (S-009/S-010 cover Level A critical items only)
- Sentry performance monitoring (error tracking only)
- Load testing / k6 benchmarks
- Custom domain / Cloud Run app.yaml (company-specific deployment config)
- Monitoring dashboards / alerting pipelines (Sentry covers error tracking)

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Email verification blocks existing test users | High | Medium | `NODE_ENV === "test"` bypass in requireAuth; test fixtures use verified tokens |
| Token revocation adds latency to every request | Low | Medium | Single indexed SELECT query; < 1ms overhead |
| Sentry SDK increases bundle size | Low | Low | Tree-shaking; lazy init; no-op when DSN unset |
| Invitation acceptance without frontend UI | Medium | Low | Accept endpoint works via API/email link; UI is follow-up |
| ComponentErrorBoundary changes break layout | Low | Low | Existing component renders inline card; no layout shift |

## Summary

| Phase | Stories | R-markers | Parallel Group |
|-------|---------|-----------|----------------|
| 0 Server Security | S-001, S-002, S-003 | 22 (R-SEC-01..22) | All 3 parallel |
| 1 Auth Hardening | S-004 | 10 (R-AUTH-01..10) | Sequential (after Phase 0) |
| 2 Error Resilience | S-005, S-006 | 15 (R-ERR-01..15) | 2 parallel |
| 3 Validation + Invites | S-007, S-008 | 18 (R-VAL-01..07, R-INV-01..11) | 2 parallel |
| 4 Accessibility | S-009, S-010 | 12 (R-A11Y-01..12) | 2 parallel |
| **Total** | **10 stories** | **77 R-markers** | |
