Trucker App Plan — Mobile-First Driver Experience (v1)

 ▎ Status: DRAFT v1. Written 2026-04-08 after 9-agent parallel research pass and strategic
 convergence between Claude and ChatGPT. This plan is review-ready but still requires the
 mandatory Phase -1 entry gate and sprint extraction before Ralph dispatch. Architectural defaults
 are now locked in this document; remaining work before dispatch is path verification, phase
 extraction, and confirming the live repo state against the entry gate.

 ▎ Assumption: This plan assumes the `ralph/pre-demo-remediation` sprint is fully complete and
 merged to main, AND the `ralph/bulletproof-sales-demo` (BSD) sprint is fully complete and merged
 to main, BEFORE this plan is dispatched. The trucker-app plan consumes the remediation's schema
 fixes (parties.entity_class, loads.equipment_id, loads.intake_source, the polling layer, the
 Issue Board create handler, the driver-intake routes) AND the BSD sprint's seed pipeline, demo
 shell, and AI hero demo gate as stable substrate.

 ▎ Target branch (created by Ralph at dispatch time): `ralph/trucker-app-v1`

 ▎ Replaces: none. This is a net-new product surface running alongside the existing web SaaS.

 ▎ Canonical references:
 - `docs/trucker-app-strategy-decisions-2026-04-08.md` — consolidated decisions memo (9-agent research pass)
 - `docs/trucker-app-feature-research-2026-04-08.md` — ChatGPT's initial research memo
 - `C:\Users\rober\.claude\projects\F--Trucking-DisbatchMe\memory\MEMORY.md` — project memory
 - `.claude/rules/build-conventions.md` — shared build conventions
 - `.claude/rules/production-standards.md` — production code standards

 ---
Context

 The current DisbatchMe SaaS is a web-only trucking operations platform (TMS + compliance + IFTA
 + accounting + CRM) targeting small trucking fleets (5-50 trucks) and owner-operators. It has an
 AI-first paperwork wedge (Gemini-powered BOL/Rate-Con extraction), a fully-wired driver intake
 flow from STORY-005 of the remediation sprint, and a bulletproof demo that ships via the BSD
 sprint.

 What's missing is a **mobile-first driver experience** — a dedicated app for drivers and
 owner-operators that puts the trip, the paperwork, the compliance trail, and the settlement
 readiness in their pocket. The mobile experience should:

 - run as a real native app (not a PWA), because push notifications and offline-first document
   capture are non-negotiable for this audience
 - share the same backend and API contract as the web app (one backend, two frontends)
 - ship AI-first paperwork as the hero experience (matches the wedge that sells the web app)
 - include the ONE feature that owner-operators immediately understand as cash-value: **one-click
   IFTA audit packet export**
 - integrate with at least one ELD provider (Motive first) so the app is credible as a driver tool,
   not just an accounting companion
 - handle offline-first document capture with a local queue and background sync
 - support English + Spanish from day 1 (23% of US drivers are Hispanic/Latino; zero incumbents
   ship Spanish)
 - enforce the freemium pricing tier (1 truck free, $19/truck 2-5, $39/truck 6-50)

 This plan is NOT about rewriting the backend or redesigning the data model. It reuses the
 existing MySQL schema, Express routes, Firebase Auth, and domain logic. It adds a mobile frontend
 in a new `apps/trucker/` subtree and extends the backend only where necessary (new routes for
 audit packet export, ELD adapter layer, invoice aging data collection for broker credit).

 ---
Prime Directives

 1. **One backend, two frontends.** The trucker app consumes the same Express API the web app
    uses. No fork. No parallel API. If the trucker app needs a new endpoint, the web app gets it
    too. If the web app already has an endpoint, the trucker app uses it as-is unless the
    response shape is inappropriate for mobile (in which case the endpoint adds a mobile-friendly
    variant, not a replacement).

 2. **Offline-first is a design constraint, not an afterthought.** Every driver-facing screen
    must work gracefully when disconnected. Document capture MUST work offline (photo captured,
    queued, uploaded on reconnect). Auth MUST work offline (cached session + biometric unlock).
    List views MUST show cached data when disconnected with a clear "offline" indicator.

 3. **Audit packet export ships FIRST** (Phase 1), before any mobile work. This is the highest-ROI
    near-term feature per research. It's cheap to build (5-6 days), demo-able immediately, and
    sells itself to any owner-operator who's ever been audited. Shipping it first gives the web
    app a new capability AND builds the back-end plumbing (audit_packets table, packet generation
    logic, PDF templates, ZIP bundling) that the mobile app consumes in Phase 8.

 4. **ELD is a partnership, not a build.** We integrate with Motive's public developer API
    (OAuth 2.0, REST, webhooks) as Phase 6. We do NOT build our own FMCSA-certified ELD hardware.
    Samsara is Phase 2 ELD provider (after first customers). The ELD integration uses a provider
    abstraction layer so adding Samsara/Geotab later is a new adapter, not a rewrite.

 5. **Legal disclaimers are mandatory on all compliance UI.** Any screen that shows IFTA status,
    CDL expiry, permit status, 2290 status, UCR status, or Clearinghouse queries MUST include an
    explicit disclaimer that the authoritative source is the state/FMCSA record, not our app. A
    "last verified" timestamp must appear next to every compliance status. Legal review of
    disclaimer text is mandatory before launch.

 6. **No scope creep in the AI extraction flow.** The trucker app uses the existing extraction
    API (`POST /api/ai/extract-load`) unchanged. We do NOT add new Gemini prompts, new extraction
    schemas, or new AI services. If the extraction quality needs improvement, that's a separate
    plan.

 7. **Spanish + English from day 1.** Every user-facing string goes through an i18n layer.
    Professional translator for legal/compliance strings (no machine translation for disclaimers
    or regulatory text).

 8. **Broker credit watchlist data collection starts early, display ships late.** Invoice aging
    data collection begins as a backend silent phase in Phase 1 (alongside audit packet). The
    broker credit score display ships in Phase 10 after sufficient data maturity (months of
    cross-tenant invoice data). Shipping the display with empty data is worse than not shipping
    it at all.

 ---
Hard Rules

 1. **Zero edits to files not listed in a phase's File Inventory.** The File Inventory table near
    the bottom of this plan is authoritative. If a ralph-worker needs to edit an unlisted file,
    it MUST escalate to the orchestrator.

 2. **Backward compatibility with the web app is required at every phase.** The web app must
    continue to pass all its tests (frontend vitest + server vitest) after every phase of this
    plan. The plan does NOT refactor the web app; it adds parallel mobile infrastructure.

 3. **Monorepo migration is a one-time move.** Phase 0 restructures the repo into
    `apps/web/` + `apps/trucker/` + `packages/shared/`. After Phase 0, no further restructuring
    happens unless explicitly called out.

 4. **Existing production code in `server/` is minimally modified.** Extensions to existing
    routes are additive (new endpoints, new query parameters, new fields). Refactors are out of
    scope for this plan.

 5. **The existing driver components (`components/DriverMobileHome.tsx`,
    `components/driver/DriverLoadIntakePanel.tsx`, `components/PendingDriverIntakeQueue.tsx`,
    `components/Scanner.tsx`) stay in the web app.** The mobile app has its OWN trip workspace,
    document intake, and scanner components written in React Native. These web components
    continue to serve the web app's driver-view functionality (useful for dispatchers previewing
    what drivers see). We do NOT port them to React Native line-by-line — we rewrite them
    idiomatically for mobile using the shared API client in `packages/shared/`.

 6. **Native platform APIs go through Expo SDK where possible.** Camera → `expo-camera`. Local
    storage → `expo-sqlite`. Biometric → `expo-local-authentication`. Push notifications → Expo
    Push Service. Background sync → `expo-task-manager`. File system → `expo-file-system`.
    Deep links → `expo-linking` or `expo-router`. Exceptions require explicit justification in
    the relevant phase.

 7. **State management is local-first.** The mobile app uses a local SQLite cache as the source
    of truth for the current session. API calls write to the cache; the cache pushes to the
    backend on connectivity. This is the opposite of the web app's "API is truth" model. The
    trade-off is intentional because drivers operate offline frequently.

 8. **Pricing tier enforcement happens at the API layer, not the UI layer.** A driver on the free
    tier who tries to exceed their monthly Gemini extraction limit sees a graceful upgrade prompt
    in the mobile UI, but the LIMIT is enforced by the server (requireTier middleware + monthly
    counter). The mobile UI is not trusted to enforce its own limits.

 9. **App Store + Play Store compliance is a Phase 0 concern, not a launch-day surprise.** Apple
    Developer account ($99/yr), Google Play Console ($25 one-time), Expo Application Services
    (EAS) setup, bundle IDs, provisioning profiles, and code signing must be in place BEFORE
    any code ships. This is Phase 0 infrastructure.

 10. **No "quick fixes" to the web app's existing files during this plan.** If the plan needs to
     fix a web-app bug, it goes in a separate sprint. The trucker-app plan must not mix
     trucker-app work with unrelated web-app fixes.

 ---
## Phase -1 — Entry Gate (mandatory before Sprint A dispatch)

 This is not a Ralph sprint. It is a preflight checklist that MUST be satisfied before any
 trucker-app sprint is copied into `.claude/docs/PLAN.md`.

 **Purpose**: verify that this plan's assumed substrate is actually present and stable.

 Entry gate checklist:

 1. Remediation sprint is fully merged to `main`, including STORY-005 and STORY-006.
 2. BSD MVP is fully merged to `main`, including the deterministic AI hero demo gate and seed
    pipeline required by this plan's assumptions.
 3. The canonical driver-intake boundary is confirmed in live code:
    - dispatcher/general load creation continues through the canonical load creation flow
    - driver mobile flow continues through `server/routes/loads-driver-intake.ts`
    - drivers do NOT receive generic "create load" capability
 4. The canonical document domain is confirmed as `/api/documents` and remains the single source
    of truth for document upload, status, storage, and download.
 5. Worktree isolation is verified against commit `17f8d99`. If it is not working, trucker-app
    sprints must be dispatched sequentially or with the two-clone workaround.
 6. Root test baseline is green before any trucker-app changes:
    - frontend vitest
    - server vitest
    - the current required E2E subset
 7. Current-path inventory is revalidated against the live repo before Phase 0 extraction.
 8. Any seed/demo fixtures assumed by the plan still exist and still match BSD outputs.
 9. Brand name for bundle IDs is confirmed (default: `LoadPilot Driver` per Open Questions §1).
    The bundle IDs `com.disbatchme.trucker.ios` and `com.disbatchme.trucker` in Phase 0's
    `app.config.ts` assume this default. If the operator chooses a different brand, Phase 0
    must be updated with the new bundle IDs BEFORE Sprint A dispatch — not after.
 10. Pre-Phase-0 manual monorepo move is either complete OR scheduled as a manual step before
    Sprint A Phase 0 begins (see "Pre-Phase-0 Manual Prerequisite" section below). Ralph
    workers do NOT perform the bulk file move; it must be done by a human operator using
    `git mv` + import path fixes, with all web tests passing before handoff.

 Exit artifact:

 - `docs/trucker-app-entry-gate.md` documenting the exact commit SHAs and checklist results used
   to authorize Sprint A dispatch.

 ---
Delivery Status Model

 This plan distinguishes **engineering completion** from **operational exit gates**.

 - **Engineering complete**: code merged, automated verification commands pass, and any required
   manual engineer-controlled checks have passed.
 - **Operational exit gate**: external approval, legal review, app-store submission readiness,
   design-partner recruitment, or data-maturity threshold.

 Rules:

 1. Manual/legal/business/data-maturity markers do NOT block code merge unless the phase goal
    explicitly says the phase is launch-ready.
 2. Legal review, app store review prep, and market-data maturity are tracked as exit gates,
    not proof that a worker sprint failed.
 3. Each extracted sprint should label stories as either `engineering` or `operational-gate`.

 ---
Phase Summary

 | # | Phase | Type | Duration | Dependencies |
 |---|---|---|---|---|
 | 0 | Foundation: Monorepo Restructure + Mobile Stack Bootstrap | foundation | ~1 week | Remediation + BSD merged |
 | 1 | IFTA Audit Packet Export MVP (web + backend) | module | ~1 week | Remediation + BSD merged. LOCKED: runs BEFORE Phase 0. All file paths in Phase 1 reference the pre-monorepo layout (root `components/`, `services/`, `src/__tests__/`). Phase 0 later moves these files along with the rest of the web app. |
 | 2 | Mobile App Shell: Expo Scaffold + i18n + Home Screen | foundation | ~1 week | Phase 0 |
 | 3 | Mobile Auth: SMS Invite + Biometric + Offline Session | module | ~1 week | Phase 2 |
 | 4 | Trip Workspace: Mobile Home + Stop Sequence + Status Updates | module | ~1 week | Phase 3 |
 | 5 | Smart Document Intake: Camera + Offline Queue + Background Sync | module | ~4 weeks | Phase 3 |
 | 6 | ELD Integration: Provider Abstraction + Motive Adapter | integration | ~2 weeks | Phase 0 backend (parallel with Phase 5) |
 | 7 | Compliance Hub Mobile: IFTA + IRP + 2290 + UCR + Permits + Clearinghouse | module | ~2 weeks | Phase 5 (backend data flow), Phase 1 (audit packet API) |
 | 8 | Mobile Audit Packet Export + Invoice Aging Silent Collection | module | ~1 week | Phase 1 (backend), Phase 7 |
 | 9 | Freemium Tier Enforcement + Stripe Subscription | module | ~1 week | Phase 2 |
 | 10 | Broker Credit Watchlist Display + Facility Dwell-Time Index Export | module | ~2 weeks | Phase 8 (data maturity), Phase 1 (backend) |
 | 11 | Offline-First Hardening + Beta Launch Prep | integration | ~2 weeks | All prior phases |

 **Total estimated effort**: 18-19 weeks (~4.5 months). The engineering MVP is reachable at end
 of Phase 6 (~9 weeks), but that MVP is NOT the full trucker-app vision. It is a limited first
 release containing mobile shell + auth + trip workspace + document intake + Motive HOS status +
 web audit packet export. Phases 7-11 contain major portions of the compliance, monetization,
 intelligence, and launch hardening work. **Phase 5 was specifically bumped from 3 weeks to 4
 weeks** because offline-first doc capture with AI extraction and background sync is the hardest
 technical problem in the plan; v0's 3-week estimate was optimistic.

 **Parallel execution opportunities** (worktree isolation verified working per commit `17f8d99`):
 - Phase 1 (backend audit packet) runs BEFORE Phase 0 on the pre-monorepo layout; Phase 0 later
   restructures Phase 1's output along with the rest of the web app
 - Phase 6 (ELD backend) can run parallel with Phase 5 (mobile doc intake)
 - Phase 9 (tier enforcement) can run parallel with Phase 7 (compliance hub mobile)

 ---
## Pre-Phase-0 — Manual Monorepo Move (human operator, not a Ralph sprint)

 This section is **not a Ralph sprint**. It is a manual prerequisite that must be completed by a
 human operator before Phase 0 can dispatch. The monorepo file move is a MASSIVE single-commit
 operation (hundreds of files, every import path in the codebase) that Ralph's single-story
 dispatch model is not well-suited for.

 Goal: After Pre-Phase-0, the repo is restructured into `apps/web/` + (empty) `apps/trucker/` +
 (empty) `packages/shared/`. The web app continues to work exactly as before — all frontend and
 server tests pass. No trucker-app or shared-package content yet; that lands in Phase 0.

 Manual steps (human operator runs these, not Ralph):

 1. `git checkout -b ralph/trucker-app-pre-phase-0`
 2. Create `apps/web/`, `apps/trucker/`, `packages/shared/` directories.
 3. `git mv` the web app's `src/`, `components/`, `services/`, `contexts/`, `hooks/`, `lib/`,
    `pages/`, and `public/` directories under `apps/web/`. Also move `vite.config.ts`,
    `index.html`, `tsconfig.json` (app-specific one, not root), and any other root-level web-app
    config files.
 4. Update all import paths inside the moved files. Most editors can do this automatically
    (VSCode: "Update imports on move"). Verify by running `npx tsc --noEmit` and fixing any
    remaining unresolved imports.
 5. Create `pnpm-workspace.yaml` at the repo root listing `apps/*` and `packages/*`.
 6. Update the root `package.json` with workspace entries and per-app scripts (`dev:web`,
    `test:web`, etc.).
 7. Update the root `tsconfig.json` with path aliases `@shared/*` and `@trucker/*`.
 8. Run `pnpm install` to initialize the workspace.
 9. Run `pnpm -w run test:web` — all web app tests MUST pass. This is the single gate that
    proves the move didn't break anything.
 10. Run `cd server && npm test` — all server tests MUST pass. Server didn't move but the test
     runner may have picked up path changes.
 11. Commit as `chore(monorepo): move web app under apps/web/ (pre-Phase-0 manual)`.
 12. Merge this branch to main (or whatever branch Phase 0 will dispatch against).

 Verification (operator-run, not Ralph):

 - `pnpm -w run test:web` passes
 - `cd server && npm test` passes
 - `npx tsc --noEmit` at root passes
 - `git status` shows no uncommitted changes
 - `docs/trucker-app-entry-gate.md` is updated with the pre-Phase-0 commit SHA

 Why this is NOT a Ralph sprint:

 1. Ralph's single-story dispatch assumes one story = one focused change. The monorepo move
    touches ~every file in the repo — not a story-sized unit.
 2. `git mv` + import path updates are best done by a human editor with refactor tooling, not
    by an LLM writing one-Edit-at-a-time.
 3. A failed Ralph dispatch mid-move would leave the repo in a half-moved state that's very
    hard to recover from.
 4. The move has zero decision-making surface — it's purely mechanical. Ralph's value is in
    decisions (plan compliance, TDD, scope enforcement), not mechanical file moves.

 ---
