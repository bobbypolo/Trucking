# LoadPilot Trucker App Master Program Plan

This document is the master program plan for the LoadPilot trucker app buildout. It tracks all sprints from the shipped SaaS baseline through general availability of the mobile-first owner-operator product.

---

## Shipped Baseline (Sprint A)

Commit: `dd8a8f4`

Sprint A delivered the bulletproof sales-demo SaaS platform. All 10 stories passed V-Model verification. The following capabilities shipped:

- Authentication and multi-tenant onboarding
- Load management with 8-state lifecycle
- Accounting portal with GL double-entry and 22 endpoints
- Safety and compliance (6 tabs, quiz-results API)
- Operations center (command center, triage)
- Broker network management
- Driver pay and settlements
- Quotes and booking with hybrid load workflow
- BOL generator
- IFTA manager
- Exception management
- Messaging system
- Data import/export
- File upload (Multer + documents route)
- Fleet map with Google Maps integration
- Intelligence hub

The SaaS baseline is the foundation upon which all trucker-app sprints build.

---

## Sprint B1 — COMPLETE

**Theme**: Infrastructure hardening and first trucker-app feature

**Status**: Shipped | Merge SHA: `8a1e9b2` | Date: 2026-04-09 | PR: #60
**Stories**: 10/10 passed | **Criteria**: 25/25 verified | **Skipped**: 0

**Goal**: Ship the IFTA audit packet export MVP, stand up Sentry error tracking, create program documentation, establish the feature-flag framework, and capture the baseline debt register.

Key deliverables:
- Invoice aging bucket migration (053) and nightly 5-bucket assignment job
- External scheduler wrapper (Windows-safe .cjs) with ops runbook
- Sentry server-side integration (gated on SENTRY_DSN)
- Master program documentation (this file), release checklist, sprint history
- Environment matrix, feature flags doc, migration numbering rules
- Baseline debt register with 3 real entries
- Feature flags DB table (054) and read/write endpoint with admin-role enforcement
- SaaS non-regression verification script

---

## Sprint B2 — COMPLETE

**Theme**: Mobile app bootstrap, shared types, and navigation shell

**Status**: Shipped | Merge SHA: `dd29a6c` | Date: 2026-04-09 | PR: #66

**Goal**: Establish the Expo + React Native project structure under `apps/trucker/`, extract shared TypeScript types into `packages/shared/`, stand up the mobile navigation shell with tab-based routing and authentication screens, and configure EAS Build.

Key deliverables (shipped):
- `apps/trucker/` scaffold on Expo SDK 55 + React Native 0.76 + expo-router 5 + TypeScript
- Mobile authentication integration (Firebase Auth + JWT, sharing the SaaS backend auth flow)
- Tab-based navigation shell (Home, Loads, Queue, Profile placeholder) via expo-router
- `packages/shared/` for cross-platform types consumed by both the SaaS web app and the mobile app
- CI pipeline updates to cover the mobile workspace

---

## Sprint C — COMPLETE

**Theme**: Trip Workspace — active-trip UI, leg state machine, and driver workflow

**Status**: Shipped | Merge SHA: `c59f8b1` | Date: 2026-04-11 | PR: #69 (combined C+D+E)

**Goal**: Build the driver-facing trip workspace where an assigned load becomes an interactive workflow — the driver can see leg-by-leg progress, transition leg state, record arrival/departure times, and drive the load from Pickup → In Transit → Delivered through the canonical 8-state LoadStatus machine.

Key deliverables (shipped):
- Trip Workspace screen with active-load header, leg list, and action buttons
- Leg state machine wired into the shared `load-state-machine.ts` (server-side canonical source)
- Arrival/departure timestamp capture per leg with geolocation stamping
- Status transition UI with optimistic updates + server reconciliation
- Type-safe `TripContext` + hooks for components under the workspace subtree

---

## Sprint D — COMPLETE

**Theme**: Document Capture — camera, image pipeline, and AI parsing hooks

**Status**: Shipped | Merge SHA: `c59f8b1` | Date: 2026-04-11 | PR: #69 (combined C+D+E)

**Goal**: Build the mobile document capture pipeline. Drivers photograph BOLs, rate confirmations, and fuel receipts with the device camera; images are pre-processed on-device and uploaded for server-side Gemini AI parsing via the existing `server/services/geminiService.ts` integration.

Key deliverables (shipped):
- `expo-camera` integration with quality validation and retake flow
- `expo-image-manipulator` on-device preprocessing (rotate, crop, resize to JPEG target size)
- `expo-file-system` temporary storage for captured images before upload
- Mobile upload integration with the existing `server/routes/documents.ts` endpoint (Multer-backed)
- Review + correction UI for parsed fields before committing to the load record

---

## Sprint E — COMPLETE

