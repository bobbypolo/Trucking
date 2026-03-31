import { z } from "zod";

/**
 * Schema for POST /api/call-sessions — creating a call session.
 */
export const createCallSessionSchema = z.object({
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  duration_seconds: z.number().optional(),
  status: z.string().min(1, "status is required"),
  assigned_to: z.string().optional(),
  team: z.string().optional(),
  notes: z.string().optional(),
  participants: z.any().optional(),
  links: z.any().optional(),
});

/**
 * Schema for PUT /api/call-sessions/:id — updating a call session.
 * All fields are optional since it's a partial update.
 */
export const updateCallSessionSchema = createCallSessionSchema.partial();
