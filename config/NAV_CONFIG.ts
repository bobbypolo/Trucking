/**
 * NAV_CONFIG.ts — Role-based navigation visibility matrix
 *
 * Implements the approved IA from NAV_VISIBILITY_AND_ROLE_MATRIX.md.
 * Replaces the dual-gate (permission + capability) filter in App.tsx
 * with a declarative role→page visibility lookup.
 *
 * Access levels:
 *   "full"     — Full read/write access
 *   "read"     — Read-only view
 *   "assigned" — Only sees own assigned records
 *   "submit"   — Can submit but not manage
 *   "none"     — Page hidden from nav
 */

import type { UserRole } from "../types";

export type NavAccessLevel = "full" | "read" | "assigned" | "submit" | "none";

/** The 9 approved primary nav item IDs */
export type NavItemId =
  | "operations-hub"
  | "loads"
  | "quotes"
  | "calendar"
  | "network"
  | "finance"
  | "accounting"
  | "exceptions"
  | "company";

/** Canonical roles from the approved matrix */
type CanonicalRole = "admin" | "owner" | "dispatcher" | "driver" | "accounting";

/**
 * Approved visibility matrix — 5 canonical roles × 9 pages.
 * Source: docs/remediation/product-rebuild/NAV_VISIBILITY_AND_ROLE_MATRIX.md
 */
const VISIBILITY_MATRIX: Record<
  CanonicalRole,
  Record<NavItemId, NavAccessLevel>
> = {
  admin: {
    "operations-hub": "full",
    loads: "full",
    quotes: "full",
    calendar: "full",
    network: "full",
    finance: "full",
    accounting: "full",
    exceptions: "full",
    company: "full",
  },
  owner: {
    "operations-hub": "full",
    loads: "full",
    quotes: "full",
    calendar: "full",
    network: "full",
    finance: "full",
    accounting: "full",
    exceptions: "full",
    company: "full",
  },
  dispatcher: {
    "operations-hub": "full",
    loads: "full",
    quotes: "full",
    calendar: "full",
    network: "full",
    finance: "read",
    accounting: "read",
    exceptions: "full",
    company: "none",
  },
  driver: {
    "operations-hub": "none",
    loads: "assigned",
    quotes: "none",
    calendar: "assigned",
    network: "none",
    finance: "submit",
    accounting: "none",
    exceptions: "submit",
    company: "none",
  },
  accounting: {
    "operations-hub": "read",
    loads: "read",
    quotes: "read",
    calendar: "read",
    network: "none",
    finance: "full",
    accounting: "full",
    exceptions: "read",
    company: "none",
  },
};

/**
 * Maps every UserRole to one of the 5 canonical roles.
 * Enterprise and split roles are grouped by their functional domain.
 */
const ROLE_MAPPING: Record<UserRole, CanonicalRole> = {
  // Core roles
  admin: "admin",
  driver: "driver",
  owner_operator: "owner",
  dispatcher: "dispatcher",
  safety_manager: "dispatcher",
  payroll_manager: "accounting",
  customer: "driver",

  // Enterprise Pack
  ORG_OWNER_SUPER_ADMIN: "admin",
  OWNER_ADMIN: "owner",
  OPS_MANAGER: "dispatcher",
  OPS: "dispatcher",
  SAFETY_COMPLIANCE: "dispatcher",
  SAFETY_MAINT: "dispatcher",
  MAINTENANCE_MANAGER: "dispatcher",
  ACCOUNTING_AR: "accounting",
  ACCOUNTING_AP: "accounting",
  PAYROLL_SETTLEMENTS: "accounting",
  FINANCE: "accounting",
  SALES_CS: "dispatcher",
  SALES_CUSTOMER_SERVICE: "dispatcher",
  DRIVER_PORTAL: "driver",
  FLEET_OO_ADMIN_PORTAL: "owner",

  // Split Roles Pack
  DISPATCHER: "dispatcher",
};

/**
 * Returns the set of nav item IDs visible to a given role.
 * Any access level other than "none" makes the item visible.
 */
export function getVisibleNavIds(role: UserRole): NavItemId[] {
  const canonical = ROLE_MAPPING[role] ?? "driver"; // safest default
  const matrix = VISIBILITY_MATRIX[canonical];
  return (Object.entries(matrix) as [NavItemId, NavAccessLevel][])
    .filter(([, level]) => level !== "none")
    .map(([id]) => id);
}

/**
 * Returns the access level for a specific nav item and role.
 * Useful for rendering read-only indicators or restricting actions.
 */
export function getNavAccessLevel(
  role: UserRole,
  navId: NavItemId,
): NavAccessLevel {
  const canonical = ROLE_MAPPING[role] ?? "driver";
  return VISIBILITY_MATRIX[canonical][navId] ?? "none";
}

/**
 * Returns true if the given role should see the nav item.
 */
export function isNavItemVisible(role: UserRole, navId: string): boolean {
  const canonical = ROLE_MAPPING[role] ?? "driver";
  const matrix = VISIBILITY_MATRIX[canonical];
  const level = matrix[navId as NavItemId];
  return level !== undefined && level !== "none";
}
