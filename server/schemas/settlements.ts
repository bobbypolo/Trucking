import { z } from 'zod';

/**
 * Schema for POST /api/accounting/settlements — creating a driver settlement.
 * Matches the fields used in routes/accounting.ts settlement POST handler.
 */
export const createSettlementSchema = z.object({
    id: z.string().optional(),
    tenantId: z.string().optional(),
    driverId: z.string().min(1),
    settlementDate: z.string().min(1),
    periodStart: z.string().optional(),
    periodEnd: z.string().optional(),
    totalEarnings: z.number().optional(),
    totalDeductions: z.number().optional(),
    totalReimbursements: z.number().optional(),
    netPay: z.number(),
    status: z.string().optional(),
    lines: z.array(z.object({
        id: z.string().optional(),
        description: z.string().optional(),
        amount: z.number(),
        loadId: z.string().optional(),
        glAccountId: z.string().optional(),
        type: z.string().optional(),
    })).optional(),
});
