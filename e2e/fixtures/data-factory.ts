/**
 * E2E Data Factory — STORY-001 (R-P0-02)
 *
 * Domain-prefixed test data factory functions. Each domain uses a unique
 * prefix to prevent cross-domain test interference:
 *
 *   AUTH-   Authentication & navigation domain
 *   LOAD-   Load lifecycle & dispatch domain
 *   ADMIN-  Admin, users & organization domain
 *   FIN-    Financials & settlements domain
 *   DOC-    Documents, map & secondary ops domain
 *
 * All factory functions return plain objects suitable for use as request body
 * payloads or test data seeds. Functions that create time-unique identifiers
 * append a timestamp suffix to avoid collisions between parallel test runs.
 */

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Returns a short timestamp suffix for unique IDs within a test run. */
function ts(): string {
  return Date.now().toString(36).toUpperCase();
}

// ---------------------------------------------------------------------------
// AUTH- domain factories
// ---------------------------------------------------------------------------

/** Test user with admin role — AUTH domain. */
export function makeAuthAdminUser(overrides: Record<string, unknown> = {}) {
  return {
    email: `AUTH-admin-${ts()}@loadpilot-e2e.dev`,
    password: "AUTH-AdminPass123!",
    role: "admin",
    displayName: `AUTH-Admin-${ts()}`,
    ...overrides,
  };
}

/** Test user with dispatcher role — AUTH domain. */
export function makeAuthDispatcherUser(
  overrides: Record<string, unknown> = {},
) {
  return {
    email: `AUTH-dispatcher-${ts()}@loadpilot-e2e.dev`,
    password: "AUTH-DispatcherPass123!",
    role: "dispatcher",
    displayName: `AUTH-Dispatcher-${ts()}`,
    ...overrides,
  };
}

/** Test user with driver role — AUTH domain. */
export function makeAuthDriverUser(overrides: Record<string, unknown> = {}) {
  return {
    email: `AUTH-driver-${ts()}@loadpilot-e2e.dev`,
    password: "AUTH-DriverPass123!",
    role: "driver",
    displayName: `AUTH-Driver-${ts()}`,
    ...overrides,
  };
}

