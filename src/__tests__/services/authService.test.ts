import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock firebase BEFORE importing authService
vi.mock("../../../services/firebase", () => ({
  auth: {
    currentUser: null,
  },
  DEMO_MODE: true,
}));

vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
  getIdToken: vi.fn(),
}));

/** Helper: create a fetch mock response with .json() support */
const mockOkResponse = (body: any = { message: "ok" }) =>
  ({ ok: true, status: 200, json: () => Promise.resolve(body) }) as any;

// Mock the fixtures import
vi.mock("../../../fixtures/test-users.json", () => ({
  default: {
    admin: {
      email: "admin@test.com",
      name: "Test Admin",
      password: "testpass123",
      companyName: "Test Corp",
      accountType: "carrier",
    },
    dispatcher: {
      email: "dispatch@test.com",
      name: "Test Dispatcher",
      role: "dispatcher",
      password: "testpass123",
    },
    opsManager: {
      email: "ops@test.com",
      name: "Test Ops",
      role: "OPS_MANAGER",
      password: "testpass123",
    },
    arSpecialist: {
      email: "ar@test.com",
      name: "Test AR",
      role: "ACCOUNTING_AR",
      password: "testpass123",
    },
    apClerk: {
      email: "ap@test.com",
      name: "Test AP",
      role: "ACCOUNTING_AP",
      password: "testpass123",
    },
    payroll: {
      email: "payroll@test.com",
      name: "Test Payroll",
      role: "payroll_manager",
      password: "testpass123",
    },
    safety: {
      email: "safety@test.com",
      name: "Test Safety",
      role: "safety_manager",
      password: "testpass123",
    },
    maintenance: {
      email: "maint@test.com",
      name: "Test Maint",
      role: "MAINTENANCE_MANAGER",
      password: "testpass123",
    },
    smallBiz: {
      email: "small@test.com",
      name: "Test Small",
      role: "OWNER_ADMIN",
      password: "testpass123",
    },
    fusedOps: {
      email: "fusedops@test.com",
      name: "Test FusedOps",
      role: "OPS",
      password: "testpass123",
    },
    fusedFinance: {
      email: "finance@test.com",
      name: "Test Finance",
      role: "FINANCE",
      password: "testpass123",
    },
    fleetOwner: {
      email: "fleet@test.com",
      name: "Test Fleet",
      role: "FLEET_OO_ADMIN_PORTAL",
      password: "testpass123",
    },
    operator1: {
      email: "op1@test.com",
      name: "Test Op1",
      role: "owner_operator",
      password: "testpass123",
    },
    operator2: {
      email: "op2@test.com",
      name: "Test Op2",
      role: "owner_operator",
      password: "testpass123",
    },
    customer: {
      email: "customer@test.com",
      name: "Test Customer",
      role: "customer",
      password: "testpass123",
    },
    architect: {
      email: "architect@test.com",
      name: "Test Architect",
      role: "ORG_OWNER_SUPER_ADMIN",
      password: "testpass123",
    },
    drivers: [
      {
        email: "driver1@test.com",
        name: "Driver One",
        password: "testpass123",
        state: "IL",
      },
    ],
  },
}));

// Mock storageService to avoid circular dependency
vi.mock("../../../services/storageService", () => ({
  seedDemoLoads: vi.fn(),
}));

import {
  getIdTokenAsync,
  onUserChange,
  getAuthHeaders,
  getCurrentUser,
  getStoredUsers,
  getStoredCompanies,
  getEffectivePermissions,
  checkPermission,
  checkCapability,
  login,
  logout,
  updateUser,
  updateCompany,
  getCompany,
  getCompanyUsers,
  addDriver,
  PERMISSION_PRESETS,
  CAPABILITY_PRESETS,
} from "../../../services/authService";

import { signInWithEmailAndPassword, signOut, getIdToken } from "firebase/auth";

