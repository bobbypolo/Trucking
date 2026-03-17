import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for server/lib/sql-auth.ts
 *
 * sql-auth contains:
 * - mapUserRowToApiUser: maps DB row to API shape
 * - mapCompanyRowToApiCompany: maps company DB row to API shape
 * - mapRowToPrincipal: (private) maps user row to SqlPrincipal
 * - resolveSqlPrincipalByFirebaseUid: queries users by firebase_uid
 * - linkSqlUserToFirebaseUid: links email to firebase_uid in DB
 * - findSqlUserById: queries user by id
 * - findSqlUsersByCompany: queries users by company_id
 * - findSqlCompanyById: queries company by id
 * - upsertSqlUser: upserts a user row
 * - mirrorUserToFirestore: mirrors user to Firestore (external)
 *
 * We mock pool.query (the mysql2 external dependency) and Firestore
 * (external service). These are external-dependency mocks, not DB mocks —
 * the sql-auth functions under test contain the real query logic.
 */

// Hoisted mocks for pool and firestore
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
  },
}));

// Mock firestore module for mirrorUserToFirestore
const { mockFirestoreSet } = vi.hoisted(() => ({
  mockFirestoreSet: vi.fn(),
}));

vi.mock("../../firestore", () => ({
  default: {
    collection: () => ({
      doc: () => ({
        set: mockFirestoreSet,
      }),
    }),
  },
}));

// Mock logger to prevent console output
vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import type { SqlUserRow, SqlCompanyRow, UserWriteInput } from "../../lib/sql-auth";

// Helper to create a mock SqlUserRow
function makeUserRow(overrides: Partial<Record<string, unknown>> = {}): SqlUserRow {
  return {
    id: "user-001",
    company_id: "company-abc",
    email: "test@example.com",
    name: "Test User",
    role: "admin",
    password: null,
    pay_model: null,
    pay_rate: null,
    onboarding_status: "Completed",
    safety_score: 95,
    managed_by_user_id: null,
    compliance_status: "Eligible",
    restriction_reason: null,
    primary_workspace: null,
    duty_mode: null,
    phone: null,
    firebase_uid: "fb-uid-123",
    constructor: { name: "RowDataPacket" },
    ...overrides,
  } as unknown as SqlUserRow;
}

function makeCompanyRow(overrides: Partial<Record<string, unknown>> = {}): SqlCompanyRow {
  return {
    id: "company-abc",
    name: "Test Trucking LLC",
    account_type: "fleet",
    email: "info@test.com",
    address: "123 Main St",
    city: "Dallas",
    state: "TX",
    zip: "75001",
    tax_id: "12-3456789",
    phone: "555-1234",
    mc_number: "MC-123456",
    dot_number: "DOT-789",
    subscription_status: "active",
    load_numbering_config: null,
    accessorial_rates: null,
    operating_mode: "fleet",
    constructor: { name: "RowDataPacket" },
    ...overrides,
  } as unknown as SqlCompanyRow;
}

