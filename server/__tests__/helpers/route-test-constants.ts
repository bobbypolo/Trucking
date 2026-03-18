/**
 * Shared route test mock constants.
 *
 * Provides reusable test data objects (companies, users, loads, equipment,
 * customers) used across route test files. Keeps mock data consistent and
 * reduces duplication.
 *
 * Usage:
 *   import { TENANT_A, MOCK_USERS, makeLoadRow, makeEquipmentRow } from "../helpers/route-test-constants";
 */

// ── Tenant IDs ────────────────────────────────────────────────────────────

export const TENANT_A = "company-aaa";
export const TENANT_B = "company-bbb";

// ── Mock Users ────────────────────────────────────────────────────────────

export interface MockUser {
  uid: string;
  id: string;
  tenantId: string;
  companyId: string;
  role: string;
  email: string;
  firebaseUid: string;
  name: string;
}

export const MOCK_USERS: Record<string, MockUser> = {
  admin: {
    uid: "user-admin-1",
    id: "user-admin-1",
    tenantId: TENANT_A,
    companyId: TENANT_A,
    role: "admin",
    email: "admin@loadpilot.com",
    firebaseUid: "firebase-uid-admin-1",
    name: "Test Admin",
  },
  dispatcher: {
    uid: "user-disp-1",
    id: "user-disp-1",
    tenantId: TENANT_A,
    companyId: TENANT_A,
    role: "dispatcher",
    email: "dispatcher@loadpilot.com",
    firebaseUid: "firebase-uid-disp-1",
    name: "Test Dispatcher",
  },
  driver: {
    uid: "user-driver-1",
    id: "user-driver-1",
    tenantId: TENANT_A,
    companyId: TENANT_A,
    role: "driver",
    email: "driver@loadpilot.com",
    firebaseUid: "firebase-uid-driver-1",
    name: "Test Driver",
  },
  otherTenantAdmin: {
    uid: "user-other-1",
    id: "user-other-1",
    tenantId: TENANT_B,
    companyId: TENANT_B,
    role: "admin",
    email: "admin@other-company.com",
    firebaseUid: "firebase-uid-other-1",
    name: "Other Admin",
  },
};

// ── Mock Company ──────────────────────────────────────────────────────────

export interface MockCompany {
  id: string;
  name: string;
  account_type: string;
  email: string;
  subscription_status: string;
}

export const MOCK_COMPANIES: Record<string, MockCompany> = {
  companyA: {
    id: TENANT_A,
    name: "Test Fleet Inc.",
    account_type: "fleet",
    email: "admin@loadpilot.com",
    subscription_status: "active",
  },
  companyB: {
    id: TENANT_B,
    name: "Other Fleet LLC",
    account_type: "fleet",
    email: "admin@other-company.com",
    subscription_status: "active",
  },
};

// ── Mock Load Row Factory ─────────────────────────────────────────────────

export function makeLoadRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "load-001",
    company_id: TENANT_A,
    customer_id: "cust-1",
    driver_id: "driver-1",
    dispatcher_id: "disp-1",
    load_number: "LD-001",
    status: "draft",
    carrier_rate: 1500,
    driver_pay: 800,
    pickup_date: "2026-03-10",
    freight_type: "Dry Van",
    commodity: "Electronics",
    weight: 42000,
    container_number: null,
    container_size: null,
    chassis_number: null,
    chassis_provider: null,
    bol_number: null,
    notification_emails: "[]",
    contract_id: null,
    gps_history: "[]",
    pod_urls: "[]",
    customer_user_id: null,
    created_at: "2026-03-07T10:00:00Z",
    ...overrides,
  };
}

// ── Mock Equipment Row Factory ────────────────────────────────────────────

export function makeEquipmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "equip-001",
    company_id: TENANT_A,
    unit_number: "UNIT-001",
    type: "Truck",
    status: "Active",
    make: "Freightliner",
    model: "Cascadia",
    year: 2023,
    vin: null,
    license_plate: null,
    ...overrides,
  };
}

// ── Mock Customer Row Factory ─────────────────────────────────────────────

export function makeCustomerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "cust-1",
    company_id: TENANT_A,
    name: "Test Broker LLC",
    type: "Broker",
    email: "broker@test.com",
    phone: "555-0100",
    mc_number: "MC-123456",
    ...overrides,
  };
}

// ── Mock Stop Row Factory ─────────────────────────────────────────────────

export function makeStopRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "stop-001",
    load_id: "load-001",
    type: "pickup",
    sequence: 1,
    facility_name: "Test Warehouse",
    address: "123 Main St, Chicago, IL 60601",
    city: "Chicago",
    state: "IL",
    zip: "60601",
    scheduled_date: "2026-03-10",
    actual_date: null,
    status: "pending",
    ...overrides,
  };
}

// ── Mock Audit Entry Factory ──────────────────────────────────────────────

export function makeAuditEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "audit-001",
    company_id: TENANT_A,
    user_id: MOCK_USERS.admin.id,
    action: "load.created",
    entity_type: "load",
    entity_id: "load-001",
    details: "{}",
    created_at: "2026-03-07T10:00:00Z",
    ...overrides,
  };
}

// ── Mock Settlement Row Factory ───────────────────────────────────────────

export function makeSettlementRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "stl-001",
    company_id: TENANT_A,
    driver_id: MOCK_USERS.driver.id,
    period_start: "2026-03-01",
    period_end: "2026-03-15",
    gross_pay: 2500,
    deductions: 500,
    net_pay: 2000,
    status: "draft",
    ...overrides,
  };
}
