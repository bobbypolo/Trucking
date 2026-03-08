/**
 * Settlement Calculation Module
 *
 * Provides centralized DECIMAL(10,2) precision with ROUND_HALF_UP rounding
 * for all financial settlement calculations.
 *
 * All monetary values are rounded to 2 decimal places using ROUND_HALF_UP
 * before aggregation to match MySQL DECIMAL(10,2) storage semantics.
 */

/**
 * Input shape for a settlement line item.
 */
export interface SettlementLineInput {
  description: string;
  amount: number;
  type: "earning" | "deduction" | "reimbursement";
  loadId?: string;
  glAccountId?: string;
}

/**
 * Output shape from settlement calculation.
 */
export interface SettlementTotals {
  totalEarnings: number;
  totalDeductions: number;
  totalReimbursements: number;
  netPay: number;
}

/**
 * Round a number to 2 decimal places using ROUND_HALF_UP.
 *
 * Standard Math.round uses "round half to even" (banker's rounding) and
 * suffers from IEEE 754 floating-point precision issues. This function
 * uses the string-based epsilon approach to implement true ROUND_HALF_UP.
 *
 * Examples:
 *   roundHalfUp(1.005)  => 1.01  (Math.round would give 1.00)
 *   roundHalfUp(2.345)  => 2.35
 *   roundHalfUp(-1.005) => -1.00 (ROUND_HALF_UP rounds toward positive infinity)
 */
export function roundHalfUp(value: number): number {
  if (value === 0) return 0;

  // For negative numbers, ROUND_HALF_UP rounds toward positive infinity
  // e.g., -1.005 rounds to -1.00, not -1.01
  if (value < 0) {
    return -roundHalfDown(-value);
  }

  // Use Number.EPSILON compensation to handle IEEE 754 precision issues
  // e.g., 1.005 is stored as 1.004999999... in IEEE 754
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Round down helper for negative ROUND_HALF_UP behavior.
 * Rounds 0.5 down (toward zero) for the magnitude of negative values.
 */
function roundHalfDown(value: number): number {
  // For the magnitude of negative values, we want to round 0.5 down
  const shifted = value * 100;
  const decimal = shifted - Math.floor(shifted);

  // If exactly 0.5, round down; otherwise use standard rounding
  if (Math.abs(decimal - 0.5) < 1e-10) {
    return Math.floor(shifted) / 100;
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate settlement totals from line items with DECIMAL(10,2) precision.
 *
 * Each line amount is rounded to 2 decimal places (ROUND_HALF_UP) before
 * being added to the appropriate category total. Final netPay is also
 * rounded to ensure DECIMAL(10,2) compliance.
 *
 * Formula: netPay = totalEarnings - totalDeductions + totalReimbursements
 */
export function calculateSettlementTotals(
  lines: SettlementLineInput[],
): SettlementTotals {
  let totalEarnings = 0;
  let totalDeductions = 0;
  let totalReimbursements = 0;

  for (const line of lines) {
    const roundedAmount = roundHalfUp(line.amount);

    switch (line.type) {
      case "earning":
        totalEarnings += roundedAmount;
        break;
      case "deduction":
        totalDeductions += roundedAmount;
        break;
      case "reimbursement":
        totalReimbursements += roundedAmount;
        break;
    }
  }

  // Round totals to DECIMAL(10,2) precision
  totalEarnings = roundHalfUp(totalEarnings);
  totalDeductions = roundHalfUp(totalDeductions);
  totalReimbursements = roundHalfUp(totalReimbursements);

  const netPay = roundHalfUp(
    totalEarnings - totalDeductions + totalReimbursements,
  );

  return {
    totalEarnings,
    totalDeductions,
    totalReimbursements,
    netPay,
  };
}
