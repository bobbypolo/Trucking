/**
 * Canonical E2E URL constants — single source of truth.
 * All spec files should import from here instead of defining their own.
 */
export const API_BASE = process.env.E2E_API_URL || "http://localhost:5000";
export const APP_BASE = process.env.E2E_APP_URL || "http://localhost:3101";
