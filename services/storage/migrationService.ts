/**
 * One-time localStorage → Server migration utility.
 * STORY-011: Handles importing existing browser-stored data to server API.
 *
 * Import order (to respect foreign key dependencies):
 * 1. Contacts, Providers (no foreign dependencies)
 * 2. Leads (no foreign dependencies)
 * 3. Quotes (may reference customer_id)
 * 4. Bookings (may reference quote_id)
 * 5. Messages, Threads (may reference load_id)
 * 6. KCI Requests (reference load_id, driver_id)
 */
import { API_URL } from "../config";
import { getAuthHeaders, getCurrentUser } from "../authService";
import { getTenantKey } from "./core";

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

// Storage keys to check for existing data
const MIGRATION_DOMAINS = [
  { key: "contacts_v1", domain: "contacts", endpoint: "/api/contacts" },
  { key: "providers_v1", domain: "providers", endpoint: "/api/providers" },
  { key: "leads_v1", domain: "leads", endpoint: "/api/leads" },
  { key: "quotes_v1", domain: "quotes", endpoint: "/api/quotes" },
  { key: "bookings_v1", domain: "bookings", endpoint: "/api/bookings" },
  { key: "messages_v1", domain: "messages", endpoint: "/api/messages" },
  { key: "threads_v1", domain: "threads", endpoint: "/api/threads" },
  { key: "requests_v1", domain: "kci-requests", endpoint: "/api/kci-requests" },
  { key: "calls_v1", domain: "call-sessions", endpoint: "/api/call-sessions" },
  { key: "tasks_v1", domain: "tasks", endpoint: "/api/tasks" },
  {
    key: "work_items_v1",
    domain: "work-items",
    endpoint: "/api/work-items",
  },
  {
    key: "crisis_v1",
    domain: "crisis-actions",
    endpoint: "/api/crisis-actions",
  },
  {
    key: "service_tickets_v1",
    domain: "service-tickets",
    endpoint: "/api/service-tickets",
  },
];

/**
 * Check which localStorage domains have data that could be migrated.
 */
export function getLocalDataSummary(): {
  domain: string;
  count: number;
  key: string;
}[] {
  const results: { domain: string; count: number; key: string }[] = [];
  for (const { key, domain } of MIGRATION_DOMAINS) {
    const storageKey = getTenantKey(key);
    try {
      const data = localStorage.getItem(storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          results.push({ domain, count: parsed.length, key: storageKey });
        }
      }
    } catch {
      // Skip unparseable data
    }
  }
  return results;
}

/**
 * Check if migration has already been completed.
 */
export function isMigrationComplete(): boolean {
  return localStorage.getItem("loadpilot_migration_complete") === "true";
}

/**
 * Mark migration as complete (hides the banner permanently).
 */
export function markMigrationComplete(): void {
  localStorage.setItem("loadpilot_migration_complete", "true");
}

/**
 * Export a domain's data as a JSON file for operator inspection.
 */
export function exportDomainAsJson(domain: string): void {
  const domainConfig = MIGRATION_DOMAINS.find((d) => d.domain === domain);
  if (!domainConfig) return;

  const storageKey = getTenantKey(domainConfig.key);
  const data = localStorage.getItem(storageKey);
  if (!data) return;

  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `loadpilot_${domain}_export.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Discard a domain's localStorage data.
 */
export function discardDomain(domain: string): void {
  const domainConfig = MIGRATION_DOMAINS.find((d) => d.domain === domain);
  if (!domainConfig) return;
  const storageKey = getTenantKey(domainConfig.key);
  localStorage.removeItem(storageKey);
}

/**
 * Import a single domain's data to the server.
 * Idempotent — uses upsert-by-ID semantics server-side.
 */
export async function importDomain(
  domain: string,
  onProgress?: (imported: number, total: number) => void,
): Promise<MigrationReport> {
  const domainConfig = MIGRATION_DOMAINS.find((d) => d.domain === domain);
  if (!domainConfig) {
    return {
      domain,
      found: 0,
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: ["Unknown domain"],
    };
  }

  const storageKey = getTenantKey(domainConfig.key);
  const data = localStorage.getItem(storageKey);
  if (!data) {
    return {
      domain,
      found: 0,
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };
  }

  let items: any[];
  try {
    items = JSON.parse(data);
    if (!Array.isArray(items)) items = [];
  } catch {
    return {
      domain,
      found: 0,
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: ["Failed to parse localStorage data"],
    };
  }

  const report: MigrationReport = {
    domain,
    found: items.length,
    imported: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const headers = await getAuthHeaders();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Basic validation: must have an id
    if (!item.id) {
      report.skipped++;
      report.errors.push(`Item at index ${i}: missing id`);
      continue;
    }

    try {
      const res = await fetch(`${API_URL}${domainConfig.endpoint}`, {
        method: "POST",
        headers: {
          ...headers,
          "X-Import-Source": "local-migration",
        },
        body: JSON.stringify(item),
      });

      if (res.ok || res.status === 201 || res.status === 409) {
        // 409 = duplicate, treated as success (idempotent)
        report.imported++;
      } else {
        report.failed++;
        report.errors.push(`Item ${item.id}: server returned ${res.status}`);
      }
    } catch (error) {
      report.failed++;
      report.errors.push(
        `Item ${item.id}: ${error instanceof Error ? error.message : "network error"}`,
      );
    }

    onProgress?.(i + 1, items.length);
  }

  // Remove localStorage data for successfully imported domains
  if (report.failed === 0) {
    localStorage.removeItem(storageKey);
  }

  return report;
}
