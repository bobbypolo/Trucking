# Plan: Full SaaS Integration Sprint — Stub Elimination

## Context

LoadPilot has 5,323 tests passing, 80% coverage, and 15+ feature modules — but several integrations remain stubbed. A multi-million dollar buyer meeting requires a fully functional SaaS with real payments, notifications, GPS tracking, and accounting integrations. This plan eliminates every stub and placeholder to deliver a production-ready product.

## V-Model SDLC Approach

Each story follows the V-Model lifecycle:

1. **Requirements** — acceptance criteria defined in story (left side)
2. **Design** — architecture follows existing patterns (FMCSA graceful fallback, middleware chain)
3. **Implementation** — code changes with TypeScript strict compliance
4. **Unit Tests** — service-level tests with mocked externals (verify logic)
5. **Integration Tests** — route-level tests with mocked DB/services (verify HTTP contracts)
6. **Functional Verification** — prove the feature works end-to-end by testing the actual behavior

### Test Level Definitions

| Level           | What It Proves                                       | How                                                                                    |
| --------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Unit**        | Service logic is correct                             | Mock external SDKs (Stripe, Twilio, Samsara, Intuit), test all code paths              |
| **Integration** | Routes accept correct input, return correct output   | Mock services, test HTTP status codes, auth enforcement, validation                    |
| **Functional**  | Feature actually works as a user would experience it | Test the full chain: route → service → (mocked) external → DB update → verify DB state |
| **Regression**  | Existing features not broken                         | Run full test suite after each wave (`npx vitest run`)                                 |

### Wave Gate Protocol

After each wave completes, ALL of these must pass before proceeding:

- `cd server && npx vitest run` — 0 failures
- `npx vitest run` — 0 failures
- `cd server && npx tsc --noEmit` — 0 errors
- `npx tsc --noEmit` — 0 errors

---

## Scope

| Integration                  | Current State                        | Target State                                     |
| ---------------------------- | ------------------------------------ | ------------------------------------------------ |
| **Stripe Payments**          | Card form captures data, discards it | Full Checkout Sessions + subscription management |
| **Subscription Enforcement** | All users get "active"               | Tier-gated features, billing portal              |
| **Twilio SMS**               | Returns "SMS not yet implemented"    | Real SMS delivery via Twilio                     |
| **QuickBooks**               | Returns 501 Not Implemented          | OAuth + one-way invoice/bill sync                |
| **GPS/ELD Tracking**         | Static positions from DB             | Provider-agnostic interface + Samsara adapter    |
| **Legacy Notifications**     | helpers.ts logs only                 | Wired to real notification-delivery service      |
| **Weather**                  | Feature-flagged off                  | Active when API key present (FMCSA pattern)      |

## Architecture Decisions

1. **Stripe Checkout** (not Elements) — Stripe handles PCI scope, no raw card data in our app
2. **Provider-agnostic GPS** — `GpsProvider` interface with adapters (Samsara first, extensible to Geotab/Motive)
3. **Graceful degradation everywhere** — follow FMCSA pattern: when API key missing, return `{ available: false, reason: "no_api_key" }`, never throw
4. **Token encryption for QuickBooks** — AES-256-GCM via `QUICKBOOKS_TOKEN_ENCRYPTION_KEY` env var

## Key Files (Reference Patterns)

- `server/services/fmcsa.service.ts` — graceful fallback pattern (reuse for all new services)
- `server/services/notification-delivery.service.ts` — multi-channel delivery pattern (extend for SMS)
- `server/middleware/requireAuth.ts` + `requireTenant.ts` — middleware chain pattern
- `server/errors/AppError.ts` — error class taxonomy
- `server/lib/sql-auth.ts:109-135` — company row mapper (must add subscription_tier + Stripe fields)
- `types.ts:909-912` — Company interface (has subscriptionTier but missing Stripe fields)
- `components/Auth.tsx:341-451` — processSignup (modify for Stripe redirect)
- `server/helpers.ts:52-55` — legacy sendNotification stub (wire to real service)
- `server/index.ts:60-78` — middleware registration order (Stripe webhook needs raw body BEFORE JSON parser)
- `components/GlobalMapViewEnhanced.tsx` — map component (needs new `/api/tracking/live` integration)

## Merge Conflict Mitigation

Multiple stories modify shared files. Ralph agents with worktree isolation must handle:

