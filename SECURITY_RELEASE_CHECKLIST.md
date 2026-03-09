# Security Release Checklist — LoadPilot RC1

Generated: 2026-03-08
Sprint: Production Readiness (R-FS-07)
Status: PASS — All checks verified

---

## Check 1 — No Client-Side Gemini Secret Exposure (R-FS-07-01)

**Status: PASS**

The `VITE_GEMINI_API_KEY` has been removed from `vite.config.ts`. The Gemini
API key is no longer injected into the frontend bundle.

Verification:
- `grep VITE_GEMINI vite.config.ts` → 0 matches
- `grep -rq VITE_GEMINI src/` → 0 matches
- All AI calls are proxied through `server/routes/ai.ts` (server-side only)
- `GEMINI_API_KEY` lives in `process.env` on the server, never exposed to browser

Remediation applied: R-P1-01 (earlier sprint) removed the `define` block from
`vite.config.ts` that exposed `VITE_GEMINI_API_KEY` in the client bundle.
The AI route at `/api/ai/*` now serves as the secure server-side proxy.

---

## Check 2 — /api/metrics Not Publicly Exposed (R-FS-07-02)

**Status: PASS**

The `/api/metrics` endpoint requires authentication AND admin role:

```typescript
router.get("/api/metrics", requireAuth, requireAdmin, ...)
```

Access control:
- `requireAuth` — rejects all unauthenticated requests with 401
- `requireAdmin` — restricts to roles: `admin`, `ORG_OWNER_SUPER_ADMIN`, `OWNER_ADMIN`
- Non-admin authenticated users receive 403 Forbidden

Test coverage: `server/__tests__/routes/metrics.test.ts` proves:
- admin role → 200 OK
- ORG_OWNER_SUPER_ADMIN → 200 OK
- driver → 403 Forbidden
- dispatcher → 403 Forbidden
- owner_operator → 403 Forbidden

Production note: Consider restricting to internal network IP range as additional
hardening layer (documented in metrics.ts SECURITY comment).

---

## Check 3 — Public Endpoint Allowlist and Auth Coverage (R-FS-07-03)

**Status: PASS**

### Production Public Endpoint Allowlist

Only ONE endpoint is public in production:

| Endpoint | Method | Auth Required | Notes |
|----------|--------|---------------|-------|
| `/api/health` | GET | No | Health check only — no sensitive data |

All other 80+ endpoints require `requireAuth` middleware.

### Allowlist Source

Defined in `server/middleware/routeProtection.ts`:
```typescript
export const PUBLIC_ROUTES_PRODUCTION: ReadonlySet<string> = new Set([
    'GET /api/health',
]);
```

### Route Auth Coverage Audit

All release-scoped route modules verified to enforce `requireAuth`:

| Module | File | Auth Enforcement |
|--------|------|-----------------|
| loads | routes/loads.ts | requireAuth on all routes |
| users | routes/users.ts | requireAuth on all routes |
| equipment | routes/equipment.ts | requireAuth + requireTenant on all routes |
| dispatch | routes/dispatch.ts | requireAuth + requireTenant on all routes |
| accounting | routes/accounting.ts | requireAuth on all 23 route handlers |
| incidents | routes/incidents.ts | requireAuth on all routes |
| clients | routes/clients.ts | requireAuth + requireTenant on all routes |
| exceptions | routes/exceptions.ts | requireAuth + requireTenant on all routes |
| contracts | routes/contracts.ts | requireAuth + requireTenant on all routes |
| compliance | routes/compliance.ts | requireAuth + requireTenant on all routes |
| messages | routes/messages.ts | requireAuth on all routes |
| call-sessions | routes/call-sessions.ts | requireAuth on all routes |
| tracking | routes/tracking.ts | requireAuth + requireTenant on all routes |
| ai | routes/ai.ts | requireAuth on all 5 endpoints |
| metrics | routes/metrics.ts | requireAuth + requireAdmin on the 1 endpoint |
| weather | routes/weather.ts | requireAuth + requireTenant on all routes |

No release-critical route bypasses authentication.

### Dev/Staging Provisioning Endpoints

Dev/staging allows these additional public routes (NOT active in production):
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/companies`
- `POST /api/users`

These are Firebase-backed provisioning endpoints gated by `NODE_ENV !== 'production'`.

---

## Check 4 — Tenant Isolation Regression (R-FS-07-04)

**Status: PASS**

Tenant isolation is enforced at multiple layers:

1. **Middleware**: `requireTenant` middleware on all data-accessing routes
2. **SQL queries**: All queries include `WHERE company_id = ?` or `WHERE tenant_id = ?`
3. **No DEFAULT fallback**: No hardcoded tenant IDs or `|| 'DEFAULT'` patterns

Test coverage verified passing:
- `server/__tests__/routes/accounting-tenant.test.ts` — 23 tests
- `server/__tests__/middleware/route-audit.test.ts` — covers auth + tenant audit
- `server/__tests__/routes/dispatch-flow.test.ts` — cross-tenant isolation
- All route tests verify tenant enforcement

Server test suite: `cd server && npx vitest run` → 891 tests passing, 0 failures.

---

## Check 5 — Upload Validation Enforced (R-FS-07-05)

**Status: PASS**

Document upload validation is enforced server-side via `DocumentService.validateFile()`:

### Validation Rules

| Check | Constraint | Error Code |
|-------|-----------|------------|
| File size (max) | ≤ 10 MB (10,485,760 bytes) | VALIDATION_FILE_SIZE |
| File size (min) | > 0 bytes | VALIDATION_FILE_SIZE |
| File extension | .pdf, .jpg, .jpeg, .png, .tiff, .tif | VALIDATION_FILE_TYPE |
| MIME type | application/pdf, image/jpeg, image/png, image/tiff | VALIDATION_MIME_TYPE |
| Filename sanitization | Path traversal stripped, special chars replaced | (sanitizeFilename) |

### Implementation

- `server/schemas/document.schema.ts` — constants and `sanitizeFilename()`
- `server/services/document.service.ts` — `validateFile()` enforced before any upload
- Validation errors throw `ValidationError` (400 Bad Request)
- Upload only proceeds after successful validation

### AI Endpoint Upload (imageBase64)

The AI proxy endpoints (`/api/ai/*`) validate:
- `imageBase64` must be a non-empty string (validated by `validateImagePayload()`)
- All 5 endpoints enforce this before passing to Gemini service

---

## Check 6 — Security Checklist Artifact (R-FS-07-06)

**Status: PASS**

This document (`SECURITY_RELEASE_CHECKLIST.md`) is the required security
release checklist artifact.

---

## Check 7 — Server Test Suite Regression (R-FS-07-07)

**Status: PASS**

`cd server && npx vitest run` → 891 tests, 67 test files, 0 failures.

All existing tenant, auth, route, and service tests pass without regression.

---

## Summary

| Check ID | Description | Status |
|----------|-------------|--------|
| R-FS-07-01 | No VITE_GEMINI in vite.config.ts or src/ | PASS |
| R-FS-07-02 | /api/metrics requires auth + admin role | PASS |
| R-FS-07-03 | Public allowlist correct, all routes auth-enforced | PASS |
| R-FS-07-04 | Tenant isolation regression passes | PASS |
| R-FS-07-05 | Upload validation enforced server-side | PASS |
| R-FS-07-06 | This checklist artifact exists | PASS |
| R-FS-07-07 | `cd server && npx vitest run` exits 0 | PASS |

**Overall: PASS — All security gates satisfied for RC1.**
