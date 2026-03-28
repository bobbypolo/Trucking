# Team 3 Live Tracking Blocker

This note captures the current Team 3 validation blocker so it is not mistaken
for a Team 3 implementation gap.

## Current Reproduction

Branch-local validation:

- Frontend: `http://localhost:3103`
- Backend: `http://localhost:5103`

Authenticated requests using either known admin principal:

- `test@test.com / Test123`
- `admin@loadpilot.com / Admin123`

Current API results:

- `GET /api/tracking/providers` returns `200 []`
- `POST /api/tracking/providers` rejects unsupported names like `Motive` with `400`
- `GET /api/tracking/live` returns `500` with `error_code: TIER_DB_ERROR_001`
- `GET /api/loads/tracking` returns `500` with `error_code: TIER_DB_ERROR_001`

## Why This Is Not Team 3-owned

The Team 3 frontend now:

- exposes the telematics setup surface
- normalizes supported provider names
- renders the tracking-state error banner honestly
- uses stop/leg context for embedded route summaries

The remaining failure is on the shared tracking entitlement/backend gate.

## Resolution (2026-03-28)

The `requireTier` middleware now includes a legacy-schema compatibility branch:
when the `subscription_tier` column is missing (migration 027/039 not yet applied),
tier enforcement is bypassed entirely. This allows `/api/tracking/live` and
`/api/loads/tracking` to function in dev/demo environments without all migrations.

- **Middleware fix:** `server/middleware/requireTier.ts` — catches `ER_BAD_FIELD_ERROR`
  / "Unknown column" and calls `next()` instead of returning 503.
- **Test proof:** `server/__tests__/middleware/requireTier.test.ts` — 3 new tests
  verify missing-column bypass, ER_BAD_FIELD_ERROR bypass, and real-error 503 preservation.
- **E2E updated:** `e2e/team03-embedded-map.spec.ts` no longer accepts 500.
  Expects 200 or 403 (tier-gated), never 503.

When the `subscription_tier` column exists (production), tier enforcement remains strict.

## Team 3 Acceptance Position

Team 3 scope is complete when:

- the browser shows the embedded map and telematics surfaces correctly
- the provider setup UI matches supported providers
- route summaries use real stop/leg data
- the live-tracking blocker is documented with the exact repro above

Team 3 does not own the shared entitlement/backend tier fix.