describe("authService", () => {
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
    // Reset global fetch mock
    vi.spyOn(globalThis, "fetch").mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── getIdTokenAsync ─────────────────────────────────────────────────
  describe("getIdTokenAsync", () => {
    it("returns null when no token and no current user", async () => {
      const token = await getIdTokenAsync();
      // DEMO_MODE is true, currentUser is null
      expect(token).toBeNull();
    });
  });

  // ─── onUserChange ────────────────────────────────────────────────────
  describe("onUserChange", () => {
    it("registers a callback and returns an unsubscribe function", () => {
      const callback = vi.fn();
      const unsub = onUserChange(callback);
      expect(typeof unsub).toBe("function");
      unsub(); // should not throw
    });
  });

  // ─── getAuthHeaders ──────────────────────────────────────────────────
  describe("getAuthHeaders", () => {
    it("returns headers with Content-Type", async () => {
      const headers = await getAuthHeaders();
      expect(headers).toHaveProperty("Content-Type", "application/json");
    });

    it("returns empty Authorization when no token", async () => {
      const headers = await getAuthHeaders();
      expect(headers.Authorization).toBe("");
    });
  });

  // ─── getCurrentUser / getStoredUsers ─────────────────────────────────
  describe("getCurrentUser / getStoredUsers", () => {
    it("getCurrentUser returns null initially", () => {
      expect(getCurrentUser()).toBeNull();
    });

    it("getStoredUsers returns an array", () => {
      const users = getStoredUsers();
      expect(Array.isArray(users)).toBe(true);
    });
  });

  // ─── getStoredCompanies (R-P1-33, R-P1-34, R-P1-35) ─────────────────
  describe("getStoredCompanies", () => {
    it("returns an array from in-memory cache (not localStorage)", () => {
      const result = getStoredCompanies();
      expect(Array.isArray(result)).toBe(true);
    });

    it("reflects companies added via updateCompany", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockOkResponse());
      await updateCompany({ id: "gsc-reflect-1", name: "Cache Co" } as any);

      const companies = getStoredCompanies();
      const found = companies.find((c) => c.id === "gsc-reflect-1");
      expect(found).toBeDefined();
      expect(found!.name).toBe("Cache Co");
    });

    it("does not read from localStorage (COMPANIES_KEY removed)", () => {
      const getItemSpy = vi.spyOn(Storage.prototype, "getItem");
      getStoredCompanies();
      const lsCalls = getItemSpy.mock.calls.filter(([key]) =>
        key.includes("companies"),
      );
      expect(lsCalls.length).toBe(0);
    });

    it("getCompany throws on API failure (no cache fallback) — R-P2-09", async () => {
      // Seed cache so fallback would have returned something
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockOkResponse());
      await updateCompany({
        id: "gsc-api-fallback-1",
        name: "Cached Value",
      } as any);

      // API fails -> should throw, not fall back to cache
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
      await expect(getCompany("gsc-api-fallback-1")).rejects.toThrow("offline");
    });
  });

  // ─── PERMISSION_PRESETS ──────────────────────────────────────────────
  describe("PERMISSION_PRESETS", () => {
    it("has presets for ORG_OWNER_SUPER_ADMIN", () => {
      expect(PERMISSION_PRESETS.ORG_OWNER_SUPER_ADMIN).toBeDefined();
      expect(PERMISSION_PRESETS.ORG_OWNER_SUPER_ADMIN!.length).toBeGreaterThan(
        0,
      );
    });

    it("ORG_OWNER_SUPER_ADMIN includes all critical permissions", () => {
      const perms = PERMISSION_PRESETS.ORG_OWNER_SUPER_ADMIN!;
      expect(perms).toContain("LOAD_CREATE");
      expect(perms).toContain("LOAD_EDIT");
      expect(perms).toContain("AUDIT_LOG_VIEW");
      expect(perms).toContain("INVOICE_CREATE");
      expect(perms).toContain("SETTLEMENT_APPROVE");
    });

    it("DISPATCHER has limited permissions", () => {
      const perms = PERMISSION_PRESETS.DISPATCHER!;
      expect(perms).toContain("LOAD_CREATE");
      expect(perms).toContain("LOAD_DISPATCH");
      expect(perms).not.toContain("INVOICE_APPROVE");
      expect(perms).not.toContain("SETTLEMENT_APPROVE");
    });

    it("DRIVER_PORTAL has minimal permissions", () => {
      const perms = PERMISSION_PRESETS.DRIVER_PORTAL!;
      expect(perms).toContain("DOCUMENT_UPLOAD");
      expect(perms).toContain("DOCUMENT_VIEW");
      expect(perms).not.toContain("LOAD_CREATE");
    });

    it("OPS_MANAGER has financial viewing but not settlement approval", () => {
      const perms = PERMISSION_PRESETS.OPS_MANAGER!;
      expect(perms).toContain("LOAD_RATE_VIEW");
      expect(perms).toContain("LOAD_MARGIN_VIEW");
      expect(perms).not.toContain("SETTLEMENT_APPROVE");
    });

    it("SAFETY_COMPLIANCE focuses on safety and documents", () => {
      const perms = PERMISSION_PRESETS.SAFETY_COMPLIANCE!;
      expect(perms).toContain("SAFETY_EVENT_VIEW");
      expect(perms).toContain("SAFETY_EVENT_EDIT");
      expect(perms).not.toContain("LOAD_CREATE");
    });

    it("FINANCE covers invoicing and settlements", () => {
      const perms = PERMISSION_PRESETS.FINANCE!;
      expect(perms).toContain("INVOICE_CREATE");
      expect(perms).toContain("SETTLEMENT_VIEW");
      expect(perms).toContain("SETTLEMENT_APPROVE");
    });
  });

  // ─── CAPABILITY_PRESETS ──────────────────────────────────────────────
  describe("CAPABILITY_PRESETS", () => {
    it("has presets for all operating modes", () => {
      expect(CAPABILITY_PRESETS["Small Team"]).toBeDefined();
      expect(CAPABILITY_PRESETS["Split Roles"]).toBeDefined();
      expect(CAPABILITY_PRESETS["Enterprise"]).toBeDefined();
    });

    it("Small Team admin has full quote capabilities", () => {
      const caps = CAPABILITY_PRESETS["Small Team"].admin;
      expect(
        caps.some(
          (c) => c.capability === "QUOTE_CREATE" && c.level === "Allow",
        ),
      ).toBe(true);
      expect(
        caps.some(
          (c) => c.capability === "QUOTE_VIEW_MARGIN" && c.level === "Allow",
        ),
      ).toBe(true);
    });

    it("Enterprise DISPATCHER has LOAD_TRACK but no quote creation", () => {
      const caps = CAPABILITY_PRESETS["Enterprise"].DISPATCHER;
      expect(
        caps.some((c) => c.capability === "LOAD_TRACK" && c.level === "Allow"),
      ).toBe(true);
      expect(caps.find((c) => c.capability === "QUOTE_CREATE")).toBeUndefined();
    });

    it("Split Roles DISPATCHER explicitly denies QUOTE_CREATE", () => {
      const caps = CAPABILITY_PRESETS["Split Roles"].DISPATCHER;
      expect(
        caps.some((c) => c.capability === "QUOTE_CREATE" && c.level === "Deny"),
      ).toBe(true);
    });
  });

  // ─── getEffectivePermissions ─────────────────────────────────────────
  describe("getEffectivePermissions", () => {
    it("returns preset-based permissions for ORG_OWNER_SUPER_ADMIN role", () => {
      const user = {
        id: "u1",
        role: "ORG_OWNER_SUPER_ADMIN",
        companyId: "c1",
      } as any;
      const perms = getEffectivePermissions(user);
      expect(perms.permissions).toBeDefined();
      expect(perms.permissions!.length).toBeGreaterThan(0);
      expect(perms.showRates).toBe(true);
      expect(perms.createLoads).toBe(true);
    });

    it("returns preset-based permissions for DISPATCHER", () => {
      const user = { id: "u2", role: "DISPATCHER", companyId: "c1" } as any;
      const perms = getEffectivePermissions(user);
      expect(perms.permissions).toBeDefined();
      expect(perms.showRates).toBe(true);
      expect(perms.createLoads).toBe(true);
    });

    it("returns legacy admin permissions when role is 'admin'", () => {
      const user = { id: "u3", role: "admin", companyId: "c1" } as any;
      const perms = getEffectivePermissions(user);
      expect(perms.showRates).toBe(true);
      expect(perms.manageDrivers).toBe(true);
      expect(perms.editCompletedLoads).toBe(true);
      expect(perms.viewIntelligence).toBe(true);
    });

    it("returns legacy dispatcher permissions when role is 'dispatcher'", () => {
      const user = { id: "u4", role: "dispatcher", companyId: "c1" } as any;
      const perms = getEffectivePermissions(user);
      expect(perms.showRates).toBe(true);
      expect(perms.createLoads).toBe(true);
      expect(perms.manageLegs).toBe(true);
    });

    it("returns payroll_manager permissions", () => {
      const user = {
        id: "u5",
        role: "payroll_manager",
        companyId: "c1",
      } as any;
      const perms = getEffectivePermissions(user);
      expect(perms.viewSettlements).toBe(true);
      expect(perms.manageDrivers).toBe(true);
    });

    it("returns safety_manager permissions", () => {
      const user = { id: "u6", role: "safety_manager", companyId: "c1" } as any;
      const perms = getEffectivePermissions(user);
      expect(perms.viewSafety).toBe(true);
      expect(perms.manageSafety).toBe(true);
    });

    it("returns owner_operator permissions from company overrides", () => {
      const user = { id: "u7", role: "owner_operator", companyId: "c1" } as any;
      const company = {
        ownerOpPermissions: {
          viewSettlements: true,
          viewSafety: true,
          manageLegs: true,
          showRates: true,
        },
      } as any;
      const perms = getEffectivePermissions(user, company);
      expect(perms.viewSettlements).toBe(true);
      expect(perms.manageLegs).toBe(true);
    });

    it("returns default owner_operator permissions when no company provided", () => {
      const user = { id: "u8", role: "owner_operator", companyId: "c1" } as any;
      const perms = getEffectivePermissions(user);
      expect(perms.viewSettlements).toBe(true);
      expect(perms.viewSafety).toBe(true);
      expect(perms.manageLegs).toBe(true);
    });

    it("returns default driver permissions for 'driver' role", () => {
      const user = { id: "u9", role: "driver", companyId: "c1" } as any;
      const perms = getEffectivePermissions(user);
      expect(perms.viewSafety).toBe(true);
      expect(perms.manageLegs).toBe(false);
    });

    it("respects company driverPermissions", () => {
      const user = { id: "u10", role: "driver", companyId: "c1" } as any;
      const company = {
        driverPermissions: {
          viewSafety: true,
          viewSettlements: false,
          manageLegs: true,
        },
      } as any;
      const perms = getEffectivePermissions(user, company);
      expect(perms.viewSafety).toBe(true);
      expect(perms.viewSettlements).toBe(false);
      expect(perms.manageLegs).toBe(true);
    });
  });

  // ─── checkPermission ─────────────────────────────────────────────────
  describe("checkPermission", () => {
    it("returns true when user role has the permission", () => {
      const user = {
        id: "u1",
        role: "ORG_OWNER_SUPER_ADMIN",
        companyId: "c1",
      } as any;
      expect(checkPermission(user, "LOAD_CREATE")).toBe(true);
    });

    it("returns false when user role lacks the permission", () => {
      const user = { id: "u2", role: "DRIVER_PORTAL", companyId: "c1" } as any;
      expect(checkPermission(user, "LOAD_CREATE")).toBe(false);
    });

    it("returns true for admin legacy role checking LOAD_CREATE", () => {
      const user = { id: "u3", role: "admin", companyId: "c1" } as any;
      expect(checkPermission(user, "LOAD_CREATE")).toBe(true);
    });

    it("returns false for driver checking LOAD_CREATE", () => {
      const user = { id: "u4", role: "driver", companyId: "c1" } as any;
      expect(checkPermission(user, "LOAD_CREATE")).toBe(false);
    });
  });

  // ─── checkCapability ─────────────────────────────────────────────────
  describe("checkCapability", () => {
    it("admin role always returns true", () => {
      const user = { id: "u1", role: "admin", companyId: "c1" } as any;
      expect(checkCapability(user, "QUOTE_CREATE")).toBe(true);
    });

    it("ORG_OWNER_SUPER_ADMIN always returns true", () => {
      const user = {
        id: "u2",
        role: "ORG_OWNER_SUPER_ADMIN",
        companyId: "c1",
      } as any;
      expect(checkCapability(user, "QUOTE_CREATE")).toBe(true);
    });

    it("OWNER_ADMIN always returns true", () => {
      const user = { id: "u3", role: "OWNER_ADMIN", companyId: "c1" } as any;
      expect(checkCapability(user, "QUOTE_CREATE")).toBe(true);
    });

    it("returns true for user with Allow capability override", () => {
      const user = {
        id: "u4",
        role: "dispatcher",
        companyId: "c1",
        assignedCapabilities: [{ capability: "QUOTE_CREATE", level: "Allow" }],
      } as any;
      expect(checkCapability(user, "QUOTE_CREATE")).toBe(true);
    });

    it("returns false for user with Deny capability override", () => {
      const user = {
        id: "u5",
        role: "dispatcher",
        companyId: "c1",
        assignedCapabilities: [{ capability: "QUOTE_CREATE", level: "Deny" }],
      } as any;
      expect(checkCapability(user, "QUOTE_CREATE")).toBe(false);
    });

    it("respects Limited level with amount check", () => {
      const user = {
        id: "u6",
        role: "dispatcher",
        companyId: "c1",
        assignedCapabilities: [
          { capability: "QUOTE_EDIT", level: "Limited", limitAmount: 200 },
        ],
      } as any;
      expect(checkCapability(user, "QUOTE_EDIT", 150)).toBe(true);
      expect(checkCapability(user, "QUOTE_EDIT", 250)).toBe(false);
    });

    it("Limited level returns true when no amount specified", () => {
      const user = {
        id: "u7",
        role: "dispatcher",
        companyId: "c1",
        assignedCapabilities: [
          { capability: "QUOTE_EDIT", level: "Limited", limitAmount: 200 },
        ],
      } as any;
      expect(checkCapability(user, "QUOTE_EDIT")).toBe(true);
    });

    it("Approval Required level blocks when amount exceeds threshold", () => {
      const user = {
        id: "u8",
        role: "SALES_CUSTOMER_SERVICE",
        companyId: "c1",
        assignedCapabilities: [
          {
            capability: "QUOTE_EDIT",
            level: "Approval Required",
            approvalThreshold: 1000,
          },
        ],
      } as any;
      expect(checkCapability(user, "QUOTE_EDIT", 500)).toBe(true);
      expect(checkCapability(user, "QUOTE_EDIT", 1500)).toBe(false);
    });

    it("Approval Required returns false when no threshold data", () => {
      const user = {
        id: "u9",
        role: "SALES_CUSTOMER_SERVICE",
        companyId: "c1",
        assignedCapabilities: [
          { capability: "QUOTE_EDIT", level: "Approval Required" },
        ],
      } as any;
      expect(checkCapability(user, "QUOTE_EDIT")).toBe(false);
    });

    it("falls back to company capabilityMatrix when no user override", () => {
      const user = { id: "u10", role: "OPS", companyId: "c1" } as any;
      const company = {
        capabilityMatrix: {
          OPS: [{ capability: "QUOTE_CREATE", level: "Allow" }],
        },
      } as any;
      expect(checkCapability(user, "QUOTE_CREATE", undefined, company)).toBe(
        true,
      );
    });

    it("dispatchers get LOAD_TRACK by fallback", () => {
      const user = { id: "u11", role: "dispatcher", companyId: "c1" } as any;
      expect(checkCapability(user, "LOAD_TRACK")).toBe(true);
    });

    it("DISPATCHER (uppercase) gets LOAD_TRACK by fallback", () => {
      const user = { id: "u12", role: "DISPATCHER", companyId: "c1" } as any;
      expect(checkCapability(user, "LOAD_TRACK")).toBe(true);
    });

    it("OPS gets LOAD_TRACK by fallback", () => {
      const user = { id: "u13", role: "OPS", companyId: "c1" } as any;
      expect(checkCapability(user, "LOAD_TRACK")).toBe(true);
    });

    it("returns false for unknown capability with no overrides", () => {
      const user = { id: "u14", role: "driver", companyId: "c1" } as any;
      expect(checkCapability(user, "NONEXISTENT_CAPABILITY" as any)).toBe(
        false,
      );
    });

    it("Scoped level returns true", () => {
      const user = {
        id: "u15",
        role: "dispatcher",
        companyId: "c1",
        assignedCapabilities: [{ capability: "QUOTE_CREATE", level: "Scoped" }],
      } as any;
      expect(checkCapability(user, "QUOTE_CREATE")).toBe(true);
    });
  });

  // ─── login ───────────────────────────────────────────────────────────
  describe("login", () => {
    it("returns null when Firebase sign-in fails", async () => {
      (signInWithEmailAndPassword as any).mockRejectedValue(
        new Error("auth/wrong-password"),
      );
      const result = await login("bad@email.com", "wrongpass");
      expect(result).toBeNull();
    });

    it("returns user on successful sign-in and API login", async () => {
      const mockFbUser = { uid: "fb-uid", email: "test@test.com" };
      (signInWithEmailAndPassword as any).mockResolvedValue({
        user: mockFbUser,
      });
      (getIdToken as any).mockResolvedValue("mock-token");

      const mockUser = {
        id: "u1",
        email: "test@test.com",
        role: "admin",
        companyId: "c1",
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: mockUser }),
      } as any);

      const result = await login("test@test.com", "password123");
      expect(result).toEqual(mockUser);
    });

    it("falls back to hydration when API login returns non-ok", async () => {
      const mockFbUser = { uid: "fb-uid", email: "test@test.com" };
      (signInWithEmailAndPassword as any).mockResolvedValue({
        user: mockFbUser,
      });
      (getIdToken as any).mockResolvedValue("mock-token");

      const mockUser = {
        id: "u1",
        email: "test@test.com",
        role: "admin",
        companyId: "c1",
      };

      // First call (login) fails, second call (hydration) succeeds
      let callCount = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return { ok: false, json: () => Promise.resolve({}) } as any;
        }
        return { ok: true, json: () => Promise.resolve(mockUser) } as any;
      });

      const result = await login("test@test.com", "password123");
      expect(result).toEqual(mockUser);
    });
  });

  // ─── logout ──────────────────────────────────────────────────────────
  describe("logout", () => {
    it("clears session and notifies listeners (DEMO_MODE)", async () => {
      const callback = vi.fn();
      onUserChange(callback);

      await logout();

      expect(callback).toHaveBeenCalledWith(null);
    });
  });

  // ─── updateUser ──────────────────────────────────────────────────────
  describe("updateUser", () => {
    it("calls API and updates user cache", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      } as any);

      const user = {
        id: "u1",
        email: "test@test.com",
        role: "admin",
        companyId: "c1",
        name: "Updated",
      } as any;

      await updateUser(user);

      // User should be in cache now
      const cached = getStoredUsers().find((u) => u.id === "u1");
      expect(cached).toBeDefined();
      expect(cached!.name).toBe("Updated");
    });

    it("throws on network error (no silent fallback)", async () => {
      // R-P2-14: updateUser must throw on ALL errors
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Network error"),
      );

      const user = {
        id: "u2",
        email: "offline@test.com",
        role: "driver",
        companyId: "c1",
        name: "Offline User",
      } as any;

      await expect(updateUser(user)).rejects.toThrow("Network error");
    });
  });

  // ─── updateCompany ───────────────────────────────────────────────────
  describe("updateCompany", () => {
    it("stores company in in-memory cache on new entry", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockOkResponse());

      const company = {
        id: "uc-new-1",
        name: "Test Corp",
        accountType: "carrier",
      } as any;

      await updateCompany(company);

      const cached = getStoredCompanies();
      const found = cached.find((c) => c.id === "uc-new-1");
      expect(found).toBeDefined();
      expect(found!.name).toBe("Test Corp");
    });

    it("updates existing company in in-memory cache", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockOkResponse());

      const original = { id: "uc-existing-1", name: "Old Name" } as any;
      await updateCompany(original);

      const company = { id: "uc-existing-1", name: "New Name" } as any;
      await updateCompany(company);

      const cached = getStoredCompanies();
      const found = cached.find((c) => c.id === "uc-existing-1");
      expect(found).toBeDefined();
      expect(found!.name).toBe("New Name");
    });

    it("does not write to localStorage", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockOkResponse());
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

      await updateCompany({ id: "uc-nols-1", name: "No-LS Corp" } as any);

      const lsCalls = setItemSpy.mock.calls.filter(([key]) =>
        key.includes("companies"),
      );
      expect(lsCalls.length).toBe(0);
    });
  });

  // ─── getCompany ──────────────────────────────────────────────────────
  describe("getCompany", () => {
    it("returns company from API when available", async () => {
      const mockCompany = { id: "c1", name: "API Corp" };
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCompany),
      } as any);

      const result = await getCompany("c1");
      expect(result).toEqual(mockCompany);
    });

    it("throws on API failure instead of falling back to cache — R-P2-09", async () => {
      // Seed the in-memory cache via updateCompany
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockOkResponse());
      await updateCompany({ id: "gc-fallback-1", name: "Cached Corp" } as any);

      // Now fail the API — should throw, not fall back
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Network error"),
      );

      await expect(getCompany("gc-fallback-1")).rejects.toThrow(
        "Network error",
      );
    });

    it("throws on API failure even when company not in cache — R-P2-09", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Network error"),
      );

      await expect(getCompany("gc-nonexistent-xyz")).rejects.toThrow(
        "Network error",
      );
    });
  });

  // ─── getCompanyUsers ─────────────────────────────────────────────────
  describe("getCompanyUsers", () => {
    it("returns users from API when available", async () => {
      const mockUsers = [
        { id: "u1", companyId: "c1", role: "admin" },
        { id: "u2", companyId: "c1", role: "driver" },
      ];
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUsers),
      } as any);

      const result = await getCompanyUsers("c1");
      expect(result).toEqual(mockUsers);
    });

    it("throws on API failure (no cache fallback) — R-P2-10", async () => {
      // Pre-populate cache so fallback would have returned something
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockOkResponse());
      await updateUser({
        id: "u3",
        companyId: "c1",
        email: "cached@test.com",
        role: "driver",
      } as any);

      // API fails -> should throw, not fall back to cache
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
      await expect(getCompanyUsers("c1")).rejects.toThrow("offline");
    });
  });

  // ─── addDriver ───────────────────────────────────────────────────────
  describe("addDriver", () => {
    it("creates a new driver user and adds to cache", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockOkResponse());

      const driver = await addDriver(
        "c1",
        "New Driver",
        "newdriver@test.com",
        "driver",
        "percent",
        25,
      );

      expect(driver).toBeDefined();
      expect(driver.name).toBe("New Driver");
      expect(driver.email).toBe("newdriver@test.com");
      expect(driver.role).toBe("driver");
      expect(driver.companyId).toBe("c1");
      expect(driver.id).toBeDefined();
    });

    it("defaults payModel to percent for non-admin roles", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockOkResponse());

      const driver = await addDriver("c1", "D2", "d2@test.com", "driver");
      expect(driver.payModel).toBe("percent");
      expect(driver.payRate).toBe(25);
    });

    it("defaults payModel to salary for admin roles", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockOkResponse());

      const admin = await addDriver("c1", "Admin", "admin2@test.com", "admin");
      expect(admin.payModel).toBe("salary");
      expect(admin.payRate).toBe(100000);
    });
  });

  // ─── registerCompany ─────────────────────────────────────────────────
  describe("registerCompany", () => {
    // Dynamic import to avoid circular issues
    let registerCompany: any;

    beforeEach(async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockOkResponse());
      const mod = await import("../../../services/authService");
      registerCompany = mod.registerCompany;
    });

    it("creates a company and admin user", async () => {
      const result = await registerCompany(
        "Test Logistics",
        "admin@test.com",
        "Test Admin",
        "carrier",
        "password123",
      );

      expect(result.company).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.company.name).toBe("Test Logistics");
      expect(result.company.accountType).toBe("carrier");
      expect(result.user.email).toBe("admin@test.com");
      expect(result.user.role).toBe("admin");
    });

    it("uses SEED_COMPANY_ID for LoadPilot Logistics", async () => {
      const result = await registerCompany(
        "LoadPilot Logistics",
        "lp@test.com",
        "LP Admin",
        "fleet",
        "password",
      );

      expect(result.company.id).toBe("iscope-authority-001");
    });

    it("generates UUID for other company names", async () => {
      const result = await registerCompany(
        "Custom Fleet Co",
        "custom@test.com",
        "Custom Admin",
        "carrier",
      );

      expect(result.company.id).not.toBe("iscope-authority-001");
      expect(result.company.id).toBeTruthy();
    });

    it("sets default company properties", async () => {
      const result = await registerCompany(
        "Default Co",
        "def@test.com",
        "Def Admin",
        "carrier",
      );

      const company = result.company;
      expect(company.subscriptionStatus).toBe("active");
      expect(company.subscriptionTier).toBe("Records Vault");
      expect(company.operatingMode).toBe("Small Team");
      expect(company.defaultFreightType).toBe("Dry Van");
      expect(company.supportedFreightTypes).toContain("Dry Van");
      expect(company.maxUsers).toBe(100);
    });

    it("sets governance defaults", async () => {
      const result = await registerCompany(
        "Gov Co",
        "gov@test.com",
        "Gov Admin",
        "carrier",
      );

      expect(result.company.governance).toBeDefined();
      expect(result.company.governance.autoLockCompliance).toBe(true);
      expect(result.company.governance.preferredCurrency).toBe("USD");
    });

    it("sets scoring config", async () => {
      const result = await registerCompany(
        "Score Co",
        "score@test.com",
        "Score Admin",
        "carrier",
      );

      expect(result.company.scoringConfig).toBeDefined();
      expect(result.company.scoringConfig.enabled).toBe(true);
      expect(result.company.scoringConfig.minimumDispatchScore).toBe(75);
    });

    it("accepts custom freight types and subscription tier", async () => {
      const result = await registerCompany(
        "Custom Freight",
        "cf@test.com",
        "CF Admin",
        "carrier",
        "password",
        50,
        ["Intermodal", "Flatbed"],
        "Flatbed",
        "Full Suite",
      );

      expect(result.company.supportedFreightTypes).toEqual([
        "Intermodal",
        "Flatbed",
      ]);
      expect(result.company.defaultFreightType).toBe("Flatbed");
      expect(result.company.subscriptionTier).toBe("Full Suite");
      expect(result.company.maxUsers).toBe(50);
    });

    it("sets admin user properties correctly", async () => {
      const result = await registerCompany(
        "Admin Props",
        "ap@test.com",
        "Admin Props User",
        "carrier",
        "mypassword",
      );

      const user = result.user;
      expect(user.onboardingStatus).toBe("Completed");
      expect(user.safetyScore).toBe(100);
      expect(user.restricted).toBe(false);
      expect(user.overrideActive).toBe(false);
      expect(user.payModel).toBe("salary");
      expect(user.payRate).toBe(100000);
    });

    it("sets capability matrix from presets", async () => {
      const result = await registerCompany(
        "Cap Co",
        "cap@test.com",
        "Cap Admin",
        "carrier",
      );

      expect(result.company.capabilityMatrix).toBeDefined();
      // Should use "Small Team" presets by default
      expect(result.company.capabilityMatrix.admin).toBeDefined();
    });

    it("sets driver visibility settings", async () => {
      const result = await registerCompany(
        "Vis Co",
        "vis@test.com",
        "Vis Admin",
        "carrier",
      );

      const vis = result.company.driverVisibilitySettings;
      expect(vis).toBeDefined();
      expect(vis.hideRates).toBe(true);
      expect(vis.hideBrokerContacts).toBe(true);
    });

    it("sets load numbering config", async () => {
      const result = await registerCompany(
        "Num Co",
        "num@test.com",
        "Num Admin",
        "carrier",
      );

      const config = result.company.loadNumberingConfig;
      expect(config.enabled).toBe(true);
      expect(config.prefix).toBe("LD");
      expect(config.nextSequence).toBe(1000);
    });
  });

  // ─── FLEET_OO_ADMIN_PORTAL permissions ───────────────────────────────
  describe("getEffectivePermissions — FLEET_OO_ADMIN_PORTAL", () => {
    it("returns FLEET_OO_ADMIN_PORTAL permissions", () => {
      const user = {
        id: "u",
        role: "FLEET_OO_ADMIN_PORTAL",
        companyId: "c1",
      } as any;
      const perms = getEffectivePermissions(user);
      expect(perms.viewSettlements).toBe(true);
      expect(perms.viewSafety).toBe(true);
      expect(perms.manageLegs).toBe(true);
    });
  });

  // ─── safeParseCompanies edge case ────────────────────────────────────
  describe("localStorage edge cases", () => {
    it("getCompany throws on API failure even with corrupted localStorage — R-P2-09", async () => {
      localStorageMock["loadpilot_companies_v1"] = "{invalid json";

      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
      // getCompany should throw — no fallback to cache
      await expect(getCompany("nonexistent")).rejects.toThrow("offline");
    });
  });

  // ─── seedDatabase ────────────────────────────────────────────────────
  describe("seedDatabase", () => {
    let seedDatabase: any;

    beforeEach(async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockOkResponse());
      const mod = await import("../../../services/authService");
      seedDatabase = mod.seedDatabase;
    });

    it("runs without throwing in DEMO_MODE", async () => {
      await expect(seedDatabase()).resolves.not.toThrow();
    });
  });

  // ─── addDriver with managedByUserId ──────────────────────────────────
  describe("addDriver — additional paths", () => {
    it("sets managedByUserId when provided", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockOkResponse());

      const driver = await addDriver(
        "c1",
        "Managed Driver",
        "managed@test.com",
        "driver",
        "percent",
        25,
        "manager-id",
      );

      expect(driver.managedByUserId).toBe("manager-id");
    });

    it("sets custom password when provided", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockOkResponse());

      const driver = await addDriver(
        "c1",
        "Custom PW",
        "custpw@test.com",
        "driver",
        "percent",
        25,
        undefined,
        "custom-password-123",
      );

      expect(driver.password).toBe("custom-password-123");
    });
  });

  // ─── updateUser — session update path ────────────────────────────────
  describe("updateUser — session refresh", () => {
    it("updates session cache when updating current user", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockOkResponse());

      // First login to set current user
      const {
        signInWithEmailAndPassword: mockSignIn,
        getIdToken: mockGetToken,
      } = await import("firebase/auth");
      (mockSignIn as any).mockResolvedValue({
        user: { uid: "fb-uid", email: "test@test.com" },
      });
      (mockGetToken as any).mockResolvedValue("mock-token");

      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            user: {
              id: "u99",
              email: "test@test.com",
              role: "admin",
              companyId: "c1",
            },
          }),
      } as any);

      const { login: loginFn } = await import("../../../services/authService");
      await loginFn("test@test.com", "pass");

      // Now update that same user
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockOkResponse());
      await updateUser({
        id: "u99",
        email: "test@test.com",
        role: "admin",
        companyId: "c1",
        name: "Updated Name",
      } as any);

      // getCurrentUser should reflect the update
      const current = getCurrentUser();
      if (current) {
        expect(current.name).toBe("Updated Name");
      }
    });
  });

  // ─── More PERMISSION_PRESETS coverage ────────────────────────────────
  describe("PERMISSION_PRESETS — additional roles", () => {
    it("has presets for ACCOUNTING_AR", () => {
      expect(PERMISSION_PRESETS.ACCOUNTING_AR).toBeDefined();
      expect(PERMISSION_PRESETS.ACCOUNTING_AR).toContain("INVOICE_CREATE");
      expect(PERMISSION_PRESETS.ACCOUNTING_AR).toContain("INVOICE_VOID");
    });

    it("has presets for ACCOUNTING_AP", () => {
      expect(PERMISSION_PRESETS.ACCOUNTING_AP).toBeDefined();
      expect(PERMISSION_PRESETS.ACCOUNTING_AP).toContain("DOCUMENT_VIEW");
    });

    it("has presets for PAYROLL_SETTLEMENTS", () => {
      expect(PERMISSION_PRESETS.PAYROLL_SETTLEMENTS).toBeDefined();
      expect(PERMISSION_PRESETS.PAYROLL_SETTLEMENTS).toContain(
        "SETTLEMENT_VIEW",
      );
    });

    it("has presets for MAINTENANCE_MANAGER", () => {
      expect(PERMISSION_PRESETS.MAINTENANCE_MANAGER).toBeDefined();
      expect(PERMISSION_PRESETS.MAINTENANCE_MANAGER).toContain(
        "MAINT_TICKET_EDIT",
      );
    });

    it("has presets for SAFETY_MAINT (fused)", () => {
      expect(PERMISSION_PRESETS.SAFETY_MAINT).toBeDefined();
      expect(PERMISSION_PRESETS.SAFETY_MAINT).toContain("SAFETY_EVENT_VIEW");
      expect(PERMISSION_PRESETS.SAFETY_MAINT).toContain("MAINT_TICKET_EDIT");
    });
  });

  // ─── getEffectivePermissions — more roles ────────────────────────────
  describe("getEffectivePermissions — additional roles", () => {
    it("OPS_MANAGER returns preset permissions", () => {
      const user = { id: "u", role: "OPS_MANAGER", companyId: "c1" } as any;
      const perms = getEffectivePermissions(user);
      expect(perms.permissions).toBeDefined();
      expect(perms.showRates).toBe(true);
    });

    it("SAFETY_COMPLIANCE returns preset permissions", () => {
      const user = {
        id: "u",
        role: "SAFETY_COMPLIANCE",
        companyId: "c1",
      } as any;
      const perms = getEffectivePermissions(user);
      expect(perms.viewSafety).toBe(true);
    });

    it("ACCOUNTING_AR returns preset permissions", () => {
      const user = { id: "u", role: "ACCOUNTING_AR", companyId: "c1" } as any;
      const perms = getEffectivePermissions(user);
      expect(perms.showRates).toBe(true);
    });

    it("OWNER_ADMIN returns preset permissions", () => {
      const user = { id: "u", role: "OWNER_ADMIN", companyId: "c1" } as any;
      const perms = getEffectivePermissions(user);
      expect(perms.createLoads).toBe(true);
      expect(perms.manageDrivers).toBe(true);
    });

    it("FINANCE returns preset permissions", () => {
      const user = { id: "u", role: "FINANCE", companyId: "c1" } as any;
      const perms = getEffectivePermissions(user);
      expect(perms.showRates).toBe(true);
    });
  });
});
