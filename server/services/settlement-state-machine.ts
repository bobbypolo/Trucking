import { BusinessRuleError } from "../errors/AppError";

/**
 * Canonical settlement statuses for the LoadPilot settlement state machine.
 *
 * Settlement is a SEPARATE entity from load — load status does NOT change
 * when settlement transitions occur.
 *
 * Flow: pending_generation -> generated -> reviewed -> posted
 * Side branch: generated|reviewed -> adjusted -> reviewed (re-review)
 */
export enum SettlementStatus {
  PENDING_GENERATION = "pending_generation",
  GENERATED = "generated",
  REVIEWED = "reviewed",
  POSTED = "posted",
  ADJUSTED = "adjusted",
}

/**
 * Map of valid settlement state transitions.
 *
 * Exactly 6 transitions are allowed:
 *   1. pending_generation -> generated (settlement calculation completes)
 *   2. generated -> reviewed (human reviews the settlement)
 *   3. generated -> adjusted (correction needed before review)
 *   4. reviewed -> posted (final posting to GL)
 *   5. reviewed -> adjusted (correction needed after review)
 *   6. adjusted -> reviewed (re-review after adjustment)
 *
 * Terminal state: posted (no further transitions)
 *
 * All other transitions are rejected with BusinessRuleError (HTTP 422).
 */
export const VALID_SETTLEMENT_TRANSITIONS: Record<
  SettlementStatus,
  SettlementStatus[]
> = {
  [SettlementStatus.PENDING_GENERATION]: [SettlementStatus.GENERATED],
  [SettlementStatus.GENERATED]: [
    SettlementStatus.REVIEWED,
    SettlementStatus.ADJUSTED,
  ],
  [SettlementStatus.REVIEWED]: [
    SettlementStatus.POSTED,
    SettlementStatus.ADJUSTED,
  ],
  [SettlementStatus.POSTED]: [],
  [SettlementStatus.ADJUSTED]: [SettlementStatus.REVIEWED],
};

/**
 * Validates that a settlement transition from `from` to `to` is allowed.
 * Throws BusinessRuleError if the transition is invalid.
 */
export function validateSettlementTransition(
  from: SettlementStatus,
  to: SettlementStatus,
): void {
  const allowed = VALID_SETTLEMENT_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new BusinessRuleError(
      `Invalid settlement transition from '${from}' to '${to}'`,
      { from, to, allowed_transitions: allowed ?? [] },
      "BUSINESS_RULE_INVALID_SETTLEMENT_TRANSITION",
    );
  }
}

/**
 * Returns the list of valid next statuses for a given settlement status.
 * Useful for UI to render only valid action buttons.
 */
export function getValidNextSettlementStatuses(
  status: SettlementStatus,
): SettlementStatus[] {
  return VALID_SETTLEMENT_TRANSITIONS[status] ?? [];
}
