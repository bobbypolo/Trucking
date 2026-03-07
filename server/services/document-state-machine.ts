import { BusinessRuleError } from "../errors/AppError";

/**
 * Canonical document statuses for the LoadPilot document state machine.
 *
 * Flow: pending -> finalized -> processing -> review_required -> accepted/rejected
 *
 * - pending: blob uploaded but not yet confirmed
 * - finalized: both blob and MySQL metadata confirmed
 * - processing: OCR or other processing underway
 * - review_required: processing complete, human review needed
 * - accepted: document accepted after review
 * - rejected: document rejected after review
 */
export enum DocumentStatus {
  PENDING = "pending",
  FINALIZED = "finalized",
  PROCESSING = "processing",
  REVIEW_REQUIRED = "review_required",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
}

/**
 * Map of valid document status transitions.
 *
 * Exactly 5 transitions:
 *   1. pending -> finalized
 *   2. finalized -> processing
 *   3. processing -> review_required
 *   4. review_required -> accepted
 *   5. review_required -> rejected
 *
 * All other transitions are rejected with BusinessRuleError (HTTP 422).
 */
export const VALID_DOCUMENT_TRANSITIONS: Record<
  DocumentStatus,
  DocumentStatus[]
> = {
  [DocumentStatus.PENDING]: [DocumentStatus.FINALIZED],
  [DocumentStatus.FINALIZED]: [DocumentStatus.PROCESSING],
  [DocumentStatus.PROCESSING]: [DocumentStatus.REVIEW_REQUIRED],
  [DocumentStatus.REVIEW_REQUIRED]: [
    DocumentStatus.ACCEPTED,
    DocumentStatus.REJECTED,
  ],
  [DocumentStatus.ACCEPTED]: [],
  [DocumentStatus.REJECTED]: [],
};

/**
 * Validates that a document status transition from `from` to `to` is allowed.
 * Throws BusinessRuleError if the transition is invalid.
 */
export function validateDocumentTransition(
  from: DocumentStatus,
  to: DocumentStatus,
): void {
  const allowed = VALID_DOCUMENT_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new BusinessRuleError(
      `Invalid document transition from '${from}' to '${to}'`,
      { from, to, allowed_transitions: allowed ?? [] },
      "BUSINESS_RULE_INVALID_DOCUMENT_TRANSITION",
    );
  }
}

/**
 * Returns the list of valid next statuses for a given document status.
 */
export function getValidNextDocumentStatuses(
  status: DocumentStatus,
): DocumentStatus[] {
  return VALID_DOCUMENT_TRANSITIONS[status] ?? [];
}
