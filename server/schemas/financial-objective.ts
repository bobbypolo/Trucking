import { z } from "zod";

/**
 * Fiscal quarter format: "YYYY-QN" where N is 1-4.
 * Used by R-P10-02 (filter) and R-P10-07 (validation failure → 400).
 */
export const QUARTER_REGEX = /^\d{4}-Q[1-4]$/;

/**
 * Zod schema for POST /api/financial-objectives body (R-P10-03).
 * `quarter` must match YYYY-QN.
 * Target columns are non-negative numbers — missing fields default to 0 to
 * match the migration's `DEFAULT 0` SQL column defaults.
 */
export const createFinancialObjectiveSchema = z.object({
  quarter: z
    .string()
    .regex(QUARTER_REGEX, "quarter must be in YYYY-QN format (e.g., 2026-Q2)"),
  revenue_target: z.number().nonnegative().default(0),
  expense_budget: z.number().nonnegative().default(0),
  profit_target: z.number().nonnegative().default(0),
  notes: z.string().optional(),
});

/**
 * Zod schema for GET /api/financial-objectives?quarter=... query (R-P10-02, R-P10-07).
 * Optional when absent; when present must match YYYY-QN or fail 400.
 */
export const listFinancialObjectivesQuerySchema = z.object({
  quarter: z
    .string()
    .regex(QUARTER_REGEX, "quarter must be in YYYY-QN format (e.g., 2026-Q2)")
    .optional(),
});

export type CreateFinancialObjectiveInput = z.infer<
  typeof createFinancialObjectiveSchema
>;
export type ListFinancialObjectivesQuery = z.infer<
  typeof listFinancialObjectivesQuerySchema
>;
