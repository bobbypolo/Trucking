import { z } from "zod";

export const createKciRequestSchema = z.object({
  id: z.string().optional(),
  type: z.string().min(1, "Type is required"),
  status: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  requested_amount: z.number().optional(),
  approved_amount: z.number().optional(),
  currency: z.string().default("USD"),
  load_id: z.string().optional(),
  driver_id: z.string().optional(),
  source: z.string().optional(),
  requires_docs: z.boolean().optional(),
  open_record_id: z.string().optional(),
  requested_at: z.string().optional(),
  due_at: z.string().optional(),
  decision_log: z.any().optional(),
  links: z.any().optional(),
});

export const updateKciRequestSchema = createKciRequestSchema.partial();
