# Route Access Matrix

Date: 2026-03-23
Team: Team 01 Platform
Source: `server/routes/*.ts`, `server/middleware/*.ts`

---

## Middleware Summary

### `requireAuth` (server/middleware/requireAuth.ts)

- Verifies Firebase ID token from `Authorization: Bearer <token>` header
- Resolves SQL principal by Firebase UID via `resolveSqlPrincipalByFirebaseUid()`
- Populates `req.user` with `{ id, uid, tenantId, companyId, role, email, firebaseUid }`
- Returns 401 if token missing/invalid, 500 if Firebase not configured

### `requireTenant` (server/middleware/requireTenant.ts)

- Must run AFTER `requireAuth` (depends on `req.user`)
- Checks `:companyId` URL param against `req.user.tenantId`
- Checks `req.body.company_id` or `req.body.companyId` against `req.user.tenantId`
- Returns 403 on mismatch or if tenant not resolved

### `requireTier` (server/middleware/requireTier.ts)

- Factory: `requireTier(...allowedTiers)` returns middleware
- Must run AFTER `requireAuth`
- Looks up `subscription_tier` and `subscription_status` from `companies` table
- Blocks `past_due` status regardless of tier (403)
- Blocks wrong tier with 403 including `required_tiers`, `current_tier`, `upgrade_url`
- Missing tier defaults to "Records Vault"
- Tiers: "Records Vault" | "Automation Pro" | "Fleet Core" | "Fleet Command"
- Per-request cache (1 DB query even with multiple requireTier calls)

### `validateBody` (server/middleware/validate.ts)

- Zod schema validation for `req.body`
- Returns structured field-level validation errors

### `routeProtection` (server/middleware/routeProtection.ts)

- Defines public route allowlist
- Production: only `GET /api/health` is public
- Dev/staging: adds `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/companies`, `POST /api/users`
- NOTE: This allowlist is informational only -- it is NOT applied as global middleware. Each route applies its own auth chain.

### Global Middleware (applied in server/index.ts)

- `helmet()`, `compression()`, `cors()` -- all routes
- `express.json()` -- all routes (except Stripe webhook which is mounted before)
- `correlationId` -- all routes
- `metricsMiddleware` -- all routes
- Rate limiter: 100 requests / 15 min on `/api/*`
- **No global `requireAuth`** -- each router applies auth individually

### Inline Role Checks (not middleware, but in-handler)

- Several routes check `req.user.role` directly in the handler body
- These are noted as "inline role check" in the matrix below

---

## Route Groups

### /api/loads (server/routes/loads.ts)

| Method | Path                             | Auth        | Tenant Source                                                                         | Roles             | Tier Gate | Callers                            |
| ------ | -------------------------------- | ----------- | ------------------------------------------------------------------------------------- | ----------------- | --------- | ---------------------------------- |
| GET    | `/api/loads`                     | requireAuth | requireTenant; companyId from `req.user.tenantId`                                     | Any authenticated | None      | LoadManagement, Dashboard          |
| POST   | `/api/loads`                     | requireAuth | requireTenant; companyId from `req.user.tenantId`; rejects body `company_id` mismatch | Any authenticated | None      | LoadManagement (create/edit)       |
| GET    | `/api/loads/counts`              | requireAuth | requireTenant; companyId from `req.user.tenantId`                                     | Any authenticated | None      | Dashboard                          |
| PATCH  | `/api/loads/:id/status`          | requireAuth | requireTenant; companyId from `req.user.tenantId`; idempotency middleware             | Any authenticated | None      | LoadManagement (status transition) |
| DELETE | `/api/loads/:id`                 | requireAuth | requireTenant; companyId from `req.user.tenantId`                                     | Any authenticated | None      | LoadManagement (soft-delete)       |
| POST   | `/api/loads/:id/change-requests` | requireAuth | requireTenant; companyId from `req.user.tenantId`                                     | Any authenticated | None      | LoadManagement (change requests)   |
| GET    | `/api/loads/:id/change-requests` | requireAuth | requireTenant; companyId from `req.user.tenantId`                                     | Any authenticated | None      | LoadManagement (change requests)   |

**Notes:**

- POST validates body with `createLoadSchema`; PATCH validates with `updateLoadStatusSchema`
- DELETE only allowed for statuses: draft, planned, cancelled
- PATCH /status uses `loadService.transitionLoad` state machine with idempotency

---

### /api/quotes (server/routes/quotes.ts)

