import { z } from "zod";

/**
 * Schema for POST /api/equipment — creating equipment.
 * Matches the destructured fields in routes/equipment.ts.
 */
export const createEquipmentSchema = z.object({
  id: z.string().optional(),
  company_id: z.string().min(1),
  unit_number: z.string().min(1),
  type: z.string().min(1),
  status: z.string().min(1),
  ownership_type: z.string().optional(),
  provider_name: z.string().optional(),
  daily_cost: z.number().optional(),
  maintenance_history: z
    .array(
      z
        .object({
          date: z.string(),
          description: z.string(),
          cost: z.number().optional(),
        })
        .passthrough(),
    )
    .optional(),
});
