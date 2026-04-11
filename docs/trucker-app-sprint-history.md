# LoadPilot Trucker App Sprint History

This document tracks each completed sprint with its merge SHA, story count, and key outcomes.

---

## Sprint A — Shipped Baseline

| Field | Value |
|-------|-------|
| Merge SHA | `dd8a8f4` |
| Branch | `main` (baseline) |
| Stories | 10 |
| Criteria | 55 |
| Status | Shipped |
| Date | 2026-04-07 |

**Summary**: Delivered the bulletproof sales-demo SaaS platform. All 10 V-Model stories passed. Established the web application with authentication, load management (8-state lifecycle), accounting (GL double-entry, 22 endpoints), safety and compliance, operations center, broker network, driver pay, quotes and booking, IFTA, exception management, and multi-tenancy.

**Key artifacts**:
- 47 database migrations (001 through 047)
- 50+ React components
- 30+ Express route modules
- Firebase Auth + JWT integration
- Google Maps, Azure Maps, Gemini AI integrations

---

## Sprint B1 — Infrastructure Hardening + Feature Flags

| Field | Value |
|-------|-------|
| Merge SHA | `8a1e9b2` |
| Branch | `ralph/trucker-app-sprint-b1` |
| PR | #60 |
| Stories | 10 |
| Criteria | 25 |
| Skipped | 0 |
| Status | Shipped |
| Date | 2026-04-09 |

**Summary**: Delivered infrastructure hardening and foundational program documentation. Added invoice aging pipeline (migration 053 + nightly job + Windows-safe scheduler), Sentry server-side init gated on SENTRY_DSN, feature flags DB table (migration 054) with GET/PUT endpoints and admin-role enforcement, master program plan for 13 sprints (B1-M), release checklist with 6 operator gate families, baseline debt register, environment matrix, feature flags doc, migration numbering rules, and SaaS non-regression verification script.

**Key artifacts**:
- 2 new database migrations (053: aging_bucket, 054: feature_flags)
- Feature flags endpoint with admin role enforcement
- Sentry integration (conditional on SENTRY_DSN)
- 7 program documentation files
- 15 verification scripts (verify-*.cjs)
- Invoice aging nightly job + .cjs scheduler wrapper + ops runbook

---

## Sprint B2 — Mobile App Bootstrap + Shared Types

| Field | Value |
|-------|-------|
| Branch | `ralph/sprint` |
| Stories | 6 |
| Criteria | 31 |
| Skipped | 0 |
| Status | Engineering Complete |
| Date | 2026-04-09 |

**Summary**: Established the Expo + React Native mobile app project under `apps/trucker/`, extracted shared TypeScript types into `packages/shared/` for dual web and mobile consumption, built the mobile navigation shell with tab-based routing, integrated Firebase Auth for mobile, configured EAS Build profiles, and resolved 3 baseline technical debt items from the B1 debt register. Full SaaS non-regression verified via existing test suites.

**Key artifacts**:
- `packages/shared/` — shared TypeScript types package (`@loadpilot/shared`)
- `apps/trucker/` — Expo + React Native mobile app with tab navigation
- Mobile auth screens (Login, Signup) with Firebase Auth integration
- EAS Build configuration (development + preview profiles)
- 3 baseline debt items resolved (jszip types, PORT env, hooks tests dir)
- 6 verification scripts (verify-*.cjs) for each phase

---

## Sprint F — Push Notifications + Driver Profile + Settings

| Field | Value |
|-------|-------|
| Branch | `ralph/trucker-app-sprint-f` |
| Stories | 12 |
| Criteria | 54 |
| Skipped | 0 |
| Status | Engineering Complete |
| Date | 2026-04-10 |

**Summary**: Delivered the Sprint F mobile feature slice for the LoadPilot trucker app — push-notification infrastructure end-to-end, a driver profile screen, a settings screen with preference toggles, and a combined verification gate. Expo Notifications were wired into the mobile runtime (`pushNotifications.ts`), AuthContext was extended to register/rotate/unregister push tokens on sign-in and sign-out, a server-side `/api/push-tokens` route pair and migration added persistence, a push-on-status server hook announces load-status transitions, the mobile notification-tap handler deep-links to `/loads/:id`, and driver profile and settings screens landed behind the existing `(tabs)` shell with `<Stack.Screen>` registration in `_layout.tsx`. A combined `verify-sprint-f.cjs` orchestrator now runs all five Sprint F mobile verify scripts in order and gates Sprint F promotion on the sprint-history heading.

**Key artifacts**:
- `apps/trucker/src/services/pushNotifications.ts` — Expo Notifications service (register, rotate, unregister, attach-response-handler)
- `apps/trucker/src/contexts/AuthContext.tsx` — push-token lifecycle wired into login/logout
- `apps/trucker/src/app/(tabs)/_layout.tsx` — Slot→Stack migration + `<Stack.Screen>` registrations for `profile` and `settings`
- `apps/trucker/src/app/(tabs)/profile.tsx`, `apps/trucker/src/app/(tabs)/settings.tsx` — new driver profile and settings screens (three preference Switches + logout)
- `server/routes/push-tokens.ts` + migration `055_push_tokens.sql` — token registration persistence with tenant scoping
- `server/services/load.service.ts` push-on-status hook — announces load-status transitions through Expo Push
- `scripts/verify-push-service.cjs`, `verify-auth-push-wiring.cjs`, `verify-push-deep-link.cjs`, `verify-profile-screen.cjs`, `verify-settings-screen.cjs` — per-story mobile verify scripts
- `scripts/verify-sprint-f.cjs` — combined Sprint F verification gate (runs all five mobile verify scripts + sprint-history heading check)

---
