import { z } from "zod";

export const createQuoteSchema = z.object({
  id: z.string().optional(),
  status: z
    .enum(["Draft", "Sent", "Negotiating", "Accepted", "Declined", "Expired"])
    .default("Draft"),
  pickup_city: z.string().optional(),
  pickup_state: z.string().optional(),
  pickup_facility: z.string().optional(),
  dropoff_city: z.string().optional(),
  dropoff_state: z.string().optional(),
  dropoff_facility: z.string().optional(),
  equipment_type: z.string().optional(),
  linehaul: z.number().optional(),
  fuel_surcharge: z.number().optional(),
  total_rate: z.number().optional(),
  customer_id: z.string().optional(),
  broker_id: z.string().optional(),
  valid_until: z.string().optional(),
  notes: z.string().optional(),
});

export const updateQuoteSchema = createQuoteSchema.partial();
