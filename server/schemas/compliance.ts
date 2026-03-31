import { z } from "zod";

/**
 * Schema for POST /api/compliance/alert — creating a compliance alert.
 */
export const createComplianceAlertSchema = z.object({
  entityType: z.string().min(1, "entityType is required"),
  entityId: z.string().min(1, "entityId is required"),
  description: z.string().optional(),
  severity: z.number().int().min(1).max(5).optional(),
  alertType: z.string().optional(),
});