| Method | Path                      | Auth        | Tenant Source                                                                                        | Roles             | Tier Gate | Callers      |
| ------ | ------------------------- | ----------- | ---------------------------------------------------------------------------------------------------- | ----------------- | --------- | ------------ |
| GET    | `/api/quotes`             | requireAuth | requireTenant; companyId from `req.user.tenantId`                                                    | Any authenticated | None      | QuoteManager |
| GET    | `/api/quotes/:id`         | requireAuth | requireTenant; companyId from `req.user.tenantId`; handler verifies `quote.company_id === companyId` | Any authenticated | None      | QuoteManager |
| POST   | `/api/quotes`             | requireAuth | requireTenant; companyId from `req.user.tenantId`                                                    | Any authenticated | None      | QuoteManager |
| PATCH  | `/api/quotes/:id`         | requireAuth | requireTenant; companyId from `req.user.tenantId`; handler verifies ownership                        | Any authenticated | None      | QuoteManager |
| PATCH  | `/api/quotes/:id/archive` | requireAuth | requireTenant; companyId from `req.user.tenantId`; handler verifies ownership                        | Any authenticated | None      | QuoteManager |

**Notes:**

- POST validates with `createQuoteSchema`; PATCH validates with `updateQuoteSchema`
- Pagination supported: `?page=1&limit=50`

---

### /api/bookings (server/routes/bookings.ts)

| Method | Path                | Auth        | Tenant Source                                                                 | Roles             | Tier Gate | Callers                     |
| ------ | ------------------- | ----------- | ----------------------------------------------------------------------------- | ----------------- | --------- | --------------------------- |
| GET    | `/api/bookings`     | requireAuth | requireTenant; companyId from `req.user.tenantId`                             | Any authenticated | None      | QuoteManager (Bookings tab) |
| GET    | `/api/bookings/:id` | requireAuth | requireTenant; companyId from `req.user.tenantId`; handler verifies ownership | Any authenticated | None      | QuoteManager                |
| POST   | `/api/bookings`     | requireAuth | requireTenant; companyId from `req.user.tenantId`                             | Any authenticated | None      | QuoteManager                |
| PATCH  | `/api/bookings/:id` | requireAuth | requireTenant; companyId from `req.user.tenantId`; handler verifies ownership | Any authenticated | None      | QuoteManager                |

**Notes:**

- POST validates with `createBookingSchema`; PATCH validates with `updateBookingSchema`
- Pagination supported: `?page=1&limit=50`

---

### /api/clients (server/routes/clients.ts)

| Method | Path                         | Auth        | Tenant Source                                                                         | Roles                                | Tier Gate | Callers                       |
| ------ | ---------------------------- | ----------- | ------------------------------------------------------------------------------------- | ------------------------------------ | --------- | ----------------------------- |
| GET    | `/api/clients/:companyId`    | requireAuth | requireTenant; `:companyId` URL param checked against `req.user.tenantId`             | Any authenticated                    | None      | BrokerNetwork, LoadManagement |
| POST   | `/api/clients`               | requireAuth | requireTenant; companyId from `req.user.tenantId`; rejects body `company_id` mismatch | Any authenticated                    | None      | BrokerNetwork                 |
| PATCH  | `/api/clients/:id/archive`   | requireAuth | requireTenant; tenantId from `req.user.tenantId`                                      | **admin, dispatcher** (inline check) | None      | BrokerNetwork                 |
| PATCH  | `/api/clients/:id/unarchive` | requireAuth | requireTenant; tenantId from `req.user.tenantId`                                      | **admin, dispatcher** (inline check) | None      | BrokerNetwork                 |

**Notes:**

- POST validates with `createClientSchema`
- Archive/unarchive has explicit `ARCHIVE_ALLOWED_ROLES = ["admin", "dispatcher"]` inline check
- GET supports `?include_archived=true` query param

---

### /api/companies (server/routes/clients.ts -- same file)

| Method | Path                 | Auth        | Tenant Source                                                                                        | Roles             | Tier Gate | Callers              |
| ------ | -------------------- | ----------- | ---------------------------------------------------------------------------------------------------- | ----------------- | --------- | -------------------- |
| GET    | `/api/companies/:id` | requireAuth | requireTenant + inline tenant check: `req.params.id === req.user.tenantId` (returns 403 on mismatch) | Any authenticated | None      | Auth/Login, Settings |
| POST   | `/api/companies`     | requireAuth | requireTenant                                                                                        | Any authenticated | None      | Signup, Settings     |