**Theme**: Offline Queue — NetInfo detection, background sync, and retry semantics

**Status**: Shipped | Merge SHA: `c59f8b1` | Date: 2026-04-11 | PR: #69 (combined C+D+E)

**Goal**: Make the trucker app resilient to intermittent connectivity. Every user action that writes to the server (status transitions, document uploads, location pings) is enqueued locally and replayed when the device regains connectivity — with idempotency, retry backoff, and deduplication.

Key deliverables (shipped):
- `@react-native-community/netinfo` connectivity detection with foreground + background hooks
- `@react-native-async-storage/async-storage`-backed queue with persistent journal
- `expo-task-manager` background sync task that flushes the queue opportunistically
- Server-side idempotency keys + request deduplication for queued writes
- Queue inspector UI on the Queue tab showing pending/failed/sent items with manual retry

---

## Sprint F — COMPLETE

**Theme**: Push Notifications Foundation + Driver Profile + Settings

**Status**: Shipped | Merge SHA: `615ec6a` | Date: 2026-04-11 | PR: #73
**Stories**: 12/12 passed | **R-markers**: 67/67 verified | **Skipped**: 0

**Goal**: Ship the end-to-end Expo Push pipeline that every future real-time feature depends on (messaging, GPS alerts, load-assignment pings), replace the Profile tab placeholder with a real backing-API-driven screen, and add a complete Settings screen with notification preferences, sign-out, and version display.

Key deliverables (shipped):
- **Expo Push pipeline**: mobile permission + token retrieval (with EAS projectId) → server registration via `POST /api/push-tokens` → trigger hooks inside `POST /api/loads` (create), `PATCH /api/loads/:id` (reassignment), and `PATCH /api/loads/:id/status` (dispatcher update) → delivery via Expo Push API → mobile tap handler that deep-links into `/loads/[id]`
- **Token rotation handling**: `attachTokenRefreshListener` re-registers rotated Expo tokens so delivery never silently breaks
- **Logout privacy**: `unregisterPushToken` fires BEFORE Firebase `signOut` so a subsequent driver on the same device does not inherit the previous driver's notifications
- **Migration 055 `push_tokens`** table with `UNIQUE KEY (user_id, expo_push_token)` and ENUM `platform` column
- **`server/lib/expo-push.ts`** `sendPush` utility that batches at 100 tokens, never throws, returns `{sent, errors}` per-token summary
- **Driver Profile screen** backed by new `GET/PATCH /api/drivers/me` endpoints (replaces placeholder)
- **Settings screen**: 3 notification-preference toggles (AsyncStorage-persisted at `@loadpilot/notification-prefs`), sign-out flow with `Alert.alert` destructive confirmation, app-version display via `Constants.expoConfig?.version`, and `Stack.Screen` registration in root `_layout.tsx`
- **Security**: role-escalation guard on `PATCH /api/drivers/me` (hard-coded `UPDATE users SET phone = ? WHERE id = ? AND company_id = ?` — defense-in-depth tenant scope, no other columns can be injected)
- **Sprint F combined verification**: `scripts/verify-sprint-f.cjs` orchestrator runs all 5 Sprint F mobile verify scripts (74 static-analysis checks) + validates the `docs/trucker-app-sprint-history.md` heading

**Release-checklist follow-up**: replace the `extra.eas.projectId` placeholder in `apps/trucker/app.json` with the real EAS project id before store submission. APNs certificate rotation, FCM project config, physical-device tap-through validation, and app-store push entitlement review are operator tasks, not Ralph-automatable items.

---

## Post-Sprint-F — Base branch cleanup (PR #74)

**Status**: Shipped | Merge SHA: `c613f5c` | Date: 2026-04-11 | PR: #74

**Goal**: Clean up 17 pre-existing test and CI-infrastructure failures that had been accumulating on `mobile/trucker-app` and were blocking new sprint PRs from inheriting a green baseline.

Shipped via 3 parallel specialist workers (Cluster A server, Cluster B frontend, Cluster C CI infra) + 6 cascading fix iterations, 21 commits total:

- **Server cleanup (Cluster A)**: `getCorsOrigin()` dev/test return-type alignment, `loads-equipment-partial-update` mock sequence repair, SPA fallback extracted to `server/routes/spa-fallback.ts` (index.ts 166→98 lines), `requireTenant` added to `demo.ts POST /reset` + `feature-flags.ts GET /` + `PUT /:name`, query-level `company_id` scope added to 2 `loads.ts` SELECTs
- **Frontend cleanup (Cluster B)**: 20 instances of `text-[10px]` replaced with `text-xs` in `DriverMobileHome.tsx` (R-P4-04 accessibility), `PendingDriverIntakeQueue.test.tsx` fetch mock replaced with `sourceLoads` prop, `storageService.saveLoad` driverId default corrected to `user.id` instead of empty string
- **CI infrastructure (Cluster C)**: `scripts/validate-migrations.cjs` Node.js port of inline JS formerly embedded in `ci.yml` bash block; `scripts/check-tenant-scope.cjs` Node.js port of the 115-line bash script (byte-identical output); `.claude/hooks/tests/` smoke test suite for `_lib.py` and `_qa_lib.py`
- **CI config**: `.github/workflows/ci.yml` added `mobile/trucker-app` to both `push` and `pull_request` branch triggers (PRs targeting the mobile base now receive CI coverage), `setup-node@v4` added to the Tenant Scope Check job, graceful `python-hooks` job skip when the runner has no Python installed

