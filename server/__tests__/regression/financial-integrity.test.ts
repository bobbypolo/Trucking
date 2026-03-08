import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P5-01-AC2 (financial integrity)

/**
 * Financial Integrity Regression Test
 *
 * Verifies settlement calculations with known values, rounding, and precision:
 *   - DECIMAL(10,2) precision with ROUND_HALF_UP
 *   - Known-value settlement total verification
 *   - Fractional cent rounding edge cases
 *   - Net pay formula: earnings - deductions + reimbursements
 *   - Settlement immutability (posted settlements cannot be modified)
 *   - Settlement state machine transitions
 */

import {
  roundHalfUp,
  calculateSettlementTotals,
  type SettlementLineInput,
} from "../../services/settlement-calculation";
import {
  SettlementStatus,
  validateSettlementTransition,
} from "../../services/settlement-state-machine";
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "../../errors/AppError";

// --- Mock setup for settlement.service ---
const {
  mockSettlementFindLoadStatus,
  mockSettlementFindByLoadAndTenant,
  mockSettlementCreate,
  mockSettlementFindById,
  mockSettlementUpdateStatus,
} = vi.hoisted(() => ({
  mockSettlementFindLoadStatus: vi.fn(),
  mockSettlementFindByLoadAndTenant: vi.fn(),
  mockSettlementCreate: vi.fn(),
  mockSettlementFindById: vi.fn(),
  mockSettlementUpdateStatus: vi.fn(),
}));

vi.mock("../../repositories/settlement.repository", () => ({
  settlementRepository: {
    findByLoadAndTenant: (...args: unknown[]) =>
      mockSettlementFindByLoadAndTenant(...args),
    findLoadStatus: (...args: unknown[]) =>
      mockSettlementFindLoadStatus(...args),
    create: (...args: unknown[]) => mockSettlementCreate(...args),
    findById: (...args: unknown[]) => mockSettlementFindById(...args),
    updateStatus: (...args: unknown[]) => mockSettlementUpdateStatus(...args),
  },
}));

import {
  generateSettlement,
  transitionSettlement,
  updatePostedSettlement,
  deleteSettlement,
} from "../../services/settlement.service";

// --- Constants ---
const TENANT = "company-financial-001";
const DRIVER_ID = "driver-fin-001";
const LOAD_ID = "load-fin-001";
const USER_ID = "user-fin-001";