## Phase 0 — Foundation: Mobile Stack Bootstrap (post-monorepo-move)

 **Phase Type**: `foundation`

 Goal: After this phase, an Expo + React Native scaffold exists under `apps/trucker/` with a
 "Hello World" screen that renders on a real device via Expo Dev Client. EAS Build is configured
 for both iOS and Android. Apple Developer Team ID, Google Play package name, bundle identifiers,
 and code signing are set up (keystore + provisioning profiles generated). The shared API client
 in `packages/shared/api-client/` is extracted from the web app and used by both frontends. The
 monorepo move from Pre-Phase-0 is assumed complete.

 Files (new):

 Path: `apps/trucker/package.json`
 Purpose: Expo + React Native app manifest. Expo SDK 52 (or latest stable at dispatch time).
   Dependencies: `expo`, `expo-router`, `expo-sqlite`, `expo-camera`, `expo-local-authentication`,
   `expo-file-system`, `expo-linking`, `expo-task-manager`, `react`, `react-native`,
   `react-native-reanimated`, `@tanstack/react-query`, `zustand`, `@react-navigation/native`,
   `nativewind`, `i18next`, `react-i18next`,
   `expo-localization`. Points at `@trucker/shared` via workspace reference.

 Path: `apps/trucker/app.config.ts`
 Purpose: Expo app config. Bundle ID: `com.disbatchme.trucker.ios`, Android package:
   `com.disbatchme.trucker`. App name: "LoadPilot" or whatever brand is chosen (decision). Icon
   and splash screen assets reference `apps/trucker/assets/`. Permissions: camera, photo library,
   location (for trip workspace), biometric, notifications, background fetch. iOS info.plist
   entries for ATT and NSCameraUsageDescription. Android AndroidManifest entries for
   ACCESS_BACKGROUND_LOCATION.

 Path: `apps/trucker/app/_layout.tsx`
 Purpose: Expo Router root layout. Sets up React Query provider, Zustand store, i18next, theme
   provider, and authentication guard. Renders `<Stack>` or `<Tabs>` based on auth state.

 Path: `apps/trucker/app/index.tsx`
 Purpose: First screen. Shows a language picker (EN/ES) and routes to login or trip workspace
   based on cached auth state.

 Path: `apps/trucker/eas.json`
 Purpose: EAS Build profiles. `development` (dev client with hot reload), `preview` (internal
   distribution TestFlight/APK), `production` (App Store + Play Store release).

 Path: `apps/trucker/tsconfig.json`
 Purpose: TypeScript config. Extends root tsconfig. Path alias `@shared/*` → `packages/shared/*`.
   `jsx: react-native`. Strict mode enabled.

 Path: `apps/trucker/babel.config.js`
 Purpose: Babel config with `babel-preset-expo` and `nativewind/babel`.

 Path: `apps/trucker/metro.config.js`
 Purpose: Metro bundler config with workspace-aware resolver so Metro can find
   `packages/shared/` during development.

 Path: `apps/trucker/assets/icon.png`, `apps/trucker/assets/splash.png`, `apps/trucker/assets/adaptive-icon.png`
 Purpose: App icons and splash screen. 1024x1024 PNG for each. Placeholder brand assets; final
   assets come later (not in scope for Phase 0).

 Path: `packages/shared/package.json`
 Purpose: Shared library package manifest. No runtime dependencies except `zod` for type
   validation. Exports API client, types, and shared utilities.

 Path: `packages/shared/src/api-client/index.ts`
 Purpose: The shared API client. Wraps `fetch` with auth header injection, response parsing,
   and error handling. Re-exports domain-specific clients: `authClient`, `loadsClient`,
   `partiesClient`, `ai Client`, `iftaClient`, etc. Extracted from the existing `services/api.ts`
   and made platform-agnostic (works in both browser and React Native environments).

 Path: `packages/shared/src/api-client/auth.ts`
 Purpose: Auth client: login, logout, refresh token, biometric unlock (via callback), session
   cache operations. Platform-agnostic storage abstraction so web uses localStorage and mobile
   uses expo-secure-store.

 Path: `packages/shared/src/api-client/loads.ts`
 Purpose: Loads client: getLoad, listLoads, createLoad (dispatcher path), createDriverIntake,
   updateLoadStatus, patchLoad, listDocuments, uploadDocument.

 Path: `packages/shared/src/api-client/ai.ts`
 Purpose: AI extraction client: extractLoad, extractBroker, extractEquipment. Wraps POST
   /api/ai/extract-load with proper error handling and typed responses.

 Path: `packages/shared/src/api-client/ifta.ts`
 Purpose: IFTA client: getIftaSummary, postIftaToLedger, listIftaEvidence, generateAuditPacket
   (Phase 1 introduces this method).

 Path: `packages/shared/src/types/index.ts`
 Purpose: Shared TypeScript types re-exported from the existing `types.ts` at repo root. No
   new types introduced.

 Path: `packages/shared/src/storage/index.ts`
 Purpose: Platform-agnostic storage interface. Two implementations:
   `BrowserStorage` (localStorage-based, used by web app) and
   `MobileStorage` (expo-secure-store + expo-sqlite, used by mobile app). The interface has
   `get`, `set`, `delete`, `clear`. Caller imports the interface and the platform-specific
   implementation is bound at app bootstrap.

 Path: `packages/shared/src/storage/browser.ts`
 Purpose: Browser storage implementation using localStorage + IndexedDB for larger blobs.

 Path: `packages/shared/src/storage/mobile.ts`
 Purpose: Mobile storage implementation using expo-secure-store for small secrets (tokens) and
   expo-sqlite for cached data (loads, documents, compliance records).

 Path: `packages/shared/tsconfig.json`
 Purpose: TypeScript config for the shared package. Strict mode. Output to `packages/shared/dist/`.

 Path: `pnpm-workspace.yaml`
 Purpose: pnpm workspace config. Lists `apps/*` and `packages/*` as workspaces.

 Path: `docs/monorepo-setup.md`
 Purpose: Developer onboarding doc. How to install pnpm, initialize the workspace, run the web
   app, run the mobile app, run tests across both, troubleshoot common issues.

 Path: `apps/trucker/__tests__/smoke.test.tsx`
 Purpose: Smoke test: renders the root layout, verifies the language picker screen shows up,
   verifies routing to login works. Uses React Native Testing Library + Jest.

 Files (existing) extended:

 Path: `package.json` (root)
 What changes: Pre-Phase-0 already added workspace entries and `dev:web`/`test:web` scripts.
   Phase 0 adds `dev:trucker`, `test:trucker`, `build:trucker` scripts pointing at the new
   `apps/trucker/` workspace. ~5 added lines.

 Path: `tsconfig.json` (root)
 What changes: Pre-Phase-0 already added path aliases for the moved web app. Phase 0 adds
   `@trucker/*` path alias pointing at `apps/trucker/src/*`. ~2 added lines.

 Path: `apps/web/src/services/api.ts` (already at the post-move path after Pre-Phase-0)
 What changes: Re-export from `@shared/api-client` instead of containing implementation. The
   implementation MOVES to `packages/shared/src/api-client/`. The web app continues to import
   from `@/services/api` (compatibility shim). No behavioral change to existing callers.

 Path: `.gitignore`
 What changes: Add `apps/trucker/.expo/`, `apps/trucker/node_modules/`, `apps/trucker/ios/`,
   `apps/trucker/android/`, `packages/shared/dist/`. Preserve existing entries.

 Verification command:

 ```bash
 pnpm install && pnpm -w run test:all && cd apps/trucker && npx expo doctor
 ```

 Acceptance criteria (R-markers):

 - R-P0-01 [unit]: `pnpm-workspace.yaml` exists and lists `apps/*` and `packages/*` as workspaces.
 - R-P0-02 [unit]: `apps/web/package.json` exists and the web app's dev script starts Vite
   successfully.
 - R-P0-03 [unit]: `apps/trucker/package.json` exists and declares Expo + React Native +
   `@trucker/shared` dependencies.
 - R-P0-04 [unit]: `packages/shared/src/api-client/index.ts` exports a platform-agnostic API
   client with `authClient`, `loadsClient`, `aiClient`, `iftaClient`.
 - R-P0-05 [unit]: The web app's `services/api.ts` re-exports from `@shared/api-client` and
   does not duplicate the implementation.
 - R-P0-06 [integration]: `pnpm -w run test:web` runs the existing web app tests and ALL pass
   (zero regression).
 - R-P0-07 [integration]: `pnpm -w run test:trucker` runs the mobile app smoke test and passes.
 - R-P0-08 [integration]: `npx expo doctor` in `apps/trucker/` reports zero issues.
 - R-P0-09 [unit]: `eas.json` exists with `development`, `preview`, and `production` profiles.
 - R-P0-10 [manual]: `eas build --platform ios --profile development` succeeds (requires Apple
   Developer account set up manually by user before dispatch).
 - R-P0-11 [manual]: `eas build --platform android --profile development` succeeds (requires
   Google Play Console set up manually).
 - R-P0-12 [unit]: `packages/shared/src/storage/index.ts` defines a platform-agnostic storage
   interface with `get`, `set`, `delete`, `clear` methods.
 - R-P0-13 [unit]: `packages/shared/src/storage/browser.ts` and `mobile.ts` both implement the
   storage interface.
 - R-P0-14 [unit]: `docs/monorepo-setup.md` exists and contains `## Install`, `## Run`, `## Test`,
   `## Troubleshoot` sections.

 **Architectural decisions to LOCK in this phase** (must be resolved before R-P0-01 ships):

 1. **Package manager**: pnpm. Locked default for dispatch.
 2. **Build orchestrator**: plain pnpm workspaces for Sprint A. Turborepo is deferred unless
    build times justify it later.
 3. **Mobile styling**: NativeWind. Locked default for dispatch.
 4. **State management (mobile)**: Zustand + React Query. Locked default for dispatch.
 5. **Navigation**: Expo Router. Locked default for dispatch.

 ---