- **server/package.json**: S-201 (stripe), S-202 (twilio), S-204 (intuit-oauth) all add deps. Each `npm install <pkg>` in its worktree auto-handles this. Merge conflicts in package.json resolved via `npm install` on the merged branch.
- **server/index.ts**: S-301 (stripe router) and S-302 (quickbooks router) both add imports + `app.use()` calls. These stories are in the same wave — each adds to different lines (append-only), so git auto-merge handles this. If conflict occurs, retry sequentially.
- **types.ts**: S-201 needs Stripe fields added to Company interface. Only one story touches this.

---

## Stories (19 total, 5 waves)

### Wave 1: Database Migrations (4 stories, all parallel)

**S-101: Add subscription_tier column + wire through auth chain**

- Files: `server/migrations/027_add_subscription_tier.sql` (new), `server/lib/sql-auth.ts` (mod)
- SQL: `ALTER TABLE companies ADD COLUMN subscription_tier VARCHAR(30) DEFAULT 'Records Vault' AFTER subscription_status`
- sql-auth.ts changes:
  - Add `subscription_tier?: string | null;` to `SqlCompanyRow` interface (after line 47)
  - Add `subscription_tier: row.subscription_tier ?? "Records Vault",` and `subscriptionTier: row.subscription_tier ?? "Records Vault",` to `mapCompanyRowToApiCompany()` (after line 128)
- Acceptance Criteria:
  - [ ] Migration applies without error
  - [ ] Column exists with default 'Records Vault'
  - [ ] Existing rows get default value
  - [ ] `mapCompanyRowToApiCompany()` returns `subscriptionTier` field
  - [ ] Null subscription_tier defaults to "Records Vault" in mapper
- Tests (functional): Migration test + verify mapCompanyRowToApiCompany includes subscriptionTier
- Verification: `cd server && npx vitest run` passes

**S-102: Add Stripe columns to companies + wire through auth chain + types**

- Files: `server/migrations/028_stripe_subscriptions.sql` (new), `server/lib/sql-auth.ts` (mod), `types.ts` (mod)
- SQL: Add `stripe_customer_id VARCHAR(255) NULL`, `stripe_subscription_id VARCHAR(255) NULL`, `subscription_period_end DATETIME NULL`
- sql-auth.ts changes:
  - Add `stripe_customer_id`, `stripe_subscription_id`, `subscription_period_end` to `SqlCompanyRow`
  - Add mappings in `mapCompanyRowToApiCompany()`: `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionPeriodEnd`
- types.ts changes:
  - Add to Company interface (after line 911): `stripeCustomerId?: string;`, `stripeSubscriptionId?: string;`, `subscriptionPeriodEnd?: string;`
- Acceptance Criteria:
  - [ ] All three columns nullable in DB
  - [ ] Migration applies cleanly
  - [ ] Company interface in types.ts has Stripe fields
  - [ ] `mapCompanyRowToApiCompany()` returns Stripe fields
- Tests (functional): Migration test asserts all 3 columns exist
- Verification: `cd server && npx vitest run` passes, `npx tsc --noEmit` passes

**S-103: Add QuickBooks OAuth token table**

- Files: `server/migrations/029_quickbooks_tokens.sql` (new)
- SQL: `CREATE TABLE quickbooks_tokens (id VARCHAR(36) PK, company_id VARCHAR(36) NOT NULL UNIQUE, realm_id VARCHAR(50), access_token TEXT, refresh_token TEXT, token_type VARCHAR(20), expires_at DATETIME, created_at TIMESTAMP, updated_at TIMESTAMP)`
- Acceptance Criteria:
  - [ ] Table creates with UNIQUE constraint on company_id
  - [ ] DOWN migration drops table cleanly
- Tests (functional): Migration test creates table, inserts test row, verifies unique constraint rejects duplicate company_id
- Verification: `cd server && npx vitest run` passes

**S-104: Add GPS positions table**

- Files: `server/migrations/030_gps_positions.sql` (new)
- SQL: `CREATE TABLE gps_positions (id VARCHAR(36) PK, company_id VARCHAR(36), vehicle_id VARCHAR(36), driver_id VARCHAR(36) NULL, latitude DECIMAL(10,7), longitude DECIMAL(10,7), speed DECIMAL(6,2), heading DECIMAL(5,2), recorded_at DATETIME, provider VARCHAR(30), provider_vehicle_id VARCHAR(100), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)` + index on `(company_id, vehicle_id, recorded_at DESC)`
- Acceptance Criteria:
  - [ ] Table creates with compound index
  - [ ] Can insert and query by company_id + vehicle_id with ORDER BY recorded_at DESC
