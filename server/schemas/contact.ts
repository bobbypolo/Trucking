import { z } from "zod";

export const createContactSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  title: z.string().optional(),
  type: z.string().optional(),
  organization: z.string().optional(),
  preferred_channel: z.string().optional(),
  normalized_phone: z.string().optional(),
  notes: z.string().optional(),
});

export const updateContactSchema = createContactSchema.partial();