**FIXED in rework:** `GET /api/companies/:id` now has an inline tenant authorization check at the top of the handler that verifies `req.params.id === req.user.tenantId` before any database query. Returns 403 if the requested company ID does not match the authenticated user's tenant. This closes the cross-tenant read vulnerability caused by the `:id`/`:companyId` param name mismatch with `requireTenant`.

---

### /api/parties (server/routes/clients.ts -- same file)

| Method | Path           | Auth        | Tenant Source                                               | Roles             | Tier Gate | Callers                        |
| ------ | -------------- | ----------- | ----------------------------------------------------------- | ----------------- | --------- | ------------------------------ |
| GET    | `/api/parties` | requireAuth | requireTenant; companyId from `req.user.tenantId`           | Any authenticated | None      | BrokerNetwork (Unified Engine) |
| POST   | `/api/parties` | requireAuth | requireTenant; companyId from body `companyId`/`company_id` | Any authenticated | None      | BrokerNetwork (Unified Engine) |

**Notes:**

- POST validates with `createPartySchema`
- POST uses `req.user.tenantId` for rate_rows and constraint_sets but uses `body.companyId || body.company_id` for the parties table insert (`finalCompanyId`). `requireTenant` would catch a mismatch if body contains `company_id`, but the logic is fragile.

---

### /api/global-search (server/routes/clients.ts -- same file)

| Method | Path                 | Auth        | Tenant Source                                      | Roles             | Tier Gate | Callers                   |
| ------ | -------------------- | ----------- | -------------------------------------------------- | ----------------- | --------- | ------------------------- |
| GET    | `/api/global-search` | requireAuth | requireTenant; companyId from `req.user.companyId` | Any authenticated | None      | GlobalSearch (header bar) |

**Notes:**

- Searches loads, customers, users (Firestore), and quotes scoped to companyId
- Results capped at 20

---

### /api/providers (server/routes/providers.ts)

| Method | Path                         | Auth        | Tenant Source                                                                 | Roles             | Tier Gate | Callers       |
| ------ | ---------------------------- | ----------- | ----------------------------------------------------------------------------- | ----------------- | --------- | ------------- |
| GET    | `/api/providers`             | requireAuth | requireTenant; companyId from `req.user.tenantId`                             | Any authenticated | None      | BrokerNetwork |
| POST   | `/api/providers`             | requireAuth | requireTenant; companyId from `req.user.tenantId`                             | Any authenticated | None      | BrokerNetwork |
| PATCH  | `/api/providers/:id`         | requireAuth | requireTenant; companyId from `req.user.tenantId`; handler verifies ownership | Any authenticated | None      | BrokerNetwork |
| PATCH  | `/api/providers/:id/archive` | requireAuth | requireTenant; companyId from `req.user.tenantId`; handler verifies ownership | Any authenticated | None      | BrokerNetwork |

**Notes:**

- POST validates with `createProviderSchema`; PATCH validates with `updateProviderSchema`
- Pagination supported: `?page=1&limit=50`

---

### /api/contacts (server/routes/contacts.ts)

| Method | Path                        | Auth        | Tenant Source                                                                 | Roles             | Tier Gate | Callers       |
| ------ | --------------------------- | ----------- | ----------------------------------------------------------------------------- | ----------------- | --------- | ------------- |
| GET    | `/api/contacts`             | requireAuth | requireTenant; companyId from `req.user.tenantId`                             | Any authenticated | None      | BrokerNetwork |
| POST   | `/api/contacts`             | requireAuth | requireTenant; companyId from `req.user.tenantId`                             | Any authenticated | None      | BrokerNetwork |
| PATCH  | `/api/contacts/:id`         | requireAuth | requireTenant; companyId from `req.user.tenantId`; handler verifies ownership | Any authenticated | None      | BrokerNetwork |
| PATCH  | `/api/contacts/:id/archive` | requireAuth | requireTenant; companyId from `req.user.tenantId`; handler verifies ownership | Any authenticated | None      | BrokerNetwork |

**Notes:**

- POST validates with `createContactSchema`; PATCH validates with `updateContactSchema`
- Pagination supported: `?page=1&limit=50`

---

### /api/accounting (server/routes/accounting.ts)