- Tests (functional): Migration test creates table, inserts positions, queries by company_id with ORDER BY, asserts correct order
- Verification: `cd server && npx vitest run` passes

**Wave 1 Gate**: All 4 migrations apply. Full server test suite passes. 0 TypeScript errors.

---

### Wave 2: Backend Services (5 stories, all parallel)

**S-201: Create Stripe payment service**

- Files: `server/services/stripe.service.ts` (new), `server/package.json` (add `stripe`)
- Functions:
  - `isStripeConfigured()` → boolean
  - `createCheckoutSession(companyId, tier, email, successUrl, cancelUrl)` → `{ sessionId, url }` or `{ available: false }`
  - `createBillingPortalSession(stripeCustomerId, returnUrl)` → `{ url }` or `{ available: false }`
  - `handleWebhookEvent(rawBody, signature)` → processes events, updates DB
- Env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_RECORDS_VAULT`, `STRIPE_PRICE_AUTOMATION_PRO`, `STRIPE_PRICE_FLEET_CORE`, `STRIPE_PRICE_FLEET_COMMAND`
- Acceptance Criteria:
  - [ ] `createCheckoutSession` returns valid session URL with correct price for each tier
  - [ ] `handleWebhookEvent` updates `companies.stripe_customer_id`, `subscription_status`, `subscription_tier`, `subscription_period_end` on `checkout.session.completed`
  - [ ] `handleWebhookEvent` sets `subscription_status = 'past_due'` on `invoice.payment_failed`
  - [ ] `handleWebhookEvent` sets `subscription_status` to NULL on `customer.subscription.deleted`
  - [ ] Invalid webhook signature returns error (not crash)
  - [ ] Webhook is idempotent — processing same event ID twice does not duplicate DB updates (check event.id before processing)
  - [ ] Missing `STRIPE_SECRET_KEY` returns `{ available: false, reason: "no_api_key" }`
- Unit Tests (8+):
  - Test createCheckoutSession with each tier → correct price ID mapped
  - Test createCheckoutSession with missing key → graceful fallback
  - Test handleWebhookEvent checkout.session.completed → DB updated
  - Test handleWebhookEvent invoice.payment_failed → status set to past_due
  - Test handleWebhookEvent customer.subscription.deleted → status cleared
  - Test handleWebhookEvent invalid signature → error returned
  - Test createBillingPortalSession → returns URL
  - Test tier-to-price mapping for all 4 tiers
- Functional Verification: Mock Stripe SDK, call `createCheckoutSession("co-1", "Automation Pro", "test@test.com")`, assert returned URL contains Stripe domain. Call `handleWebhookEvent` with `checkout.session.completed` payload, then query mock DB to verify `companies` row updated with correct `stripe_customer_id` and `subscription_tier = "Automation Pro"`.

**S-202: Implement Twilio SMS in notification delivery service**

- Files: `server/services/notification-delivery.service.ts` (mod), `server/package.json` (add `twilio`)
- Changes: Replace SMS stub (lines 187-192) with real Twilio `client.messages.create()`
- Acceptance Criteria:
  - [ ] SMS channel sends via Twilio when configured
  - [ ] Returns message SID on success
  - [ ] Returns `{ status: "FAILED", sync_error: "Twilio not configured" }` when env vars missing
  - [ ] Handles Twilio API errors gracefully (logs, returns FAILED, doesn't throw)
  - [ ] Recipients without phone numbers are skipped (not errored)
  - [ ] Existing email delivery tests still pass unchanged
- Unit Tests (6+):
  - Test SMS send success → returns SENT with message SID
  - Test SMS send failure (Twilio error) → returns FAILED with error message
  - Test missing Twilio config → returns FAILED with "Twilio not configured"
  - Test recipient without phone → skipped, logged
  - Test multiple recipients → sends to each, returns SENT if any succeed
  - Test email channel still works (regression)
- Functional Verification: Mock Twilio, call `deliverNotification({ channel: "sms", recipients: [{phone: "+1555..."}], message: "test" })`, assert Twilio `messages.create` called with correct `to`, `from`, `body`. Assert returned status is "SENT".

**S-203: Create GPS provider interface + Samsara adapter**

- Files: `server/services/gps/gps-provider.interface.ts` (new), `server/services/gps/samsara.adapter.ts` (new), `server/services/gps/index.ts` (new)
- Interface: `GpsProvider { getVehicleLocations(companyId): Promise<GpsPosition[]>; getVehicleLocation(vehicleId): Promise<GpsPosition | null> }`
- Type: `GpsPosition { vehicleId, driverId?, latitude, longitude, speed, heading, recordedAt, provider, providerVehicleId }`
- Samsara adapter: calls `https://api.samsara.com/fleet/vehicles/locations`, 5s timeout, 60s cache
- Factory: `getGpsProvider()` returns adapter based on `GPS_PROVIDER` env var
- Acceptance Criteria:
  - [ ] Interface is provider-agnostic (no Samsara-specific types in interface)
  - [ ] Samsara adapter returns parsed `GpsPosition[]` from API response
  - [ ] Timeout after 5 seconds returns empty array (not error)
  - [ ] Cache hit within 60s returns cached data without API call
  - [ ] Missing `SAMSARA_API_TOKEN` returns mock data with `isMock: true` on each position
  - [ ] Factory function returns SamsaraAdapter when `GPS_PROVIDER=samsara`
  - [ ] Factory function throws clear error for unknown provider
