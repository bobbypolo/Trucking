import { z } from "zod";

/**
 * Schema for POST /api/safety/quizzes — create a safety quiz.
 */
export const createSafetyQuizSchema = z.object({
  title: z.string().min(1, "title is required"),
  description: z.string().optional(),
  questions: z.any().optional(),
});

/**
 * Schema for POST /api/safety/quiz-results — record a quiz result.
 */
export const createQuizResultSchema = z.object({
  quiz_id: z.string().min(1, "quiz_id is required"),
  user_id: z.string().optional(),
  score: z.number().optional(),
  answers: z.any().optional(),
  passed: z.boolean().optional(),
});

/**
 * Schema for POST /api/safety/maintenance — create a maintenance record.
 */
export const createMaintenanceSchema = z.object({
  vehicle_id: z.string().min(1, "vehicle_id is required"),
  type: z.string().min(1, "type is required"),
  description: z.string().optional(),
  cost: z.number().optional(),
  scheduled_date: z.string().optional(),
  status: z.string().optional(),
  vendor_id: z.string().optional(),
});

/**
 * Schema for PATCH /api/safety/maintenance/:id — partial update.
 */
export const patchMaintenanceSchema = createMaintenanceSchema.partial();

/**
 * Schema for POST /api/safety/vendors — create a safety vendor.
 */
export const createSafetyVendorSchema = z.object({
  name: z.string().min(1, "name is required"),
  contact_info: z.string().optional(),
  specialty: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});

/**
 * Schema for POST /api/safety/activity — record a safety activity log entry.
 */
export const createSafetyActivitySchema = z.object({
  action: z.string().min(1, "action is required"),
  description: z.string().optional(),
  entity_type: z.string().optional(),
  entity_id: z.string().optional(),
});
