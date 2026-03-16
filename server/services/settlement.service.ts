import { v4 as uuidv4 } from "uuid";
import {
  SettlementStatus,
  validateSettlementTransition,
} from "./settlement-state-machine";
import {
  calculateSettlementTotals,
  type SettlementLineInput,
} from "./settlement-calculation";
import { settlementRepository } from "../repositories/settlement.repository";
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../errors/AppError";

/**
 * Input shape for generating a settlement.
 */
export interface GenerateSettlementInput {
  loadId: string;
  driverId: string;
  companyId: string;
  userId: string;
  settlementDate: string;
  periodStart?: string;
  periodEnd?: string;
  lines: SettlementLineInput[];
}

/**
 * Settlement Service — orchestrates settlement generation with business rules.
 *
 * Business rules enforced:
 *   1. Cannot generate settlement for non-completed loads
 *   2. Duplicate generation is idempotent (returns existing settlement)
 *   3. Settlement is a SEPARATE entity from load (load status is NOT modified)
 *   4. All financial calculations use DECIMAL(10,2) with ROUND_HALF_UP
 *   5. Settlement is created in 'generated' status (atomic transition from pending_generation)
 */

/**
 * Generate a settlement for a completed load.
 *
 * Steps:
 *   1. Verify load exists and is in 'completed' status
 *   2. Check for existing settlement (idempotency)
 *   3. Calculate totals with DECIMAL(10,2) precision
 *   4. Create settlement in 'generated' status
 *
 * @param input - Settlement generation parameters
 * @returns The created (or existing) settlement record
 */
export async function generateSettlement(
  input: GenerateSettlementInput,
): Promise<Record<string, unknown>> {
  // 1. Verify load exists and is completed
  const loadStatus = await settlementRepository.findLoadStatus(
    input.loadId,
    input.companyId,
  );

  if (loadStatus === null) {
    throw new NotFoundError(
      `Load '${input.loadId}' not found for tenant '${input.companyId}'`,
      { loadId: input.loadId, companyId: input.companyId },
    );
  }

  if (loadStatus !== "completed") {
    throw new BusinessRuleError(
      `Cannot generate settlement for load '${input.loadId}' — load must be in 'completed' status (current: '${loadStatus}')`,
      {
        loadId: input.loadId,
        currentStatus: loadStatus,
        requiredStatus: "completed",
      },
      "BUSINESS_RULE_SETTLEMENT_LOAD_NOT_COMPLETED",
    );
  }

  // 2. Idempotency check — return existing settlement if one exists
  const existing = await settlementRepository.findByLoadAndTenant(
    input.loadId,
    input.companyId,
  );

  if (existing) {
    return existing;
  }

  // 3. Calculate totals with DECIMAL(10,2) precision and ROUND_HALF_UP
  const totals = calculateSettlementTotals(input.lines);

  // 4. Create settlement in 'generated' status
  // The transition from pending_generation to generated is atomic —
  // the settlement is never persisted in pending_generation status.
  const settlement = await settlementRepository.create({
    company_id: input.companyId,
    load_id: input.loadId,
    driver_id: input.driverId,
    settlement_date: input.settlementDate,
    period_start: input.periodStart ?? null,
    period_end: input.periodEnd ?? null,
    status: SettlementStatus.GENERATED,
    total_earnings: totals.totalEarnings,
    total_deductions: totals.totalDeductions,
    total_reimbursements: totals.totalReimbursements,
    net_pay: totals.netPay,
    created_by: input.userId,
    lines: input.lines.map((line) => ({
      description: line.description,
      amount: line.amount,
      type: line.type,
      loadId: line.loadId,
      glAccountId: line.glAccountId,
    })),
  });

  return settlement;
}

/**
 * Input shape for transitioning a settlement's status.
 */
export interface TransitionSettlementInput {
  settlementId: string;
  companyId: string;
  newStatus: SettlementStatus;
  expectedVersion: number;
  userId: string;
}

/**
 * Input shape for creating a settlement adjustment.
 */
export interface CreateAdjustmentInput {
  settlementId: string;
  companyId: string;
  reason: string;
  adjustmentType: string;
  amount: number;
  userId: string;
}

/**
 * Transition a settlement to a new status with optimistic locking.
 *
 * Business rules enforced:
 *   1. Settlement must exist for the given tenant
 *   2. State machine validates the transition (e.g., generated -> reviewed)
 *   3. Optimistic locking via version column prevents concurrent overwrites
 *   4. Posted settlements are terminal — no transitions allowed out of posted
 *
 * @throws NotFoundError if settlement does not exist
 * @throws BusinessRuleError if state machine rejects the transition
 * @throws ConflictError (409) if version mismatch (concurrent edit)
 */
