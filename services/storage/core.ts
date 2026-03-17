/**
 * Core localStorage utilities — tenant-scoped key management.
 * Shared by all domain storage modules.
 */
import { getCurrentUser } from "../authService";

/**
 * Tenant-scoped localStorage key builder (F-008 fix).
 *
 * Returns `loadpilot_{companyId}_{baseName}` when a companyId is available,
 * or the legacy `loadpilot_{baseName}` key as graceful degradation when no session exists.
 *
 * On first access, checks for data stored under the legacy unprefixed key and
 * migrates it to the new tenant-scoped key so existing user data is not lost.
 *
 * @param baseName - The short key name (e.g. "incidents_v1")
 */
export const getTenantKey = (baseName: string): string => {
  const companyId = getCurrentUser()?.companyId;
  const legacyKey = `loadpilot_${baseName}`;
  if (!companyId) return legacyKey; // graceful degradation — returns legacy key format
  const tenantKey = `loadpilot_${companyId}_${baseName}`;
  // Migrate legacy unprefixed key data to tenant-scoped key on first access
  migrateKey(legacyKey, tenantKey);
  return tenantKey;
};

/**
 * One-shot legacy key migration helper.
 * Copies data from `legacyKey` to `newKey` if legacy data exists and new key is empty.
 * Removes the legacy key after a successful migration.
 */
export const migrateKey = (legacyKey: string, newKey: string): void => {
  try {
    const legacyData = localStorage.getItem(legacyKey);
    if (!legacyData) return; // nothing to migrate
    const newData = localStorage.getItem(newKey);
    if (newData) {
      // new key already has data — legacy key is stale, remove it
      localStorage.removeItem(legacyKey);
      return;
    }
    // migrate: copy legacy data to tenant key then remove old key
    localStorage.setItem(newKey, legacyData);
    localStorage.removeItem(legacyKey);
  } catch (_error: unknown) {
    // non-fatal — migration failure means data stays at legacy key
  }
};
