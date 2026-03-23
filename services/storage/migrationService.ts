/**
 * Dead code — domain migration to server complete (STORY-011).
 * All domains now use server API directly. This module is a no-op stub.
 * @deprecated STORY-110: No-op stubs retained for import compatibility.
 */

export interface MigrationReport {
  domain: string;
  found: number;
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export interface MigrationSummary {
  domains: MigrationReport[];
  startedAt: string;
  completedAt: string;
  totalFound: number;
  totalImported: number;
  totalSkipped: number;
  totalFailed: number;
}

/** No local data — migration is complete. Always returns empty array. */
export function getLocalDataSummary(): {
  domain: string;
  count: number;
  key: string;
}[] {
  return [];
}

/** Migration always considered complete. */
export function isMigrationComplete(): boolean {
  return true;
}

/** No-op — migration status stored server-side. */
export function markMigrationComplete(): void {
  // no-op
}

/** No-op — nothing to export. */
export function exportDomainAsJson(_domain: string): void {
  // no-op
}

/** No-op — nothing to discard. */
export function discardDomain(_domain: string): void {
  // no-op
}

/** No-op — no local data to import. */
export async function importDomain(
  domain: string,
  _onProgress?: (imported: number, total: number) => void,
): Promise<MigrationReport> {
  return {
    domain,
    found: 0,
    imported: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };
}
