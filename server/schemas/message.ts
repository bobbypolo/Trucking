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
  thread_id: z.string().optional(),
});

/**
 * Schema for POST /api/threads — create a new thread.
 */
export const createThreadSchema = z.object({
  title: z.string().optional(),
  load_id: z.string().optional(),
  participant_ids: z
    .array(z.string().min(1))
    .min(1, "participant_ids must have at least one participant"),
});

/**
 * Schema for PATCH /api/messages/:id/read — mark message as read.
 * Body is empty; id comes from route params.
 */
export const markReadSchema = z.object({});