## Phase 1 — IFTA Audit Packet Export MVP (web + backend)

 **Phase Type**: `module`

 Goal: After this phase, a user in the web app can click "Generate IFTA Audit Packet" in
 `IFTAManager.tsx`, select a quarter + year, and download a ZIP file containing:
 - a cover letter PDF with company info, tax summary table, and signature line
 - `mileage.csv` (mileage_jurisdiction rows filtered to the quarter)
 - `fuel.csv` (fuel_ledger rows filtered to the quarter)
 - `trips.json` (ifta_trips_audit rows filtered to the quarter)
 - `documents/` folder with all fuel receipts and BOLs linked to loads in the quarter

 The ZIP is generated server-side, stored in Firebase Storage under
 `audit-packets/{tenant_id}/{packet_id}.zip`, and a signed download URL is returned. A new table
 `ifta_audit_packets` tracks generated packets with status (draft/filed/verified/locked).

 This phase is WEB + BACKEND only. The mobile app consumes this API in Phase 8. Shipping the
 web version first gives the existing product a new capability AND builds the backend plumbing
 that mobile reuses.

 **Silent work in this phase**: The backend ALSO starts collecting invoice aging data for the
 broker credit watchlist feature (Phase 10). This is invisible to users — just a new column on
 the invoices table and a nightly job that computes days-since-issued for unpaid invoices. No UI
 touches. The data starts accumulating from day 1 so Phase 10 has historical data to display.

 Files (new):

 Path: `server/migrations/051_ifta_audit_packets.sql`
 Purpose: Additive migration.
   UP: adds table `ifta_audit_packets` with columns `id VARCHAR(36)`,
   `company_id VARCHAR(36) NOT NULL`, `quarter TINYINT NOT NULL`, `year SMALLINT NOT NULL`,
   `status ENUM('draft','filed','verified','locked') DEFAULT 'draft'`,
   `storage_path VARCHAR(500)`, `sha256_hash VARCHAR(64)`, `created_by VARCHAR(36)`,
   `created_at TIMESTAMP`, `filed_at TIMESTAMP NULL`, `locked_at TIMESTAMP NULL`,
   `retention_until DATE NOT NULL`. FK to `companies(id)` and `users(id)`. Indexes on
   `(company_id, year, quarter)` and `(company_id, status, created_at)`.
   DOWN: drops the table and its indexes. No other DROP statements.

 Path: `server/migrations/052_invoices_aging_tracking.sql`
 Purpose: Additive migration for broker credit silent collection.
   UP: adds columns `days_since_issued INT NULL` and `aging_bucket ENUM('current','30','60','90','120+') NULL`
   to the existing `ar_invoices` table. Adds an index on `(broker_id, aging_bucket)` if the
   invoices table has `broker_id` (verify against migration 011). If not, the column is just
   `customer_id`.
   DOWN: drops the two columns and the index. No other changes.

 Path: `server/routes/ifta-audit-packets.ts`
 Purpose: New Express router mounted at `/api/accounting/ifta-audit-packets`. Endpoints:
   - `POST /` — generate a new packet. Body: `{ quarter: number, year: number, includeDocuments?: boolean }`.
     Queries mileage_jurisdiction, fuel_ledger, ifta_trips_audit, documents for the requested
     period, generates the cover letter PDF via jsPDF, bundles everything into a ZIP via JSZip,
     uploads to Firebase Storage, inserts a row into `ifta_audit_packets`, returns the packet
     metadata + signed download URL.
   - `GET /` — list packets for the current tenant, most recent first. Paginated.
   - `GET /:packetId` — retrieve packet metadata + signed download URL (regenerated on each call
     because signed URLs expire).
   - `POST /:packetId/verify` — sha256 hash verification for audit trail integrity.

 Path: `server/services/ifta-audit-packet.service.ts`
 Purpose: Business logic for packet generation. Functions:
   - `collectQuarterData(companyId, quarter, year)` — queries all source tables, returns
     structured data.
   - `generateCoverLetterPdf(data)` — uses jsPDF + jspdf-autotable to produce a cover letter
     with company info, tax summary table, and signature line. Returns a Buffer.
   - `bundleAuditPacket(data, coverLetterBuffer, includeDocuments)` — uses JSZip to bundle
     everything. Returns a Buffer.
   - `uploadPacketToStorage(buffer, packetId)` — uploads to Firebase Storage, returns the
     storage path.
   - `computePacketHash(buffer)` — sha256 hash for integrity verification.

 Path: `server/jobs/invoice-aging-nightly.ts`
 Purpose: Nightly cron job (runs at 2 AM UTC) that iterates over all unpaid ar_invoices and
   updates `days_since_issued` and `aging_bucket`. The job is idempotent and can be re-run
   safely. This is the silent data collection that feeds broker credit watchlist in Phase 10.

 Path: `server/__tests__/migrations/051_ifta_audit_packets.test.ts`
 Purpose: Doc-as-spec regression test for the migration. Asserts the table exists, has the
   correct columns, and DOWN drops only what UP added.

 Path: `server/__tests__/migrations/052_invoices_aging_tracking.test.ts`
 Purpose: Same doc-as-spec test for the aging migration.

 Path: `server/__tests__/routes/ifta-audit-packets.test.ts`
 Purpose: Integration tests for all endpoints. Tests packet generation from seeded data,
   signed URL retrieval, pagination, verify endpoint. Mocks JSZip + Firebase Storage uploads.

 Path: `server/__tests__/services/ifta-audit-packet.service.test.ts`
 Purpose: Unit tests for the service functions. Tests data collection, PDF generation, ZIP
   bundling, hash computation against known fixtures.

 Path: `server/__tests__/jobs/invoice-aging-nightly.test.ts`
 Purpose: Tests for the aging job. Runs the job against seeded invoices, asserts
   `days_since_issued` and `aging_bucket` are correctly computed.

 Path: `src/__tests__/components/IFTAManager.audit-packet.test.tsx`
 Purpose: Frontend test. Renders IFTAManager with a mocked API response, clicks the
   "Generate Audit Packet" button, asserts the modal opens, fills in quarter + year, asserts
   the POST call is made with correct body, asserts the download link appears on success.

 Files (existing) extended:

 Path: `server/index.ts`
 What changes: Mount the new router: `app.use("/api/accounting/ifta-audit-packets", iftaAuditPacketsRouter);`.
   2 added lines (import + mount).

 Path: `components/IFTAManager.tsx`
 What changes: Add a "Generate Audit Packet" button and modal. Modal has quarter/year selectors,
   "include documents" checkbox, submit button. On submit, calls the new API, shows progress,
   displays the download link on success. Phase 1 is LOCKED to the pre-monorepo layout; Phase 0
   later moves this file to `apps/web/src/components/IFTAManager.tsx` along with the rest of the
   web app.

 Path: `services/financialService.ts`
 What changes: Add `generateIftaAuditPacket(quarter, year, includeDocuments)`,
   `listIftaAuditPackets(page)`, `getIftaAuditPacket(packetId)` methods. Phase 1 writes this at
   the pre-monorepo path `services/financialService.ts`. Phase 0 later moves it to
   `apps/web/src/services/financialService.ts` and `packages/shared/src/api-client/ifta.ts`
   becomes the authoritative client via re-export. In Phase 1 alone, direct fetch calls wired
   to the new endpoint are acceptable.

 Path: `server/package.json`
 What changes: Add `jszip` to dependencies. Run `npm install`.

 Acceptance criteria (R-markers):

 - R-P1-01 [unit]: Migration `server/migrations/051_ifta_audit_packets.sql` exists and contains
   `CREATE TABLE ifta_audit_packets` in its UP section — grep assert.
 - R-P1-02 [unit]: Migration 051 DOWN section contains `DROP TABLE ifta_audit_packets` and no
   other DROP statements — grep assert.
 - R-P1-03 [unit]: Migration 052 UP section contains `ADD COLUMN days_since_issued` and
   `ADD COLUMN aging_bucket` on `ar_invoices` — grep assert.
 - R-P1-04 [unit]: Migration 052 DOWN section contains `DROP COLUMN days_since_issued` and
   `DROP COLUMN aging_bucket` and no other DROP statements — grep assert.
 - R-P1-05 [integration]: `POST /api/accounting/ifta-audit-packets` with body
   `{ quarter: 4, year: 2026 }` returns HTTP 201 with body
   `{ packetId, storagePath, downloadUrl, status: "draft" }` when called against a seeded tenant.
 - R-P1-06 [integration]: `POST /api/accounting/ifta-audit-packets` generates a ZIP file that,
   when unzipped, contains `cover-letter.pdf`, `mileage.csv`, `fuel.csv`, `trips.json` at
   minimum.
 - R-P1-07 [integration]: `GET /api/accounting/ifta-audit-packets` returns the list of packets
   for the current tenant, most recent first, with pagination.
 - R-P1-08 [integration]: `GET /api/accounting/ifta-audit-packets/:packetId` returns the packet
   metadata with a fresh signed download URL.
 - R-P1-09 [integration]: `POST /api/accounting/ifta-audit-packets/:packetId/verify` recomputes
   the sha256 hash and returns `{ valid: true }` if it matches the stored hash.
 - R-P1-10 [unit]: `generateCoverLetterPdf()` against a known fixture produces a PDF buffer with
   the company name, quarter, and tax summary table visible (asserts via pdf-parse or similar).
 - R-P1-11 [unit]: `bundleAuditPacket()` returns a ZIP buffer containing the expected file
   entries — asserted by extracting the ZIP and checking the entry list.
 - R-P1-12 [unit]: `computePacketHash()` returns a deterministic sha256 for the same input
   buffer across multiple calls.
 - R-P1-13 [integration]: `server/jobs/invoice-aging-nightly.ts` run against seeded invoices
   correctly populates `days_since_issued` and `aging_bucket` on each invoice row.
 - R-P1-14 [unit]: `IFTAManager.tsx` contains a button with the text "Generate Audit Packet"
   and the onClick handler opens a modal — grep assert on source.
 - R-P1-15 [integration]: Frontend test renders IFTAManager, clicks "Generate Audit Packet",
   fills quarter=4/year=2026, submits, and asserts the API was called with the correct body.
 - R-P1-16 [unit]: `services/financialService.ts` exports `generateIftaAuditPacket`,
   `listIftaAuditPackets`, and `getIftaAuditPacket` functions — grep assert. (Phase 0 later
   wraps these via `packages/shared/src/api-client/ifta.ts` re-export; that is a Phase 0
   concern, not Phase 1.)
 - R-P1-17 [manual]: End-to-end: log into the web app, navigate to IFTAManager, generate a packet
   for a seeded quarter, download the ZIP, verify it opens and contains expected files.
 - R-P1-18 [unit]: `server/index.ts` mounts `/api/accounting/ifta-audit-packets` router — grep
   assert.

### Operational exit gates (tracked, not worker-blocking)

 - Packet retention period and cover-letter wording approved by product/ops.
 - Any filing-attestation workflow requested by accounting/legal is explicitly deferred to a
   later phase unless separately planned.

 Verification command:

 ```bash
 bash -c "cd server && npx vitest run __tests__/migrations/051_ifta_audit_packets.test.ts __tests__/migrations/052_invoices_aging_tracking.test.ts __tests__/routes/ifta-audit-packets.test.ts __tests__/services/ifta-audit-packet.service.test.ts __tests__/jobs/invoice-aging-nightly.test.ts && cd .. && npx vitest run src/__tests__/components/IFTAManager.audit-packet.test.tsx"
 ```

 ---
## Phase 2 — Mobile App Shell: Expo Scaffold + i18n + Home Screen

 **Phase Type**: `foundation`

 Goal: After this phase, the mobile app has a functional Expo shell with file-based routing via
 Expo Router, i18n infrastructure (English + Spanish) with professional translations for the
 core UI strings, a language picker on first launch, and a placeholder home screen that routes
 to "login" or "trip workspace" based on cached auth state. The app builds successfully via
 `eas build --profile development` for both iOS and Android. A test user can install the dev
 build on a real device via TestFlight (iOS) or internal APK (Android) and see the language
 picker screen.

 Files (new):

 Path: `apps/trucker/app/_layout.tsx`
 Purpose: Root layout. Sets up React Query provider, Zustand store, i18next, theme provider,
   and auth guard. Wraps children in `<Stack>` component from Expo Router.

 Path: `apps/trucker/app/(onboarding)/language.tsx`
 Purpose: Language picker screen. Two buttons (English / Español). On tap, sets i18next language
   and routes to `(auth)/login`.

 Path: `apps/trucker/app/(auth)/login.tsx`
 Purpose: Login screen skeleton (Phase 3 fills this in). For now, shows "Login coming soon" text
   and a placeholder email/password form.

 Path: `apps/trucker/app/(app)/_layout.tsx`
 Purpose: Authenticated app layout. Bottom tab bar with 4 tabs: Trip, Docs, Compliance, Profile.
   Tab icons from `@expo/vector-icons`.

 Path: `apps/trucker/app/(app)/trip.tsx`
 Purpose: Trip workspace placeholder (Phase 4 fills this in). Shows "Trip workspace coming soon".

 Path: `apps/trucker/app/(app)/docs.tsx`
 Purpose: Documents placeholder (Phase 5 fills this in).

 Path: `apps/trucker/app/(app)/compliance.tsx`
 Purpose: Compliance placeholder (Phase 7 fills this in).

 Path: `apps/trucker/app/(app)/profile.tsx`
 Purpose: Profile placeholder. Shows user name, language picker, logout button.

 Path: `apps/trucker/src/i18n/index.ts`
 Purpose: i18next initialization. Configures language detection via expo-localization,
   fallback to English, and loads translation bundles from `apps/trucker/src/i18n/locales/`.

 Path: `apps/trucker/src/i18n/locales/en.json`
 Purpose: English translation bundle. Covers all user-facing strings in the Phase 2 shell: nav
   tab labels, language picker, login placeholder, common errors, offline indicator, etc.
   Structured hierarchically (`common.*`, `auth.*`, `nav.*`, `errors.*`).

 Path: `apps/trucker/src/i18n/locales/es.json`
 Purpose: Spanish translation bundle. Same keys as `en.json`, professionally translated (not
   machine translation). Covers the same scope as Phase 2.

 Path: `apps/trucker/src/state/auth-store.ts`
 Purpose: Zustand store for auth state. Fields: `user`, `accessToken`, `refreshToken`, `locale`,
   `isAuthenticated`. Actions: `setSession`, `clearSession`, `setLocale`. Persists to
   expo-secure-store via `zustand/middleware/persist`.

 Path: `apps/trucker/src/theme/index.ts`
 Purpose: Theme tokens (colors, spacing, typography). Matches the web app's Tailwind config so
   the two products feel consistent.

 Path: `apps/trucker/src/components/Screen.tsx`
 Purpose: Reusable screen wrapper component. Handles safe-area insets, background color, and
   optional header. Every screen uses this as its root.

 Path: `apps/trucker/src/components/LanguagePicker.tsx`
 Purpose: Language picker component (used in onboarding AND profile). Shows EN/ES options,
   updates i18n and Zustand store on change.

 Path: `apps/trucker/src/components/ErrorBoundary.tsx`
 Purpose: React Error Boundary for the mobile app. Logs to console in dev, logs to Sentry in
   production (Sentry setup in Phase 11).

 Path: `apps/trucker/__tests__/shell.test.tsx`
 Purpose: Smoke tests. Renders `_layout`, asserts language picker shows. Renders `language.tsx`,
   taps English, asserts navigation to `login`. Renders `(app)/_layout`, asserts 4 tabs are
   present with correct labels.

 Path: `apps/trucker/__tests__/i18n.test.ts`
 Purpose: Tests that both EN and ES translation bundles have identical key sets (no missing
   translations). Tests that changing language updates all rendered strings.

 Acceptance criteria (R-markers):

 - R-P2-01 [unit]: `apps/trucker/app/_layout.tsx` exists and wraps children in a React Query
   provider and i18next provider — grep assert.
 - R-P2-02 [unit]: `apps/trucker/app/(onboarding)/language.tsx` renders two buttons (English /
   Español) — tested via React Native Testing Library.
 - R-P2-03 [unit]: `apps/trucker/src/i18n/locales/en.json` and `es.json` both exist and have
   identical key structure (no missing translations) — asserted via a deep key comparison test.
 - R-P2-04 [unit]: `apps/trucker/src/state/auth-store.ts` exports a Zustand store with
   `user`, `accessToken`, `refreshToken`, `locale`, `isAuthenticated` fields.
 - R-P2-05 [unit]: The auth store persists to expo-secure-store — asserted via mock test.
 - R-P2-06 [integration]: Tapping English in the language picker navigates to `/login`.
 - R-P2-07 [integration]: Tapping Español in the language picker sets i18n to `es` and
   navigates to `/login` with Spanish strings rendering.
 - R-P2-08 [unit]: The authenticated tab layout has exactly 4 tabs: Trip, Docs, Compliance,
   Profile — asserted via rendered tab count.
 - R-P2-09 [manual]: `eas build --profile development --platform ios` succeeds.
 - R-P2-10 [manual]: `eas build --profile development --platform android` succeeds.
 - R-P2-11 [manual]: Installing the dev build on a real iOS device via TestFlight shows the
   language picker on first launch.
 - R-P2-12 [manual]: Installing the dev build on a real Android device via APK shows the
   language picker on first launch.
 - R-P2-13 [unit]: The theme tokens in `apps/trucker/src/theme/index.ts` match the web app's
   Tailwind config for at least primary, secondary, and background colors — asserted via
   value comparison.

 Verification command:

 ```bash
 pnpm -w run test:trucker
 ```

 ---
## Phase 3 — Mobile Auth: SMS Invite + Biometric + Offline Session

 **Phase Type**: `module`

 Goal: After this phase, a driver can be invited via SMS deep link by a dispatcher, accept the
 invite, set a password, enable biometric unlock, and log in. The session persists across app
 restarts via a long-lived refresh token cached in expo-secure-store. Biometric unlock (Face ID
 / Touch ID) bypasses the password entry on subsequent launches. The refresh token is rotated
 every 15 minutes when online. The app works offline with a cached session — drivers can open
 the app, see cached data, and perform actions that queue for upload.

 Files (new):

 Path: `server/routes/driver-invitations.ts`
 Purpose: New Express router. Endpoints:
   - `POST /api/drivers/invite` — dispatcher creates a new driver. Body: `{ name, phone, cdlNumber, preferredLanguage }`.
     Creates a user record with role='driver', generates a single-use invitation token (JWT
     with 7-day TTL), sends an SMS with the branded deep link to the driver's phone.
   - `GET /api/drivers/invite/:token` — driver opens the deep link. Returns the invitation
     payload (dispatcher name, company name, preferred language). Token validity checked.
   - `POST /api/drivers/invite/:token/accept` — driver submits password. Creates the Firebase
     Auth user, links to the MySQL user record, issues access + refresh tokens, invalidates the
     invitation token.

 Path: `server/services/sms.service.ts`
 Purpose: SMS sending abstraction. Twilio as the default provider. Interface: `sendInviteSms(phone, brandedLink, language)`.
   Adapter pattern so alternative providers (AWS SNS, MessageBird) can be swapped later.
   Templates in English and Spanish.

 Path: `apps/trucker/app/(onboarding)/invite/[token].tsx`
 Purpose: Deep-link handler screen. Reads the token from URL params, calls `GET /api/drivers/invite/:token`,
   shows the dispatcher + company info, shows a password setup form, on submit calls
   `POST /api/drivers/invite/:token/accept`, stores the session in Zustand + expo-secure-store,
   prompts to enable biometric, routes to trip workspace.

 Path: `apps/trucker/app/(auth)/login.tsx` (extended from Phase 2 placeholder)
 Purpose: Login screen. If biometric is enabled AND a refresh token is cached, shows a
   biometric prompt. On biometric success, refreshes the access token and routes to trip
   workspace. Otherwise shows an email/password form.

 Path: `apps/trucker/src/auth/biometric.ts`
 Purpose: Wraps `expo-local-authentication`. Functions: `isBiometricAvailable`,
   `enableBiometric`, `authenticateWithBiometric`, `disableBiometric`. Stores a flag in
   expo-secure-store indicating whether the user has opted into biometric.

 Path: `apps/trucker/src/auth/session.ts`
 Purpose: Session management. Functions: `saveSession(accessToken, refreshToken, user)`,
   `loadSession()` (returns cached session or null), `refreshAccessToken()`,
   `clearSession()`. Stores refresh token in expo-secure-store. Access token stored in memory
   only (never persisted).

 Path: `apps/trucker/src/auth/deep-link.ts`
 Purpose: Deep link handler. Parses `disbatch.me/i/:token` URLs, extracts the token, routes to
   the invite screen.

 Path: `server/__tests__/routes/driver-invitations.test.ts`
 Purpose: Integration tests for the invite endpoints. Tests create + accept flow, expired token
   rejection, invalid token rejection, already-accepted token rejection.

 Path: `server/__tests__/services/sms.service.test.ts`
 Purpose: Unit tests for the SMS service. Mocks Twilio client, asserts template selection based
   on language, asserts phone number formatting.

 Path: `apps/trucker/__tests__/auth/invite-flow.test.tsx`
 Purpose: Tests the full invite flow: deep link → fetch invite → set password → accept → session
   saved → biometric prompt → biometric enabled.

 Path: `apps/trucker/__tests__/auth/biometric.test.tsx`
 Purpose: Tests biometric enable/disable, authenticate, and the "biometric not available" fallback.

 Path: `apps/trucker/__tests__/auth/session.test.tsx`
 Purpose: Tests session save/load/refresh/clear. Tests that access tokens are NOT persisted.
   Tests that refresh tokens are encrypted via expo-secure-store.

 Files (existing) extended:

 Path: `server/index.ts`
 What changes: Mount the driver-invitations router. Import + `app.use()`. 2 added lines.

 Path: `server/lib/sql-auth.ts`
 What changes: Add `createDriverUser(phone, cdlNumber, ...)` function that creates a user row
   with role='driver' and links to Firebase Auth. ~15 added lines. NOTE: This file is sensitive
   and requires extra review — it's the auth boundary.

 Path: `apps/web/src/components/driver/DriverInvitationPanel.tsx`
 What changes: New web-only component mounted from the existing dispatcher user-management
   surface. Contains "Invite Driver" button, modal form, and invitation history. This avoids
   tying the phase to an ambiguous existing file path during dispatch.

 Path: `packages/shared/src/api-client/auth.ts`
 What changes: Add `inviteDriver`, `acceptInvitation`, `fetchInviteDetails` methods.

 Path: `.env.example`
 What changes: Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`,
   `SMS_INVITE_BRANDED_DOMAIN` (e.g., `disbatch.me`).

 Acceptance criteria (R-markers):

 - R-P3-01 [integration]: `POST /api/drivers/invite` creates a driver user record with
   role='driver' and returns an invitation token.
 - R-P3-02 [integration]: `POST /api/drivers/invite` with body
   `{ name: "Test Driver", phone: "+15551234567", cdlNumber: "X12345", preferredLanguage: "es" }`
   invokes `sms.service.sendInviteSms` exactly once with
   `phone="+15551234567"`, `brandedLink` matching regex `^https://disbatch\.me/i/[A-Za-z0-9_-]+$`,
   and `language="es"` — asserted via mocked SMS service call capture.
 - R-P3-03 [unit]: The invitation token is a JWT with a 7-day TTL and is signed with
   `INVITATION_TOKEN_SECRET`.
 - R-P3-04 [integration]: `GET /api/drivers/invite/:token` returns the invite payload with
   dispatcher name, company name, and preferred language.
 - R-P3-05 [integration]: `POST /api/drivers/invite/:token/accept` creates a Firebase Auth
   user, links to the MySQL user record, invalidates the token, and returns access + refresh
   tokens.
 - R-P3-06 [integration]: An expired invitation token is rejected with HTTP 401.
 - R-P3-07 [integration]: An already-accepted invitation token is rejected with HTTP 409.
 - R-P3-08 [unit]: `sms.service.ts` selects the Spanish template when the invite language is
   'es'.
 - R-P3-09 [unit]: `apps/trucker/src/auth/session.ts` stores the refresh token in
   expo-secure-store but does NOT persist the access token.
 - R-P3-10 [unit]: `apps/trucker/src/auth/biometric.ts` falls back gracefully when biometric
   is unavailable (returns `false` from `isBiometricAvailable`).
 - R-P3-11 [integration]: The deep link handler parses `disbatch.me/i/ABCD1234` and routes to
   `(onboarding)/invite/ABCD1234`.
 - R-P3-12 [integration]: After the invite flow completes, the Zustand auth store reflects
   `isAuthenticated=true` and the user object.
 - R-P3-13 [integration]: Closing and reopening the app loads the cached session via
   biometric unlock (if enabled) and routes directly to trip workspace.
 - R-P3-14 [unit]: `refreshAccessToken()` rotates the access token and updates the in-memory
   store.
 - R-P3-15 [manual]: End-to-end: dispatcher clicks Invite Driver on web, driver receives SMS on
   real phone, taps link, sets password, enables biometric, biometric unlock works on next
   app open.

