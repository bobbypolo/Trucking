import { useState, useEffect } from "react";
import { getCurrentUser, onUserChange } from "../services/authService";
import type { User } from "../types";

/**
 * useCurrentUser — reactive hook that subscribes to auth state changes
 * via onUserChange() from authService.
 *
 * Replaces synchronous getCurrentUser() calls in consumer components,
 * ensuring components re-render when the authenticated user changes
 * (login, logout, token refresh) without null-user crashes.
 *
 * @returns The current User or null if not authenticated.
 */
export function useCurrentUser(): User | null {
  const [user, setUser] = useState<User | null>(() => getCurrentUser());

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = onUserChange((newUser: User | null) => {
      setUser(newUser);
    });

    // Sync in case user changed between initial render and effect
    setUser(getCurrentUser());

    return unsubscribe;
  }, []);

  return user;
}
