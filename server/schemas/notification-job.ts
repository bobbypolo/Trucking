import { z } from "zod";

/**
 * Schema for POST /api/notification-jobs — creating a notification job.
 */
export const createNotificationJobSchema = z.object({
  id: z.string().optional(),
  loadId: z.string().optional(),
  incidentId: z.string().optional(),
  message: z.string().min(1, "message is required"),
  channel: z.enum(["email", "sms", "push", "in_app"]),
  status: z.enum(["PENDING", "SENT", "FAILED"]).optional(),
  sentBy: z.string().optional(),
  sentAt: z.string().optional(),
  recipients: z.array(z.any()).optional(),
  sync_error: z.boolean().optional(),
});

/**
 * Schema for PATCH /api/notification-jobs/:id — updating job status.
 */
export const patchNotificationJobSchema = z.object({
  status: z.enum(["PENDING", "SENT", "FAILED"]),
  sync_error: z.boolean().optional(),
});
