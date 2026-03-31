import { z } from "zod";

/**
 * Schema for POST /api/incidents — create an incident.
 */
export const createIncidentSchema = z.object({
  load_id: z.string().min(1, "load_id is required"),
  type: z.string().min(1, "type is required"),
  severity: z.string().min(1, "severity is required"),
  description: z.string().min(1, "description is required"),
  status: z.string().optional(),
  sla_deadline: z.string().optional(),
  location_lat: z.number().optional(),
  location_lng: z.number().optional(),
  recovery_plan: z.string().optional(),
});

/**
 * Schema for POST /api/incidents/:id/actions — log an incident action.
 */
export const createIncidentActionSchema = z.object({
  action: z.string().min(1, "action is required"),
  actor_name: z.string().min(1, "actor_name is required"),
  notes: z.string().optional(),
  attachments: z.any().optional(),
});

/**
 * Schema for PATCH /api/incidents/:id — partial update.
 */
export const patchIncidentSchema = createIncidentSchema.partial();

/**
 * Schema for POST /api/incidents/:id/charges — record an emergency charge.
 */
export const createIncidentChargeSchema = z.object({
  category: z.string().min(1, "category is required"),
  amount: z.number().min(0, "amount must be >= 0"),
  provider_vendor: z.string().optional(),
  status: z.string().optional(),
  approved_by: z.string().optional(),
  receipt_url: z.string().optional(),
});