### Operational exit gates (tracked, not worker-blocking)

 - Twilio sender registration, branded domain setup, and SMS deliverability review complete for
   production use.

 Verification command:

 ```bash
 bash -c "cd server && npx vitest run __tests__/routes/driver-invitations.test.ts __tests__/services/sms.service.test.ts && cd .. && pnpm -w run test:trucker"
 ```

 ---
## Phase 4 — Trip Workspace: Mobile Home + Stop Sequence + Status Updates

 **Phase Type**: `module`

 Goal: After this phase, an authenticated driver sees their active trip as the primary home
 screen when opening the app. The screen shows: today's active trip (load number, broker, pickup
 facility, dropoff facility, commodity, weight, rate), the current stop in the sequence, the
 next stop, a map preview of the route (static image, no live GPS yet), quick status update
 buttons (en-route, at-pickup, loaded, at-dropoff, delivered), a "navigation" button that hands
 off to Apple Maps / Google Maps / Waze, a "scan document" button (Phase 5 integration), and a
 document checklist showing which required docs are complete and which are missing. The screen
 works offline with cached trip data.

 Files (new):

 Path: `apps/trucker/app/(app)/trip.tsx` (replaces Phase 2 placeholder)
 Purpose: Trip workspace screen. Queries `GET /api/loads/current-trip` via React Query, shows
   the data, handles loading/error/offline states. Uses cached data when offline.

 Path: `apps/trucker/src/components/trip/ActiveTripCard.tsx`
 Purpose: Card component showing the active trip details (load number, broker, pickup, dropoff,
   commodity, weight, rate). Tapping opens the full trip details screen.

 Path: `apps/trucker/src/components/trip/StopSequence.tsx`
 Purpose: Visual stop sequence (pickup → dropoff → rest → fuel → pickup2 → dropoff2, etc.).
   Shows the current stop highlighted. Each stop has facility name, address, appointment time.

 Path: `apps/trucker/src/components/trip/StatusUpdateButtons.tsx`
 Purpose: Row of quick-update buttons. Tapping a button calls `PATCH /api/loads/:id/status` with
   the appropriate status transition. Optimistic update to local cache, rolls back on error.

 Path: `apps/trucker/src/components/trip/NavigationButton.tsx`
 Purpose: Button that opens the device's default navigation app with the next stop coordinates.
   Uses `expo-linking` to construct `maps:`, `google.navigation:`, or `waze://` URLs based on
   availability.

 Path: `apps/trucker/src/components/trip/DocumentChecklist.tsx`
 Purpose: List of required documents for the trip (rate confirmation, BOL, POD, lumper receipt
   if applicable, fuel receipts if IFTA-relevant). Each item shows "complete" / "missing". Tap
   missing to trigger the document capture flow.

 Path: `apps/trucker/src/components/trip/RoutePreview.tsx`
 Purpose: Static map image showing the route. Uses Google Static Maps API or Mapbox Static to
   render a preview without requiring a live map. Future enhancement: live map with GPS tracking.

 Path: `apps/trucker/src/hooks/useCurrentTrip.ts`
 Purpose: React Query hook. `useCurrentTrip()` fetches the current trip, caches in React Query,
   persists to SQLite for offline access. Refetches every 30 seconds when online.

 Path: `apps/trucker/src/hooks/useStatusUpdate.ts`
 Purpose: React Query mutation hook. `useStatusUpdate()` sends PATCH to update load status.
   Optimistic update via React Query's onMutate. Rolls back on error.

 Path: `apps/trucker/src/lib/offline-cache.ts`
 Purpose: Offline cache helpers. `cacheTrip(trip)`, `loadCachedTrip(loadId)`, `listCachedTrips()`.
   Uses expo-sqlite under the hood. Cache TTL: 24 hours.

 Path: `server/routes/driver-trip.ts`
 Purpose: New routes for the driver mobile app to fetch their current trip:
   - `GET /api/drivers/current-trip` — returns the driver's currently-assigned active trip (load
     with status in [Planned, EnRoute, AtPickup, Loaded, AtDropoff]) or null.
   - `GET /api/drivers/trip-history` — paginated list of the driver's completed trips.

 Path: `server/__tests__/routes/driver-trip.test.ts`
 Purpose: Tests the driver trip endpoints. Asserts tenant + driver scoping (driver only sees
   their own trips), asserts status filtering (only active trip returned from current-trip).

 Path: `apps/trucker/__tests__/trip/trip-workspace.test.tsx`
 Purpose: Tests the trip workspace screen. Mocks the API, asserts the active trip card renders
   with correct data. Tests offline mode (no network → cached data shows).

 Path: `apps/trucker/__tests__/trip/status-update.test.tsx`
 Purpose: Tests the status update flow. Taps "en-route", asserts PATCH call, asserts optimistic
   update, tests error rollback.

 Path: `apps/trucker/__tests__/trip/navigation-handoff.test.tsx`
 Purpose: Tests the navigation button. Asserts it constructs the correct URL for iOS (maps:)
   and Android (google.navigation:).

 Files (existing) extended:

 Path: `server/index.ts`
 What changes: Mount the driver-trip router. 2 added lines.

 Path: `packages/shared/src/api-client/loads.ts`
 What changes: Add `getCurrentTrip()`, `getTripHistory(page)`, `updateLoadStatus(loadId, status)`
   methods. ~25 added lines.

 Acceptance criteria (R-markers):

 - R-P4-01 [integration]: `GET /api/drivers/current-trip` returns the active trip for the
   authenticated driver, or null if no active trip exists.
 - R-P4-02 [integration]: `GET /api/drivers/current-trip` does NOT return trips belonging to
   other drivers (tenant + driver scoping).
 - R-P4-03 [integration]: `GET /api/drivers/trip-history` returns paginated completed trips for
   the authenticated driver.
 - R-P4-04 [unit]: `useCurrentTrip()` React Query hook caches the response and refetches every
   30 seconds when online.
 - R-P4-05 [unit]: `useCurrentTrip()` returns cached data when the network is unavailable.
 - R-P4-06 [unit]: `StopSequence.tsx` highlights the current stop based on the load's progress.
 - R-P4-07 [integration]: Tapping "en-route" calls `PATCH /api/loads/:id` with
   `{ status: 'EnRoute' }` and optimistically updates the UI.
 - R-P4-08 [integration]: A failed status update call rolls back the optimistic UI update.
 - R-P4-09 [unit]: The navigation button constructs `maps:?daddr=<lat>,<lng>` on iOS and
   `google.navigation:q=<lat>,<lng>` on Android.
 - R-P4-10 [unit]: `DocumentChecklist.tsx` shows "complete" for documents that exist in the
   load's documents collection and "missing" for required docs that don't.
 - R-P4-11 [unit]: `offline-cache.ts` writes trip data to expo-sqlite and reads it back
   correctly.
 - R-P4-12 [integration]: Opening the trip workspace while offline shows cached data with an
   "offline" indicator.
 - R-P4-13 [integration]: `ActiveTripCard` renders the broker name, pickup facility, dropoff
   facility, commodity, weight, and rate from the trip data.
 - R-P4-14 [manual]: End-to-end on a real device: driver sees their active trip, taps
   en-route, taps navigation, Apple/Google Maps opens with the next stop.

 Verification command:

 ```bash
 bash -c "cd server && npx vitest run __tests__/routes/driver-trip.test.ts && cd .. && pnpm -w run test:trucker apps/trucker/__tests__/trip/"
 ```

 ---
## Phase 5 — Smart Document Intake: Camera + Offline Queue + Background Sync

 **Phase Type**: `module`

 Goal: After this phase, a driver can capture a document (BOL, POD, rate confirmation, fuel
 receipt, lumper receipt, scale ticket) via the camera or file picker in the mobile app. The
 capture works offline — the document is written to the local SQLite cache and queued for
 upload. When connectivity is restored, a background sync job uploads the document, calls the
 AI extraction endpoint for applicable document types (BOL, rate confirmation), and updates the
 load with extracted fields (broker, commodity, weight, rate, etc.). The driver sees a queue
 indicator showing pending uploads and can retry failed uploads manually. Duplicate detection
 prevents the same document from being uploaded twice. Document classification (BOL vs receipt
 vs lumper) is automatic for the AI-extracted types; drivers manually classify other types.

 This is the **hardest phase** in this plan — offline-first document capture with AI extraction
 and background sync is a multi-month research topic, not a one-week sprint. We ship an
 **online-first with graceful offline degradation** version in Phase 5 and iterate on the
 distributed-state hardness in Phase 11. "Graceful offline degradation" means: the app works
 offline (captures queue, shows cached data), but conflict resolution in edge cases (e.g., the
 same load was edited by both a dispatcher on the web app and a driver on mobile while offline)
 deferred to Phase 11.

 Files (new):

 Path: `apps/trucker/app/(app)/docs.tsx` (replaces Phase 2 placeholder)
 Purpose: Documents tab screen. Lists uploaded + pending documents for the current trip. Shows
   a "capture new" button that opens the camera or file picker. Shows pending upload queue
   at the top with retry + delete actions.

 Path: `apps/trucker/app/(app)/capture.tsx`
 Purpose: Document capture screen. Full-screen camera preview via `expo-camera`. Capture button
   takes a photo. Preview screen shows the photo with crop/rotate controls. "Accept" queues the
   document for upload. "Classify" picker lets the driver select the document type (BOL, POD,
   rate confirmation, fuel receipt, lumper, scale ticket, other).

 Path: `apps/trucker/src/components/docs/DocumentCard.tsx`
 Purpose: Card component showing a document (thumbnail, filename, type, upload status). Tapping
   opens the document viewer.

 Path: `apps/trucker/src/components/docs/UploadQueueIndicator.tsx`
 Purpose: Header indicator showing number of pending uploads, sync status, retry button.

 Path: `apps/trucker/src/components/docs/ExtractionConfirmation.tsx`
 Purpose: Post-AI-extraction confirmation UI. Shows the extracted fields (broker, commodity,
   weight, rate) with edit controls. Driver confirms or edits, then the load is patched.

 Path: `apps/trucker/src/lib/document-queue.ts`
 Purpose: Offline upload queue implementation. Functions:
   - `enqueueDocument(loadId, imageUri, type, metadata)` — adds to SQLite queue
   - `processQueue()` — iterates pending items, uploads, marks complete/failed
   - `retryFailed()` — re-queues failed items
   - `getQueueStatus()` — returns pending/complete/failed counts
   - `deleteQueued(id)` — removes a queued item (driver cancelled)

 Path: `apps/trucker/src/lib/background-sync.ts`
 Purpose: Background task registration via `expo-task-manager` + `expo-background-fetch`.
   Registers a task that runs every 15 minutes when online to process the queue.

 Path: `apps/trucker/src/lib/document-hash.ts`
 Purpose: Perceptual hash for duplicate detection. Computes a hash of the image that's robust
   to minor compression artifacts. Used to detect when the driver accidentally captures the
   same document twice. Uses `expo-crypto` for the hash.

 Path: `apps/trucker/src/hooks/useDocumentCapture.ts`
 Purpose: Hook that wraps the capture flow. Handles camera permissions, photo capture,
   classification, duplicate detection, queue insertion, and UI feedback.

 Path: `apps/trucker/src/hooks/useDocumentUpload.ts`
 Purpose: Hook that wraps the upload mutation. Handles retry logic, progress reporting, and
   post-upload AI extraction calls.

 Path: `apps/trucker/__tests__/docs/capture.test.tsx`
 Purpose: Tests the capture flow. Mocks expo-camera, asserts photo is saved to local storage,
   queued, and duplicate detection works.

 Path: `apps/trucker/__tests__/docs/queue.test.tsx`
 Purpose: Tests the document queue. Tests enqueue, process, retry, delete. Mocks the API.

 Path: `apps/trucker/__tests__/docs/background-sync.test.tsx`
 Purpose: Tests the background sync task. Mocks expo-task-manager, asserts queue is processed.

 Path: `apps/trucker/__tests__/docs/extraction-confirmation.test.tsx`
 Purpose: Tests the post-extraction confirmation UI. Asserts extracted fields are shown, edit
   works, confirm triggers PATCH on the load.

 Files (existing) extended:

 Path: `packages/shared/src/api-client/documents.ts`
 What changes: Add `uploadDocument(file, documentType, loadId, metadata)` method that uploads to
   the canonical `POST /api/documents` endpoint. The method must support the same canonical
   metadata contract the web app already uses.

 Path: `packages/shared/src/api-client/ai.ts`
 What changes: Add `extractLoadFromImage(imageBuffer, mimeType)` wrapping the existing AI extract
   endpoint. ~10 added lines.

 Path: `server/routes/documents.ts`
 What changes: Extend the canonical document route only if mobile needs additive metadata fields
   or mobile-specific content-type handling. The plan explicitly does NOT create or depend on a
   second document-upload contract under `server/routes/loads.ts`.

 Acceptance criteria (R-markers):

 - R-P5-01 [unit]: `document-queue.ts` enqueues a document to SQLite and returns a queue ID.
