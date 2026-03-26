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

## Expected Behavior After the Team 1 / Platform Fix

Once the shared tracking gate is repaired:
- `/api/tracking/live` should return `200`
- the response should surface either:
  - `trackingState: "configured-live"` when positions exist, or
  - `trackingState: "configured-idle"` when a valid provider is configured but no positions are currently returned
- the frontend should display:
  - green "Live Tracking Active" when positions exist
  - amber "Tracking Idle" when configured but idle
  - red "Tracking temporarily unavailable" only for actual provider/network/backend failures

## Team 3 Acceptance Position

Team 3 scope is complete when:
- the browser shows the embedded map and telematics surfaces correctly
- the provider setup UI matches supported providers
- route summaries use real stop/leg data
- the live-tracking blocker is documented with the exact repro above

Team 3 does not own the shared entitlement/backend tier fix.