- Unit Tests (8+):
  - Test getVehicleLocations success → returns parsed GpsPosition array
  - Test getVehicleLocations timeout → returns empty array
  - Test getVehicleLocations API error → returns empty array, logs error
  - Test cache hit → returns cached, no API call
  - Test cache expiry → makes new API call after 60s
  - Test missing API token → returns mock positions with isMock flag
  - Test factory returns SamsaraAdapter for "samsara"
  - Test factory throws for unknown provider name
- Functional Verification: Mock global fetch, call `getGpsProvider().getVehicleLocations("co-1")`, assert returned positions have correct lat/lng/speed fields. Call again within 60s, assert fetch NOT called (cache hit). Wait 61s (or reset cache), call again, assert fetch called.

**S-204: Create QuickBooks OAuth service**

- Files: `server/services/quickbooks.service.ts` (new), `server/package.json` (add `intuit-oauth`)
- Functions: `isQbConfigured()`, `getAuthorizationUrl(companyId)`, `handleCallback(companyId, authCode, realmId)`, `getClient(companyId)`, `syncInvoiceToQBO(companyId, invoiceData)`, `syncBillToQBO(companyId, billData)`, `getConnectionStatus(companyId)`
- Token encryption: AES-256-GCM before DB storage
- Acceptance Criteria:
  - [ ] `getAuthorizationUrl` returns valid Intuit OAuth URL with correct client_id and redirect_uri
  - [ ] `handleCallback` exchanges auth code for tokens, encrypts, stores in quickbooks_tokens table
  - [ ] `getClient` decrypts tokens, refreshes if expired (calls Intuit refresh endpoint), re-encrypts and stores new tokens
  - [ ] `syncInvoiceToQBO` creates Invoice object via Intuit API with correct field mapping (customer, line items, amount)
  - [ ] `syncBillToQBO` creates Bill object via Intuit API with correct field mapping (vendor, line items, amount)
  - [ ] `getConnectionStatus` returns `{ connected: true, realmId, expiresAt }` when tokens exist and valid
  - [ ] `getConnectionStatus` returns `{ connected: false, reason: "no_tokens" }` when no tokens stored
  - [ ] Missing env vars returns `{ available: false, reason: "no_api_key" }`
  - [ ] Token encryption/decryption roundtrip preserves original token value
- Unit Tests (10+):
  - Test getAuthorizationUrl → returns URL with correct query params
  - Test handleCallback success → tokens encrypted and stored in DB
  - Test handleCallback invalid code → returns error, nothing stored
  - Test getClient with valid tokens → returns authenticated client
  - Test getClient with expired tokens → refreshes, stores new tokens, returns client
  - Test getClient with no tokens → returns error
  - Test syncInvoiceToQBO → maps LoadPilot invoice fields to QBO format, calls API
  - Test syncBillToQBO → maps LoadPilot bill fields to QBO format, calls API
  - Test token encrypt/decrypt roundtrip → original value preserved
  - Test missing config → graceful degradation
- Functional Verification: Mock intuit-oauth SDK. Call `getAuthorizationUrl("co-1")`, assert URL contains client_id. Call `handleCallback("co-1", "auth-code", "realm-123")`, assert `quickbooks_tokens` table (mocked) receives encrypted token. Call `syncInvoiceToQBO("co-1", { invoiceNumber: "INV-001", amount: 5000 })`, assert Intuit API mock received correct Invoice object.

