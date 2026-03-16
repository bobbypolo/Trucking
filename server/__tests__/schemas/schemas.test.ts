import { describe, it, expect } from "vitest";
import { createLoadSchema, updateLoadStatusSchema } from "../../schemas/loads";
import { registerUserSchema, syncUserSchema } from "../../schemas/users";
import { createEquipmentSchema } from "../../schemas/equipment";
import { createSettlementSchema } from "../../schemas/settlements";

// Tests R-P1-03-AC1, R-P1-03-AC2

describe("R-P1-03: Zod Schemas", () => {
  describe("Load schemas", () => {
    it("AC1: createLoadSchema accepts a valid load payload", () => {
      const validLoad = {
        id: "load-001",
        company_id: "co-001",
        load_number: "L-1000",
        status: "Booked",
      };
      const result = createLoadSchema.safeParse(validLoad);
      expect(result.success).toBe(true);
    });

    it("AC2: createLoadSchema accepts missing company_id (derived from auth)", () => {
      // company_id is optional — server derives from auth context
      const valid = {
        id: "load-001",
        load_number: "L-1000",
        status: "Booked",
      };
      const result = createLoadSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("AC2: createLoadSchema rejects non-string load_number", () => {
      const invalid = {
        id: "load-001",
        company_id: "co-001",
        load_number: 1000,
        status: "Booked",
      };
      const result = createLoadSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("AC1: updateLoadStatusSchema accepts valid status update", () => {
      const valid = { status: "In Transit" };
      const result = updateLoadStatusSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("AC2: updateLoadStatusSchema rejects empty status", () => {
      const invalid = { status: "" };
      const result = updateLoadStatusSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("User schemas", () => {
    it("AC1: registerUserSchema accepts valid registration", () => {
      const valid = {
        email: "user@example.com",
        name: "John Doe",
        role: "driver",
        password: "securepass123",
      };
      const result = registerUserSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("AC2: registerUserSchema rejects invalid email", () => {
      const invalid = {
        email: "not-email",
        name: "John",
        role: "driver",
      };
      const result = registerUserSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("AC1: syncUserSchema accepts valid user sync payload", () => {
      const valid = {
        email: "user@example.com",
        name: "Jane Doe",
      };
      const result = syncUserSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("AC2: syncUserSchema rejects missing email", () => {
      const invalid = { name: "Jane" };
      const result = syncUserSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("Equipment schemas", () => {
    it("AC1: createEquipmentSchema accepts valid equipment", () => {
      const valid = {
        company_id: "co-001",
        unit_number: "T-100",
        type: "Tractor",
        status: "Active",
      };
      const result = createEquipmentSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("AC2: createEquipmentSchema rejects missing company_id", () => {
      const invalid = {
        unit_number: "T-100",
        type: "Tractor",
        status: "Active",
      };
      const result = createEquipmentSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("AC2: createEquipmentSchema rejects non-numeric daily_cost", () => {
      const invalid = {
        company_id: "co-001",
        unit_number: "T-100",
        type: "Tractor",
        status: "Active",
        daily_cost: "fifty",
      };
      const result = createEquipmentSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("Settlement schemas", () => {
    it("AC1: createSettlementSchema accepts valid settlement", () => {
      const valid = {
        driverId: "drv-001",
        settlementDate: "2026-03-01",
        totalEarnings: 5000,
        totalDeductions: 500,
        totalReimbursements: 100,
        netPay: 4600,
      };
      const result = createSettlementSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("AC2: createSettlementSchema rejects missing driverId", () => {
      const invalid = {
        settlementDate: "2026-03-01",
        netPay: 4600,
      };
      const result = createSettlementSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("AC2: createSettlementSchema rejects non-numeric netPay", () => {
      const invalid = {
        driverId: "drv-001",
        settlementDate: "2026-03-01",
        netPay: "four thousand",
      };
      const result = createSettlementSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