| Method | Path                                    | Auth        | Tenant Source                                    | Roles                  | Tier Gate | Callers                              |
| ------ | --------------------------------------- | ----------- | ------------------------------------------------ | ---------------------- | --------- | ------------------------------------ |
| GET    | `/api/accounting/accounts`              | requireAuth | requireTenant; tenantId from `req.user.tenantId` | Any authenticated      | None      | AccountingPortal (Chart of Accounts) |
| GET    | `/api/accounting/load-pl/:loadId`       | requireAuth | requireTenant; tenantId from `req.user.tenantId` | Any authenticated      | None      | AccountingPortal (Load P&L)          |
| POST   | `/api/accounting/journal`               | requireAuth | requireTenant; tenantId from `req.user.tenantId` | ACCOUNTING_WRITE_ROLES | None      | AccountingPortal (Journal Entry)     |
| POST   | `/api/accounting/invoices`              | requireAuth | requireTenant; tenantId from `req.user.tenantId` | ACCOUNTING_WRITE_ROLES | None      | AccountingPortal (AR Invoices)       |
| GET    | `/api/accounting/invoices`              | requireAuth | requireTenant; tenantId from `req.user.tenantId` | Any authenticated      | None      | AccountingPortal (AR Invoices)       |
| POST   | `/api/accounting/bills`                 | requireAuth | requireTenant; tenantId from `req.user.tenantId` | ACCOUNTING_WRITE_ROLES | None      | AccountingPortal (AP Bills)          |
| GET    | `/api/accounting/bills`                 | requireAuth | requireTenant; tenantId from `req.user.tenantId` | Any authenticated      | None      | AccountingPortal (AP Bills)          |
| GET    | `/api/accounting/settlements`           | requireAuth | requireTenant; tenantId from `req.user.tenantId` | Any authenticated      | None      | DriverPaySettlements                 |
| POST   | `/api/accounting/settlements`           | requireAuth | requireTenant; tenantId from `req.user.tenantId` | ACCOUNTING_WRITE_ROLES | None      | DriverPaySettlements                 |
| PATCH  | `/api/accounting/settlements/batch`     | requireAuth | requireTenant; tenantId from `req.user.tenantId` | ACCOUNTING_WRITE_ROLES | None      | DriverPaySettlements                 |
| GET    | `/api/accounting/docs`                  | requireAuth | requireTenant; tenantId from `req.user.tenantId` | Any authenticated      | None      | AccountingPortal (Document Vault)    |
| POST   | `/api/accounting/docs`                  | requireAuth | requireTenant; tenantId from `req.user.tenantId` | ACCOUNTING_WRITE_ROLES | None      | AccountingPortal (Document Vault)    |
| PATCH  | `/api/accounting/docs/:id`              | requireAuth | requireTenant; tenantId from `req.user.tenantId` | ACCOUNTING_WRITE_ROLES | None      | AccountingPortal (Document Vault)    |
| GET    | `/api/accounting/ifta-evidence/:loadId` | requireAuth | requireTenant; tenantId from `req.user.tenantId` | Any authenticated      | None      | IFTA module                          |
| POST   | `/api/accounting/ifta-analyze`          | requireAuth | requireTenant                                    | ACCOUNTING_WRITE_ROLES | None      | IFTA module                          |
| POST   | `/api/accounting/ifta-audit-lock`       | requireAuth | requireTenant; tenantId from `req.user.tenantId` | ACCOUNTING_WRITE_ROLES | None      | IFTA module                          |
| GET    | `/api/accounting/ifta-summary`          | requireAuth | requireTenant; tenantId from `req.user.tenantId` | Any authenticated      | None      | IFTA module                          |
| GET    | `/api/accounting/mileage`               | requireAuth | requireTenant; tenantId from `req.user.tenantId` | Any authenticated      | None      | IFTA module                          |
| POST   | `/api/accounting/mileage`               | requireAuth | requireTenant; tenantId from `req.user.tenantId` | ACCOUNTING_WRITE_ROLES | None      | IFTA module                          |
| POST   | `/api/accounting/ifta-post`             | requireAuth | requireTenant; tenantId from `req.user.tenantId` | ACCOUNTING_WRITE_ROLES | None      | IFTA module                          |
| POST   | `/api/accounting/adjustments`           | requireAuth | requireTenant; tenantId from `req.user.tenantId` | ACCOUNTING_WRITE_ROLES | None      | AccountingPortal                     |
| POST   | `/api/accounting/batch-import`          | requireAuth | requireTenant; tenantId from `req.user.tenantId` | ACCOUNTING_WRITE_ROLES | None      | AccountingPortal (Import)            |

**Notes:**

