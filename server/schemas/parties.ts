import { z } from "zod";

export const createPartySchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  mc_number: z.string().optional(),
  dot_number: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  status: z.string().optional(),
  credit_score: z.number().optional(),
  payment_terms: z.string().optional(),
  notes: z.string().optional(),
});