**Outcome**: `mobile/trucker-app` now has a fully green CI baseline (10/10 checks SUCCESS on PR #74's final run). This unblocks all future sprint PRs from inheriting red tests as noise.

---

## Deferred themes (originally planned Sprint C–F, re-slotted to the late roadmap)

The sprints that actually shipped (C Trip Workspace, D Document Capture, E Offline Queue, F Push Notifications) diverged from the originally-planned roadmap. The following themes were originally slotted to Sprints C–F but are now deferred — they remain on the roadmap and will be picked up as appropriate:

- **ELD / telematics integration** (originally Sprint D) — Motive API integration, automatic mileage jurisdiction tracking, HOS status display, real-time vehicle location polling, ELD data sync conflict resolution. Depends on ELD vendor partnerships.
- **IFTA automation + fuel management** (originally Sprint E) — fuel card API (Comdata / EFS / WEX), automated jurisdiction mileage from ELD data, quarterly IFTA calculation engine, filing preparation export, fuel purchase receipt matching. Partial foundation exists from Sprint B1's IFTA audit packet MVP.
- **Broker credit scoring and receivables** (originally Sprint F) — broker payment history aggregation, credit score calculation engine, slow-pay detection and alerts, broker credit dashboard, invoice aging analytics (using B1 aging bucket data).

---

## Sprint G

**Theme**: Settlement automation

**Goal**: Automate driver settlement calculations, including per-mile pay, accessorial charges, deductions, and direct deposit integration.

Key deliverables:
- Settlement calculation engine (per-mile, percentage, flat)
- Accessorial charge configuration
- Deduction management (advances, fuel, insurance)
- Settlement statement generation (PDF)
- Payment processing integration prep

---

## Sprint H

**Theme**: Facility dwell time and detention billing

**Goal**: Track facility dwell time using geofencing and ELD data. Automatically generate detention invoices when dwell exceeds contracted free time.

Key deliverables:
- Geofence-based facility arrival/departure detection
- Dwell time calculation engine
- Detention billing rule configuration
- Automated detention invoice generation
- Facility performance scorecards

---

## Sprint I

**Theme**: Maintenance and compliance management

**Goal**: Build preventive maintenance scheduling, DVIR integration, and compliance calendar for driver qualifications and equipment certifications.

Key deliverables:
- Preventive maintenance schedule engine
- DVIR submission and tracking (mobile)
- Compliance calendar with expiration alerts
- Equipment certification tracking
- Maintenance cost tracking and reporting

---

## Sprint J

**Theme**: Route optimization and trip planning

**Goal**: Intelligent trip planning that considers fuel costs, HOS constraints, facility dwell history, and weather conditions.

Key deliverables:
- Multi-stop route optimization
- HOS-aware trip planning
- Fuel cost optimization (cheapest fuel stops)
- Weather-informed routing
- Trip profitability estimation

---

## Sprint K

**Theme**: Freemium tier and self-service onboarding

**Goal**: Implement the freemium business model. Allow owner-operators to self-register, use limited features free, and upgrade to paid tiers.

Key deliverables:
- Self-service registration flow
- Freemium feature gating
- Subscription management (Stripe integration)
- Usage quotas and metering
- Upgrade prompt UX

---

## Sprint L

**Theme**: Analytics dashboard and business intelligence

**Goal**: Comprehensive analytics for owner-operators covering revenue per mile, cost per mile, deadhead percentage, and fleet utilization.

Key deliverables:
- Revenue analytics (per mile, per load, per lane)
- Cost analytics (fuel, maintenance, insurance, tolls)
- Utilization metrics (loaded vs empty miles)
- Trend visualization and period comparison
- Exportable reports (PDF, CSV)

---

## Sprint M

**Theme**: General availability preparation and hardening

**Goal**: Final hardening sprint before public launch. Performance optimization, security audit, accessibility compliance, and production monitoring.

Key deliverables:
- Performance audit and optimization (bundle size, API latency)
- Security penetration testing and remediation
- WCAG 2.1 AA accessibility compliance
- Production monitoring and alerting setup
- App store submission preparation (iOS, Android)
- Launch checklist completion
