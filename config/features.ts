/**
 * Feature flags for dev-only tools.
 * All flags are true in development and false in production.
 * Use these to gate any UI that should never appear to real users.
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
