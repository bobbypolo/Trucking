import { describe, it, expect } from "vitest";

// Tests R-P4-01-AC1

import {
  roundHalfUp,
  calculateSettlementTotals,
  type SettlementLineInput,
} from "../../services/settlement-calculation";

describe("R-P4-01-AC1: Settlement Calculation with DECIMAL(10,2) Precision", () => {
  describe("roundHalfUp", () => {
    it("rounds 0.5 to 0.50 (already within 2 decimal places)", () => {
      expect(roundHalfUp(0.5)).toBe(0.5);
    });

    it("rounds 1.005 to 1.01 (banker's rounding edge case)", () => {
      // Standard Math.round would give 1.00 due to IEEE 754
      // ROUND_HALF_UP should give 1.01
      expect(roundHalfUp(1.005)).toBe(1.01);
    });

    it("rounds 2.345 to 2.35", () => {
      expect(roundHalfUp(2.345)).toBe(2.35);
    });

    it("leaves exact values unchanged", () => {
      expect(roundHalfUp(100.0)).toBe(100.0);
      expect(roundHalfUp(1500.0)).toBe(1500.0);
    });

    it("rounds negative values correctly with ROUND_HALF_UP", () => {
      expect(roundHalfUp(-1.005)).toBe(-1.0);
      expect(roundHalfUp(-2.345)).toBe(-2.34);
    });

    it("handles zero", () => {
      expect(roundHalfUp(0)).toBe(0);
    });
  });

  describe("calculateSettlementTotals — known-value verification", () => {
    it("calculates settlement with line haul, fuel surcharge, and detention", () => {
      // Known values from acceptance criteria:
      // Line haul $1500.00, fuel surcharge 15% = $225.00, detention $75.00, total = $1800.00
      const lines: SettlementLineInput[] = [
        {
          description: "Line Haul",
          amount: 1500.0,
          type: "earning",
          loadId: "load-001",
        },
        {
          description: "Fuel Surcharge (15%)",
          amount: 225.0,
          type: "earning",
          loadId: "load-001",
        },
        {
          description: "Detention",
          amount: 75.0,
          type: "earning",
          loadId: "load-001",
        },
      ];

      const result = calculateSettlementTotals(lines);

      expect(result.totalEarnings).toBe(1800.0);
      expect(result.totalDeductions).toBe(0.0);
      expect(result.totalReimbursements).toBe(0.0);
      expect(result.netPay).toBe(1800.0);
    });

    it("calculates settlement with earnings and deductions", () => {
      const lines: SettlementLineInput[] = [
        {
          description: "Line Haul",
          amount: 2500.0,
          type: "earning",
          loadId: "load-002",
        },
        {
          description: "Fuel Surcharge",
          amount: 375.0,
          type: "earning",
          loadId: "load-002",
        },
        {
          description: "Insurance Deduction",
          amount: 150.0,
          type: "deduction",
        },
        { description: "Fuel Advance", amount: 200.0, type: "deduction" },
      ];

      const result = calculateSettlementTotals(lines);

      expect(result.totalEarnings).toBe(2875.0);
      expect(result.totalDeductions).toBe(350.0);
      expect(result.totalReimbursements).toBe(0.0);
      expect(result.netPay).toBe(2525.0);
    });

    it("calculates settlement with earnings, deductions, and reimbursements", () => {
      const lines: SettlementLineInput[] = [
        {
          description: "Line Haul",
          amount: 3000.0,
          type: "earning",
          loadId: "load-003",
        },
        { description: "Fuel Advance", amount: 500.0, type: "deduction" },
        {
          description: "Toll Reimbursement",
          amount: 45.5,
          type: "reimbursement",
        },
        {
          description: "Lumper Reimbursement",
          amount: 75.0,
          type: "reimbursement",
        },
      ];

      const result = calculateSettlementTotals(lines);

      expect(result.totalEarnings).toBe(3000.0);
      expect(result.totalDeductions).toBe(500.0);
      expect(result.totalReimbursements).toBe(120.5);
      // netPay = earnings - deductions + reimbursements = 3000 - 500 + 120.50 = 2620.50
      expect(result.netPay).toBe(2620.5);
    });

    it("handles fractional cent rounding with ROUND_HALF_UP", () => {
      // Lines that would produce fractional cents
      const lines: SettlementLineInput[] = [
        {
          description: "Rate per mile 1",
          amount: 333.335,
          type: "earning",
          loadId: "load-004",
        },
        {
          description: "Rate per mile 2",
          amount: 666.665,
          type: "earning",
          loadId: "load-004",
        },
      ];

      const result = calculateSettlementTotals(lines);

      // Each line rounded individually: 333.34 + 666.67 = 1000.01
      expect(result.totalEarnings).toBe(1000.01);
      expect(result.netPay).toBe(1000.01);
    });

    it("handles empty lines array", () => {
      const result = calculateSettlementTotals([]);

      expect(result.totalEarnings).toBe(0.0);
      expect(result.totalDeductions).toBe(0.0);
      expect(result.totalReimbursements).toBe(0.0);
      expect(result.netPay).toBe(0.0);
    });

    it("all returned values have at most 2 decimal places", () => {
      const lines: SettlementLineInput[] = [
        {
          description: "Odd amount 1",
          amount: 123.456,
          type: "earning",
          loadId: "load-005",
        },
        { description: "Odd amount 2", amount: 78.999, type: "deduction" },
        { description: "Odd amount 3", amount: 12.345, type: "reimbursement" },
      ];

      const result = calculateSettlementTotals(lines);

      // Verify each result has max 2 decimal places
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
  });
});
