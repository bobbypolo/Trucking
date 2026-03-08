import { describe, it, expect } from "vitest";

// Tests R-P4-01-AC2

import {
  SettlementStatus,
  VALID_SETTLEMENT_TRANSITIONS,
  validateSettlementTransition,
  getValidNextSettlementStatuses,
} from "../../services/settlement-state-machine";
import { BusinessRuleError } from "../../errors/AppError";

describe("R-P4-01-AC2: Settlement State Machine", () => {
  describe("SettlementStatus enum", () => {
    it("defines exactly 5 canonical statuses", () => {
      const values = Object.values(SettlementStatus);
      expect(values).toHaveLength(5);
      expect(values).toContain("pending_generation");
      expect(values).toContain("generated");
      expect(values).toContain("reviewed");
      expect(values).toContain("posted");
      expect(values).toContain("adjusted");
    });
  });

  describe("VALID_SETTLEMENT_TRANSITIONS map", () => {
    it("defines transitions for every settlement status", () => {
      const statuses = Object.values(SettlementStatus);
      for (const status of statuses) {
        expect(VALID_SETTLEMENT_TRANSITIONS).toHaveProperty(status);
      }
    });

    it("pending_generation transitions only to generated", () => {
      expect(
        VALID_SETTLEMENT_TRANSITIONS[SettlementStatus.PENDING_GENERATION],
      ).toEqual([SettlementStatus.GENERATED]);
    });

    it("generated transitions to reviewed or adjusted", () => {
      expect(VALID_SETTLEMENT_TRANSITIONS[SettlementStatus.GENERATED]).toEqual(
        expect.arrayContaining([
          SettlementStatus.REVIEWED,
          SettlementStatus.ADJUSTED,
        ]),
      );
      expect(
        VALID_SETTLEMENT_TRANSITIONS[SettlementStatus.GENERATED],
      ).toHaveLength(2);
    });

    it("reviewed transitions to posted or adjusted", () => {
      expect(VALID_SETTLEMENT_TRANSITIONS[SettlementStatus.REVIEWED]).toEqual(
        expect.arrayContaining([
          SettlementStatus.POSTED,
          SettlementStatus.ADJUSTED,
        ]),
      );
      expect(
        VALID_SETTLEMENT_TRANSITIONS[SettlementStatus.REVIEWED],
      ).toHaveLength(2);
    });

    it("posted is a terminal state with no outgoing transitions", () => {
      expect(VALID_SETTLEMENT_TRANSITIONS[SettlementStatus.POSTED]).toEqual([]);
    });

    it("adjusted transitions to reviewed (re-review after adjustment)", () => {
      expect(VALID_SETTLEMENT_TRANSITIONS[SettlementStatus.ADJUSTED]).toEqual([
        SettlementStatus.REVIEWED,
      ]);
    });
  });

  describe("validateSettlementTransition — valid transitions", () => {
    const validPairs: [SettlementStatus, SettlementStatus][] = [
      [SettlementStatus.PENDING_GENERATION, SettlementStatus.GENERATED],
      [SettlementStatus.GENERATED, SettlementStatus.REVIEWED],
      [SettlementStatus.GENERATED, SettlementStatus.ADJUSTED],
      [SettlementStatus.REVIEWED, SettlementStatus.POSTED],
      [SettlementStatus.REVIEWED, SettlementStatus.ADJUSTED],
      [SettlementStatus.ADJUSTED, SettlementStatus.REVIEWED],
    ];

    for (const [from, to] of validPairs) {
      it(`allows transition from ${from} to ${to}`, () => {
        expect(() => validateSettlementTransition(from, to)).not.toThrow();
      });
    }
  });

  describe("validateSettlementTransition — invalid transitions throw BusinessRuleError", () => {
    const invalidPairs: [SettlementStatus, SettlementStatus][] = [
      // Skip states
      [SettlementStatus.PENDING_GENERATION, SettlementStatus.REVIEWED],
      [SettlementStatus.PENDING_GENERATION, SettlementStatus.POSTED],
      [SettlementStatus.PENDING_GENERATION, SettlementStatus.ADJUSTED],
      [SettlementStatus.GENERATED, SettlementStatus.POSTED],
      // Backward transitions
      [SettlementStatus.GENERATED, SettlementStatus.PENDING_GENERATION],
      [SettlementStatus.REVIEWED, SettlementStatus.PENDING_GENERATION],
      [SettlementStatus.REVIEWED, SettlementStatus.GENERATED],
      [SettlementStatus.POSTED, SettlementStatus.PENDING_GENERATION],
      [SettlementStatus.POSTED, SettlementStatus.GENERATED],
      [SettlementStatus.POSTED, SettlementStatus.REVIEWED],
      [SettlementStatus.POSTED, SettlementStatus.ADJUSTED],
      [SettlementStatus.ADJUSTED, SettlementStatus.PENDING_GENERATION],
      [SettlementStatus.ADJUSTED, SettlementStatus.GENERATED],
      [SettlementStatus.ADJUSTED, SettlementStatus.POSTED],
      // Self-transitions
      [
        SettlementStatus.PENDING_GENERATION,
        SettlementStatus.PENDING_GENERATION,
      ],
      [SettlementStatus.GENERATED, SettlementStatus.GENERATED],
      [SettlementStatus.REVIEWED, SettlementStatus.REVIEWED],
      [SettlementStatus.POSTED, SettlementStatus.POSTED],
      [SettlementStatus.ADJUSTED, SettlementStatus.ADJUSTED],
    ];

    for (const [from, to] of invalidPairs) {
      it(`rejects transition from ${from} to ${to}`, () => {
        expect(() => validateSettlementTransition(from, to)).toThrow(
          BusinessRuleError,
        );
      });
    }

    it("throws BusinessRuleError with correct error_class and details", () => {
      try {
        validateSettlementTransition(
          SettlementStatus.PENDING_GENERATION,
          SettlementStatus.POSTED,
        );
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(BusinessRuleError);
        const brErr = err as BusinessRuleError;
        expect(brErr.error_class).toBe("BUSINESS_RULE");
        expect(brErr.statusCode).toBe(422);
        expect(brErr.details).toHaveProperty("from", "pending_generation");
        expect(brErr.details).toHaveProperty("to", "posted");
        expect(brErr.details).toHaveProperty("allowed_transitions");
        expect(brErr.error_code).toBe(
          "BUSINESS_RULE_INVALID_SETTLEMENT_TRANSITION",
        );
      }
    });
  });

  describe("getValidNextSettlementStatuses", () => {
    it("returns generated for pending_generation", () => {
      expect(
        getValidNextSettlementStatuses(SettlementStatus.PENDING_GENERATION),
      ).toEqual([SettlementStatus.GENERATED]);
    });

    it("returns reviewed and adjusted for generated", () => {
      const next = getValidNextSettlementStatuses(SettlementStatus.GENERATED);
      expect(next).toEqual(
        expect.arrayContaining([
          SettlementStatus.REVIEWED,
          SettlementStatus.ADJUSTED,
        ]),
      );
    });

    it("returns posted and adjusted for reviewed", () => {
      const next = getValidNextSettlementStatuses(SettlementStatus.REVIEWED);
      expect(next).toEqual(
        expect.arrayContaining([
          SettlementStatus.POSTED,
          SettlementStatus.ADJUSTED,
        ]),
      );
    });

    it("returns empty array for posted (terminal)", () => {
      expect(getValidNextSettlementStatuses(SettlementStatus.POSTED)).toEqual(
        [],
      );
    });

    it("returns reviewed for adjusted", () => {
      expect(getValidNextSettlementStatuses(SettlementStatus.ADJUSTED)).toEqual(
        [SettlementStatus.REVIEWED],
      );
    });
  });
});
