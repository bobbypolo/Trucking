import { z } from "zod";

export const createBookingSchema = z.object({
  id: z.string().optional(),
  quote_id: z.string().optional(),
  customer_id: z.string().optional(),
  status: z
    .enum([
      "Pending",
      "Confirmed",
      "Ready_for_Dispatch",
      "Dispatched",
      "Cancelled",
    ])
    .default("Pending"),
  pickup_date: z.string().optional(),
  delivery_date: z.string().optional(),
  load_id: z.string().optional(),
  notes: z.string().optional(),
});

export const updateBookingSchema = createBookingSchema.partial();
