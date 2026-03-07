import { describe, it, expect } from "vitest";

// Tests R-P3-01-AC3

import {
  DocumentStatus,
  VALID_DOCUMENT_TRANSITIONS,
  validateDocumentTransition,
  getValidNextDocumentStatuses,
} from "../../services/document-state-machine";
import { BusinessRuleError } from "../../errors/AppError";

describe("R-P3-01-AC3: Document State Machine", () => {
  describe("DocumentStatus enum", () => {
    it("defines exactly 6 canonical statuses", () => {
      const values = Object.values(DocumentStatus);
      expect(values).toHaveLength(6);
      expect(values).toContain("pending");
      expect(values).toContain("finalized");
      expect(values).toContain("processing");
      expect(values).toContain("review_required");
      expect(values).toContain("accepted");
      expect(values).toContain("rejected");
    });
  });

  describe("VALID_DOCUMENT_TRANSITIONS map", () => {
    it("defines transitions for every document status", () => {
      const statuses = Object.values(DocumentStatus);
      for (const status of statuses) {
        expect(VALID_DOCUMENT_TRANSITIONS).toHaveProperty(status);
      }
    });

    it("pending transitions only to finalized", () => {
      expect(VALID_DOCUMENT_TRANSITIONS[DocumentStatus.PENDING]).toEqual([
        DocumentStatus.FINALIZED,
      ]);
    });

    it("finalized transitions only to processing", () => {
      expect(VALID_DOCUMENT_TRANSITIONS[DocumentStatus.FINALIZED]).toEqual([
        DocumentStatus.PROCESSING,
      ]);
    });

    it("processing transitions only to review_required", () => {
      expect(VALID_DOCUMENT_TRANSITIONS[DocumentStatus.PROCESSING]).toEqual([
        DocumentStatus.REVIEW_REQUIRED,
      ]);
    });

    it("review_required transitions to accepted or rejected", () => {
      expect(
        VALID_DOCUMENT_TRANSITIONS[DocumentStatus.REVIEW_REQUIRED],
      ).toEqual(
        expect.arrayContaining([
          DocumentStatus.ACCEPTED,
          DocumentStatus.REJECTED,
        ]),
      );
      expect(
        VALID_DOCUMENT_TRANSITIONS[DocumentStatus.REVIEW_REQUIRED],
      ).toHaveLength(2);
    });

    it("terminal states (accepted, rejected) have no outgoing transitions", () => {
      expect(VALID_DOCUMENT_TRANSITIONS[DocumentStatus.ACCEPTED]).toEqual([]);
      expect(VALID_DOCUMENT_TRANSITIONS[DocumentStatus.REJECTED]).toEqual([]);
    });
  });

  describe("validateDocumentTransition — valid transitions", () => {
    const validPairs: [DocumentStatus, DocumentStatus][] = [
      [DocumentStatus.PENDING, DocumentStatus.FINALIZED],
      [DocumentStatus.FINALIZED, DocumentStatus.PROCESSING],
      [DocumentStatus.PROCESSING, DocumentStatus.REVIEW_REQUIRED],
      [DocumentStatus.REVIEW_REQUIRED, DocumentStatus.ACCEPTED],
      [DocumentStatus.REVIEW_REQUIRED, DocumentStatus.REJECTED],
    ];

    for (const [from, to] of validPairs) {
      it(`allows transition from ${from} to ${to}`, () => {
        expect(() => validateDocumentTransition(from, to)).not.toThrow();
      });
    }
  });

  describe("validateDocumentTransition — invalid transitions throw BusinessRuleError", () => {
    const invalidPairs: [DocumentStatus, DocumentStatus][] = [
      // Skip states
      [DocumentStatus.PENDING, DocumentStatus.PROCESSING],
      [DocumentStatus.PENDING, DocumentStatus.REVIEW_REQUIRED],
      [DocumentStatus.PENDING, DocumentStatus.ACCEPTED],
      [DocumentStatus.PENDING, DocumentStatus.REJECTED],
      [DocumentStatus.FINALIZED, DocumentStatus.REVIEW_REQUIRED],
      [DocumentStatus.FINALIZED, DocumentStatus.ACCEPTED],
      [DocumentStatus.FINALIZED, DocumentStatus.REJECTED],
      [DocumentStatus.PROCESSING, DocumentStatus.ACCEPTED],
      [DocumentStatus.PROCESSING, DocumentStatus.REJECTED],
      // Backward transitions
      [DocumentStatus.FINALIZED, DocumentStatus.PENDING],
      [DocumentStatus.PROCESSING, DocumentStatus.FINALIZED],
      [DocumentStatus.PROCESSING, DocumentStatus.PENDING],
      [DocumentStatus.REVIEW_REQUIRED, DocumentStatus.PROCESSING],
      [DocumentStatus.REVIEW_REQUIRED, DocumentStatus.FINALIZED],
      [DocumentStatus.REVIEW_REQUIRED, DocumentStatus.PENDING],
      [DocumentStatus.ACCEPTED, DocumentStatus.REVIEW_REQUIRED],
      [DocumentStatus.REJECTED, DocumentStatus.REVIEW_REQUIRED],
      // Terminal state transitions
      [DocumentStatus.ACCEPTED, DocumentStatus.PENDING],
      [DocumentStatus.ACCEPTED, DocumentStatus.REJECTED],
      [DocumentStatus.REJECTED, DocumentStatus.PENDING],
      [DocumentStatus.REJECTED, DocumentStatus.ACCEPTED],
      // Self-transitions
      [DocumentStatus.PENDING, DocumentStatus.PENDING],
      [DocumentStatus.FINALIZED, DocumentStatus.FINALIZED],
    ];

    for (const [from, to] of invalidPairs) {
      it(`rejects transition from ${from} to ${to}`, () => {
        expect(() => validateDocumentTransition(from, to)).toThrow(
          BusinessRuleError,
        );
      });
    }

    it("throws BusinessRuleError with correct error_class and details", () => {
      try {
        validateDocumentTransition(
          DocumentStatus.PENDING,
          DocumentStatus.ACCEPTED,
        );
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(BusinessRuleError);
        const brErr = err as BusinessRuleError;
        expect(brErr.error_class).toBe("BUSINESS_RULE");
        expect(brErr.statusCode).toBe(422);
        expect(brErr.details).toHaveProperty("from", "pending");
        expect(brErr.details).toHaveProperty("to", "accepted");
        expect(brErr.details).toHaveProperty("allowed_transitions");
        expect(brErr.error_code).toBe(
          "BUSINESS_RULE_INVALID_DOCUMENT_TRANSITION",
        );
      }
    });
  });

  describe("getValidNextDocumentStatuses", () => {
    it("returns finalized for pending", () => {
      expect(getValidNextDocumentStatuses(DocumentStatus.PENDING)).toEqual([
        DocumentStatus.FINALIZED,
      ]);
    });

    it("returns accepted/rejected for review_required", () => {
      const next = getValidNextDocumentStatuses(DocumentStatus.REVIEW_REQUIRED);
      expect(next).toEqual(
        expect.arrayContaining([
          DocumentStatus.ACCEPTED,
          DocumentStatus.REJECTED,
        ]),
      );
    });

    it("returns empty array for terminal states", () => {
      expect(getValidNextDocumentStatuses(DocumentStatus.ACCEPTED)).toEqual([]);
      expect(getValidNextDocumentStatuses(DocumentStatus.REJECTED)).toEqual([]);
    });
  });
});
