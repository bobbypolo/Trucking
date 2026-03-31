import { z } from "zod";

/**
 * Schema for POST /api/contracts — creating or replacing a customer contract.
 */
export const createContractSchema = z.object({
  id: z.string().optional(),
  customer_id: z.string().min(1, "customer_id is required"),
  contract_name: z.string().min(1, "contract_name is required"),
  terms: z.string().optional(),
  start_date: z.string().optional(),
  expiry_date: z.string().optional(),
  equipment_preferences: z.any().optional(),
  status: z.string().optional(),
});