- POST /journal validates with `createJournalEntrySchema`
- POST /invoices validates with `createInvoiceSchema`; auto-posts to GL
- POST /bills validates with `createBillSchema`; auto-posts to GL
- POST /settlements validates with `createSettlementSchema`; auto-posts to GL
- PATCH /settlements/batch validates with `batchUpdateSettlementsSchema`
- POST /docs validates with `createDocumentVaultSchema`
- POST /batch-import validates with `batchImportSchema`
- **FIXED in rework:** All 13 write endpoints (POST/PATCH) now gated with `requireRole(...ACCOUNTING_WRITE_ROLES)` middleware. ACCOUNTING_WRITE_ROLES = `admin`, `dispatcher`, `payroll_manager`, `OWNER_ADMIN`, `ORG_OWNER_SUPER_ADMIN`, `FINANCE`, `ACCOUNTING_AR`, `ACCOUNTING_AP`, `PAYROLL_SETTLEMENTS`. GET endpoints remain open to any authenticated user within the tenant.

---

### /api/safety (server/routes/safety.ts)

| Method | Path                           | Auth        | Tenant Source                                     | Roles               | Tier Gate | Callers                       |
| ------ | ------------------------------ | ----------- | ------------------------------------------------- | ------------------- | --------- | ----------------------------- |
| GET    | `/api/safety/quizzes`          | requireAuth | requireTenant; companyId from `req.user.tenantId` | Any authenticated   | None      | SafetyView (Quizzes tab)      |
| GET    | `/api/safety/quizzes/:id`      | requireAuth | requireTenant; companyId from `req.user.tenantId` | Any authenticated   | None      | SafetyView                    |
| POST   | `/api/safety/quizzes`          | requireAuth | requireTenant; companyId from `req.user.tenantId` | SAFETY_MANAGE_ROLES | None      | SafetyView                    |
| GET    | `/api/safety/quiz-results`     | requireAuth | requireTenant; companyId from `req.user.tenantId` | Any authenticated   | None      | SafetyView (Quiz Results tab) |
| POST   | `/api/safety/quiz-results`     | requireAuth | requireTenant; companyId from `req.user.tenantId` | Any authenticated   | None      | SafetyView                    |
| GET    | `/api/safety/maintenance`      | requireAuth | requireTenant; companyId from `req.user.tenantId` | Any authenticated   | None      | SafetyView (Maintenance tab)  |
| GET    | `/api/safety/maintenance/:id`  | requireAuth | requireTenant; companyId from `req.user.tenantId` | Any authenticated   | None      | SafetyView                    |
| POST   | `/api/safety/maintenance`      | requireAuth | requireTenant; companyId from `req.user.tenantId` | SAFETY_MANAGE_ROLES | None      | SafetyView                    |
| GET    | `/api/safety/vendors`          | requireAuth | requireTenant; companyId from `req.user.tenantId` | Any authenticated   | None      | SafetyView (Vendors tab)      |
| GET    | `/api/safety/vendors/:id`      | requireAuth | requireTenant; companyId from `req.user.tenantId` | Any authenticated   | None      | SafetyView                    |
| POST   | `/api/safety/vendors`          | requireAuth | requireTenant; companyId from `req.user.tenantId` | SAFETY_MANAGE_ROLES | None      | SafetyView                    |
| GET    | `/api/safety/activity`         | requireAuth | requireTenant; companyId from `req.user.tenantId` | Any authenticated   | None      | SafetyView (Activity tab)     |
| POST   | `/api/safety/activity`         | requireAuth | requireTenant; companyId from `req.user.tenantId` | Any authenticated   | None      | SafetyView                    |
| GET    | `/api/safety/expiring-certs`   | requireAuth | requireTenant; companyId from `req.user.tenantId` | Any authenticated   | None      | SafetyView (Compliance tab)   |
| GET    | `/api/safety/fmcsa/:dotNumber` | requireAuth | requireTenant                                     | Any authenticated   | None      | SafetyView (FMCSA tab)        |

**Notes:**

- FMCSA endpoint queries external service, does not use tenantId for data scoping
- **FIXED in rework:** POST /safety/quizzes, POST /safety/maintenance, POST /safety/vendors now gated with `requireRole(...SAFETY_MANAGE_ROLES)`. SAFETY_MANAGE_ROLES = `admin`, `safety_manager`, `dispatcher`, `OWNER_ADMIN`, `ORG_OWNER_SUPER_ADMIN`, `SAFETY_MAINT`, `SAFETY_COMPLIANCE`, `MAINTENANCE_MANAGER`, `OPS_MANAGER`.
- POST /safety/quiz-results intentionally left ungated: drivers must be able to submit their own quiz results.
- POST /safety/activity intentionally left ungated: any user can log activity entries (audit trail).

