import { v4 as uuidv4 } from "uuid";
import { SettlementStatus } from "./settlement-state-machine";
import {
  calculateSettlementTotals,
  type SettlementLineInput,
} from "./settlement-calculation";
import { settlementRepository } from "../repositories/settlement.repository";
import { BusinessRuleError, NotFoundError } from "../errors/AppError";

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
