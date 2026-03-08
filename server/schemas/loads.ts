import { z } from "zod";

/**
 * Schema for POST /api/loads — creating or replacing a load.
 * Matches the destructured fields in routes/loads.ts router.post('/api/loads').
 */
export const createLoadSchema = z.object({
  id: z.string().optional(),
  company_id: z.string().optional(), // Derived from auth context server-side
  customer_id: z.string().optional(),
  driver_id: z.string().optional(),
  dispatcher_id: z.string().optional(),
  load_number: z.string().min(1),
  status: z.string().min(1),
  carrier_rate: z.number().optional(),
  driver_pay: z.number().optional(),
  pickup_date: z.string().optional(),
  freight_type: z.string().optional(),
  commodity: z.string().optional(),
  weight: z.number().optional(),
  container_number: z.string().optional(),
  chassis_number: z.string().optional(),
  bol_number: z.string().optional(),
  legs: z
    .array(
      z.object({
        id: z.string().optional(),
        type: z.string().optional(),
        facility_name: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        date: z.string().optional(),
        appointment_time: z.string().optional(),
        appointmentTime: z.string().optional(),
        completed: z.union([z.boolean(), z.string()]).optional(),
        location: z
          .object({
            facilityName: z.string().optional(),
            city: z.string().optional(),
            state: z.string().optional(),
          })
          .optional(),
        sequence_order: z.number().optional(),
      }),
    )
    .optional(),
  notification_emails: z.array(z.string()).optional(),
  contract_id: z.string().optional(),
  gpsHistory: z
    .array(
      z
        .object({
          lat: z.number(),
          lng: z.number(),
          timestamp: z.string().optional(),
        })
        .passthrough(),
    )
    .optional(),
  podUrls: z.array(z.string()).optional(),
  customerUserId: z.string().optional(),
  issues: z
    .array(
      z.object({
        id: z.string().optional(),
        category: z.string().optional(),
        description: z.string(),
        status: z.string().optional(),
      }),
    )
    .optional(),
});

/**
 * Schema for PATCH /api/loads/:id/status — status update.
 */
export const updateLoadStatusSchema = z.object({
  status: z.string().min(1),
  dispatcher_id: z.string().optional(),
});