---

### /api/incidents (server/routes/incidents.ts)

| Method | Path                         | Auth        | Tenant Source                                                                                          | Roles             | Tier Gate | Callers                      |
| ------ | ---------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ | ----------------- | --------- | ---------------------------- |
| GET    | `/api/incidents`             | requireAuth | requireTenant; companyId from `req.user.tenantId`                                                      | Any authenticated | None      | OperationsCenter, SafetyView |
| POST   | `/api/incidents`             | requireAuth | requireTenant; companyId from `req.user.tenantId`                                                      | Any authenticated | None      | OperationsCenter             |
| POST   | `/api/incidents/:id/actions` | requireAuth | requireTenant; companyId from `req.user.tenantId`; handler verifies incident belongs to tenant         | Any authenticated | None      | OperationsCenter             |
| POST   | `/api/incidents/:id/charges` | requireAuth | requireTenant; tenantId from `req.user.tenantId`; handler verifies `incidents.company_id === tenantId` | Any authenticated | None      | OperationsCenter             |

**Notes:**

- POST /incidents validates FK: checks load exists before insert
- POST /incidents/:id/actions validates incident exists and belongs to tenant via repository
- POST /incidents/:id/charges has explicit cross-tenant block with warning log

---

### /api/exceptions (server/routes/exceptions.ts)

| Method | Path                         | Auth        | Tenant Source                                                         | Roles             | Tier Gate | Callers                               |
| ------ | ---------------------------- | ----------- | --------------------------------------------------------------------- | ----------------- | --------- | ------------------------------------- |
| GET    | `/api/exceptions`            | requireAuth | requireTenant; tenantId from `req.user.tenantId`                      | Any authenticated | None      | ExceptionManagement, OperationsCenter |
| POST   | `/api/exceptions`            | requireAuth | requireTenant; tenantId from `req.user.tenantId`                      | Any authenticated | None      | ExceptionManagement                   |
| PATCH  | `/api/exceptions/:id`        | requireAuth | requireTenant; tenantId from `req.user.tenantId`                      | Any authenticated | None      | ExceptionManagement                   |
| GET    | `/api/exceptions/:id/events` | requireAuth | requireTenant; tenantId from `req.user.tenantId` (JOIN on exceptions) | Any authenticated | None      | ExceptionManagement                   |
| GET    | `/api/exception-types`       | requireAuth | requireTenant                                                         | Any authenticated | None      | ExceptionManagement                   |

**Notes:**

- POST validates with `createExceptionSchema`; PATCH validates with `patchExceptionSchema`
- PATCH supports resolution hooks (cross-module updates for dispatch/billing/payroll)
- GET /exception-types queries global `exception_type` table (not tenant-scoped)
- GET /exceptions supports filtering: `?status=&type=&severity=&entityType=&entityId=&ownerId=`

---

### /api/tracking (server/routes/tracking.ts)

| Method | Path                      | Auth                 | Tenant Source                                             | Roles                                          | Tier Gate                     | Callers                    |
| ------ | ------------------------- | -------------------- | --------------------------------------------------------- | ---------------------------------------------- | ----------------------------- | -------------------------- |
| GET    | `/api/loads/tracking`     | requireAuth          | requireTenant; companyId from `req.user.tenantId`         | Any authenticated                              | **Fleet Core, Fleet Command** | FleetMap                   |
| GET    | `/api/loads/:id/tracking` | requireAuth          | requireTenant; companyId from `req.user.tenantId`         | Any authenticated                              | **Fleet Core, Fleet Command** | FleetMap, LoadManagement   |
| GET    | `/api/tracking/live`      | requireAuth          | requireTenant; companyId from `req.user.tenantId`         | Any authenticated                              | **Fleet Core, Fleet Command** | FleetMap (live GPS)        |
| POST   | `/api/tracking/webhook`   | **No Firebase auth** | companyId from `req.body.companyId` (may be "unresolved") | N/A -- API key auth via `X-GPS-API-Key` header | None                          | External ELD/GPS providers |

**Notes:**

- This is the ONLY route group using `requireTier`
- Tracking/live positions require "Fleet Core" or "Fleet Command" subscription tier
- Webhook uses custom API key auth (`X-GPS-API-Key` header validated against `GPS_WEBHOOK_SECRET` env var)
- Webhook has in-memory rate limiter: 1000 requests/minute per API key
- Webhook falls back to `companyId = "unresolved"` if not provided in body

---