- R-P5-02 [unit]: `document-queue.ts` processes pending items when called, uploading via the
   canonical documents API client.
 - R-P5-03 [unit]: A failed upload is marked as "failed" in the queue and does not block
   subsequent items.
 - R-P5-04 [unit]: `retryFailed()` re-queues all failed items.
 - R-P5-05 [unit]: `document-hash.ts` produces a deterministic hash for the same image across
   multiple calls.
 - R-P5-06 [unit]: Enqueueing a document with a duplicate hash returns an error "duplicate
   document detected".
 - R-P5-07 [integration]: The background sync task registers with expo-task-manager and runs
   every 15 minutes.
 - R-P5-08 [integration]: Capturing a photo queues it to SQLite and shows it in the pending
   upload list.
 - R-P5-09 [integration]: Going online triggers a manual sync that uploads the queued document.
- R-P5-10 [integration]: After a successful upload of a BOL through `/api/documents`, the AI
   extraction runs and the confirmation UI shows the extracted fields.
 - R-P5-11 [integration]: Confirming the extracted fields calls PATCH on the load with the new
   data.
 - R-P5-12 [integration]: Editing an extracted field before confirming sends the edited value
   in the PATCH call.
 - R-P5-13 [unit]: On first mount, `apps/trucker/app/(app)/capture.tsx` calls
   `Camera.requestCameraPermissionsAsync()` exactly once. When the returned status is
   `"denied"`, the screen renders the fallback view with i18n key
   `capture.camera_permission_denied` and a "Retry" button whose `onPress` re-invokes
   `requestCameraPermissionsAsync()` — asserted via mocked expo-camera + render snapshot.
 - R-P5-14 [integration]: Network disconnect during upload → upload retries up to 3 times with
   exponential backoff → marks as failed after exhaustion.
- R-P5-15 [manual]: End-to-end on a real device: driver captures a BOL offline, goes back
   online, sees it upload and extract automatically, confirms fields, load is updated.
 - R-P5-16 [unit]: `packages/shared/src/api-client/documents.ts` source contains the literal
   string `/api/documents` AND does NOT contain any reference to `/api/loads/` or
   `/api/loads/:id/documents` — grep assert. This enforces the canonical document domain rule
   stated in the phase header: the mobile app must not open a second document-upload contract.

### Operational exit gates (tracked, not worker-blocking)

 - Queue retention and purge policy approved for device storage.
 - Background-task limitations on iOS/Android are documented in the beta runbook.

 Verification command:

 ```bash
 bash -c "pnpm -w run test:trucker apps/trucker/__tests__/docs/ && cd server && npx vitest run __tests__/routes/documents.test.ts"
 ```

 ---
## Phase 6 — ELD Integration: Provider Abstraction + Motive Adapter

 **Phase Type**: `integration`

 Goal: After this phase, the backend exposes a generic ELD provider interface and a Motive
 implementation that syncs HOS logs, duty status, vehicle GPS positions, and driver identity
 from Motive's developer API. A fleet admin on the web app can connect their Motive account via
 OAuth (per-tenant-admin authorization). Once connected, HOS data flows into a new
 `hos_events` table nightly. The mobile app displays the driver's current HOS status (on-duty,
 off-duty, sleeper, driving, personal conveyance) with remaining hours and violation warnings.
 The provider abstraction layer is designed so adding Samsara (Phase 2 ELD, post-MVP) is a new
 adapter module, not a rewrite.

 This phase runs IN PARALLEL with Phase 5 if worktree isolation is verified working. The
 backend work (provider interface, Motive adapter, OAuth flow, nightly sync) is orthogonal to
 the mobile document intake work.

 Files (new):

 Path: `server/migrations/053_eld_events.sql`
 Purpose: Additive migration creating tables for ELD data:
   - `eld_providers` (id, company_id, provider_name, oauth_token, refresh_token, expires_at, connected_at)
   - `hos_events` (id, company_id, driver_id, event_time, status, location, raw_payload)
   - `gps_positions` (id, company_id, driver_id, truck_id, ts, lat, lng, speed, odometer, source)
   DOWN drops the three tables cleanly.

 Path: `server/services/eld/provider.interface.ts`
 Purpose: TypeScript interface for ELD providers. Methods:
   - `authenticate(tenantId, oauthCallback)` — initiates OAuth flow
   - `refreshAuth(providerId)` — refreshes an expired token
   - `syncHosLogs(providerId, since, until)` — fetches HOS logs for a date range
   - `syncDrivers(providerId)` — fetches driver list + metadata
   - `syncVehicles(providerId)` — fetches vehicle list + current position
   - `subscribeWebhooks(providerId, callbackUrl)` — optional webhook subscription
   The interface is strict — all providers MUST implement these methods.

 Path: `server/services/eld/motive.adapter.ts`
 Purpose: Motive-specific implementation of the ELD provider interface. Uses Motive's developer
   API (`developer.gomotive.com`). Handles OAuth 2.0 flow, token refresh, REST calls to
   `/api/drivers`, `/api/vehicles`, `/api/hos-logs` endpoints. Rate limits per Motive's published
   limits. Webhook subscription for real-time HOS updates.

 Path: `server/routes/eld-integration.ts`
 Purpose: New Express routes:
   - `GET /api/eld/providers` — list connected providers for the current tenant
   - `POST /api/eld/connect/:providerName` — initiate OAuth flow, returns the redirect URL
   - `GET /api/eld/callback/:providerName` — OAuth callback, stores the tokens
   - `POST /api/eld/disconnect/:providerId` — disconnect a provider
   - `GET /api/eld/hos-status/:driverId` — returns current HOS status for a driver
   - `GET /api/eld/hos-history/:driverId` — paginated HOS event history

 Path: `server/jobs/eld-sync-nightly.ts`
 Purpose: Nightly cron job that iterates all connected ELD providers and syncs the last 24
   hours of HOS events and GPS positions. Idempotent — uses `raw_payload_hash` for dedup.

 Path: `apps/trucker/app/(app)/hos.tsx`
 Purpose: HOS status screen on the mobile app. Shows current status (on-duty/off-duty/driving),
   remaining driving hours, remaining on-duty hours, 8-day and 14-day window, violation
   warnings (if any). Updates in real-time via polling every 60 seconds. Works offline with
   cached last-known status.

 Path: `apps/trucker/src/components/hos/StatusCard.tsx`
 Purpose: Large status card showing the current duty status with color coding (green = ok,
   yellow = warning, red = violation).

 Path: `apps/trucker/src/components/hos/RemainingHours.tsx`
 Purpose: Visual display of remaining driving hours, on-duty hours, 8-day window, 14-day
   window. Progress bars.

 Path: `apps/web/src/components/EldIntegration.tsx`
 Purpose: Web UI for fleet admins to connect/disconnect ELD providers. Lists connected
   providers, shows Connect button for Motive (and future providers).

 Path: `server/__tests__/services/eld/motive.adapter.test.ts`
 Purpose: Unit tests for the Motive adapter. Mocks HTTP calls, asserts correct OAuth flow,
   correct REST endpoint calls, correct response parsing.

 Path: `server/__tests__/routes/eld-integration.test.ts`
 Purpose: Integration tests for the ELD routes. Tests OAuth flow, disconnect, HOS status
   retrieval.

 Path: `server/__tests__/jobs/eld-sync-nightly.test.ts`
 Purpose: Tests the nightly sync job. Mocks the adapter, asserts idempotency, asserts correct
   period filtering.

 Files (existing) extended:

 Path: `server/index.ts`
 What changes: Mount the ELD integration router and register the nightly sync job. ~4 added
   lines.

 Path: `.env.example`
 What changes: Add `MOTIVE_CLIENT_ID`, `MOTIVE_CLIENT_SECRET`, `MOTIVE_REDIRECT_URI`,
   `MOTIVE_WEBHOOK_SECRET`.

 Path: `packages/shared/src/api-client/eld.ts` (new sub-file)
 What changes: New ELD client with `getHosStatus(driverId)`, `listProviders()`, `connect()`,
   `disconnect()` methods.

 Acceptance criteria (R-markers):

 - R-P6-01 [unit]: Migration 053 UP creates `eld_providers`, `hos_events`, `gps_positions`
   tables — grep assert.
 - R-P6-02 [unit]: Migration 053 DOWN drops those three tables only — grep assert.
 - R-P6-03 [unit]: `provider.interface.ts` defines all 6 required methods — asserted via
   TypeScript strict compilation.
 - R-P6-04 [unit]: `motive.adapter.ts` implements all 6 interface methods.
 - R-P6-05 [integration]: `POST /api/eld/connect/motive` returns an OAuth redirect URL pointing
   at `developer.gomotive.com`.
 - R-P6-06 [integration]: `GET /api/eld/callback/motive` with a valid authorization code stores
   tokens in the `eld_providers` table.
 - R-P6-07 [integration]: `syncHosLogs()` called against a mocked Motive API inserts HOS events
   into the `hos_events` table.
 - R-P6-08 [integration]: `syncHosLogs()` is idempotent — re-running it does not create duplicate
   events (deduped by `raw_payload_hash`).
 - R-P6-09 [integration]: The nightly sync job processes all connected providers for all
   tenants.
 - R-P6-10 [integration]: `GET /api/eld/hos-status/:driverId` returns the driver's current duty
   status based on the latest hos_events row.
 - R-P6-11 [integration]: Expired OAuth tokens are automatically refreshed via
   `refreshAuth()`.
 - R-P6-12 [unit]: The mobile HOS screen displays the current status, remaining driving hours,
   remaining on-duty hours.
 - R-P6-13 [integration]: The HOS screen polls every 60 seconds when online.
 - R-P6-14 [integration]: The HOS screen shows cached last-known status when offline.
 - R-P6-15 [manual]: End-to-end: fleet admin connects Motive sandbox account, seeded HOS data
   flows in, driver sees their HOS status on mobile.

 Verification command:

 ```bash
 bash -c "cd server && npx vitest run __tests__/services/eld/ __tests__/routes/eld-integration.test.ts __tests__/jobs/eld-sync-nightly.test.ts && cd .. && pnpm -w run test:trucker apps/trucker/__tests__/hos/"
 ```

 ---
## Phase 7 — Compliance Hub Mobile: IFTA + IRP + 2290 + UCR + Permits + Clearinghouse

 **Phase Type**: `module`

 Goal: After this phase, the mobile app has a Compliance Hub tab showing all the driver's and
 vehicle's compliance obligations in one place:
 - **IFTA**: current quarter status, fleet MPG, tax owed, missing fuel receipts warning
 - **IRP**: mileage by jurisdiction for the current year, apportionment status
 - **2290 / HVUT**: filing status, next due date, tax paid
 - **UCR**: annual status, renewal due date
 - **Permits**: state trip/fuel permits, expiration dates, state-by-state overview
 - **Clearinghouse**: annual query status (for owner-operators)
 - **CDL expiry**: countdown with warning levels (green > 60d, yellow 30-60d, red < 30d)
 - **Medical card**: countdown with warning levels
 - **Insurance**: expiry countdown
 - **Annual inspection**: countdown

 Every screen in this hub shows an explicit legal disclaimer: "This information is sourced from
 your fleet's records and may not reflect the authoritative state/FMCSA record. Always verify
 with the issuing authority before relying on this status for legal compliance." Every status
 has a "last verified" timestamp.

 Files (new):

 Path: `apps/trucker/app/(app)/compliance.tsx` (replaces Phase 2 placeholder)
 Purpose: Compliance hub home screen. Grid of cards: IFTA, IRP, 2290, UCR, Permits, Clearinghouse,
   CDL, Medical, Insurance, Annual Inspection. Each card shows current status + "tap for
   details".

 Path: `apps/trucker/app/(app)/compliance/ifta.tsx`
 Purpose: IFTA detail screen. Shows current quarter status, jurisdiction breakdown, missing
   receipts warning, "Generate Audit Packet" button (Phase 8 wires this in).

 Path: `apps/trucker/app/(app)/compliance/irp.tsx`
 Purpose: IRP detail screen. Mileage by jurisdiction for the current year, apportionment status.

 Path: `apps/trucker/app/(app)/compliance/2290.tsx`
 Purpose: 2290 HVUT detail screen. Filing status, next due date, tax paid. "Set Reminder"
   button.

 Path: `apps/trucker/app/(app)/compliance/permits.tsx`
 Purpose: Permit manager screen. List of active permits by state with expiration dates. Add
   permit form.

 Path: `apps/trucker/app/(app)/compliance/clearinghouse.tsx`
 Purpose: Clearinghouse query status. Annual query requirement for owner-operators. Last query
   date, next required date, reminder toggle.

 Path: `apps/trucker/app/(app)/compliance/cdl.tsx`
 Purpose: CDL expiry screen. Current CDL info, expiry date, countdown, upload new CDL photo
   (queues for sync). Warning level color-coding.

 Path: `apps/trucker/app/(app)/compliance/medical.tsx`
 Purpose: Medical card expiry screen. Same shape as CDL screen.

 Path: `apps/trucker/src/components/compliance/ComplianceCard.tsx`
 Purpose: Reusable compliance status card component. Props: title, status, detail, warning
   level (green/yellow/red), last verified timestamp, disclaimer text.

 Path: `apps/trucker/src/components/compliance/DisclaimerBanner.tsx`
 Purpose: Mandatory disclaimer banner component. Shown on every compliance screen. Text is
   i18n'd.

 Path: `apps/trucker/src/components/compliance/LastVerifiedBadge.tsx`
 Purpose: Small badge showing "Last verified: 2h ago" or similar. Tap to see data source.

 Path: `apps/trucker/src/lib/compliance-warnings.ts`
 Purpose: Logic for computing warning levels: green (> 60 days), yellow (30-60 days), red
   (< 30 days). Functions: `cdlWarningLevel(expiry)`, `medicalWarningLevel(expiry)`,
   `insuranceWarningLevel(expiry)`, etc.

 Path: `apps/trucker/src/hooks/useCompliance.ts`
 Purpose: React Query hook that fetches all compliance data for the current driver.
   Multiplexes calls to `/api/drivers/:driverId/compliance`. Caches offline.

Path: `server/routes/driver-compliance.ts`
 Purpose: New route `GET /api/drivers/:driverId/compliance` that returns aggregated compliance
   data: IFTA status, IRP mileage, 2290 status, UCR status, permits, Clearinghouse status, CDL,
   medical, insurance, inspection expiry. Every category in the payload must include:
   `status`, `sourceType`, `sourceOfTruth`, `verifiedAt`, and `confidence`. Any category lacking
   authoritative or user-entered backing data returns `status: "unknown"` rather than a derived
   green state. Pulls from existing safety + accounting + compliance tables plus explicit manual
   entry tables added in this phase if a source does not already exist.

 Path: `apps/trucker/src/i18n/locales/en.json` + `es.json` (extended)
 What changes: Add compliance-specific strings. All disclaimers, warning messages, and status
   labels in both languages. **Legal/compliance strings use professional translation.**

 Path: `server/__tests__/routes/driver-compliance.test.ts`
 Purpose: Tests the compliance aggregation endpoint. Seeds a driver with various statuses and
   asserts the aggregated response.

 Path: `apps/trucker/__tests__/compliance/hub.test.tsx`
 Purpose: Tests the compliance hub screen. Asserts all 10 cards render. Tests warning level
   color logic. Asserts disclaimer banner appears on every detail screen.

 Path: `apps/trucker/__tests__/compliance/disclaimers.test.tsx`
 Purpose: Tests that every compliance screen renders the DisclaimerBanner component. This is a
   critical legal requirement.

 Path: `docs/compliance-ux-legal-framework.md`
 Purpose: Internal legal framework doc. Lists every disclaimer text, the data source attribution
   for each compliance category, the "last verified" refresh logic, and the retention policy.
   **This doc must be reviewed by legal counsel before Phase 7 ships.**

 Files (existing) extended:

 Path: `server/index.ts`
 What changes: Mount the driver-compliance router. 2 added lines.

 Path: `packages/shared/src/api-client/compliance.ts` (new)
 What changes: New compliance client with `getCompliance(driverId)` method.

 Acceptance criteria (R-markers):

 - R-P7-01 [integration]: `GET /api/drivers/:driverId/compliance` returns aggregated data for
   IFTA, IRP, 2290, UCR, permits, Clearinghouse, CDL, medical, insurance, inspection, and each
   category includes `sourceType`, `sourceOfTruth`, `verifiedAt`, and `confidence`.
 - R-P7-02 [unit]: `cdlWarningLevel()` returns 'green' for > 60 days, 'yellow' for 30-60 days,
   'red' for < 30 days.
 - R-P7-03 [unit]: `medicalWarningLevel()` follows the same logic as CDL.
 - R-P7-04 [unit]: The compliance hub screen renders exactly 10 cards.
 - R-P7-05 [unit]: Every compliance detail screen contains a `DisclaimerBanner` component
   — asserted via rendered DOM tree.
 - R-P7-06 [unit]: Every compliance status card shows a "last verified" timestamp.
 - R-P7-07 [integration]: The IFTA detail screen shows the current quarter's status and jurisdiction
   breakdown.
 - R-P7-08 [integration]: The 2290 detail screen shows the filing status and next due date.
 - R-P7-09 [integration]: The permits screen lists active permits and allows adding new ones.
 - R-P7-10 [unit]: The Spanish translation bundle contains translations for all disclaimer
   strings — verified against a key-by-key comparison.
 - R-P7-11 [unit]: `docs/compliance-ux-legal-framework.md` exists and contains sections on
   disclaimer text, data source attribution, and retention policy.
 - R-P7-12 [integration]: Compliance data is cached offline — the hub works with no network.
 - R-P7-13 [integration]: Warning-level color coding renders correctly for all 10 categories.
 - R-P7-14 [manual]: End-to-end: driver opens compliance hub, sees all 10 cards with current
   status, taps IFTA, sees quarter breakdown + disclaimer.
