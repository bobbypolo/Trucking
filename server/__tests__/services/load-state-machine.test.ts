import { describe, it, expect } from "vitest";

// Tests R-P2-02-AC1, R-P2-02-AC2

import {
  LoadStatus,
  VALID_TRANSITIONS,
  validateTransition,
  getValidNextStatuses,
  validateDispatchGuards,
  type DispatchGuardInput,
} from "../../services/load-state-machine";
import { BusinessRuleError } from "../../errors/AppError";

// --- Constants ---
const COMPANY_A = "company-aaa";

describe("R-P2-02: Load State Machine", () => {
  describe("AC1: LoadStatus enum", () => {
    it("defines exactly 8 canonical states", () => {
      const values = Object.values(LoadStatus);
      expect(values).toHaveLength(8);
      expect(values).toContain("draft");
      expect(values).toContain("planned");
      expect(values).toContain("dispatched");
      expect(values).toContain("in_transit");
      expect(values).toContain("arrived");
      expect(values).toContain("delivered");
      expect(values).toContain("completed");
      expect(values).toContain("cancelled");
    });
  });

  describe("AC1: VALID_TRANSITIONS map", () => {
    it("defines transitions for every status", () => {
      const statuses = Object.values(LoadStatus);
      for (const status of statuses) {
        expect(VALID_TRANSITIONS).toHaveProperty(status);
      }
    });

    it("terminal states have no outgoing transitions", () => {
      expect(VALID_TRANSITIONS[LoadStatus.COMPLETED]).toEqual([]);
      expect(VALID_TRANSITIONS[LoadStatus.CANCELLED]).toEqual([]);
    });

    it("draft can transition to planned or cancelled", () => {
      expect(VALID_TRANSITIONS[LoadStatus.DRAFT]).toEqual(
        expect.arrayContaining([LoadStatus.PLANNED, LoadStatus.CANCELLED]),
      );
      expect(VALID_TRANSITIONS[LoadStatus.DRAFT]).toHaveLength(2);
    });

    it("planned can transition to dispatched or cancelled", () => {
      expect(VALID_TRANSITIONS[LoadStatus.PLANNED]).toEqual(
        expect.arrayContaining([LoadStatus.DISPATCHED, LoadStatus.CANCELLED]),
      );
      expect(VALID_TRANSITIONS[LoadStatus.PLANNED]).toHaveLength(2);
    });

    it("dispatched can transition to in_transit only", () => {
      expect(VALID_TRANSITIONS[LoadStatus.DISPATCHED]).toEqual([
        LoadStatus.IN_TRANSIT,
      ]);
    });

    it("in_transit can transition to arrived only", () => {
      expect(VALID_TRANSITIONS[LoadStatus.IN_TRANSIT]).toEqual([
        LoadStatus.ARRIVED,
      ]);
    });

    it("arrived can transition to delivered only", () => {
      expect(VALID_TRANSITIONS[LoadStatus.ARRIVED]).toEqual([
        LoadStatus.DELIVERED,
      ]);
    });

    it("delivered can transition to completed only", () => {
      expect(VALID_TRANSITIONS[LoadStatus.DELIVERED]).toEqual([
        LoadStatus.COMPLETED,
      ]);
    });
  });

  describe("AC1: validateTransition — valid transitions", () => {
    const validPairs: [LoadStatus, LoadStatus][] = [
      [LoadStatus.DRAFT, LoadStatus.PLANNED],
      [LoadStatus.PLANNED, LoadStatus.DISPATCHED],
      [LoadStatus.DISPATCHED, LoadStatus.IN_TRANSIT],
      [LoadStatus.IN_TRANSIT, LoadStatus.ARRIVED],
      [LoadStatus.ARRIVED, LoadStatus.DELIVERED],
      [LoadStatus.DELIVERED, LoadStatus.COMPLETED],
      [LoadStatus.DRAFT, LoadStatus.CANCELLED],
      [LoadStatus.PLANNED, LoadStatus.CANCELLED],
    ];

    for (const [from, to] of validPairs) {
      it(`allows transition from ${from} to ${to}`, () => {
        expect(() => validateTransition(from, to)).not.toThrow();
      });
    }
  });

  describe("AC1: validateTransition — invalid transitions throw BusinessRuleError", () => {
    const invalidPairs: [LoadStatus, LoadStatus][] = [
      // Skip states
      [LoadStatus.DRAFT, LoadStatus.DISPATCHED],
      [LoadStatus.DRAFT, LoadStatus.IN_TRANSIT],
      [LoadStatus.DRAFT, LoadStatus.ARRIVED],
      [LoadStatus.DRAFT, LoadStatus.DELIVERED],
      [LoadStatus.DRAFT, LoadStatus.COMPLETED],
      [LoadStatus.PLANNED, LoadStatus.IN_TRANSIT],
      [LoadStatus.PLANNED, LoadStatus.ARRIVED],
      [LoadStatus.PLANNED, LoadStatus.DELIVERED],
      [LoadStatus.PLANNED, LoadStatus.COMPLETED],
      [LoadStatus.DISPATCHED, LoadStatus.ARRIVED],
      [LoadStatus.DISPATCHED, LoadStatus.DELIVERED],
      [LoadStatus.DISPATCHED, LoadStatus.COMPLETED],
      [LoadStatus.IN_TRANSIT, LoadStatus.DELIVERED],
      [LoadStatus.IN_TRANSIT, LoadStatus.COMPLETED],
      [LoadStatus.ARRIVED, LoadStatus.COMPLETED],
      // Backward transitions
      [LoadStatus.PLANNED, LoadStatus.DRAFT],
      [LoadStatus.DISPATCHED, LoadStatus.DRAFT],
      [LoadStatus.DISPATCHED, LoadStatus.PLANNED],
      [LoadStatus.IN_TRANSIT, LoadStatus.DISPATCHED],
      [LoadStatus.ARRIVED, LoadStatus.IN_TRANSIT],
      [LoadStatus.DELIVERED, LoadStatus.ARRIVED],
      [LoadStatus.COMPLETED, LoadStatus.DELIVERED],
      // Terminal states
      [LoadStatus.COMPLETED, LoadStatus.DRAFT],
      [LoadStatus.COMPLETED, LoadStatus.CANCELLED],
      [LoadStatus.CANCELLED, LoadStatus.DRAFT],
      [LoadStatus.CANCELLED, LoadStatus.PLANNED],
      // Non-cancellable from certain states
      [LoadStatus.DISPATCHED, LoadStatus.CANCELLED],
      [LoadStatus.DELIVERED, LoadStatus.CANCELLED],
      // Self-transitions
      [LoadStatus.DRAFT, LoadStatus.DRAFT],
      [LoadStatus.PLANNED, LoadStatus.PLANNED],
    ];

    for (const [from, to] of invalidPairs) {
      it(`rejects transition from ${from} to ${to}`, () => {
        expect(() => validateTransition(from, to)).toThrow(BusinessRuleError);
      });
    }

    it("throws BusinessRuleError with correct error_class", () => {
      try {
        validateTransition(LoadStatus.DRAFT, LoadStatus.COMPLETED);
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(BusinessRuleError);
        const brErr = err as BusinessRuleError;
        expect(brErr.error_class).toBe("BUSINESS_RULE");
        expect(brErr.statusCode).toBe(422);
        expect(brErr.details).toHaveProperty("from", "draft");
        expect(brErr.details).toHaveProperty("to", "completed");
      }
    });
  });

  describe("AC1: getValidNextStatuses", () => {
    it("returns valid next states for draft", () => {
      const next = getValidNextStatuses(LoadStatus.DRAFT);
      expect(next).toEqual(
        expect.arrayContaining([LoadStatus.PLANNED, LoadStatus.CANCELLED]),
      );
    });

    it("returns empty array for terminal state", () => {
      expect(getValidNextStatuses(LoadStatus.COMPLETED)).toEqual([]);
      expect(getValidNextStatuses(LoadStatus.CANCELLED)).toEqual([]);
    });
  });

  describe("AC2: validateDispatchGuards — dispatch prerequisites", () => {
    const validInput: DispatchGuardInput = {
      loadId: "load-001",
      companyId: COMPANY_A,
      driverId: "driver-001",
      equipmentId: "equip-001",
      stops: [
        { type: "Pickup", completed: false },
        { type: "Dropoff", completed: false },
      ],
      driverCompanyId: COMPANY_A,
      equipmentCompanyId: COMPANY_A,
    };

    it("passes when all dispatch prerequisites are met", () => {
      expect(() => validateDispatchGuards(validInput)).not.toThrow();
    });

    it("throws when driver is not assigned", () => {
      expect(() =>
        validateDispatchGuards({ ...validInput, driverId: null }),
      ).toThrow(BusinessRuleError);
      expect(() =>
        validateDispatchGuards({ ...validInput, driverId: null }),
      ).toThrow(/driver/i);
    });

    it("throws when equipment is not assigned", () => {
      expect(() =>
        validateDispatchGuards({ ...validInput, equipmentId: null }),
      ).toThrow(BusinessRuleError);
      expect(() =>
        validateDispatchGuards({ ...validInput, equipmentId: null }),
      ).toThrow(/equipment/i);
    });

    it("throws when pickup stop is missing", () => {
      const noPickup: DispatchGuardInput = {
        ...validInput,
        stops: [{ type: "Dropoff", completed: false }],
      };
      expect(() => validateDispatchGuards(noPickup)).toThrow(BusinessRuleError);
      expect(() => validateDispatchGuards(noPickup)).toThrow(/pickup/i);
    });

    it("throws when dropoff stop is missing", () => {
      const noDropoff: DispatchGuardInput = {
        ...validInput,
        stops: [{ type: "Pickup", completed: false }],
      };
      expect(() => validateDispatchGuards(noDropoff)).toThrow(
        BusinessRuleError,
      );
      expect(() => validateDispatchGuards(noDropoff)).toThrow(/dropoff/i);
    });

    it("throws when no stops at all", () => {
      expect(() =>
        validateDispatchGuards({ ...validInput, stops: [] }),
      ).toThrow(BusinessRuleError);
    });

    it("throws when driver belongs to different tenant", () => {
      expect(() =>
        validateDispatchGuards({
          ...validInput,
          driverCompanyId: "company-bbb",
        }),
      ).toThrow(BusinessRuleError);
      expect(() =>
        validateDispatchGuards({
          ...validInput,
          driverCompanyId: "company-bbb",
        }),
      ).toThrow(/tenant/i);
    });

    it("throws when equipment belongs to different tenant", () => {
      expect(() =>
        validateDispatchGuards({
          ...validInput,
          equipmentCompanyId: "company-bbb",
        }),
      ).toThrow(BusinessRuleError);
      expect(() =>
        validateDispatchGuards({
          ...validInput,
          equipmentCompanyId: "company-bbb",
        }),
      ).toThrow(/tenant/i);
    });
  });
});
