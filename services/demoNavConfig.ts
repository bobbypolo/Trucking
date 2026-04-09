/**
 * Sales Demo navigation configuration.
 *
 * Pure config used by App.tsx to (a) decide whether to collapse the
 * dispatcher/admin sidebar into the demo allowlist, and (b) which route
 * keys to keep when demo-mode is active. All behavior is gated by the
 * Vite env flag VITE_DEMO_NAV_MODE. When the flag is not equal to
 * 'sales', every production tenant renders the full nav exactly as
 * before (byte-for-byte unchanged at runtime).
 *
 * Keys in DEMO_NAV_ALLOWLIST must match real NavItem ids used in
 * App.tsx. No fictional keys.
 */

/**
 * The six real nav keys that are kept when sales-demo mode is active.
 */
export const DEMO_NAV_ALLOWLIST = [
  "operations-hub",
  "loads",
  "calendar",
  "network",
  "accounting",
  "exceptions",
] as const;

export type DemoNavKey = (typeof DEMO_NAV_ALLOWLIST)[number];

/**
 * Returns true iff the Vite env flag VITE_DEMO_NAV_MODE is exactly
 * the string 'sales'. Any other value (including undefined, '', null,
 * 'SALES', 'production') returns false.
 */
export function isDemoNavMode(): boolean {
  // Check process.env first so vi.stubEnv() in tests takes precedence
  // over import.meta.env (which Vitest populates from .env.local at
  // transform time and cannot be overridden by vi.stubEnv).
  if (typeof process !== "undefined" && process.env) {
    // process.env is authoritative when available (Node / Vitest)
    return process.env.VITE_DEMO_NAV_MODE === "sales";
  }
  // Browser fallback: Vite replaces import.meta.env.VITE_* at build time.
  const viteEnv = (import.meta as unknown as { env?: Record<string, string> })
    .env;
  return viteEnv?.VITE_DEMO_NAV_MODE === "sales";
}

/**
 * Shape that applyDemoNavFilter expects: an array of nav categories,
 * each exposing a mutable `items` list where each item has a string
 * `id`. Deliberately structural so App.tsx does not have to export its
 * NavItem/NavCategory types for this helper to be useful.
 */
export interface DemoNavCategoryLike {
  items: Array<{ id: string }>;
}

/**
 * Collapse a categories array down to just the DEMO_NAV_ALLOWLIST ids
 * and drop any category that ends up empty. Mutates in place so the
 * caller can keep a single `const filteredCategories` declaration
 * without re-assigning. Safe no-op when not in demo mode.
 */
export function applyDemoNavFilter<T extends DemoNavCategoryLike>(
  categories: T[],
): void {
  const allow = new Set<string>(DEMO_NAV_ALLOWLIST);
  categories.forEach((c) => {
    c.items = c.items.filter((i) => allow.has(i.id));
  });
  for (let i = categories.length - 1; i >= 0; i--) {
    if (categories[i].items.length === 0) categories.splice(i, 1);
  }
}

/**
 * POST to /api/demo/reset and return a Toast-friendly payload
 * describing the outcome. Exposed as a helper so App.tsx can keep
 * its demo-button JSX minimal.
 */
export async function resetDemo(): Promise<{
  message: string;
  type: "success" | "error";
}> {
  try {
    // Dynamic import to avoid pulling api module (and its side effects)
    // into this pure-config file at load time — preserves test isolation.
    const { api } = await import("./api");
    await api.post("/demo/reset", {});
    return { message: "Reset Demo OK", type: "success" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("404")) {
      return {
        message:
          "Reset Demo failed: route not available — ensure ALLOW_DEMO_RESET=1 is set in server env",
        type: "error",
      };
    }
    return { message: `Reset Demo failed: ${msg}`, type: "error" };
  }
}
