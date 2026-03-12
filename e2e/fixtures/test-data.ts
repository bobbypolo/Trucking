/**
 * E2E Test Data Fixtures — Phase 6: R-P6-01 / STORY-001: R-P0-01, R-P0-02
 *
 * Provides test data for E2E tests: users, loads, documents, finance, admin.
 * Loaded from environment variables in CI; uses dev defaults locally.
 *
 * Updated in STORY-001 to add entries for all 5 domains (AUTH, LOAD, ADMIN, FIN, DOC).
 */

export const testUsers = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || "admin@loadpilot.dev",
    password: process.env.E2E_ADMIN_PASSWORD || "AdminPassword123!",
    role: "admin",
  },
  dispatcher: {
    email: process.env.E2E_DISPATCHER_EMAIL || "dispatcher@loadpilot.dev",
    password: process.env.E2E_DISPATCHER_PASSWORD || "DispatcherPassword123!",
    role: "dispatcher",
  },
  driver: {
    email: process.env.E2E_DRIVER_EMAIL || "driver@loadpilot.dev",
    password: process.env.E2E_DRIVER_PASSWORD || "DriverPassword123!",
    role: "driver",
  },
};

export const testLoads = {
  draft: {
    status: "draft",
    origin: "Chicago, IL",
    destination: "Detroit, MI",
    weight: 10000,
    commodity: "Test Freight",
  },
  planned: {
    status: "planned",
    origin: "New York, NY",
    destination: "Boston, MA",
    weight: 15000,
    commodity: "Auto Parts",
  },
  dispatched: {
    status: "dispatched",
    origin: "Los Angeles, CA",
    destination: "Phoenix, AZ",
    weight: 20000,
    commodity: "Electronics",
  },
};

// ADMIN domain test data
export const testAdminData = {
  company: {
    name: "E2E Test Company",
    mc_number: "MC-999999",
    dot_number: "DOT-999999",
    address: "123 Test Ave",
    city: "Chicago",
    state: "IL",
    zip: "60601",
  },
  userInvitation: {
    email: "e2e-invite@loadpilot-test.dev",
    role: "dispatcher",
    firstName: "E2E",
    lastName: "TestUser",
  },
};

// FIN domain test data
export const testFinanceData = {
  settlement: {
    status: "pending",
    amount: 2500.0,
    currency: "USD",
    period_start: "2026-03-01",
    period_end: "2026-03-31",
  },
  invoiceItem: {
    description: "E2E Freight Invoice",
    quantity: 1,
    unit_price: 1500.0,
    category: "freight",
  },
  rateConfirmation: {
    rate: 2200.0,
    fuel_surcharge: 150.0,
    total: 2350.0,
    currency: "USD",
  },
};

// DOC domain test data
export const testDocumentData = {
  billOfLading: {
    document_type: "bill_of_lading",
    mime_type: "application/pdf",
    description: "E2E Bill of Lading",
  },
  exception: {
    exception_type: "delay",
    severity: "minor",
    description: "E2E test delay exception",
  },
  safetyRecord: {
    inspection_type: "roadside",
    result: "passed",
    notes: "E2E Safety Inspection",
  },
};

export const apiBase = process.env.E2E_API_URL || "http://localhost:5000";
export const appBase = process.env.E2E_APP_URL || "http://localhost:5173";