describe("R-P5-01-AC2: Financial Integrity Regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("DECIMAL(10,2) precision with ROUND_HALF_UP", () => {
    it("rounds 1.005 to 1.01 (IEEE 754 edge case)", () => {
      expect(roundHalfUp(1.005)).toBe(1.01);
    });

    it("rounds 2.345 to 2.35", () => {
      expect(roundHalfUp(2.345)).toBe(2.35);
    });

    it("rounds 0.5 correctly", () => {
      expect(roundHalfUp(0.5)).toBe(0.5);
    });

    it("handles zero", () => {
      expect(roundHalfUp(0)).toBe(0);
    });

    it("rounds negative values toward positive infinity", () => {
      expect(roundHalfUp(-1.005)).toBe(-1.0);
      expect(roundHalfUp(-2.345)).toBe(-2.34);
    });

    it("preserves exact 2-decimal values", () => {
      expect(roundHalfUp(100.0)).toBe(100.0);
      expect(roundHalfUp(1500.25)).toBe(1500.25);
      expect(roundHalfUp(0.01)).toBe(0.01);
    });
  });

  describe("Known-value settlement total verification", () => {
    it("line haul $2500 + fuel surcharge $375 + detention $125 = $3000 earnings", () => {
      const lines: SettlementLineInput[] = [
        { description: "Line Haul", amount: 2500.0, type: "earning" },
        { description: "Fuel Surcharge", amount: 375.0, type: "earning" },
        { description: "Detention", amount: 125.0, type: "earning" },
      ];

      const result = calculateSettlementTotals(lines);

      expect(result.totalEarnings).toBe(3000.0);
      expect(result.totalDeductions).toBe(0.0);
      expect(result.totalReimbursements).toBe(0.0);
      expect(result.netPay).toBe(3000.0);
    });

    it("net pay formula: earnings - deductions + reimbursements", () => {
      const lines: SettlementLineInput[] = [
        { description: "Line Haul", amount: 2000.0, type: "earning" },
        { description: "Insurance", amount: 100.0, type: "deduction" },
        { description: "Fuel Advance", amount: 300.0, type: "deduction" },
        { description: "Tolls", amount: 25.5, type: "reimbursement" },
        { description: "Lumper Fee", amount: 75.0, type: "reimbursement" },
      ];

      const result = calculateSettlementTotals(lines);

      expect(result.totalEarnings).toBe(2000.0);
      expect(result.totalDeductions).toBe(400.0);
      expect(result.totalReimbursements).toBe(100.5);
      // 2000 - 400 + 100.50 = 1700.50
      expect(result.netPay).toBe(1700.5);
    });

    it("handles empty line items", () => {
      const result = calculateSettlementTotals([]);

      expect(result.totalEarnings).toBe(0.0);
      expect(result.totalDeductions).toBe(0.0);
      expect(result.totalReimbursements).toBe(0.0);
      expect(result.netPay).toBe(0.0);
    });
  });

  describe("Fractional cent rounding edge cases", () => {
    it("rounds each line individually before aggregation", () => {
      const lines: SettlementLineInput[] = [
        { description: "Rate 1", amount: 333.335, type: "earning" },
        { description: "Rate 2", amount: 666.665, type: "earning" },
      ];

      const result = calculateSettlementTotals(lines);

      // 333.335 -> 333.34, 666.665 -> 666.67
      // Total: 333.34 + 666.67 = 1000.01
      expect(result.totalEarnings).toBe(1000.01);
      expect(result.netPay).toBe(1000.01);
    });

    it("all output values have at most 2 decimal places", () => {
      const lines: SettlementLineInput[] = [
        { description: "Odd 1", amount: 123.456, type: "earning" },
        { description: "Odd 2", amount: 78.999, type: "deduction" },
        { description: "Odd 3", amount: 12.345, type: "reimbursement" },
      ];

      const result = calculateSettlementTotals(lines);

      const decimalPlaces = (n: number) => {
        const str = n.toString();
        const dot = str.indexOf(".");
        return dot === -1 ? 0 : str.length - dot - 1;
      };

      expect(decimalPlaces(result.totalEarnings)).toBeLessThanOrEqual(2);
      expect(decimalPlaces(result.totalDeductions)).toBeLessThanOrEqual(2);
      expect(decimalPlaces(result.totalReimbursements)).toBeLessThanOrEqual(2);
      expect(decimalPlaces(result.netPay)).toBeLessThanOrEqual(2);
    });

    it("handles very small fractional amounts", () => {
      const lines: SettlementLineInput[] = [
        { description: "Micro", amount: 0.001, type: "earning" },
        { description: "Micro 2", amount: 0.004, type: "earning" },
        { description: "Micro 3", amount: 0.005, type: "earning" },
      ];

      const result = calculateSettlementTotals(lines);

      // 0.001 -> 0.00, 0.004 -> 0.00, 0.005 -> 0.01
      expect(result.totalEarnings).toBe(0.01);
    });
  });

  describe("Settlement generation financial correctness end-to-end", () => {
    it("creates settlement with correct totals passed to repository", async () => {
      mockSettlementFindLoadStatus.mockResolvedValueOnce("completed");
      mockSettlementFindByLoadAndTenant.mockResolvedValueOnce(null);
      mockSettlementCreate.mockImplementation(
        async (data: Record<string, unknown>) => ({
          ...data,
          id: "settle-fin-001",
          status: SettlementStatus.GENERATED,
        }),
      );

      await generateSettlement({
        loadId: LOAD_ID,
        driverId: DRIVER_ID,
        companyId: TENANT,
        userId: USER_ID,
        settlementDate: "2026-03-16",
        lines: [
          {
            description: "Line Haul",
            amount: 1500.0,
            type: "earning",
            loadId: LOAD_ID,
          },
          {
            description: "Fuel Surcharge",
            amount: 225.005,
            type: "earning",
            loadId: LOAD_ID,
          },
          { description: "Insurance", amount: 50.0, type: "deduction" },
          {
            description: "Toll Reimburse",
            amount: 15.255,
            type: "reimbursement",
          },
        ],
      });

      const createArg = mockSettlementCreate.mock.calls[0][0];
      // 1500.00 + 225.01 (rounded from 225.005) = 1725.01
      expect(createArg.total_earnings).toBe(1725.01);
      expect(createArg.total_deductions).toBe(50.0);
      // 15.255 -> 15.26
      expect(createArg.total_reimbursements).toBe(15.26);
      // 1725.01 - 50.00 + 15.26 = 1690.27
      expect(createArg.net_pay).toBe(1690.27);
      expect(createArg.status).toBe(SettlementStatus.GENERATED);
    });

    it("rejects settlement for non-completed load", async () => {
      for (const status of [
        "draft",
        "planned",
        "dispatched",
        "in_transit",
        "cancelled",
      ]) {
        mockSettlementFindLoadStatus.mockResolvedValueOnce(status);

        await expect(
          generateSettlement({
            loadId: LOAD_ID,
            driverId: DRIVER_ID,
            companyId: TENANT,
            userId: USER_ID,
            settlementDate: "2026-03-16",
            lines: [
              { description: "Line Haul", amount: 1500, type: "earning" },
            ],
          }),
        ).rejects.toThrow(BusinessRuleError);
      }
    });

    it("idempotent: returns existing settlement without creating duplicate", async () => {
      mockSettlementFindLoadStatus.mockResolvedValueOnce("completed");

      const existing = {
        id: "settle-existing",
        load_id: LOAD_ID,
        status: SettlementStatus.GENERATED,
        total_earnings: 1800.0,
        net_pay: 1800.0,
      };
      mockSettlementFindByLoadAndTenant.mockResolvedValueOnce(existing);

      const result = await generateSettlement({
        loadId: LOAD_ID,
        driverId: DRIVER_ID,
        companyId: TENANT,
        userId: USER_ID,
        settlementDate: "2026-03-16",
        lines: [{ description: "Line Haul", amount: 1500, type: "earning" }],
      });

      expect(result).toEqual(existing);
      expect(mockSettlementCreate).not.toHaveBeenCalled();
    });
  });

  describe("Settlement state machine transitions", () => {
    it("allows valid transitions: generated->reviewed->posted", () => {
      expect(() =>
        validateSettlementTransition(
          SettlementStatus.GENERATED,
          SettlementStatus.REVIEWED,
        ),
      ).not.toThrow();

      expect(() =>
        validateSettlementTransition(
          SettlementStatus.REVIEWED,
          SettlementStatus.POSTED,
        ),
      ).not.toThrow();
    });

    it("allows adjustment flow: generated->adjusted->reviewed", () => {
      expect(() =>
        validateSettlementTransition(
          SettlementStatus.GENERATED,
          SettlementStatus.ADJUSTED,
        ),
      ).not.toThrow();

      expect(() =>
        validateSettlementTransition(
          SettlementStatus.ADJUSTED,
          SettlementStatus.REVIEWED,
        ),
      ).not.toThrow();
    });

    it("rejects invalid transitions", () => {
      expect(() =>
        validateSettlementTransition(
          SettlementStatus.POSTED,
          SettlementStatus.GENERATED,
        ),
      ).toThrow(BusinessRuleError);

      expect(() =>
        validateSettlementTransition(
          SettlementStatus.GENERATED,
          SettlementStatus.POSTED,
        ),
      ).toThrow(BusinessRuleError);

      expect(() =>
        validateSettlementTransition(
          SettlementStatus.POSTED,
          SettlementStatus.ADJUSTED,
        ),
      ).toThrow(BusinessRuleError);
    });

    it("posted is terminal state (no outgoing transitions)", () => {
      for (const target of [
        SettlementStatus.GENERATED,
        SettlementStatus.REVIEWED,
        SettlementStatus.ADJUSTED,
        SettlementStatus.PENDING_GENERATION,
      ]) {
        expect(() =>
          validateSettlementTransition(SettlementStatus.POSTED, target),
        ).toThrow(BusinessRuleError);
      }
    });
  });

  describe("Settlement immutability enforcement", () => {
    it("posted settlements cannot be modified (403)", async () => {
      mockSettlementFindById.mockResolvedValueOnce({
        id: "settle-posted",
        company_id: TENANT,
        status: SettlementStatus.POSTED,
      });

      await expect(
        updatePostedSettlement("settle-posted", TENANT, {
          net_pay: 9999,
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it("settlements cannot be deleted (403)", async () => {
      mockSettlementFindById.mockResolvedValueOnce({
        id: "settle-delete",
        company_id: TENANT,
        status: SettlementStatus.GENERATED,
      });

      await expect(deleteSettlement("settle-delete", TENANT)).rejects.toThrow(
        ForbiddenError,
      );
    });

    it("settlement transition uses optimistic locking (409 on conflict)", async () => {
      mockSettlementFindById.mockResolvedValueOnce({
        id: "settle-lock",
        company_id: TENANT,
        status: SettlementStatus.GENERATED,
        version: 1,
      });
      // updateStatus returns null (version conflict)
      mockSettlementUpdateStatus.mockResolvedValueOnce(null);

      await expect(
        transitionSettlement({
          settlementId: "settle-lock",
          companyId: TENANT,
          newStatus: SettlementStatus.REVIEWED,
          expectedVersion: 1,
          userId: USER_ID,
        }),
      ).rejects.toThrow(ConflictError);
    });
  });
});
