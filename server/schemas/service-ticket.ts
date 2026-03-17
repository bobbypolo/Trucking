import { z } from "zod";

export const createServiceTicketSchema = z.object({
  id: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  vendor: z.string().optional(),
  cost: z.number().optional(),
  equipment_id: z.string().optional(),
  description: z.string().optional(),
});

export const updateServiceTicketSchema = createServiceTicketSchema.partial();
