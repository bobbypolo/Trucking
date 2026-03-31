import { z } from "zod";

/**
 * Schema for POST /api/call-logs — log a phone interaction.
 */
export const createCallLogSchema = z.object({
  phoneNumber: z.string().min(1, "phoneNumber is required"),
  context: z.string().optional(),
  contactName: z.string().optional(),
  direction: z.enum(["inbound", "outbound"]).optional().default("outbound"),
});