### /api/users and /api/auth (server/routes/users.ts)

| Method | Path                       | Auth                                              | Tenant Source                                                             | Roles                                                          | Tier Gate | Callers                              |
| ------ | -------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------- | --------- | ------------------------------------ |
| POST   | `/api/auth/register`       | requireAuth                                       | requireTenant; companyId from `req.user.tenantId`                         | **admin only** (inline check)                                  | None      | Settings (User Management)           |
| POST   | `/api/users`               | requireAuth                                       | requireTenant; companyId from `req.user.tenantId`                         | **admin** OR **self-sync** (inline: `isAdmin \|\| isSelfSync`) | None      | Auth flow, Settings                  |
| POST   | `/api/auth/login`          | **No requireAuth** (Bearer token verified inline) | N/A -- auto-provisions company if needed                                  | Any (with valid Firebase token)                                | None      | Login page                           |
| POST   | `/api/auth/reset-password` | **No requireAuth**                                | N/A                                                                       | Any (unauthenticated)                                          | None      | Login page                           |
| GET    | `/api/users/me`            | requireAuth                                       | N/A (returns own profile)                                                 | Any authenticated                                              | None      | App shell, Settings                  |
| GET    | `/api/users/:companyId`    | requireAuth                                       | requireTenant; `:companyId` URL param checked against `req.user.tenantId` | Any authenticated                                              | None      | Settings (User Management), Dispatch |

**Notes:**

- POST /auth/register validates with `registerUserSchema`; admin-only
- POST /users validates with `syncUserSchema`; admin can create any user, non-admin can only sync themselves
- POST /auth/login validates with `loginUserSchema`; rate limited to 10/15min per IP; auto-provisions new company+admin if Firebase user has no SQL record
- POST /auth/reset-password validates with `resetPasswordSchema`; rate limited to 3/15min per IP; always returns 200 (no account enumeration)
- GET /users/me does NOT use requireTenant (by design -- fetches own profile)

---

### /api/documents (server/routes/documents.ts)

| Method | Path                          | Auth        | Tenant Source                                     | Roles             | Tier Gate | Callers                  |
| ------ | ----------------------------- | ----------- | ------------------------------------------------- | ----------------- | --------- | ------------------------ |
| GET    | `/api/documents`              | requireAuth | requireTenant; companyId from `req.user.tenantId` | Any authenticated | None      | DocumentManager          |
| POST   | `/api/documents`              | requireAuth | requireTenant; companyId from `req.user.tenantId` | Any authenticated | None      | DocumentManager (upload) |
| GET    | `/api/documents/:id/download` | requireAuth | requireTenant; companyId from `req.user.tenantId` | Any authenticated | None      | DocumentManager          |

**Notes:**

- POST uses multer for multipart file upload (memory storage, 10MB limit)
- MIME type filtering: only allowed types (see `ALLOWED_MIME_TYPES` in schema)
- Download returns signed URL, scoped to tenant via `svc.getDownloadUrl(id, companyId)`

---

## Summary of Security Findings

### 1. Cross-Tenant Risks

