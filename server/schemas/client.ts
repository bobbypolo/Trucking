import { z } from "zod";

export const createClientSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Client name is required"),
  type: z.string().optional(),
  mc_number: z.string().optional(),
  dot_number: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  payment_terms: z.string().optional(),
  chassis_requirements: z.any().optional(),
  // company_id accepted for backward compatibility but route handler
  // ignores it and derives company_id from auth context
  company_id: z.string().optional(),
});
