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

/**
 * Schema for converting a booking to an operational load.
 * Accepts booking fields plus the load details needed for canonical load creation.
 * Financial estimates from the quote (estimatedDriverPay, margin) are NOT accepted —
 * only the carrier_rate is carried as a reference value on the load.
 */
export const convertBookingSchema = z.object({
  // Booking fields
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
    .default("Confirmed"),
  pickup_date: z.string().optional(),
  delivery_date: z.string().optional(),
  notes: z.string().optional(),

  // Load creation fields (operational truth only)
  load_number: z.string().min(1, "Load number is required"),
  freight_type: z.string().optional(),
  commodity: z.string().optional(),
  weight: z.number().optional(),
  carrier_rate: z.number().default(0),
});
