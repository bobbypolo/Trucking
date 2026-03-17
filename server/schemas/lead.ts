import { z } from "zod";

export const createLeadSchema = z.object({
  id: z.string().optional(),
  status: z
    .enum(["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"])
    .default("New"),
  source: z.string().optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal("")),
  contact_phone: z.string().optional(),
  company_name: z.string().optional(),
  notes: z.string().optional(),
  estimated_value: z.number().optional(),
  lane: z.string().optional(),
  equipment_needed: z.string().optional(),
});

export const updateLeadSchema = createLeadSchema.partial();
