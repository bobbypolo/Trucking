import { z } from "zod";

/**
 * Schema for POST /api/messages — create a new message.
 */
export const createMessageSchema = z.object({
  load_id: z.string().min(1, "load_id is required"),
  sender_id: z.string().min(1, "sender_id is required"),
  sender_name: z.string().optional(),
  text: z.string().optional(),
  attachments: z.any().optional(),
});
