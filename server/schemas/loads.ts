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
  equipment_id: z.string().optional(),
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
 * Schema for POST /api/loads/driver-intake — driver-initiated load creation.
 * All fields are optional (OCR may extract only partial data).
 * Server-derived fields (status, intake_source, driver_id, load_number) are NOT here.
 */
export const createDriverIntakeLoadSchema = z.object({
  commodity: z.string().optional(),
  weight: z.number().optional(),
  bol_number: z.string().optional(),
  reference_number: z.string().optional(),
  pickup_date: z.string().optional(),
  pickup_city: z.string().optional(),
  pickup_state: z.string().optional(),
  pickup_facility_name: z.string().optional(),
  dropoff_city: z.string().optional(),
  dropoff_state: z.string().optional(),
  dropoff_facility_name: z.string().optional(),
});

/**
 * Schema for PATCH /api/loads/:id/status — status update.
 */
export const updateLoadStatusSchema = z.object({
  status: z.string().min(1),
  dispatcher_id: z.string().optional(),
});

/**
 * Schema for PATCH /api/loads/:id - partial load updates from scan/intake flows.
 * This is intentionally narrow so scanner-driven updates cannot mutate the
 * broader load lifecycle or bypass state-machine rules.
 */
export const partialUpdateLoadSchema = z
  .object({
    weight: z.coerce.number().finite().nonnegative().optional(),
    commodity: z.string().trim().min(1).optional(),
    bol_number: z.string().trim().min(1).optional(),
    reference_number: z.string().trim().min(1).optional(),
    reference_numbers: z.array(z.string().trim().min(1)).optional(),
    pickup_date: z.string().trim().min(1).optional(),
    notes: z.string().trim().min(1).max(2000).optional(),
    equipment_id: z.string().trim().min(1).optional(),
  })
  .refine(
    (data) =>
      data.weight !== undefined ||
      data.commodity !== undefined ||
      data.bol_number !== undefined ||
      data.reference_number !== undefined ||
      (data.reference_numbers !== undefined &&
        data.reference_numbers.length > 0) ||
      data.pickup_date !== undefined ||
      data.notes !== undefined ||
      data.equipment_id !== undefined,
    {
      message:
        "At least one supported partial-update field is required for PATCH /api/loads/:id",
    },
  );
