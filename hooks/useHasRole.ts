import { useMemo } from "react";
import { useCurrentUser } from "./useCurrentUser";
import type { UserRole } from "../types";

/**
 * useHasRole — checks if the current user has one of the specified roles.
 *
 * Used by frontend components to conditionally render role-gated UI elements
 * (e.g., archive buttons, admin-only actions). This prevents drivers and
 * other restricted roles from seeing buttons that would trigger 403 errors.
 *
 * @param allowedRoles - Array of roles that are permitted for the action.
 * @returns true if the user's role is in the allowedRoles list, false otherwise.
 *
 * @example
 * const canArchive = useHasRole(["admin", "dispatcher"]);
 * {canArchive && <button onClick={handleArchive}>Archive</button>}
 */
export function useHasRole(allowedRoles: UserRole[]): boolean {
  const user = useCurrentUser();

  return useMemo(() => {
    if (!user || !user.role) return false;
    return allowedRoles.includes(user.role);
  }, [user, allowedRoles]);
}
