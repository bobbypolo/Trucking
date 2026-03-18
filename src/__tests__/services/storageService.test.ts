// Tests R-P4-01, R-P4-02, R-P4-03, R-P4-04
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock authService BEFORE importing storageService
vi.mock("../../../services/authService", () => ({
  getCompany: vi.fn(),
  updateCompany: vi.fn(),
  getStoredUsers: vi.fn().mockReturnValue([]),
  getAuthHeaders: vi.fn().mockResolvedValue({}),
  getCurrentUser: vi.fn(),
}));

// Mock firebase and other heavy deps
vi.mock("../../../services/firebase", () => ({
  storage: {},
  DEMO_MODE: false,
}));
vi.mock("firebase/storage", () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));
vi.mock("../../../services/brokerService", () => ({
  getBrokers: vi.fn().mockResolvedValue([]),
}));
vi.mock("jspdf", () => ({ jsPDF: vi.fn() }));
vi.mock("jspdf-autotable", () => ({ default: vi.fn() }));
vi.mock("../../../services/dispatchIntelligence", () => ({
  DispatchIntelligence: vi.fn(),
}));
vi.mock("../../../services/loadService", () => ({
  fetchLoads: vi.fn().mockResolvedValue([]),
  createLoad: vi.fn().mockResolvedValue({}),
  updateLoadStatusApi: vi.fn().mockResolvedValue({}),
  searchLoadsApi: vi.fn().mockResolvedValue([]),
}));

import { getTenantKey } from "../../../services/storageService";
import { getCurrentUser } from "../../../services/authService";

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;

describe("getTenantKey — tenant isolation (R-P4-02, R-P4-04)", () => {
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    localStorageMock = {};
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(
      (key: string) => localStorageMock[key] ?? null,
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(
      (key: string, value: string) => {
        localStorageMock[key] = value;
      },
    );
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(
      (key: string) => {
        delete localStorageMock[key];
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generates tenant-scoped key when companyId is available", () => {
    mockGetCurrentUser.mockReturnValue({ companyId: "acme-corp" });
    const key = getTenantKey("incidents_v1");
    expect(key).toBe("loadpilot_acme-corp_incidents_v1");
  });

  it("falls back to legacy key when companyId is unavailable (graceful degradation)", () => {
    mockGetCurrentUser.mockReturnValue(null);
    const key = getTenantKey("incidents_v1");
    expect(key).toBe("loadpilot_incidents_v1");
  });

  it("cross-tenant isolation: different companyIds produce different keys", () => {
    mockGetCurrentUser.mockReturnValue({ companyId: "tenant-a" });
    const keyA = getTenantKey("calls_v1");

    mockGetCurrentUser.mockReturnValue({ companyId: "tenant-b" });
    const keyB = getTenantKey("calls_v1");

    expect(keyA).not.toBe(keyB);
    expect(keyA).toContain("tenant-a");
    expect(keyB).toContain("tenant-b");
  });

  it("migrates legacy key data to tenant key on first access (R-P4-03)", () => {
    // Seed legacy unprefixed key
    const legacyKey = "loadpilot_messages_v1";
    localStorageMock[legacyKey] = JSON.stringify([{ id: "msg-1" }]);

    mockGetCurrentUser.mockReturnValue({ companyId: "org-x" });
    const tenantKey = getTenantKey("messages_v1");

    // Data should be migrated to the new tenant key
    expect(localStorageMock[tenantKey]).toBe(
      JSON.stringify([{ id: "msg-1" }]),
    );
    // Legacy key should be removed after migration
    expect(localStorageMock[legacyKey]).toBeUndefined();
  });

  it("does not overwrite existing tenant data during migration", () => {
    const legacyKey = "loadpilot_requests_v1";
    const tenantKey = "loadpilot_org-y_requests_v1";
    localStorageMock[legacyKey] = JSON.stringify([{ id: "old" }]);
    localStorageMock[tenantKey] = JSON.stringify([{ id: "existing" }]);

    mockGetCurrentUser.mockReturnValue({ companyId: "org-y" });
    const result = getTenantKey("requests_v1");

    // Existing tenant data preserved, legacy key cleaned up
    expect(localStorageMock[result]).toBe(JSON.stringify([{ id: "existing" }]));
    expect(localStorageMock[legacyKey]).toBeUndefined();
  });

  it("key includes companyId prefix for correct tenant namespacing", () => {
    mockGetCurrentUser.mockReturnValue({ companyId: "company-123" });
    const key = getTenantKey("vault_docs_v1");
    expect(key).toMatch(/^loadpilot_company-123_/);
  });
});
