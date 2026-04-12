import { z } from "zod";

/**
 * Zod schema for PATCH /api/loads/:loadId/stops/:stopId body.
 *
 * Allows partial updates to stop status tracking fields.
 * At least one field must be provided.
 */
export const patchStopSchema = z
  .object({
    status: z.enum(["pending", "arrived", "departed", "completed"]).optional(),
    arrived_at: z.string().datetime().optional(),
    departed_at: z.string().datetime().optional(),
    completed: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.status !== undefined ||
      data.arrived_at !== undefined ||
      data.departed_at !== undefined ||
      data.completed !== undefined,
    { message: "At least one field must be provided" },
  );
