import { z } from "zod";

/**
 * Schema for POST /api/time-logs — creating a driver time log entry.
 */
export const createTimeLogSchema = z.object({
  id: z.string().optional(),
  user_id: z.string().min(1, "user_id is required"),
  load_id: z.string().optional(),
  activity_type: z.string().min(1, "activity_type is required"),
  location_lat: z.number().optional(),
  location_lng: z.number().optional(),
  clock_out: z.string().optional(),
});

/**
 * Schema for POST /api/dispatch-events — logging a dispatch event.
 */
export const createDispatchEventSchema = z.object({
  id: z.string().optional(),
  load_id: z.string().min(1, "load_id is required"),
  dispatcher_id: z.string().optional(),
  event_type: z.string().min(1, "event_type is required"),
  message: z.string().optional(),
  payload: z.any().optional(),
});

/**
 * Schema for POST /api/dispatch/best-matches — GPS-based driver matching.
 */
export const bestMatchesSchema = z.object({
  loadId: z.string().min(1, "loadId is required"),
  maxCandidates: z.number().int().positive().optional(),
});