| Route                    | Issue                                                                                                                                                                             | Severity | Status                                                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/companies/:id` | URL param is `:id` not `:companyId`, so `requireTenant` middleware does not enforce param check.                                                                                  | **HIGH** | **FIXED in rework** -- inline tenant check added: `req.params.id === req.user.tenantId` returns 403 on mismatch                                     |
| `POST /api/parties`      | Uses `body.companyId \|\| body.company_id` for the parties table insert instead of `req.user.tenantId`. Tenant middleware catches body mismatch but the handler logic is fragile. | MEDIUM   | UNRESOLVED RISK -- requireTenant body check mitigates exploitation but handler logic remains fragile; not fixed in this rework to avoid scope creep |

### 2. Missing Role Gates

| Route Group                              | Issue                                                                                                                    | Recommendation                                                                    | Status                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `/api/accounting/*` (13 write endpoints) | No role restrictions on write ops. Drivers could create invoices, post journal entries, and batch-import financial data. | Restrict write endpoints to accounting roles                                      | **FIXED in rework** -- all 13 POST/PATCH endpoints gated with `requireRole(...ACCOUNTING_WRITE_ROLES)` |
| `/api/safety/quizzes` (POST)             | Any user can create quizzes                                                                                              | Restrict to admin/safety_manager                                                  | **FIXED in rework** -- gated with `requireRole(...SAFETY_MANAGE_ROLES)`                                |
| `/api/safety/maintenance` (POST)         | Any user can create maintenance records                                                                                  | Restrict to safety management roles                                               | **FIXED in rework** -- gated with `requireRole(...SAFETY_MANAGE_ROLES)`                                |
| `/api/safety/vendors` (POST)             | Any user can create safety vendors                                                                                       | Restrict to safety management roles                                               | **FIXED in rework** -- gated with `requireRole(...SAFETY_MANAGE_ROLES)`                                |
| `/api/safety/quiz-results` (POST)        | Any user can submit quiz results                                                                                         | Allow drivers to submit own results; restrict viewing all to admin/safety_manager | Intentionally ungated -- drivers submit their own results                                              |
| `/api/safety/activity` (POST)            | Any user can log activity                                                                                                | Audit trail -- any user                                                           | Intentionally ungated -- audit log entries                                                             |
| `/api/exceptions` (POST/PATCH)           | Any user can create and update exceptions                                                                                | Consider restricting PATCH to admin/dispatcher                                    | UNRESOLVED RISK -- not in scope for this rework                                                        |
| `/api/incidents` (POST)                  | Any user can create incidents                                                                                            | May be intentional (drivers report incidents)                                     | Intentionally ungated -- drivers report incidents                                                      |

### 3. Tier Gate Coverage

| Feature Area                                 | Tier Required                             | Status              |
| -------------------------------------------- | ----------------------------------------- | ------------------- |
| GPS Tracking (loads/tracking, tracking/live) | Fleet Core, Fleet Command                 | Enforced            |
| AI endpoints (not in audit scope)            | Automation Pro, Fleet Core, Fleet Command | Enforced (in ai.ts) |
| Accounting, Safety, Loads, Quotes, Bookings  | None                                      | No tier gates       |

### 4. Unauthenticated Endpoints

| Route                           | Auth Mechanism                 | Rate Limited                      |
| ------------------------------- | ------------------------------ | --------------------------------- |
| `GET /api/health`               | None (public)                  | No (mounted before rate limiter)  |
| `POST /api/auth/login`          | Firebase token verified inline | Yes (10/15min per IP)             |
| `POST /api/auth/reset-password` | None                           | Yes (3/15min per IP)              |
| `POST /api/tracking/webhook`    | `X-GPS-API-Key` header         | Yes (1000/min per key, in-memory) |

### 5. Routes with Inline Role Checks (Not Middleware)

| Route                              | Roles              | Check Location       |
| ---------------------------------- | ------------------ | -------------------- |
| `POST /api/auth/register`          | admin              | Handler line 115     |
| `POST /api/users`                  | admin OR self-sync | Handler line 165-168 |
| `PATCH /api/clients/:id/archive`   | admin, dispatcher  | Handler line 58      |
| `PATCH /api/clients/:id/unarchive` | admin, dispatcher  | Handler line 100     |

---

## Endpoint Count Summary

| Route Group                                 | Endpoints | Auth   | Tenant | Role-Gated | Tier-Gated |
| ------------------------------------------- | --------- | ------ | ------ | ---------- | ---------- |
| /api/loads                                  | 7         | 7      | 7      | 0          | 0          |
| /api/quotes                                 | 5         | 5      | 5      | 0          | 0          |
| /api/bookings                               | 4         | 4      | 4      | 0          | 0          |
| /api/clients (+ companies, parties, search) | 9         | 9      | 9      | 2          | 0          |
| /api/providers                              | 4         | 4      | 4      | 0          | 0          |
| /api/contacts                               | 4         | 4      | 4      | 0          | 0          |
| /api/accounting                             | 22        | 22     | 22     | **13**     | 0          |
| /api/safety                                 | 15        | 15     | 15     | **3**      | 0          |
| /api/incidents                              | 4         | 4      | 4      | 0          | 0          |
| /api/exceptions                             | 5         | 5      | 5      | 0          | 0          |
| /api/tracking                               | 4         | 3      | 3      | 0          | 3          |
| /api/users + auth                           | 6         | 4      | 4      | 2          | 0          |
| /api/documents                              | 3         | 3      | 3      | 0          | 0          |
| **TOTAL**                                   | **92**    | **89** | **89** | **20**     | **3**      |

- 89/92 endpoints require Firebase auth (97%)
- 89/92 endpoints enforce tenant isolation (97%)
- 20/92 endpoints have role-based access control (22%) -- up from 4 (4%) before rework
- Only 3/92 endpoints have subscription tier gates (3%)
- 3 unauthenticated endpoints (login, reset-password, webhook)
