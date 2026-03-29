/**
 * Feature flags for dev-only tools.
 * All flags are true in development and false in production.
 * Use these to gate any UI that should never appear to real users.
 *
 * ─── DEV/PROD TRUST BOUNDARY ────────────────────────────────────────
 *
 * All flags below are derived from `import.meta.env.DEV`, which Vite
 * statically replaces at build time:
 *   - `npm run dev`   → DEV = true  (flags are enabled)
 *   - `npm run build` → DEV = false (flags are dead-code-eliminated)
 *
 * PRODUCTION INVARIANTS:
 *   1. Every flag evaluates to `false` in production builds.
 *   2. Code paths gated by these flags are tree-shaken by Vite and
 *      do NOT appear in the dist/ bundle.
 *   3. seedDatabase() (gated by `seedSystem`) uses dynamic import()
 *      for fixture data, so seed credentials like "admin@loadpilot.com"
 *      and "User123" are never bundled in production.
 *   4. DEMO_MODE (services/firebase.ts) is a separate runtime guard
 *      that throws at startup if active in a production build.
 *
 * ADDING NEW FLAGS:
 *   - Always derive from `import.meta.env.DEV` (never env vars).
 *   - Never add a flag that enables production behavior — these are
 *     dev-only tools. Production feature flags belong in server-side
 *     configuration (e.g., ALLOW_AUTO_PROVISION in server/lib/env.ts).
 *
 * See also: services/firebase.ts (DEMO_MODE guard),
 *           services/authService.ts (seedDatabase dynamic import),
 *           services/mockDataService.ts (seed fixtures location).
 * ─────────────────────────────────────────────────────────────────────
 */
export const features = {
  /** Show the SIMULATE action group in IntelligenceHub */
  simulateActions: import.meta.env.DEV,
  /** Show the API Tester nav item and route */
  apiTester: import.meta.env.DEV,
  /** Allow seedDatabase() to run */
  seedSystem: import.meta.env.DEV,
  /** Show the "Inject Record" action in IntelligenceHub */
  injectRecord: import.meta.env.DEV,
  /** Show debug panels and dev overlays */
  debugPanels: import.meta.env.DEV,
} as const satisfies Record<string, boolean>;
