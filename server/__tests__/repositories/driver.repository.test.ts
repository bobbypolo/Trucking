import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P2-03-AC1

// --- Mock setup (hoisted so vi.mock factory can reference them) ---
const { mockQuery } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  return { mockQuery };
});

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
  },
}));

import { driverRepository } from "../../repositories/driver.repository";

// --- Constants ---
const COMPANY_A = "company-aaa";
const COMPANY_B = "company-bbb";

const makeDriverRow = (overrides: Record<string, unknown> = {}) => ({
  id: "driver-001",
  company_id: COMPANY_A,
  email: "driver1@test.com",
  name: "John Doe",
  role: "driver",
  compliance_status: "Eligible",
  version: 1,
  ...overrides,
});

describe("R-P2-03: Driver Repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: findById — tenant-scoped driver lookup", () => {
    it("returns driver when id and companyId match", async () => {
      const driverRow = makeDriverRow();
      mockQuery.mockResolvedValueOnce([[driverRow], []]);

      const result = await driverRepository.findById("driver-001", COMPANY_A);

      expect(result).not.toBeNull();
      expect(result!.id).toBe("driver-001");
      expect(result!.company_id).toBe(COMPANY_A);
    });

    it("returns null when driver belongs to different tenant", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      const result = await driverRepository.findById("driver-001", COMPANY_B);

      expect(result).toBeNull();

      // Verify both id AND company_id are in the WHERE clause
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("?");
      expect(params).toContain("driver-001");
      expect(params).toContain(COMPANY_B);
    });

    it("returns null when driver does not exist", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      const result = await driverRepository.findById("nonexistent", COMPANY_A);

      expect(result).toBeNull();
    });

    it("uses parameterized query (no string interpolation)", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      await driverRepository.findById("driver-001", COMPANY_A);

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).not.toContain("driver-001");
      expect(sql).not.toContain(COMPANY_A);
      expect(sql).toContain("?");
      expect(params).toContain("driver-001");
      expect(params).toContain(COMPANY_A);
    });

    it("queries the users table with driver role filter", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      await driverRepository.findById("driver-001", COMPANY_A);

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("users");
      expect(sql).toContain("company_id");
    });
  });

  describe("AC1: findByCompany — tenant-scoped listing", () => {
    it("returns all drivers for a company", async () => {
      const drivers = [
        makeDriverRow({ id: "driver-001" }),
        makeDriverRow({ id: "driver-002", name: "Jane Smith" }),
      ];
      mockQuery.mockResolvedValueOnce([drivers, []]);

      const result = await driverRepository.findByCompany(COMPANY_A);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("driver-001");
      expect(result[1].id).toBe("driver-002");
    });

    it("returns empty array when company has no drivers", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      const result = await driverRepository.findByCompany("company-empty");

      expect(result).toHaveLength(0);
    });

    it("uses parameterized query for company_id", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      await driverRepository.findByCompany(COMPANY_A);

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).not.toContain(COMPANY_A);
      expect(sql).toContain("?");
      expect(params).toContain(COMPANY_A);
    });
  });
});
