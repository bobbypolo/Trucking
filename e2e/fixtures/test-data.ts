/**
 * E2E Test Data Fixtures — Phase 6: R-P6-01
 *
 * Provides test data for E2E tests: users, loads, documents.
 * Loaded from environment variables in CI; uses dev defaults locally.
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
};

export const apiBase = process.env.E2E_API_URL || "http://localhost:3001";
export const appBase = process.env.E2E_APP_URL || "http://localhost:5173";
