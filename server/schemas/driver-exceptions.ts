import { z } from "zod";

/**
 * Valid issue types that a driver can report from the mobile app.
 */
export const DRIVER_ISSUE_TYPES = [
  "BREAKDOWN",
  "DELAY_REPORTED",
  "DETENTION_ELIGIBLE",
  "LUMPER_REQUEST",
  "INCIDENT_GENERAL",
] as const;

export type DriverIssueType = (typeof DRIVER_ISSUE_TYPES)[number];

/**
 * Zod schema for POST /api/driver/exceptions body.
 */
export const createDriverExceptionSchema = z.object({
  issue_type: z.enum(DRIVER_ISSUE_TYPES),
  load_id: z.string().min(1),
  description: z.string().min(1),
  photo_urls: z.array(z.string().url()).optional(),
  location: z.string().optional(),
});
