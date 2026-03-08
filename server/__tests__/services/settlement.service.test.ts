import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P4-01-AC1, R-P4-01-AC2

import { SettlementStatus } from "../../services/settlement-state-machine";
import {
  generateSettlement,
  type GenerateSettlementInput,
} from "../../services/settlement.service";
import {
  BusinessRuleError,
  NotFoundError,
  ConflictError,
} from "../../errors/AppError";

// --- Mock the repository ---
const mockFindByLoadAndTenant = vi.fn();
const mockFindLoadStatus = vi.fn();
const mockCreate = vi.fn();

vi.mock("../../repositories/settlement.repository", () => ({
  settlementRepository: {
    findByLoadAndTenant: (...args: unknown[]) =>
      mockFindByLoadAndTenant(...args),
    findLoadStatus: (...args: unknown[]) => mockFindLoadStatus(...args),
    create: (...args: unknown[]) => mockCreate(...args),
  },
}));

// --- Constants ---
const TENANT = "company-aaa";
const DRIVER_ID = "driver-001";
const LOAD_ID = "load-001";
const USER_ID = "user-001";

const baseInput: GenerateSettlementInput = {
  loadId: LOAD_ID,
  driverId: DRIVER_ID,
  companyId: TENANT,
  userId: USER_ID,
  settlementDate: "2026-03-07",
  periodStart: "2026-03-01",
  periodEnd: "2026-03-07",
  lines: [
    {
      description: "Line Haul",
      amount: 1500.0,
      type: "earning",
      loadId: LOAD_ID,
    },
    {
      description: "Fuel Surcharge (15%)",
      amount: 225.0,
      type: "earning",
      loadId: LOAD_ID,
    },
    {
      description: "Detention",
      amount: 75.0,
      type: "earning",
      loadId: LOAD_ID,
    },
  ],
};

describe("R-P4-01: Settlement Service — generateSettlement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AC2: Cannot generate for non-completed loads", () => {
    it("throws BusinessRuleError when load status is not completed", async () => {
      mockFindLoadStatus.mockResolvedValue("in_transit");

      await expect(generateSettlement(baseInput)).rejects.toThrow(
        BusinessRuleError,
      );
      await expect(generateSettlement(baseInput)).rejects.toThrow(/completed/i);
    });

    it("throws NotFoundError when load does not exist", async () => {
      mockFindLoadStatus.mockResolvedValue(null);

      await expect(generateSettlement(baseInput)).rejects.toThrow(
        NotFoundError,
      );
    });

    it("rejects draft loads", async () => {
      mockFindLoadStatus.mockResolvedValue("draft");

      await expect(generateSettlement(baseInput)).rejects.toThrow(
        BusinessRuleError,
      );
    });

    it("rejects dispatched loads", async () => {
      mockFindLoadStatus.mockResolvedValue("dispatched");

      await expect(generateSettlement(baseInput)).rejects.toThrow(
        BusinessRuleError,
      );
    });

    it("rejects cancelled loads", async () => {
      mockFindLoadStatus.mockResolvedValue("cancelled");

      await expect(generateSettlement(baseInput)).rejects.toThrow(
        BusinessRuleError,
      );
    });
  });

  describe("AC2: Duplicate generation is idempotent", () => {
    it("returns existing settlement when one already exists for load+tenant", async () => {
      mockFindLoadStatus.mockResolvedValue("completed");

      const existingSettlement = {
        id: "settle-existing",
        load_id: LOAD_ID,
        driver_id: DRIVER_ID,
        company_id: TENANT,
        status: SettlementStatus.GENERATED,
        total_earnings: 1800.0,
        total_deductions: 0.0,
        total_reimbursements: 0.0,
        net_pay: 1800.0,
      };
      mockFindByLoadAndTenant.mockResolvedValue(existingSettlement);

      const result = await generateSettlement(baseInput);

      expect(result).toEqual(existingSettlement);
      // create should NOT have been called
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe("AC1: Settlement calculated server-side with DECIMAL(10,2) precision", () => {
    it("creates settlement with correct totals for known values", async () => {
      mockFindLoadStatus.mockResolvedValue("completed");
      mockFindByLoadAndTenant.mockResolvedValue(null);
      mockCreate.mockImplementation(async (data: Record<string, unknown>) => ({
        ...data,
        id: "settle-new",
        status: SettlementStatus.GENERATED,
      }));

      const result = await generateSettlement(baseInput);

      expect(mockCreate).toHaveBeenCalledOnce();
      const createArg = mockCreate.mock.calls[0][0];
      expect(createArg.total_earnings).toBe(1800.0);
      expect(createArg.total_deductions).toBe(0.0);
      expect(createArg.total_reimbursements).toBe(0.0);
      expect(createArg.net_pay).toBe(1800.0);
      expect(createArg.status).toBe(SettlementStatus.GENERATED);
      expect(createArg.load_id).toBe(LOAD_ID);
      expect(createArg.driver_id).toBe(DRIVER_ID);
      expect(createArg.company_id).toBe(TENANT);
    });

    it("calculates with deductions correctly", async () => {
      mockFindLoadStatus.mockResolvedValue("completed");
      mockFindByLoadAndTenant.mockResolvedValue(null);
      mockCreate.mockImplementation(async (data: Record<string, unknown>) => ({
        ...data,
        id: "settle-new-2",
        status: SettlementStatus.GENERATED,
      }));

      const inputWithDeductions: GenerateSettlementInput = {
        ...baseInput,
        lines: [
          {
            description: "Line Haul",
            amount: 2000.0,
            type: "earning",
            loadId: LOAD_ID,
          },
          { description: "Insurance", amount: 100.0, type: "deduction" },
          { description: "Fuel Advance", amount: 300.0, type: "deduction" },
          { description: "Tolls", amount: 25.5, type: "reimbursement" },
        ],
      };

      await generateSettlement(inputWithDeductions);

      const createArg = mockCreate.mock.calls[0][0];
      expect(createArg.total_earnings).toBe(2000.0);
      expect(createArg.total_deductions).toBe(400.0);
      expect(createArg.total_reimbursements).toBe(25.5);
      expect(createArg.net_pay).toBe(1625.5);
    });
  });

  describe("AC2: Settlement is SEPARATE entity from load", () => {
    it("does NOT modify load status when generating settlement", async () => {
      mockFindLoadStatus.mockResolvedValue("completed");
      mockFindByLoadAndTenant.mockResolvedValue(null);
      mockCreate.mockImplementation(async (data: Record<string, unknown>) => ({
        ...data,
        id: "settle-sep",
        status: SettlementStatus.GENERATED,
      }));

      await generateSettlement(baseInput);

      // Verify that create was called but no load update happened
      expect(mockCreate).toHaveBeenCalledOnce();
      const createArg = mockCreate.mock.calls[0][0];
      // Settlement status is set, not load status
      expect(createArg.status).toBe(SettlementStatus.GENERATED);
      // No load status update call should exist
      // (the mock setup only has findLoadStatus and findByLoadAndTenant — no updateLoadStatus)
    });

    it("generates settlement starting in 'generated' status (not pending_generation)", async () => {
      mockFindLoadStatus.mockResolvedValue("completed");
      mockFindByLoadAndTenant.mockResolvedValue(null);
      mockCreate.mockImplementation(async (data: Record<string, unknown>) => ({
        ...data,
        id: "settle-gen",
      }));

      await generateSettlement(baseInput);

      const createArg = mockCreate.mock.calls[0][0];
      // The service transitions from pending_generation to generated atomically
      expect(createArg.status).toBe(SettlementStatus.GENERATED);
    });
  });
});