describe("sql-auth.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("mapUserRowToApiUser", () => {
    it("maps all fields from DB row to API user object", async () => {
      const { mapUserRowToApiUser } = await import("../../lib/sql-auth");

      const row = makeUserRow({
        pay_model: "per_mile",
        pay_rate: 0.55,
        managed_by_user_id: "mgr-001",
        compliance_status: "Restricted",
        restriction_reason: "Missing CDL",
        primary_workspace: "dispatch",
        duty_mode: "on_duty",
        phone: "555-9876",
      });

      const result = mapUserRowToApiUser(row);

      expect(result.id).toBe("user-001");
      expect(result.companyId).toBe("company-abc");
      expect(result.email).toBe("test@example.com");
      expect(result.name).toBe("Test User");
      expect(result.role).toBe("admin");
      expect(result.payModel).toBe("per_mile");
      expect(result.payRate).toBe(0.55);
      expect(result.onboardingStatus).toBe("Completed");
      expect(result.safetyScore).toBe(95);
      expect(result.managedByUserId).toBe("mgr-001");
      expect(result.complianceStatus).toBe("Restricted");
      expect(result.restrictionReason).toBe("Missing CDL");
      expect(result.primaryWorkspace).toBe("dispatch");
      expect(result.dutyMode).toBe("on_duty");
      expect(result.phone).toBe("555-9876");
      expect(result.firebaseUid).toBe("fb-uid-123");
    });

    it("maps null/undefined optional fields to undefined", async () => {
      const { mapUserRowToApiUser } = await import("../../lib/sql-auth");

      const row = makeUserRow({
        pay_model: null,
        pay_rate: null,
        onboarding_status: null,
        safety_score: null,
        managed_by_user_id: null,
        compliance_status: null,
        restriction_reason: null,
        primary_workspace: null,
        duty_mode: null,
        phone: null,
        firebase_uid: null,
      });

      const result = mapUserRowToApiUser(row);

      expect(result.payModel).toBeUndefined();
      expect(result.payRate).toBeUndefined();
      expect(result.onboardingStatus).toBe("Pending");
      expect(result.safetyScore).toBe(100);
      expect(result.managedByUserId).toBeUndefined();
      expect(result.complianceStatus).toBeUndefined();
      expect(result.restrictionReason).toBeUndefined();
      expect(result.primaryWorkspace).toBeUndefined();
      expect(result.dutyMode).toBeUndefined();
      expect(result.phone).toBeUndefined();
      expect(result.firebaseUid).toBeUndefined();
    });

    it("converts pay_rate to Number", async () => {
      const { mapUserRowToApiUser } = await import("../../lib/sql-auth");

      // MySQL can return decimal strings for DECIMAL columns
      const row = makeUserRow({ pay_rate: "0.65" as unknown as number });
      const result = mapUserRowToApiUser(row);
      expect(result.payRate).toBe(0.65);
      expect(typeof result.payRate).toBe("number");
    });

    it("handles pay_rate of 0 correctly", async () => {
      const { mapUserRowToApiUser } = await import("../../lib/sql-auth");
      const row = makeUserRow({ pay_rate: 0 });
      const result = mapUserRowToApiUser(row);
      expect(result.payRate).toBe(0);
    });
  });

  describe("mapCompanyRowToApiCompany", () => {
    it("maps all company fields including dual naming convention", async () => {
      const { mapCompanyRowToApiCompany } = await import("../../lib/sql-auth");
      const row = makeCompanyRow();
      const result = mapCompanyRowToApiCompany(row);

      // snake_case aliases
      expect(result.account_type).toBe("fleet");
      expect(result.tax_id).toBe("12-3456789");
      expect(result.mc_number).toBe("MC-123456");
      expect(result.dot_number).toBe("DOT-789");
      expect(result.subscription_status).toBe("active");
      expect(result.operating_mode).toBe("fleet");

      // camelCase aliases
      expect(result.accountType).toBe("fleet");
      expect(result.taxId).toBe("12-3456789");
      expect(result.mcNumber).toBe("MC-123456");
      expect(result.dotNumber).toBe("DOT-789");
      expect(result.subscriptionStatus).toBe("active");
      expect(result.operatingMode).toBe("fleet");
    });

    it("maps null optional fields to undefined", async () => {
      const { mapCompanyRowToApiCompany } = await import("../../lib/sql-auth");
      const row = makeCompanyRow({
        account_type: null,
        email: null,
        tax_id: null,
        mc_number: null,
        dot_number: null,
        subscription_status: null,
        operating_mode: null,
      });
      const result = mapCompanyRowToApiCompany(row);

      expect(result.accountType).toBeUndefined();
      expect(result.email).toBeUndefined();
      expect(result.taxId).toBeUndefined();
      expect(result.mcNumber).toBeUndefined();
      expect(result.dotNumber).toBeUndefined();
      expect(result.subscriptionStatus).toBeUndefined();
      expect(result.operatingMode).toBeUndefined();
    });

    it("parses JSON string columns for load_numbering_config and accessorial_rates", async () => {
      const { mapCompanyRowToApiCompany } = await import("../../lib/sql-auth");
      const configObj = { prefix: "LD", nextNumber: 100 };
      const ratesObj = { detention: 75, lumper: 50 };

      const row = makeCompanyRow({
        load_numbering_config: JSON.stringify(configObj),
        accessorial_rates: JSON.stringify(ratesObj),
      });
      const result = mapCompanyRowToApiCompany(row);

      expect(result.loadNumberingConfig).toEqual(configObj);
      expect(result.accessorialRates).toEqual(ratesObj);
    });

    it("returns original value if JSON column is already an object", async () => {
      const { mapCompanyRowToApiCompany } = await import("../../lib/sql-auth");
      const configObj = { prefix: "LD" };
      const row = makeCompanyRow({
        load_numbering_config: configObj,
      });
      const result = mapCompanyRowToApiCompany(row);
      expect(result.loadNumberingConfig).toEqual(configObj);
    });

    it("returns original string if JSON parse fails", async () => {
      const { mapCompanyRowToApiCompany } = await import("../../lib/sql-auth");
      const row = makeCompanyRow({
        load_numbering_config: "not-json",
      });
      const result = mapCompanyRowToApiCompany(row);
      expect(result.loadNumberingConfig).toBe("not-json");
    });

    it("returns undefined for null JSON columns", async () => {
      const { mapCompanyRowToApiCompany } = await import("../../lib/sql-auth");
      const row = makeCompanyRow({
        load_numbering_config: null,
        accessorial_rates: null,
      });
      const result = mapCompanyRowToApiCompany(row);
      expect(result.loadNumberingConfig).toBeUndefined();
      expect(result.accessorialRates).toBeUndefined();
    });
  });

  describe("resolveSqlPrincipalByFirebaseUid", () => {
    it("returns SqlPrincipal when user found by firebase_uid", async () => {
      const { resolveSqlPrincipalByFirebaseUid } = await import("../../lib/sql-auth");

      const userRow = makeUserRow();
      mockQuery.mockResolvedValueOnce([[userRow], []]);

      const result = await resolveSqlPrincipalByFirebaseUid("fb-uid-123");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("user-001");
      expect(result!.tenantId).toBe("company-abc");
      expect(result!.companyId).toBe("company-abc");
      expect(result!.role).toBe("admin");
      expect(result!.email).toBe("test@example.com");
      expect(result!.firebaseUid).toBe("fb-uid-123");
    });

    it("returns null when no user found", async () => {
      const { resolveSqlPrincipalByFirebaseUid } = await import("../../lib/sql-auth");

      mockQuery.mockResolvedValueOnce([[], []]);

      const result = await resolveSqlPrincipalByFirebaseUid("nonexistent-uid");
      expect(result).toBeNull();
    });

    it("handles user with empty firebase_uid (maps to empty string)", async () => {
      const { resolveSqlPrincipalByFirebaseUid } = await import("../../lib/sql-auth");

      const userRow = makeUserRow({ firebase_uid: "" });
      mockQuery.mockResolvedValueOnce([[userRow], []]);

      const result = await resolveSqlPrincipalByFirebaseUid("fb-uid-123");
      expect(result).not.toBeNull();
      // empty string is falsy, so firebaseUid should be ""
      expect(result!.firebaseUid).toBe("");
    });

    it("queries with correct SQL and parameter", async () => {
      const { resolveSqlPrincipalByFirebaseUid } = await import("../../lib/sql-auth");

      mockQuery.mockResolvedValueOnce([[], []]);
      await resolveSqlPrincipalByFirebaseUid("test-uid");

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("firebase_uid = ?"),
        ["test-uid"],
      );
    });
  });

  describe("linkSqlUserToFirebaseUid", () => {
    it("returns true if user already linked (firebase_uid exists)", async () => {
      const { linkSqlUserToFirebaseUid } = await import("../../lib/sql-auth");

      // First query: check if firebase_uid already linked
      mockQuery.mockResolvedValueOnce([[makeUserRow()], []]);

      const result = await linkSqlUserToFirebaseUid("test@example.com", "fb-uid-123");
      expect(result).toBe(true);
      // Should not have called UPDATE
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it("links user by email when firebase_uid not yet assigned", async () => {
      const { linkSqlUserToFirebaseUid } = await import("../../lib/sql-auth");

      // First query: no existing link
      mockQuery.mockResolvedValueOnce([[], []]);
      // Second query: UPDATE succeeds with 1 affected row
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

      const result = await linkSqlUserToFirebaseUid("Test@Example.com", "fb-uid-456");
      expect(result).toBe(true);

      // Verify email was normalized to lowercase
      expect(mockQuery).toHaveBeenCalledTimes(2);
      const updateCall = mockQuery.mock.calls[1];
      expect(updateCall[1]).toEqual(["fb-uid-456", "test@example.com"]);
    });

    it("returns false when no matching email found", async () => {
      const { linkSqlUserToFirebaseUid } = await import("../../lib/sql-auth");

      mockQuery.mockResolvedValueOnce([[], []]);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await linkSqlUserToFirebaseUid("unknown@test.com", "fb-uid-789");
      expect(result).toBe(false);
    });

    it("trims email whitespace", async () => {
      const { linkSqlUserToFirebaseUid } = await import("../../lib/sql-auth");

      mockQuery.mockResolvedValueOnce([[], []]);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

      await linkSqlUserToFirebaseUid("  spaced@test.com  ", "fb-uid");

      const updateCall = mockQuery.mock.calls[1];
      expect(updateCall[1][1]).toBe("spaced@test.com");
    });
  });

  describe("findSqlUserById", () => {
    it("returns user row when found", async () => {
      const { findSqlUserById } = await import("../../lib/sql-auth");

      const row = makeUserRow();
      mockQuery.mockResolvedValueOnce([[row], []]);

      const result = await findSqlUserById("user-001");
      expect(result).toBe(row);
    });

    it("returns null when user not found", async () => {
      const { findSqlUserById } = await import("../../lib/sql-auth");

      mockQuery.mockResolvedValueOnce([[], []]);

      const result = await findSqlUserById("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("findSqlUsersByCompany", () => {
    it("returns all users for a company", async () => {
      const { findSqlUsersByCompany } = await import("../../lib/sql-auth");

      const rows = [
        makeUserRow({ id: "user-001", name: "Alice" }),
        makeUserRow({ id: "user-002", name: "Bob" }),
      ];
      mockQuery.mockResolvedValueOnce([rows, []]);

      const result = await findSqlUsersByCompany("company-abc");
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("user-001");
      expect(result[1].id).toBe("user-002");
    });

    it("returns empty array when company has no users", async () => {
      const { findSqlUsersByCompany } = await import("../../lib/sql-auth");

      mockQuery.mockResolvedValueOnce([[], []]);

      const result = await findSqlUsersByCompany("empty-company");
      expect(result).toEqual([]);
    });

    it("queries with company_id and orders by name ASC", async () => {
      const { findSqlUsersByCompany } = await import("../../lib/sql-auth");

      mockQuery.mockResolvedValueOnce([[], []]);
      await findSqlUsersByCompany("co-123");

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("company_id = ?"),
        ["co-123"],
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY name ASC"),
        expect.anything(),
      );
    });
  });

  describe("findSqlCompanyById", () => {
    it("returns company row when found", async () => {
      const { findSqlCompanyById } = await import("../../lib/sql-auth");

      const row = makeCompanyRow();
      mockQuery.mockResolvedValueOnce([[row], []]);

      const result = await findSqlCompanyById("company-abc");
      expect(result).toBe(row);
    });

    it("returns null when company not found", async () => {
      const { findSqlCompanyById } = await import("../../lib/sql-auth");

      mockQuery.mockResolvedValueOnce([[], []]);

      const result = await findSqlCompanyById("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("upsertSqlUser", () => {
    it("executes INSERT ... ON DUPLICATE KEY UPDATE with all fields", async () => {
      const { upsertSqlUser } = await import("../../lib/sql-auth");

      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

      const input: UserWriteInput = {
        id: "user-001",
        companyId: "company-abc",
        email: "test@example.com",
        name: "Test User",
        role: "admin",
        passwordHash: "hashed-pw",
        payModel: "per_mile",
        payRate: 0.55,
        onboardingStatus: "Completed",
        safetyScore: 95,
        managedByUserId: "mgr-001",
        complianceStatus: "Eligible",
        restrictionReason: null,
        primaryWorkspace: "dispatch",
        dutyMode: "on_duty",
        phone: "555-1234",
        firebaseUid: "fb-uid-123",
      };

      await upsertSqlUser(input);

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("INSERT INTO users");
      expect(sql).toContain("ON DUPLICATE KEY UPDATE");
      expect(params).toContain("user-001");
      expect(params).toContain("company-abc");
      expect(params).toContain("test@example.com");
      expect(params).toContain("hashed-pw");
      expect(params).toContain("per_mile");
      expect(params).toContain(0.55);
    });

    it("uses default values for optional fields when not provided", async () => {
      const { upsertSqlUser } = await import("../../lib/sql-auth");

      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

      const input: UserWriteInput = {
        id: "user-002",
        companyId: "company-abc",
        email: "min@test.com",
        name: "Minimal User",
        role: "driver",
      };

      await upsertSqlUser(input);

      const [, params] = mockQuery.mock.calls[0];
      // passwordHash → null
      expect(params[3]).toBeNull();
      // onboardingStatus → "Completed"
      expect(params[8]).toBe("Completed");
      // safetyScore → 100
      expect(params[9]).toBe(100);
      // complianceStatus → "Eligible"
      expect(params[11]).toBe("Eligible");
    });
  });

  describe("mirrorUserToFirestore", () => {
    it("mirrors user data to Firestore on success", async () => {
      const { mirrorUserToFirestore } = await import("../../lib/sql-auth");

      mockFirestoreSet.mockResolvedValueOnce(undefined);

      const input: UserWriteInput = {
        id: "user-001",
        companyId: "company-abc",
        email: "test@example.com",
        name: "Test User",
        role: "admin",
      };

      await mirrorUserToFirestore(input);

      expect(mockFirestoreSet).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "user-001",
          company_id: "company-abc",
          email: "test@example.com",
          name: "Test User",
          role: "admin",
        }),
        { merge: true },
      );
    });

    it("does not throw when Firestore write fails (logs warning)", async () => {
      const { mirrorUserToFirestore } = await import("../../lib/sql-auth");

      mockFirestoreSet.mockRejectedValueOnce(new Error("Firestore unavailable"));

      const input: UserWriteInput = {
        id: "user-002",
        companyId: "company-abc",
        email: "test@example.com",
        name: "Test User",
        role: "driver",
      };

      // Should not throw
      await expect(mirrorUserToFirestore(input)).resolves.not.toThrow();
    });

    it("uses default values for optional fields in Firestore mirror", async () => {
      const { mirrorUserToFirestore } = await import("../../lib/sql-auth");

      mockFirestoreSet.mockResolvedValueOnce(undefined);

      const input: UserWriteInput = {
        id: "user-003",
        companyId: "company-abc",
        email: "minimal@test.com",
        name: "Min",
        role: "driver",
      };

      await mirrorUserToFirestore(input);

      expect(mockFirestoreSet).toHaveBeenCalledWith(
        expect.objectContaining({
          onboarding_status: "Completed",
          safety_score: 100,
          compliance_status: "Eligible",
        }),
        { merge: true },
      );
    });
  });
});
