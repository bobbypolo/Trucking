import { z } from "zod";

export const createProviderSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  type: z.string().optional(),
  status: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  coverage: z.any().optional(),
  capabilities: z.any().optional(),
  contacts: z.any().optional(),
  after_hours_contacts: z.any().optional(),
  is_247: z.boolean().optional(),
  notes: z.string().optional(),
});

export const updateProviderSchema = createProviderSchema.partial();
