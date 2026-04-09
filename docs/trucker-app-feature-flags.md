# LoadPilot Trucker App Feature Flags

This document defines the feature flags used across the LoadPilot trucker app. Flags control gradual rollouts, beta gates, and integration toggles from Sprint B1 onward.

## Read priority

Flags are resolved in the following order:

1. **Database** (`feature_flags` table) -- tenant-scoped overrides set by admin
2. **Environment variable** -- process-level default (e.g., `FEATURE_MOTIVE_ELD=true`)
3. **Default false** -- if neither DB nor env is set, the flag evaluates to `false`

## Flag inventory

| Flag | Purpose | Default (prod) |
| --- | --- | --- |
| `FEATURE_TRUCKER_MOBILE_BETA` | Gates the entire mobile app experience. When false, the mobile app shows a "coming soon" screen. | `false` |
| `FEATURE_MOTIVE_ELD` | Gates the Motive ELD integration endpoints and UI. Must be enabled per-tenant after Motive API credentials are configured. | `false` |
| `FEATURE_BROKER_CREDIT` | Gates the broker credit score display on the Broker Network page. Hidden until the credit model is validated. | `false` |
| `FEATURE_FACILITY_DWELL` | Gates the facility dwell-time export feature. Requires GPS/ELD data pipeline to be active. | `false` |
| `FEATURE_FREEMIUM_QUOTA` | Gates AI quota enforcement for freemium-tier tenants. When enabled, Gemini API calls are metered and capped. | `false` |
| `FEATURE_FORCE_UPGRADE` | Gates the force-upgrade modal shown to mobile users on outdated app versions. | `false` |

## Endpoints

- **Read**: `GET /api/feature-flags` -- returns merged flag map (DB > env > default) for the authenticated user's tenant.
- **Write**: `PUT /api/feature-flags/:name` -- admin-only, tenant-scoped. Sets or clears a flag override in the database.

## Removal criteria

A flag may be removed from the codebase when it has been **100% enabled across all tenants for 30 consecutive days** with no rollback events. The removal PR must delete the flag row from the DB migration, remove env references, and inline the gated code path.