/** Auth session / token test data. */
export function makeAuthSessionData(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: `AUTH-sess-${ts()}`,
    createdAt: new Date().toISOString(),
    expiresIn: 3600,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// LOAD- domain factories
// ---------------------------------------------------------------------------

/** Draft load payload — LOAD domain. */
export function makeLoadDraft(overrides: Record<string, unknown> = {}) {
  return {
    load_number: `LOAD-DRAFT-${ts()}`,
    status: "draft",
    origin: "Chicago, IL",
    destination: "Detroit, MI",
    weight: 10000,
    commodity: "LOAD-E2E Test Freight",
    pickup_date: "2026-04-01",
    delivery_date: "2026-04-02",
    ...overrides,
  };
}

/** Planned load payload — LOAD domain. */
export function makeLoadPlanned(overrides: Record<string, unknown> = {}) {
  return {
    load_number: `LOAD-PLANNED-${ts()}`,
    status: "planned",
    origin: "New York, NY",
    destination: "Boston, MA",
    weight: 15000,
    commodity: "LOAD-E2E Auto Parts",
    pickup_date: "2026-04-03",
    delivery_date: "2026-04-04",
    ...overrides,
  };
}

/** Dispatched load payload — LOAD domain. */
export function makeLoadDispatched(overrides: Record<string, unknown> = {}) {
  return {
    load_number: `LOAD-DISPATCHED-${ts()}`,
    status: "dispatched",
    origin: "Los Angeles, CA",
    destination: "Phoenix, AZ",
    weight: 20000,
    commodity: "LOAD-E2E Electronics",
    pickup_date: "2026-04-05",
    delivery_date: "2026-04-06",
    ...overrides,
  };
}

/** Status transition payload for LOAD domain tests. */
export function makeLoadStatusTransition(
  targetStatus: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    status: targetStatus,
    transition_note: `LOAD-E2E status transition to ${targetStatus} at ${new Date().toISOString()}`,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ADMIN- domain factories
// ---------------------------------------------------------------------------

/** Company / organization record — ADMIN domain. */
export function makeAdminCompany(overrides: Record<string, unknown> = {}) {
  return {
    name: `ADMIN-TestCo-${ts()}`,
    mc_number: `ADMIN-MC${ts()}`,
    dot_number: `ADMIN-DOT${ts()}`,
    address: "123 ADMIN Test Ave",
    city: "Chicago",
    state: "IL",
    zip: "60601",
    phone: "555-ADMIN-00",
    ...overrides,
  };
}

/** User invitation payload — ADMIN domain. */
export function makeAdminUserInvitation(
  overrides: Record<string, unknown> = {},
) {
  return {
    email: `ADMIN-invite-${ts()}@loadpilot-e2e.dev`,
    role: "dispatcher",
    firstName: "ADMIN",
    lastName: `TestUser-${ts()}`,
    ...overrides,
  };
}

/** Audit log query parameters — ADMIN domain. */
export function makeAdminAuditQuery(overrides: Record<string, unknown> = {}) {
  return {
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    action: "ADMIN-E2E-AUDIT-QUERY",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// FIN- domain factories
// ---------------------------------------------------------------------------

/** Settlement record payload — FIN domain. */
export function makeFinSettlement(overrides: Record<string, unknown> = {}) {
  return {
    settlement_number: `FIN-SETTLE-${ts()}`,
    amount: 2500.0,
    currency: "USD",
    status: "pending",
    notes: "FIN-E2E Settlement Test",
    period_start: "2026-03-01",
    period_end: "2026-03-31",
    ...overrides,
  };
}

/** Invoice line item — FIN domain. */
export function makeFinInvoiceItem(overrides: Record<string, unknown> = {}) {
  return {
    description: `FIN-E2E Invoice Item ${ts()}`,
    quantity: 1,
    unit_price: 1500.0,
    total: 1500.0,
    category: "freight",
    ...overrides,
  };
}

/** Accounting entry — FIN domain. */
export function makeFinAccountingEntry(
  overrides: Record<string, unknown> = {},
) {
  return {
    reference: `FIN-ACCT-${ts()}`,
    amount: 3000.0,
    account_code: "4000",
    description: "FIN-E2E Revenue",
    entry_date: new Date().toISOString().split("T")[0],
    ...overrides,
  };
}

/** Rate confirmation data — FIN domain. */
export function makeFinRateConfirmation(
  overrides: Record<string, unknown> = {},
) {
  return {
    rate_con_number: `FIN-RC-${ts()}`,
    rate: 2200.0,
    fuel_surcharge: 150.0,
    total: 2350.0,
    currency: "USD",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// DOC- domain factories
// ---------------------------------------------------------------------------

/** Bill of lading document record — DOC domain. */
export function makeDocBillOfLading(overrides: Record<string, unknown> = {}) {
  return {
    document_number: `DOC-BOL-${ts()}`,
    document_type: "bill_of_lading",
    filename: `DOC-bol-${ts()}.pdf`,
    mime_type: "application/pdf",
    description: "DOC-E2E Bill of Lading",
    ...overrides,
  };
}

/** Exception / incident record — DOC domain. */
export function makeDocException(overrides: Record<string, unknown> = {}) {
  return {
    exception_type: "delay",
    description: `DOC-E2E Exception ${ts()}`,
    severity: "minor",
    reported_at: new Date().toISOString(),
    ...overrides,
  };
}

/** Safety / compliance record — DOC domain. */
export function makeDocSafetyRecord(overrides: Record<string, unknown> = {}) {
  return {
    inspection_type: "roadside",
    result: "passed",
    notes: `DOC-E2E Safety Inspection ${ts()}`,
    inspection_date: new Date().toISOString().split("T")[0],
    ...overrides,
  };
}

/** Scanner upload payload — DOC domain. */
export function makeDocScannerPayload(overrides: Record<string, unknown> = {}) {
  return {
    document_type: "rate_confirmation",
    source: "DOC-E2E-SCANNER",
    filename: `DOC-scan-${ts()}.jpg`,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Cross-domain test isolation helpers
// ---------------------------------------------------------------------------

/** Returns all 5 domain prefixes — used to verify prefix coverage in assertions. */
export const DOMAIN_PREFIXES = [
  "AUTH-",
  "LOAD-",
  "ADMIN-",
  "FIN-",
  "DOC-",
] as const;
export type DomainPrefix = (typeof DOMAIN_PREFIXES)[number];

/** Returns true if a string contains a valid domain prefix. */
export function hasDomainPrefix(value: string): boolean {
  return DOMAIN_PREFIXES.some((p) => value.includes(p));
}

/**
 * Extract the domain prefix from a test identifier.
 * Returns null if no known prefix found.
 */
export function extractDomainPrefix(value: string): DomainPrefix | null {
  return DOMAIN_PREFIXES.find((p) => value.includes(p)) ?? null;
}