- R-P7-15 [manual]: Legal review of `docs/compliance-ux-legal-framework.md` is complete (user
   action, not automated).

### Operational exit gates (tracked, not worker-blocking)

 - Legal review of disclaimer text complete before public beta.
 - Product signoff that categories without reliable source data remain `"unknown"` rather than
   showing inferred completion states.

 Verification command:

 ```bash
 bash -c "cd server && npx vitest run __tests__/routes/driver-compliance.test.ts && cd .. && pnpm -w run test:trucker apps/trucker/__tests__/compliance/"
 ```

 ---
## Phase 8 — Mobile Audit Packet Export + Invoice Aging Continues

 **Phase Type**: `module`

 Goal: After this phase, drivers and fleet admins can generate IFTA audit packets from the
 mobile app. The mobile "Generate Audit Packet" button wraps the Phase 1 API. The generated
 packet is downloadable from the mobile app or emailable to an accountant. Additionally, the
 invoice aging data collection job (started in Phase 1) continues accumulating data so Phase 10
 has months of history to display.

 Files (new):

 Path: `apps/trucker/app/(app)/compliance/audit-packet.tsx`
 Purpose: Audit packet generation screen. Quarter/year picker, "Include documents" checkbox,
   "Generate" button. On submit, calls the Phase 1 API via the shared client, shows progress,
   renders a download button when ready.

 Path: `apps/trucker/src/components/compliance/AuditPacketCard.tsx`
 Purpose: Card shown in the IFTA detail screen. "Generate Audit Packet" button opens the
   audit-packet screen.

 Path: `apps/trucker/src/components/compliance/PacketHistory.tsx`
 Purpose: List of previously generated packets. Each shows quarter, year, status, download link.

 Path: `apps/trucker/src/hooks/useAuditPacket.ts`
 Purpose: React Query hook for generating and listing audit packets.

 Path: `apps/trucker/__tests__/compliance/audit-packet.test.tsx`
 Purpose: Tests the audit packet generation flow. Mocks the API, asserts the download link
   appears after success.

 Files (existing) extended:

 Path: `apps/trucker/app/(app)/compliance/ifta.tsx`
 What changes: Add an `AuditPacketCard` below the jurisdiction breakdown. Tapping opens the
   audit packet screen. ~10 added lines.

 Path: `packages/shared/src/api-client/ifta.ts`
 What changes: The audit packet methods added in Phase 1 are already in the shared client. No
   change needed unless mobile-specific download URL handling is required.

 Acceptance criteria (R-markers):

 - R-P8-01 [unit]: `audit-packet.tsx` renders a quarter picker, year picker, "include documents"
   checkbox, and "generate" button.
 - R-P8-02 [integration]: Submitting the form calls `POST /api/accounting/ifta-audit-packets`
   via the shared API client.
 - R-P8-03 [integration]: A successful generation shows a download button with the signed URL.
 - R-P8-04 [integration]: The packet history list shows previously generated packets with their
   status.
 - R-P8-05 [integration]: Tapping the download button opens the ZIP in the device's default
   file handler.
 - R-P8-06 [unit]: The IFTA detail screen contains an `AuditPacketCard` component.
 - R-P8-07 [unit]: The "Email to Accountant" button uses `expo-mail-composer` to open the email
   client with the packet attached.
 - R-P8-08 [manual]: End-to-end on a real device: driver generates a Q4 audit packet, downloads
   it, opens the ZIP in the Files app.

 Verification command:

 ```bash
 pnpm -w run test:trucker apps/trucker/__tests__/compliance/audit-packet.test.tsx
 ```

 ---
