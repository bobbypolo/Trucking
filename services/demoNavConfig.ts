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
  // Vite replaces import.meta.env.VITE_* at build time with the literal
  // value. In Node test envs, vitest stubs into process.env via
  // vi.stubEnv, so we check both sources to keep the helper testable
  // without leaking the Vite-specific mechanism into the call sites.
  const viteEnv = (import.meta as unknown as { env?: Record<string, string> })
    .env;
  const viteValue = viteEnv?.VITE_DEMO_NAV_MODE;
  if (viteValue === "sales") return true;
  if (typeof process !== "undefined" && process.env) {
    return process.env.VITE_DEMO_NAV_MODE === "sales";
  }
  return false;
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
    const r = await fetch("/api/demo/reset", { method: "POST" });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (r.ok) return { message: "Reset Demo OK", type: "success" };
    return {
      message: `Reset Demo failed: ${j.error || r.status}`,
      type: "error",
    };
  } catch {
    return { message: "Reset Demo failed", type: "error" };
  }
}