export async function transitionSettlement(
  input: TransitionSettlementInput,
): Promise<Record<string, unknown>> {
  // 1. Fetch settlement with tenant scoping
  const settlement = await settlementRepository.findById(
    input.settlementId,
    input.companyId,
  );

  if (!settlement) {
    throw new NotFoundError(
      `Settlement '${input.settlementId}' not found for tenant '${input.companyId}'`,
      { settlementId: input.settlementId, companyId: input.companyId },
    );
  }

  // 2. Validate state machine transition (throws BusinessRuleError if invalid)
  validateSettlementTransition(
    settlement.status as SettlementStatus,
    input.newStatus,
  );

  // 3. Attempt update with optimistic locking
  const updated = await settlementRepository.updateStatus(
    input.settlementId,
    input.newStatus,
    input.companyId,
    input.expectedVersion,
  );

  if (!updated) {
    throw new ConflictError(
      `Settlement '${input.settlementId}' was modified by another process (version conflict)`,
      {
        settlementId: input.settlementId,
        expectedVersion: input.expectedVersion,
      },
      "CONFLICT_SETTLEMENT_VERSION",
    );
  }

  return updated;
}

/**
 * Attempt to directly update a posted settlement's fields.
 *
 * ALWAYS rejects — posted settlements are immutable. Callers must use
 * createAdjustment() to record corrections against posted settlements.
 *
 * @throws ForbiddenError (403) — posted settlements cannot be modified
 * @throws NotFoundError if settlement does not exist
 */
export async function updatePostedSettlement(
  settlementId: string,
  companyId: string,
  _updates: Record<string, unknown>,
): Promise<never> {
  const settlement = await settlementRepository.findById(
    settlementId,
    companyId,
  );

  if (!settlement) {
    throw new NotFoundError(
      `Settlement '${settlementId}' not found for tenant '${companyId}'`,
      { settlementId, companyId },
    );
  }

  throw new ForbiddenError(
    `Settlement '${settlementId}' is immutable — posted settlements cannot be modified. Use adjustments to record corrections.`,
    {},
    "FORBIDDEN_SETTLEMENT_IMMUTABLE",
  );
}

/**
 * Attempt to delete a settlement.
 *
 * ALWAYS rejects — no hard-delete path exists for settlements. All
 * settlement records are retained for audit trail compliance.
 *
 * @throws ForbiddenError (403) — settlements cannot be deleted
 * @throws NotFoundError if settlement does not exist
 */
export async function deleteSettlement(
  settlementId: string,
  companyId: string,
): Promise<never> {
  const settlement = await settlementRepository.findById(
    settlementId,
    companyId,
  );

  if (!settlement) {
    throw new NotFoundError(
      `Settlement '${settlementId}' not found for tenant '${companyId}'`,
      { settlementId, companyId },
    );
  }

  throw new ForbiddenError(
    `Settlement '${settlementId}' cannot be deleted — no hard-delete path exists for settlements. All records are retained for audit compliance.`,
    {},
    "FORBIDDEN_SETTLEMENT_NO_DELETE",
  );
}

/**
 * Create an adjustment (correction record) against a posted settlement.
 *
 * Adjustments are separate records that reference the original settlement.
 * The posted settlement itself is NEVER modified.
 *
 * Business rules:
 *   1. Settlement must exist for the given tenant
 *   2. Settlement must be in 'posted' status (only posted settlements need adjustments)
 *   3. Adjustment is a new record in the settlement_adjustments table
 *
 * @throws NotFoundError if settlement does not exist
 * @throws BusinessRuleError if settlement is not in 'posted' status
 */
export async function createAdjustment(
  input: CreateAdjustmentInput,
): Promise<Record<string, unknown>> {
  // 1. Fetch settlement with tenant scoping
  const settlement = await settlementRepository.findById(
    input.settlementId,
    input.companyId,
  );

  if (!settlement) {
    throw new NotFoundError(
      `Settlement '${input.settlementId}' not found for tenant '${input.companyId}'`,
      { settlementId: input.settlementId, companyId: input.companyId },
    );
  }

  // 2. Only posted settlements can have adjustments
  if (settlement.status !== SettlementStatus.POSTED) {
    throw new BusinessRuleError(
      `Cannot create adjustment for settlement '${input.settlementId}' — settlement must be in 'posted' status (current: '${settlement.status}')`,
      {
        settlementId: input.settlementId,
        currentStatus: settlement.status,
        requiredStatus: SettlementStatus.POSTED,
      },
      "BUSINESS_RULE_ADJUSTMENT_NOT_POSTED",
    );
  }

  // 3. Create adjustment record (never modifies the original settlement)
  const adjustment = await settlementRepository.createAdjustment({
    settlement_id: input.settlementId,
    reason: input.reason,
    adjustment_type: input.adjustmentType,
    amount: input.amount,
    created_by: input.userId,
  });

  return adjustment;
}