**S-205: Remove weather feature flag**

- Files: `server/services/weather.service.ts` (mod), `server/__tests__/services/weather.service.test.ts` (mod)
- Changes: Remove `WEATHER_ENABLED` check, keep `WEATHER_API_KEY` presence check
- Acceptance Criteria:
  - [ ] Weather works when `WEATHER_API_KEY` is set (no `WEATHER_ENABLED` needed)
  - [ ] Returns `{ available: false, reason: "no_api_key" }` when key not set
  - [ ] No reference to `WEATHER_ENABLED` remains in codebase
- Unit Tests (3+):
  - Test with API key → returns weather data
  - Test without API key → returns graceful fallback
  - Test API error → returns `{ available: false, reason: "api_error" }`
- Functional Verification: Mock fetch. Set `WEATHER_API_KEY`, call `getWeatherForLocation(lat, lng)`, assert Azure Maps API called and response parsed. Unset key, call again, assert `{ available: false }` returned without API call.

**Wave 2 Gate**: Full server + frontend test suite passes. 0 TypeScript errors. Each service's functional verification passes.

---

### Wave 3: Backend Routes + Wiring (6 stories, all parallel)

**S-301: Add Stripe webhook + checkout routes**

- Files: `server/routes/stripe.ts` (new), `server/index.ts` (mod)
- Routes:
  - `POST /api/stripe/create-checkout-session` — requireAuth, requireTenant
  - `POST /api/stripe/create-billing-portal` — requireAuth, requireTenant
  - `POST /api/stripe/webhook` — NO auth, express.raw() body
- Critical: webhook route registered BEFORE `app.use(express.json())` in index.ts
- Acceptance Criteria:
  - [ ] POST /api/stripe/create-checkout-session returns 200 with `{ sessionId, url }` when Stripe configured
  - [ ] POST /api/stripe/create-checkout-session returns 503 with `{ error: "Stripe not configured" }` when not configured
  - [ ] POST /api/stripe/create-checkout-session returns 401 without auth token
  - [ ] POST /api/stripe/create-billing-portal returns 200 with `{ url }`
  - [ ] POST /api/stripe/webhook returns 200 on valid event
  - [ ] POST /api/stripe/webhook returns 400 on invalid signature
  - [ ] Webhook endpoint accessible without auth token (public)
- Integration Tests (7+):
  - Test POST checkout-session with valid auth → 200 + session data
  - Test POST checkout-session without auth → 401
  - Test POST checkout-session with Stripe not configured → 503
  - Test POST billing-portal with valid auth → 200 + URL
  - Test POST webhook with valid signature → 200
  - Test POST webhook with invalid signature → 400
  - Test POST webhook without auth → 200 (public endpoint)
- Functional Verification: Mock stripe.service, POST to `/api/stripe/create-checkout-session` with auth header and body `{ tier: "Automation Pro", email: "test@t.com" }`, assert 200 response contains `url`. POST to webhook with mocked payload, assert service `handleWebhookEvent` called.

**S-302: Replace QuickBooks 501 stub with real routes**

- Files: `server/routes/quickbooks.ts` (new), `server/routes/accounting.ts` (mod lines 1161-1171), `server/index.ts` (mod)
- Routes: GET /api/quickbooks/auth-url, GET /api/quickbooks/callback, POST /api/quickbooks/sync-invoice, POST /api/quickbooks/sync-bill, GET /api/quickbooks/status
- Acceptance Criteria:
  - [ ] 501 stub removed from accounting.ts
  - [ ] GET /api/quickbooks/auth-url returns OAuth URL when configured, 503 when not
  - [ ] GET /api/quickbooks/callback exchanges code for tokens, redirects to settings page
  - [ ] POST /api/quickbooks/sync-invoice syncs invoice and returns QBO reference ID
  - [ ] POST /api/quickbooks/sync-bill syncs bill and returns QBO reference ID
  - [ ] GET /api/quickbooks/status returns connection state
  - [ ] All routes enforce requireAuth + requireTenant
- Integration Tests (8+):
  - Test GET auth-url with auth → 200 + URL
  - Test GET auth-url without auth → 401
  - Test GET auth-url not configured → 503
  - Test GET callback with valid code → token stored, redirect
  - Test GET callback with invalid code → error
  - Test POST sync-invoice with auth → 200 + QBO ID
  - Test POST sync-bill with auth → 200 + QBO ID
  - Test GET status → connection state