## Phase 9 — Freemium Tier Enforcement + Stripe Subscription

 **Phase Type**: `module`

 Goal: After this phase, the product enforces the freemium tier structure:
 - **Free tier** (1 truck, 50 AI extractions/month)
 - **Fleet Starter** ($19/truck/month, 2-5 trucks, unlimited AI extractions)
 - **Fleet Core** ($39/truck/month, 6-50 trucks, unlimited AI extractions, multi-user permissions)
 - **Enterprise** (custom pricing, 50+ trucks, dedicated support)

 The backend has a per-tenant AI extraction counter that resets monthly. When a free-tier tenant
 exceeds 50 extractions in a month, the `/api/ai/extract-load` endpoint returns HTTP 402
 (Payment Required) with a `{ code: "UPGRADE_REQUIRED", limit: 50, used: 50 }` body. The mobile
 and web apps show an upgrade prompt with Stripe checkout. Successful subscription transitions
 the tenant's `subscription_tier` and resets/removes the extraction limit.

 Files (new):

 Path: `server/migrations/054_ai_usage_tracking.sql`
 Purpose: Additive migration.
   UP: creates `ai_usage` table with columns `id`, `company_id`, `user_id`, `endpoint`,
   `tokens_used`, `created_at`. Index on `(company_id, created_at)`.
   DOWN: drops the table.

 Path: `server/middleware/ai-quota.ts`
 Purpose: Middleware that runs before AI extraction endpoints. Checks the tenant's monthly
   usage count. If free tier AND usage >= limit, returns HTTP 402 with the upgrade payload.
   Otherwise increments the counter and lets the request through.

 Path: `server/routes/subscription.ts`
 Purpose: New Express routes:
   - `POST /api/subscription/checkout` — creates a Stripe checkout session, returns the URL
   - `POST /api/subscription/webhook` — Stripe webhook handler for subscription events
   - `GET /api/subscription/status` — returns current tier + usage
   - `POST /api/subscription/portal` — returns a Stripe customer portal URL

 Path: `server/services/subscription.service.ts`
 Purpose: Business logic for subscription management. Functions: `createCheckoutSession`,
   `handleWebhook`, `getSubscriptionStatus`, `transitionTier`.

 Path: `apps/trucker/app/(app)/upgrade.tsx`
 Purpose: Upgrade modal screen. Shown when a 402 is received. Displays tier comparison, "Upgrade
   Now" button that opens Stripe checkout in a WebView.

 Path: `apps/trucker/src/components/subscription/TierComparison.tsx`
 Purpose: Tier comparison UI component.

 Path: `apps/trucker/src/components/subscription/UpgradePrompt.tsx`
 Purpose: Upgrade prompt shown when the user hits a quota limit.

 Path: `apps/web/src/components/subscription/SubscriptionManager.tsx`
 Purpose: Web UI for managing subscriptions. Shows current tier, usage, upgrade options.

 Path: `server/__tests__/middleware/ai-quota.test.ts`
 Purpose: Tests the quota middleware. Tests free tier within limit (allows), free tier over
   limit (blocks with 402), paid tier (allows unlimited).

 Path: `server/__tests__/routes/subscription.test.ts`
 Purpose: Tests the subscription routes. Mocks Stripe SDK.

 Path: `server/__tests__/services/subscription.service.test.ts`
 Purpose: Unit tests for subscription logic.

 Path: `apps/trucker/__tests__/upgrade/flow.test.tsx`
 Purpose: Tests the upgrade flow. Mocks a 402 response, asserts the upgrade modal appears,
   tests "Upgrade Now" routing.

 Files (existing) extended:

 Path: `server/routes/ai.ts`
 What changes: Apply the `aiQuota` middleware to `/extract-load` and related endpoints. ~3
   added lines.

 Path: `server/index.ts`
 What changes: Mount the subscription router. 2 added lines.

 Path: `.env.example`
 What changes: Add `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `STRIPE_PRICE_ID_FLEET_STARTER`, `STRIPE_PRICE_ID_FLEET_CORE`.

 Path: `packages/shared/src/api-client/subscription.ts` (new)
 What changes: New subscription client.

 Acceptance criteria (R-markers):

 - R-P9-01 [unit]: Migration 054 creates the `ai_usage` table with the documented columns.
 - R-P9-02 [unit]: The `aiQuota` middleware allows requests within the limit.
 - R-P9-03 [unit]: The `aiQuota` middleware blocks requests over the limit with HTTP 402 and
   body `{ code: "UPGRADE_REQUIRED", limit: 50, used: 50 }`.
 - R-P9-04 [unit]: The `aiQuota` middleware does NOT apply to paid tiers.
 - R-P9-05 [integration]: `POST /api/subscription/checkout` creates a Stripe checkout session
   (mocked) and returns the URL.
 - R-P9-06 [integration]: Stripe webhook for `checkout.session.completed` transitions the
   tenant's tier.
 - R-P9-07 [integration]: `GET /api/subscription/status` returns the current tier + usage
   counts.
 - R-P9-08 [integration]: A 402 response from the mobile app triggers the upgrade modal.
 - R-P9-09 [integration]: Tapping "Upgrade Now" opens Stripe checkout in a WebView.
- R-P9-10 [manual]: End-to-end: free tenant hits limit, upgrade modal appears, completes
  Stripe checkout (test mode), webhook fires, tier transitions, subsequent requests succeed.

### Operational exit gates (tracked, not worker-blocking)

 - Final pricing copy and Stripe product naming approved before production rollout.

Verification command:

 ```bash
 bash -c "cd server && npx vitest run __tests__/middleware/ai-quota.test.ts __tests__/routes/subscription.test.ts __tests__/services/subscription.service.test.ts && cd .. && pnpm -w run test:trucker apps/trucker/__tests__/upgrade/"
 ```

 ---
## Phase 10 — Broker Credit Watchlist + Facility Dwell-Time Index Export

 **Phase Type**: `module`

 Goal: After this phase, the web app has a "Broker Credit Watchlist" feature that shows broker
 payment reliability scores based on invoice aging data collected since Phase 1 (months of
 history by this point). The score is computed per broker per tenant aggregated across all
 invoices to that broker. Additionally, the backend exposes a facility dwell-time export
 endpoint that aggregates dispatch-to-pickup-completion times from all tenants' trip data. This
 phase does NOT publish a general public dwell lookup. Dwell exports are internal/admin-only
 until privacy, thresholding, and consent rules are explicitly approved.

 **IMPORTANT**: This phase ships the DISPLAY of broker credit scores. Data collection has been
 happening silently since Phase 1. If insufficient data has accumulated by this point, the
 display phase is deferred and the backend continues collecting.

 Files (new):

 Path: `server/migrations/055_broker_credit_scores.sql`
 Purpose: Additive migration.
   UP: creates `broker_credit_scores` table (id, broker_id, company_id, score, data_points,
   avg_days_to_pay, worst_aging_days, computed_at). Also creates `facility_dwell_aggregates`
   table (id, facility_name, facility_state, avg_dwell_minutes, p90_dwell_minutes, sample_size,
   aggregated_at).

 Path: `server/jobs/broker-credit-compute-nightly.ts`
 Purpose: Nightly job that recomputes broker credit scores from the invoice aging data.
   Algorithm: for each broker, compute average days to pay, percentage of invoices aging 60+,
   percentage unpaid > 90 days. Score = weighted combination. Write to `broker_credit_scores`.

 Path: `server/jobs/facility-dwell-aggregate-nightly.ts`
 Purpose: Nightly job that aggregates dispatch-to-pickup-completion times from all tenants' GPS
   data + load_legs data. Computes average and p90 dwell per facility. Write to
   `facility_dwell_aggregates`.

 Path: `server/routes/broker-credit.ts`
 Purpose: New routes:
   - `GET /api/broker-credit/scores` — returns scored brokers for the current tenant
   - `GET /api/broker-credit/scores/:brokerId` — detailed score for one broker
   - `POST /api/broker-credit/flag/:brokerId` — user flags a broker for manual review

Path: `server/routes/facility-dwell.ts`
 Purpose: New routes:
   - `GET /api/facility-dwell/export` — internal export for FMCSA submission (admin only)
   - `GET /api/facility-dwell/preview/:facility` — internal preview for authorized users only,
     subject to anonymity threshold and minimum sample-size checks

 Path: `apps/web/src/components/BrokerCreditWatchlist.tsx`
 Purpose: Web UI for the broker credit watchlist. Sortable table with broker name, score, avg
   days to pay, flagged count, actions.

 Path: `apps/trucker/app/(app)/broker-credit.tsx`
 Purpose: Mobile view of broker credit data. Search by broker name, show score + details.

 Path: `server/__tests__/jobs/broker-credit-compute-nightly.test.ts`
 Purpose: Tests the scoring algorithm against seeded invoice data.

 Path: `server/__tests__/jobs/facility-dwell-aggregate-nightly.test.ts`
 Purpose: Tests the dwell aggregation job.

 Path: `server/__tests__/routes/broker-credit.test.ts`
 Purpose: Tests the broker credit routes.

 Path: `server/__tests__/routes/facility-dwell.test.ts`
 Purpose: Tests the facility dwell routes.

 Files (existing) extended:

 Path: `server/index.ts`
 What changes: Mount the new routers and register the new nightly jobs. ~6 added lines.

 Path: `packages/shared/src/api-client/broker-credit.ts` (new)
 What changes: New client.

 Acceptance criteria (R-markers):

 - R-P10-01 [unit]: Migration 055 creates `broker_credit_scores` and `facility_dwell_aggregates`
   tables.
 - R-P10-02 [integration]: The broker credit compute job runs against seeded invoice data and
   produces scores.
 - R-P10-03 [unit]: The scoring algorithm penalizes brokers with avg_days_to_pay > 60.
 - R-P10-04 [unit]: The scoring algorithm penalizes brokers with unpaid invoices > 90 days.
 - R-P10-05 [integration]: `GET /api/broker-credit/scores` returns scored brokers sorted by
   score descending.
 - R-P10-06 [integration]: The facility dwell aggregation job correctly computes avg + p90.
- R-P10-07 [integration]: `GET /api/facility-dwell/export` returns CSV or JSON for FMCSA
  submission.
- R-P10-12 [integration]: `GET /api/facility-dwell/preview/:facility` rejects requests when the
  anonymity threshold or minimum sample size is not met.
 - R-P10-08 [unit]: The web broker credit watchlist UI renders the score table.
 - R-P10-09 [unit]: The mobile broker credit screen searches by broker name.
 - R-P10-10 [integration]: Flagging a broker updates the local review flag (no public display).
- R-P10-11 [manual]: Verify data maturity before launching the display — at least 3 months of
  invoice aging data should be present. If not, defer this phase.

### Operational exit gates (tracked, not worker-blocking)

 - Data maturity threshold met for broker credit display.
 - Privacy review approves facility dwell export and preview thresholds.

 Verification command:

 ```bash
 bash -c "cd server && npx vitest run __tests__/jobs/broker-credit-compute-nightly.test.ts __tests__/jobs/facility-dwell-aggregate-nightly.test.ts __tests__/routes/broker-credit.test.ts __tests__/routes/facility-dwell.test.ts && cd .. && pnpm -w run test:all apps/web/src/__tests__/components/BrokerCreditWatchlist.test.tsx"
 ```

 ---
## Phase 11 — Offline-First Hardening + Beta Launch Prep

 **Phase Type**: `integration`

 Goal: After this phase, the mobile app is ready for beta launch with 3-5 design partners:
 - Offline-first hardening: conflict resolution for concurrent edits, event ordering
   guarantees, graceful recovery from split-brain scenarios
 - Sentry error reporting integrated
 - Analytics (PostHog or Amplitude) integrated
 - App Store review preparation: privacy policy, terms of service, data safety declarations,
   ATT prompts, ASO metadata
 - Play Store review preparation: data safety section, content rating, policy compliance
 - Marketing site landing page with download links
 - Beta feedback collection mechanism
 - Design partner onboarding runbook

 This phase is **the last phase before beta launch**. It's an "integration" phase — it doesn't
 add new user-facing features, it hardens the existing experience and prepares for public
 release.

 Files (new):

 Path: `apps/trucker/src/lib/conflict-resolution.ts`
 Purpose: Conflict resolution for concurrent edits. Three strategies: last-write-wins (default),
   manual-resolve (for financial fields), merge (for list fields). Configurable per field.

 Path: `apps/trucker/src/lib/event-ordering.ts`
 Purpose: Event ordering for offline actions. Uses a hybrid logical clock (HLC) to ensure
   events apply in a consistent order regardless of sync order.

 Path: `apps/trucker/src/lib/sentry.ts`
 Purpose: Sentry initialization. Captures errors, breadcrumbs, performance data. Respects user
   privacy (no PII in breadcrumbs).

 Path: `apps/trucker/src/lib/analytics.ts`
 Purpose: Analytics wrapper. PostHog or Amplitude (decision). Tracks key events (trip started,
   doc captured, packet generated, upgrade clicked). Respects ATT on iOS.

 Path: `apps/trucker/privacy-policy.md`
 Purpose: Privacy policy for the mobile app. Covers data collection, storage, sharing,
   retention, user rights. **Requires legal review.**

 Path: `apps/trucker/terms-of-service.md`
 Purpose: Terms of service for the mobile app. **Requires legal review.**

 Path: `apps/trucker/data-safety.json`
 Purpose: Google Play Data Safety declaration. Lists all data types collected, why, how.

 Path: `apps/trucker/app-store-metadata.md`
 Purpose: App Store Connect metadata: name, subtitle, description, keywords, screenshots,
   promo text, what's new.

 Path: `apps/web-marketing/` (new subtree or external deployment)
 Purpose: Marketing landing page. Hosted separately from the main web app. Focus: AI hero demo
   video, pricing, feature comparison, sign-up for beta.

 Path: `docs/beta-launch-runbook.md`
 Purpose: Beta launch runbook. Pre-launch checklist (App Store submission, Play Store
   submission, marketing site live, Stripe test mode verified, Sentry dashboards set up).
   Launch day steps. Post-launch monitoring.

 Path: `docs/design-partner-program.md`
 Purpose: Design partner onboarding doc. Target: 3-5 partners, free for 6 months, weekly
   feedback calls, direct Slack channel.

 Path: `apps/trucker/__tests__/offline/conflict-resolution.test.tsx`
 Purpose: Tests conflict resolution strategies.

 Path: `apps/trucker/__tests__/offline/event-ordering.test.tsx`
 Purpose: Tests HLC-based event ordering.

 Files (existing) extended:

 Path: `apps/trucker/app/_layout.tsx`
 What changes: Initialize Sentry + analytics at app start. ~5 added lines.

 Path: `.env.example`
 What changes: Add `SENTRY_DSN`, `POSTHOG_API_KEY`, `POSTHOG_HOST`.

 Path: `docs/compliance-ux-legal-framework.md`
 What changes: Append sections on privacy policy, ToS, data retention.

 Acceptance criteria (R-markers):

 - R-P11-01 [unit]: `conflict-resolution.ts` implements at least last-write-wins and
   manual-resolve strategies.
 - R-P11-02 [unit]: `event-ordering.ts` implements a hybrid logical clock with monotonic
   timestamps.
 - R-P11-03 [integration]: Sentry captures an error from a test throw.
 - R-P11-04 [integration]: Analytics tracks a test event.
 - R-P11-05 [unit]: `privacy-policy.md` exists and contains required sections (data
   collection, storage, sharing, retention, user rights).
 - R-P11-06 [unit]: `terms-of-service.md` exists.
 - R-P11-07 [unit]: `data-safety.json` declares all data types collected.
 - R-P11-08 [unit]: `app-store-metadata.md` contains all required fields.
 - R-P11-09 [unit]: `docs/beta-launch-runbook.md` exists and contains pre-launch, launch, and
   post-launch sections.
 - R-P11-10 [unit]: `docs/design-partner-program.md` exists and describes the 3-5 partner
   structure.

### Operational exit gates (tracked, not worker-blocking — per Delivery Status Model)

 Phase 11 is the launch-prep phase, so unlike most phases these gates MUST be satisfied before
 the app actually ships to the App Store and Play Store. But they do NOT block the ralph-worker
 from completing Phase 11's engineering work. Tracked separately for the operator to close.

 - **E-P11-01**: App Store review preparation checklist complete (privacy manifest, ATT
   implementation, screenshots, keywords, metadata, content rating, data safety declaration).
 - **E-P11-02**: Play Store review preparation checklist complete (data safety section,
   content rating, policy compliance, target API level).
 - **E-P11-03**: Marketing landing page deployed with download links (App Store + Play Store
   badges, hero demo video, pricing page).
 - **E-P11-04**: 3-5 design partners identified and recruited for the beta program (signed
   agreements or verbal commitments).
 - **E-P11-05**: Legal review of privacy policy, terms of service, and all compliance
   disclaimers (Phase 7 disclaimer text + Phase 11 launch docs) complete.
 - **E-P11-06**: Apple Developer account + Google Play Console accounts in place, signing
   certificates valid, first TestFlight/Internal Track build distributed to design partners.

 Verification command:

 ```bash
 pnpm -w run test:trucker apps/trucker/__tests__/offline/ && \
   cat docs/beta-launch-runbook.md && \
   cat docs/design-partner-program.md
 ```

 ---
Cross-Cutting Concerns

 ### 1. Legal Disclaimer Framework

 Every compliance UI screen (Phase 7) MUST include an explicit disclaimer that the data
 displayed is from the fleet's own records and NOT the authoritative state/FMCSA source.
 Disclaimer text is i18n'd in both English and Spanish. Legal review of the disclaimer text is
 mandatory before Phase 7 ships.

 Failure mode: if the app says "your IFTA is complete" and it's not, the fleet could eat a
 penalty. Our mitigation:
 - Explicit disclaimer on every screen
 - "Last verified" timestamp on every status
 - Data source attribution (e.g., "based on your fleet's fuel_ledger and mileage_jurisdiction
   records, as of 2026-04-08 14:32 UTC")
 - User-facing link to the authoritative source (FMCSA SAFER for safety, state DOT sites for
   permits, IRS for 2290)

 The legal framework doc at `docs/compliance-ux-legal-framework.md` is the single source of
 truth for these patterns.

 ### 2. ELD Partner Dependency Abstraction

 The ELD integration (Phase 6) goes through a provider abstraction layer. The interface is
 defined in `server/services/eld/provider.interface.ts`. Motive is the first adapter. Samsara
 and Geotab can be added as new adapters without touching consumer code.

 Abstraction boundaries:
 - Provider interface: OAuth, HOS sync, GPS sync, vehicle sync, webhook subscribe
 - Canonical internal data model: HOS events, GPS positions, vehicles, drivers (all vendor-agnostic)
 - Adapter layer: translates vendor-specific formats into the canonical model

 Failure mode: if Motive changes their API or pricing, we can swap providers without a full
 rewrite. Cost: ~1 extra week of upfront abstraction work in Phase 6, saves months of rewrite
 pain later.

 ### 3. App Store / Play Store Operational Burden

 Running a native mobile app has ongoing operational costs that don't exist for web-only
 products:
 - Apple Developer account: $99/yr
 - Google Play Console: $25 one-time
 - EAS Build: free tier for low volume, paid for production ($29/mo for team)
 - App Store review: 1-3 day cycle per release, can fail for policy reasons
 - Play Store review: 1-7 day cycle, can fail for data safety or content rating
 - Periodic policy updates force refactors (Apple ATT, Google Data Safety, privacy manifests)
 - Binary update cadence: every 2-4 weeks to avoid "app outdated" warnings

 Budget: ~2-5 days per quarter of ongoing operational work post-launch. This is a recurring
 cost, not a one-time setup. Phase 0 gets the accounts set up; Phase 11 handles the first
 submission; post-launch maintenance is an ongoing cost line.

 ### 4. Driver-Intake Boundary UX

 STORY-005 of the remediation sprint enforces the technical boundary: drivers submit load
 intakes via a distinct endpoint (`/api/loads-driver-intake`) that creates loads in `Draft`
 status with `intake_source='driver'`. The dispatcher then reviews and promotes to `Planned`.

 The product UX is locked for dispatch: in the mobile app, drivers see ONLY "Submit Intake" —
 never "Create Load". The terminology itself reinforces the technical boundary. Dispatchers,
 when using the web app, see both "Create Load" (standard creation) and "Review Intakes"
 (driver submissions awaiting promotion).

 ### 5. Offline-First Sync Complexity

 Document capture with offline queue + background sync + eventual consistency is the hardest
 technical problem in this plan. Phase 5 ships an "online-first with graceful offline
 degradation" version — drivers can capture documents offline, they queue, and they upload on
 reconnect. Edge cases (concurrent edits from dispatcher + driver, split-brain scenarios, sync
 ordering) are deferred to Phase 11.

 Phase 11's conflict resolution and event ordering are the real hardening pass. Do not
 underestimate them. They are 2+ weeks of careful engineering, not a one-week sprint.

 ### 6. Spanish-First i18n

 Every user-facing string in the mobile app goes through an i18n layer from Phase 2 onward.
 Translation bundles are at `apps/trucker/src/i18n/locales/en.json` and `es.json`. Professional
 translation (not machine) for legal/compliance strings. Machine translation is acceptable for
 non-legal UI strings if budget-constrained but must be reviewed by a native speaker before
 shipping.

 The web app is NOT translated in this plan. Spanish-first is a mobile-only differentiator.
 Translating the web app can be a separate future sprint.

 ### 7. Compliance Data-Source Matrix

 Compliance UI may only show a non-`unknown` status when a concrete backing source exists.

 | Category | Primary source | Source type | Refresh model | Mobile display rule |
 |---|---|---|---|---|
 | IFTA | `mileage_jurisdiction`, `fuel_ledger`, `ifta_trips_audit` | internal derived | nightly/on-demand | show derived status + verified timestamp |
 | IRP mileage | trip mileage records + jurisdiction splits | internal derived | nightly/on-demand | show derived status only if trip data exists; else unknown |
 | 2290 | manual entry or uploaded Schedule 1 doc | manual/document-backed | manual update | do not infer from truck age or weight |
 | UCR | manual entry or uploaded confirmation | manual/document-backed | manual update | do not infer from fleet size alone |
 | Permits | permit records + uploaded permit docs | manual/document-backed | manual update | expired/active based on stored validity dates |
 | Clearinghouse | manual status until direct integration exists | manual | manual update | always show source as manual |
 | CDL | driver profile + uploaded license metadata | manual/document-backed | manual update | warning colors based on stored expiry only |
 | Medical card | compliance record + uploaded document metadata | manual/document-backed | manual update | warning colors based on stored expiry only |
 | Insurance | company/equipment compliance docs | manual/document-backed | manual update | unknown until populated |
 | Inspection | safety maintenance / inspection records | internal + manual | nightly/on-demand | unknown until record exists |

 Rule:

 - if a category is not integrated and not manually populated, it returns `unknown`
 - no green card may be synthesized from absence of data
 - every card shows `sourceType`, `sourceOfTruth`, and `verifiedAt`

 ---
File Inventory (final, verified against live state at dispatch time)

 This inventory will be re-verified during the `/plan` refinement pass before dispatch. Line
 numbers in existing files are subject to drift and will be re-confirmed at that time.

 ## Extended (existing files modified)

 | File | Phase(s) | Diff scope |
 |---|---|---|
 | `package.json` (root) | 0 | Add pnpm workspace config, move scripts into apps/web/ |
 | `tsconfig.json` (root) | 0 | Add path aliases for @shared/* and @trucker/* |
 | `apps/web/src/services/api.ts` (at post-Pre-Phase-0 path) | 0 | Re-export from @shared/api-client |
 | `.gitignore` | 0 | Add apps/trucker/.expo, node_modules, ios, android |
 | `server/index.ts` | 1, 3, 4, 6, 9, 10 | ~12 added lines total across phases (router mounts) |
 | `server/package.json` | 1, 6, 9 | Add jszip, add Motive SDK (if any), add Stripe |
 | `server/routes/documents.ts` | 5 | additive metadata/mobile compatibility updates only; canonical document domain remains authoritative |
 | `server/lib/sql-auth.ts` | 3 | ~15 added lines (createDriverUser function) |
 | `server/routes/ai.ts` | 9 | ~3 added lines (apply aiQuota middleware) |
 | `components/IFTAManager.tsx` | 1 | ~60 added lines (audit packet button + modal). Phase 1 is LOCKED to pre-monorepo layout; Phase 0 later moves the file to `apps/web/src/components/IFTAManager.tsx` as part of the monorepo restructure. |
 | `services/financialService.ts` | 1 | ~15 added lines (audit packet API methods). Phase 1 is LOCKED to pre-monorepo layout; Phase 0 later moves to `apps/web/src/services/financialService.ts` and re-exports from `packages/shared/src/api-client/ifta.ts`. |
 | `apps/trucker/app/(auth)/login.tsx` | 3 | Replace Phase 2 placeholder with real login |
 | `apps/trucker/app/(app)/trip.tsx` | 4 | Replace Phase 2 placeholder with real trip workspace |
 | `apps/trucker/app/(app)/docs.tsx` | 5 | Replace Phase 2 placeholder with real docs tab |
 | `apps/trucker/app/(app)/compliance.tsx` | 7 | Replace Phase 2 placeholder with real hub |
 | `apps/trucker/app/_layout.tsx` | 11 | ~5 added lines (Sentry + analytics init) |
 | `apps/trucker/src/i18n/locales/en.json` | 2, 3, 4, 5, 6, 7, 8, 9 | Append new translation keys each phase |
 | `apps/trucker/src/i18n/locales/es.json` | 2, 3, 4, 5, 6, 7, 8, 9 | Append matching Spanish translations |
 | `packages/shared/src/api-client/loads.ts` | 4 | ~25 added lines (getCurrentTrip and related trip methods) |
 | `packages/shared/src/api-client/documents.ts` | 5 | canonical mobile document upload client |
 | `packages/shared/src/api-client/ifta.ts` | 1 | ~30 added lines (audit packet methods) |
 | `packages/shared/src/api-client/ai.ts` | 5 | ~10 added lines (extractLoadFromImage) |
 | `packages/shared/src/api-client/auth.ts` | 3 | ~25 added lines (invite methods) |
 | `docs/compliance-ux-legal-framework.md` | 11 | Append privacy, ToS, retention sections |

 ## New (files created — grouped by category)

 ### Monorepo infrastructure (Phase 0)
 - `pnpm-workspace.yaml`
 - `apps/trucker/package.json`, `app.config.ts`, `eas.json`, `tsconfig.json`, `babel.config.js`, `metro.config.js`
 - `apps/trucker/app/_layout.tsx`, `app/index.tsx`, `app/(onboarding)/language.tsx`, `app/(auth)/login.tsx`, `app/(app)/_layout.tsx`, `app/(app)/trip.tsx`, `app/(app)/docs.tsx`, `app/(app)/compliance.tsx`, `app/(app)/profile.tsx`
 - `apps/trucker/src/i18n/index.ts`, `src/i18n/locales/en.json`, `src/i18n/locales/es.json`
 - `apps/trucker/src/state/auth-store.ts`, `src/theme/index.ts`, `src/components/Screen.tsx`, `src/components/LanguagePicker.tsx`, `src/components/ErrorBoundary.tsx`
 - `apps/trucker/assets/icon.png`, `assets/splash.png`, `assets/adaptive-icon.png`
 - `packages/shared/package.json`, `tsconfig.json`
 - `packages/shared/src/api-client/index.ts`, `auth.ts`, `loads.ts`, `documents.ts`, `ai.ts`, `ifta.ts`
 - `packages/shared/src/types/index.ts`
 - `packages/shared/src/storage/index.ts`, `browser.ts`, `mobile.ts`
 - `docs/monorepo-setup.md`
 - `apps/trucker/__tests__/smoke.test.tsx`, `__tests__/shell.test.tsx`, `__tests__/i18n.test.ts`

 ### Backend routes (Phases 1, 3, 4, 6, 7, 9, 10)
 - `server/routes/ifta-audit-packets.ts` (Phase 1)
 - `server/routes/driver-invitations.ts` (Phase 3)
 - `server/routes/driver-trip.ts` (Phase 4)
 - `server/routes/eld-integration.ts` (Phase 6)
- `server/routes/driver-compliance.ts` (Phase 7)
 - `server/routes/subscription.ts` (Phase 9)
 - `server/routes/broker-credit.ts` (Phase 10)
 - `server/routes/facility-dwell.ts` (Phase 10)

 ### Backend services (Phases 1, 3, 6, 9)
 - `server/services/ifta-audit-packet.service.ts` (Phase 1)
 - `server/services/sms.service.ts` (Phase 3)
 - `server/services/eld/provider.interface.ts` (Phase 6)
 - `server/services/eld/motive.adapter.ts` (Phase 6)
 - `server/services/subscription.service.ts` (Phase 9)

 ### Backend jobs (Phases 1, 6, 10)
 - `server/jobs/invoice-aging-nightly.ts` (Phase 1)
 - `server/jobs/eld-sync-nightly.ts` (Phase 6)
 - `server/jobs/broker-credit-compute-nightly.ts` (Phase 10)
 - `server/jobs/facility-dwell-aggregate-nightly.ts` (Phase 10)

 ### Backend middleware (Phase 9)
 - `server/middleware/ai-quota.ts`

 ### Migrations (Phases 1, 6, 9, 10)
 - `server/migrations/051_ifta_audit_packets.sql`
 - `server/migrations/052_invoices_aging_tracking.sql`
 - `server/migrations/053_eld_events.sql`
 - `server/migrations/054_ai_usage_tracking.sql`
 - `server/migrations/055_broker_credit_scores.sql`

 ### Mobile screens (Phases 3, 4, 5, 6, 7, 8, 9)
 - `apps/trucker/app/(onboarding)/invite/[token].tsx` (Phase 3)
 - `apps/trucker/app/(app)/capture.tsx` (Phase 5)
 - `apps/trucker/app/(app)/hos.tsx` (Phase 6)
 - `apps/trucker/app/(app)/compliance/ifta.tsx`, `irp.tsx`, `2290.tsx`, `permits.tsx`, `clearinghouse.tsx`, `cdl.tsx`, `medical.tsx`, `audit-packet.tsx` (Phase 7, 8)
- `apps/trucker/app/(app)/upgrade.tsx` (Phase 9)
- `apps/trucker/app/(app)/broker-credit.tsx` (Phase 10)
 - `apps/web/src/components/driver/DriverInvitationPanel.tsx` (Phase 3)

 ### Mobile components (Phases 4, 5, 6, 7, 8, 9)
 - `apps/trucker/src/components/trip/*.tsx` (Phase 4: ActiveTripCard, StopSequence, StatusUpdateButtons, NavigationButton, DocumentChecklist, RoutePreview)
 - `apps/trucker/src/components/docs/*.tsx` (Phase 5: DocumentCard, UploadQueueIndicator, ExtractionConfirmation)
 - `apps/trucker/src/components/hos/*.tsx` (Phase 6: StatusCard, RemainingHours)
 - `apps/trucker/src/components/compliance/*.tsx` (Phase 7, 8: ComplianceCard, DisclaimerBanner, LastVerifiedBadge, AuditPacketCard, PacketHistory)
 - `apps/trucker/src/components/subscription/*.tsx` (Phase 9: TierComparison, UpgradePrompt)

 ### Mobile libs (Phases 3, 4, 5, 6, 11)
 - `apps/trucker/src/auth/biometric.ts`, `session.ts`, `deep-link.ts` (Phase 3)
 - `apps/trucker/src/lib/offline-cache.ts` (Phase 4)
 - `apps/trucker/src/lib/document-queue.ts`, `background-sync.ts`, `document-hash.ts` (Phase 5)
 - `apps/trucker/src/lib/compliance-warnings.ts` (Phase 7)
 - `apps/trucker/src/lib/conflict-resolution.ts`, `event-ordering.ts`, `sentry.ts`, `analytics.ts` (Phase 11)

 ### Mobile hooks (Phases 4, 5, 7, 8)
 - `apps/trucker/src/hooks/useCurrentTrip.ts`, `useStatusUpdate.ts` (Phase 4)
 - `apps/trucker/src/hooks/useDocumentCapture.ts`, `useDocumentUpload.ts` (Phase 5)
 - `apps/trucker/src/hooks/useCompliance.ts` (Phase 7)
 - `apps/trucker/src/hooks/useAuditPacket.ts` (Phase 8)

 ### Tests — roughly 100-120 test files total across phases, not enumerated here. See each phase's "Files (new)" list.

 ### Documentation (Phases 0, 7, 11)
 - `docs/monorepo-setup.md` (Phase 0)
 - `docs/compliance-ux-legal-framework.md` (Phase 7, extended Phase 11)
 - `docs/beta-launch-runbook.md` (Phase 11)
 - `docs/design-partner-program.md` (Phase 11)
 - `apps/trucker/privacy-policy.md`, `terms-of-service.md`, `data-safety.json`, `app-store-metadata.md` (Phase 11)

 ## Files explicitly NOT touched (proof of minimum scope)

 - Existing migrations 001-050 (frozen history)
 - `server/scripts/seed-demo.ts`, `server/scripts/seed-sales-demo.ts` (demo seeds unchanged)
 - `server/services/load-state-machine.ts` (state machine unchanged; trucker-app consumes but
   does not modify)
 - `server/services/gemini.service.ts` (AI extraction unchanged; trucker-app consumes existing
   endpoints)
 - `components/NetworkPortal.tsx` (web CRM unchanged; parties used via existing API)
 - `components/GlobalMapViewEnhanced.tsx` (fleet map unchanged)
 - `components/SafetyView.tsx` (safety dashboard unchanged; compliance data aggregated via new
   `/api/drivers/:id/compliance` endpoint)
 - `components/AccountingPortal.tsx` (accounting unchanged; audit packet is a NEW feature, not a
   refactor)
 - `components/IFTAManager.tsx` — Extended in Phase 1 with audit packet button. NOT refactored.
 - `components/Scanner.tsx` — The web-side scanner is NOT modified. Mobile has its OWN scanner
   component under `apps/trucker/`.
 - `components/DriverMobileHome.tsx`, `components/driver/DriverLoadIntakePanel.tsx`,
   `components/PendingDriverIntakeQueue.tsx` — The web-side driver components STAY as-is for
   dispatcher preview purposes. Mobile has its own equivalents.
 - All `.claude/` files except `.claude/docs/PLAN-trucker-app.md` (this file)

 ---
Architectural Decisions (to lock via /plan refinement)

 1. **Mobile styling library**: NativeWind. Locked default for dispatch. Revisit only with
    orchestrator approval if a concrete blocker appears.

 2. **Mobile state management**: Zustand + React Query. Locked default for dispatch.

 3. **Mobile navigation**: Expo Router. Locked default for dispatch.

 4. **Monorepo orchestrator**: plain pnpm workspaces for Sprint A; Turborepo may be introduced
    later if build times justify it. Locked default for dispatch is plain pnpm.

 5. **SMS provider**: Twilio. Locked default for dispatch.

 6. **Analytics provider**: PostHog. Locked default for dispatch.

 7. **Error reporting**: Sentry (industry standard). Decision: Sentry. Locked.

 8. **Push notifications**: Expo Push Service. Locked default for dispatch.

 9. **Background task frequency**: every 15 minutes (default) vs user-configurable. Decision:
    default 15 minutes, no user config in v1. Can add in v2.

 10. **Document retention in mobile SQLite**: 30 days (default) vs user-configurable.
    Decision: default 30 days, auto-purge after. Can add user config in v2.

 ---
Open Questions for User Resolution

 If these are unanswered at dispatch time, the defaults below apply so engineering is not blocked.

 1. **Brand name for the mobile app**: default to `LoadPilot Driver` for engineering assets and
    bundle IDs. Marketing rename is allowed later if needed.

 2. **Design partners**: who are the first 3-5 design partners? Sourcing plan needed before
    Phase 11.

 3. **Launch target market**: default to US-only. Canada is explicitly out of scope for this
    plan unless a later sprint expands the compliance matrix.

 4. **Free tier extraction limit**: 50/month is an initial guess. Decision can defer to Phase 9
    based on real usage data from BSD demo period.

 5. **Apple Developer Team + Google Play developer account holder**: default to business entity
    if available, otherwise individual owner with transfer checklist documented in Phase 11.

 6. **ELD partner onboarding flow for existing Motive customers**: do we auto-detect Motive
    connection via the customer's OAuth login? Or ask them separately? Decision refines Phase
    6.

 7. **Broker credit watchlist launch criteria**: how many months of aging data before the
    display ships? Recommendation: 3 months minimum. Decision defers to Phase 10 entry
    criteria.

 8. **Spanish translation budget**: default to professional translation for legal/compliance
    strings before Phase 7 public rollout; non-legal UI strings may use reviewed provisional
    translation earlier.

 9. **Legal counsel engagement**: default assumption is external counsel review before Phase 7
    public beta and again before Phase 11 launch submission. This is an operational gate, not an
    engineering blocker.

 10. **Beta launch timing target**: default to milestone-based launch after Phase 11 engineering
     completion plus required operational exit gates.

 ---
Risk Register

 | # | Risk | Impact | Likelihood | Mitigation |
 |---|---|---|---|---|
 | 1 | Offline-first sync edge cases cause data corruption | HIGH | MEDIUM | Phase 11 dedicated to hardening. Conservative conflict resolution (LWW default). Extensive edge case testing. |
 | 2 | Compliance UX liability (incorrect status causes penalty) | HIGH | MEDIUM | Mandatory disclaimer framework (Phase 7). Legal review. "Last verified" timestamps. Data source attribution. |
 | 3 | Motive API changes force rewrite | MEDIUM | LOW | Provider abstraction layer (Phase 6). Adapter pattern. Interface contract stable. |
 | 4 | App Store rejection on first submission | MEDIUM | MEDIUM | Pre-submission checklist (Phase 11). ATT compliance. Privacy manifest. Legal review. |
 | 5 | Spanish translation quality issues | MEDIUM | LOW | Professional translator for legal strings. Native speaker review. |
 | 6 | Gemini API cost explosion on free tier | MEDIUM | MEDIUM | Per-tenant monthly limit (Phase 9). Rate limit at API layer. Monitor usage dashboards. |
 | 7 | SMS delivery failure for driver invitations | LOW | MEDIUM | Backup path: dispatcher can show QR code in person. Invitation email fallback. |
 | 8 | Biometric unlock bypass security concerns | MEDIUM | LOW | Biometric requires a pre-established password. Biometric is an unlock, not a credential. Refresh token still server-validated. |
 | 9 | ELD partner (Motive) pricing changes | LOW | LOW | Self-serve developer portal indicates no per-partner pricing. If this changes, fall back to customer-provided tokens. |
 | 10 | Single-writer Ralph workflow state blocks parallel trucker-app + BSD sprints | MEDIUM | HIGH | Verify commit 17f8d99 worktree fix (Task #1). If working, parallel dispatch is safe. If not, use two-clones workaround or strict sequential. |
 | 11 | Owner-operator persona churns before achieving freemium → paid conversion | HIGH | MEDIUM | Design partner program (Phase 11). Direct feedback loops. Fast iteration post-launch. |
 | 12 | Broker fraud feature (Phase 10) insufficient data on launch | MEDIUM | MEDIUM | Silent data collection from Phase 1 onward. Do not launch display until 3 months data accumulated. |

 ---
Sprint Summary (draft v1)

 **12 phases** (Phase 0 through Phase 11), estimated **~17-18 weeks** total effort, or
 **~8 weeks to MVP launch** if Phases 7-11 are deferred to post-MVP iteration.

 **MVP definition**: Phases 0-6 complete. Mobile app has:
 - monorepo structure
 - IFTA audit packet export (via web app, Phase 1)
 - Expo shell with EN/ES i18n
 - SMS invite + biometric auth
 - Trip workspace
 - Smart document intake with offline queue
 - Motive ELD integration (HOS status display)

 **Post-MVP iteration**:
 - Phase 7: Compliance Hub Mobile (IFTA, IRP, 2290, UCR, permits, Clearinghouse, CDL, medical,
   insurance, inspection)
 - Phase 8: Mobile Audit Packet Export
 - Phase 9: Freemium Tier Enforcement + Stripe
 - Phase 10: Broker Credit Watchlist + Facility Dwell-Time Index
 - Phase 11: Offline-First Hardening + Beta Launch Prep

 **Total R-markers (estimated)**: ~130-140 across 12 phases.

 **Total new files**: ~150+ (mostly new mobile components, tests, and backend routes)

 **Total extended files**: ~25 existing files (mostly additive, minimal refactoring)

 **Target branch**: `ralph/trucker-app-v1`

 **Dispatch prerequisites**:
 - `ralph/pre-demo-remediation` merged to main
 - `ralph/bulletproof-sales-demo` merged to main
 - Commit `17f8d99` (worktree fix) verified working
 - This plan refined via `/plan` pass to fill in line-number assertions and architectural
   decisions
 - Brand name chosen
 - Apple Developer account set up
 - Google Play Console set up
 - Motive developer account registered (sandbox credentials in `.env.local`)
 - Twilio account set up
 - Stripe account set up

 ---
Notes and Open Items

 This plan is **v1 DRAFT**. Before dispatching to Ralph:

 1. **Run a /plan refinement pass** to verify all line-number assertions (many references are
    approximate and need confirmation against the live repo state at dispatch time).

 2. **Lock architectural decisions** (styling library, state management, navigation, monorepo
    orchestrator, SMS provider, analytics provider).

 3. **Resolve open questions** (brand name, launch market, free tier limit, translator budget,
    legal counsel).

 4. **Verify BSD MVP ships first** — the trucker-app plan assumes BSD provides stable demo
    infrastructure. If BSD doesn't ship first, some assumptions break (especially around the
    seed pipeline that Phase 1's audit packet test fixtures depend on).

 5. **Verify worktree fix (commit 17f8d99)** — without it, parallel Phase 1 + Phase 2 dispatch
    is not safe. With it, many phase overlaps become tractable.

 6. **Split into multiple Ralph sprints** — 17-18 weeks is too long for a single sprint. The
    executable order must follow the "audit packet first" directive, not the raw phase numbering:
    - Sprint A: Phase 1 only (audit packet export, pre-monorepo) — dispatch artifact:
      `docs/PLAN-trucker-app-sprint-a.md`
    - Sprint B: Phase 0 only (manual pre-Phase-0 move already completed + monorepo/bootstrap)
    - Sprint C: Phases 2-4 (mobile shell + auth + trip workspace)
    - Sprint D: Phase 5 (document intake with offline queue)
    - Sprint E: Phase 6 (ELD integration)
    - Sprint F: Phases 7-8 (compliance hub + mobile audit packet)
    - Sprint G: Phases 9-10 (tier enforcement + broker credit)
    - Sprint H: Phase 11 (hardening + beta launch)
    Each sub-sprint has its own PLAN.md, its own prd.json, its own branch, its own PR. The
    handoff between sub-sprints is clean because each one leaves the system in a working state.

 7. **Budget for research spikes** — Phase 5 (offline-first doc intake) and Phase 6 (ELD
    integration) are the highest-complexity phases. Budget 1-2 days per phase for research
    spikes before implementation.

 8. **Design partner program starts BEFORE Phase 11** — recruit partners during Phase 6 or 7 so
    they're ready to onboard at Phase 11 launch.

 ---
End of PLAN-trucker-app.md v1 DRAFT

 Last updated: 2026-04-08 by orchestrator synthesis after 9-agent parallel research pass +
 Claude/ChatGPT strategic convergence on decisions memo.

 Next action: user review. If approved, run `/plan` refinement pass before Ralph dispatch.