- Functional Verification: Mock quickbooks.service, POST to `/api/quickbooks/sync-invoice` with auth + invoice body, assert 200 response contains `qboInvoiceId`. Verify service was called with correct invoice data.

**S-303: Add GPS live tracking route**

- Files: `server/routes/tracking.ts` (mod)
- Routes: `GET /api/tracking/live`, `POST /api/tracking/webhook`
- GPS webhook auth: `POST /api/tracking/webhook` validates `X-GPS-API-Key` header against `GPS_WEBHOOK_SECRET` env var (not Firebase auth — ELD providers can't do Firebase). Returns 401 if key missing or wrong.
- Acceptance Criteria:
  - [ ] GET /api/tracking/live returns live positions from GPS provider
  - [ ] GET /api/tracking/live stores received positions in gps_positions table
  - [ ] GET /api/tracking/live returns mock positions when provider not configured
  - [ ] POST /api/tracking/webhook accepts GPS pings and stores in DB
  - [ ] POST /api/tracking/webhook validates `X-GPS-API-Key` header (rejects invalid/missing)
  - [ ] POST /api/tracking/webhook validates required fields (latitude, longitude, vehicleId)
  - [ ] Existing GET /api/loads/tracking unchanged (backward compatible)
- Integration Tests (6+):
  - Test GET /api/tracking/live with auth → 200 + positions array
  - Test GET /api/tracking/live without auth → 401
  - Test POST /api/tracking/webhook with valid payload → 201
  - Test POST /api/tracking/webhook with invalid payload (missing lat) → 400
  - Test existing GET /api/loads/tracking still works → regression
  - Test tenant isolation on live positions
- Functional Verification: Mock GPS provider, GET `/api/tracking/live` with auth, assert response contains `positions[]` with lat/lng/speed/heading fields. POST to webhook with `{ vehicleId: "truck-1", latitude: 40.7128, longitude: -74.0060 }`, assert DB mock received insert call.

**S-304: Wire legacy sendNotification to real delivery service**

- Files: `server/helpers.ts` (mod)
- Changes: Replace logger-only stub with call to `deliverNotification()`
- Acceptance Criteria:
  - [ ] `sendNotification(["a@b.com"], "Subject", "Body")` calls `deliverNotification` with channel "email"
  - [ ] Notification failure does NOT throw (fire-and-forget)
  - [ ] Empty emails array is a no-op
  - [ ] Load save in loads.ts still works with notification_emails (regression)
- Unit Tests (4+):
  - Test sendNotification calls deliverNotification with correct params
  - Test sendNotification with empty array → no-op
  - Test sendNotification catches delivery errors (doesn't throw)
  - Test loads.ts integration still calls sendNotification (regression)
- Functional Verification: Mock notification-delivery.service, call `sendNotification(["test@t.com"], "Load #123", "Status update")`, assert `deliverNotification` called with `{ channel: "email", recipients: [{email: "test@t.com"}], message: "Status update" }`.

**S-305: Update .env.example with all new integration vars**

- Files: `.env.example` (mod)
- Add: Stripe (6), Twilio (3), QuickBooks (5), GPS (2) sections; remove WEATHER_ENABLED
- Acceptance Criteria:
  - [ ] All integration env vars documented with descriptions
  - [ ] Required vs optional clearly marked
  - [ ] No real API keys or secrets in file
- Verification: Grep file for actual API keys/tokens (must find none)

**S-306: Clean up IFTA client-side stub comment**

- Files: `services/dispatchIntelligence.ts` (mod)
- Changes: Update comment at lines 426-437. `netTaxDue = 0` stays (server handles real calculation).
- Acceptance Criteria:
  - [ ] Comment accurately describes server-side IFTA calculation
  - [ ] `netTaxDue = 0` unchanged
  - [ ] Existing IFTA tests pass
- Verification: `npx vitest run` passes

**Wave 3 Gate**: Full test suite passes. All new routes respond correctly. Legacy endpoints unchanged.

---

### Wave 4: Frontend Integration (3 stories, parallel)

**S-401: Replace Auth.tsx payment form with Stripe Checkout**

- Files: `components/Auth.tsx` (mod)
- Changes:
  - Remove `cardNumber`, `cardExpiry`, `cardCVC` state vars (lines 159-161)
  - Remove inline card input fields (lines 1267-1282)
  - Payment view: show tier name + price + "Subscribe with Stripe" button + "Start Free Trial" button
  - processSignup(): call `POST /api/stripe/create-checkout-session` with `successUrl` and `cancelUrl`, redirect to Stripe or fallback to trial
  - Handle Stripe return: On mount, check URL for `?session_id=` — if present, verify session completed, show success, auto-login
  - Handle cancel: If `/signup/cancel` path, show "Payment cancelled" with retry button
- Acceptance Criteria:
  - [ ] No `<input>` for card number, expiry, or CVC exists in rendered output (PCI compliance)
  - [ ] "Subscribe with Stripe" button calls checkout session API with successUrl and cancelUrl
  - [ ] Successful API response redirects to Stripe URL
  - [ ] Stripe return with session_id verifies payment and logs in
  - [ ] Stripe cancel shows message with retry option
  - [ ] "Start Free Trial" button bypasses payment, logs in with trial status
  - [ ] When Stripe not configured, payment step auto-falls through to trial
  - [ ] Tier name and price displayed correctly for each tier
- Frontend Tests (6+):
  - Test renders tier name and price (not card inputs)
  - Test "Subscribe with Stripe" button calls API with correct tier
  - Test successful checkout redirects (mock window.location)
  - Test "Start Free Trial" button skips payment
  - Test Stripe unavailable → falls through to trial flow
  - Test existing signup flow tests still pass (regression)
- Functional Verification: Render Auth component, navigate to payment step. Assert no `input[type=text]` with placeholder containing "card" exists. Click "Subscribe with Stripe", assert fetch called to `/api/stripe/create-checkout-session` with correct body. Assert `window.location.href` set to returned URL.

**S-402: Add subscription management to CompanyProfile**

- Files: `components/CompanyProfile.tsx` (mod)
- Changes:
  - Add "Billing & Subscription" section: current tier badge, status, period end date
  - "Manage Subscription" button → Stripe billing portal redirect
  - "Connect QuickBooks" button → QuickBooks OAuth redirect
  - Hide sections when respective services not configured
- Acceptance Criteria:
  - [ ] Billing section shows current tier name and status badge
  - [ ] "Manage Subscription" calls billing portal API and redirects
  - [ ] "Connect QuickBooks" calls auth-url API and redirects
  - [ ] Sections hidden when API returns 503 (not configured)
  - [ ] QuickBooks section shows "Connected" status when tokens exist
- Frontend Tests (5+):
  - Test billing section renders with tier and status
  - Test manage subscription button calls API
  - Test connect QuickBooks button calls API
  - Test sections hidden when not configured (mock 503 response)
  - Test QuickBooks shows connected state

**S-403: Update GlobalMapViewEnhanced to consume live GPS data**

- Files: `components/GlobalMapViewEnhanced.tsx` (mod)
- Changes:
  - Add `useEffect` that polls `GET /api/tracking/live` every 30 seconds when component is mounted
  - Merge live GPS positions with existing static load positions
  - Show live positions with a pulsing indicator (distinct from static markers)
  - Graceful: if `/api/tracking/live` returns mock data (isMock=true), show positions but add "(simulated)" label
  - Graceful: if API returns empty/error, fall back to existing static positions (no change in UX)
  - Add "Live" indicator dot in corner when receiving real GPS data
- Acceptance Criteria:
  - [ ] Map shows live GPS positions when available
  - [ ] Positions update every 30 seconds (polling interval)
  - [ ] Mock positions visually distinguished from real positions
  - [ ] Fallback to static data when GPS provider not configured
  - [ ] No visual regression when GPS not configured (existing behavior preserved)
  - [ ] Polling stops on component unmount (cleanup — no memory leak)
- Frontend Tests (4+):
  - Test live positions render when API returns data
  - Test polling interval fires and refetches
  - Test fallback to static data on API error
  - Test cleanup on unmount (no lingering interval)

**Wave 4 Gate**: Full frontend test suite passes. 0 TypeScript errors. Build succeeds.

---

### Wave 5: Tier Enforcement (2 stories, sequential)

**S-501: Create subscription tier enforcement middleware**

- Files: `server/middleware/requireTier.ts` (new)
- Function: `requireTier(...allowedTiers: SubscriptionTier[])` middleware factory
- Acceptance Criteria:
  - [ ] Allowed tier + active status → next() called
  - [ ] Allowed tier + trial status → next() called
  - [ ] Disallowed tier → 403 with `{ error, required_tiers, current_tier, upgrade_url }`
  - [ ] Past_due status → 403 regardless of tier
  - [ ] Missing tier defaults to "Records Vault"
  - [ ] Tier lookup cached per-request (no duplicate DB queries)
- Unit Tests (6+):
  - Test allowed tier + active → passes
  - Test allowed tier + trial → passes
  - Test disallowed tier → 403 with correct body
  - Test past_due → 403
  - Test missing tier → defaults to Records Vault
  - Test caching → only 1 DB query per request even with multiple requireTier calls

**S-502: Apply tier gates to premium routes**

- Files: `server/routes/ai.ts` (mod), select other route files
- Changes: Add `requireTier(...)` to middleware chains on premium endpoints
- Tier Mapping:
  - **Records Vault** (base): All basic CRUD — loads, quotes, invoices, bills, safety, messaging
  - **Automation Pro+**: AI endpoints (`/api/ai/*`), IFTA automation, automation rules
  - **Fleet Core+**: Fleet management, advanced dispatch, GPS tracking
  - **Fleet Command**: Enterprise analytics, multi-company management
- Acceptance Criteria:
  - [ ] Base tier (Records Vault) can access all core CRUD endpoints
  - [ ] AI endpoints return 403 for Records Vault tier
  - [ ] AI endpoints return 200 for Automation Pro tier
  - [ ] GPS tracking returns 403 for Records Vault and Automation Pro
  - [ ] Existing tests updated to include tier context
- Integration Tests (4+):
  - Test AI endpoint with Records Vault tier → 403
  - Test AI endpoint with Automation Pro tier → 200
  - Test GPS tracking with Fleet Core tier → 200
  - Test base CRUD with Records Vault → 200 (regression)

**Wave 5 Gate**: Full test suite passes. Tier enforcement verified on all protected routes.

---

## Final Verification Checklist

After all 5 waves complete:

### Automated

1. `cd server && npx vitest run` — all backend tests pass (1,947+ existing + ~100 new)
2. `npx vitest run` — all frontend tests pass (3,376+ existing + ~20 new)
3. `cd server && npx tsc --noEmit` — 0 TypeScript errors
4. `npx tsc --noEmit` — 0 TypeScript errors
5. `npm run build` — production build succeeds

### Functional Proof (per integration)

6. **Stripe**: Service test proves checkout session creates with correct price, webhook updates DB
7. **Twilio SMS**: Service test proves `messages.create` called with correct params, SENT returned
8. **QuickBooks**: Service test proves OAuth URL generated, token stored encrypted, invoice synced to QBO
9. **GPS/Samsara**: Service test proves positions fetched from Samsara API, cached, stored in DB
10. **Weather**: Service test proves API called when key present, graceful fallback when absent
11. **Legacy notifications**: Test proves `sendNotification` calls `deliverNotification` (not just logs)
12. **Tier enforcement**: Test proves 403 returned for unauthorized tier, 200 for authorized tier

### Regression

13. All 1,947 existing backend tests pass
14. All 3,376 existing frontend tests pass
15. Build output < 5MB
16. No new TypeScript errors

## Environment Variables (Complete List)

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_RECORDS_VAULT=price_...
STRIPE_PRICE_AUTOMATION_PRO=price_...
STRIPE_PRICE_FLEET_CORE=price_...
STRIPE_PRICE_FLEET_COMMAND=price_...

# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...

# QuickBooks
QUICKBOOKS_CLIENT_ID=...
QUICKBOOKS_CLIENT_SECRET=...
QUICKBOOKS_REDIRECT_URI=https://app.loadpilot.com/api/quickbooks/callback
QUICKBOOKS_ENVIRONMENT=sandbox
QUICKBOOKS_TOKEN_ENCRYPTION_KEY=... (32-byte hex)

# GPS/ELD
SAMSARA_API_TOKEN=...
GPS_PROVIDER=samsara
GPS_WEBHOOK_SECRET=... (API key for ELD webhook authentication)

# Weather (no longer needs WEATHER_ENABLED)
WEATHER_API_KEY=...
```

## Summary

- **20 stories** across **5 waves** (4 + 5 + 6 + 3 + 2)
- **~130 new tests** (unit + integration + functional)
- **~10 new files**, **~14 modified files**
- **7 integrations** from stub → functional
- V-Model verified at each wave gate
- All gaps addressed: sql-auth.ts mapping, types.ts Stripe fields, frontend GPS map, GPS webhook auth, Stripe return URL, webhook idempotency, merge conflict mitigation
