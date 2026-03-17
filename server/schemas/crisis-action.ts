import { z } from "zod";

export const createCrisisActionSchema = z.object({
  id: z.string().optional(),
  type: z.string().min(1, "Type is required"),
  status: z.string().optional(),
  incident_id: z.string().optional(),
  load_id: z.string().optional(),
  operator_id: z.string().optional(),
  location: z.any().optional(),
  timeline: z.any().optional(),
  description: z.string().optional(),
});

export const updateCrisisActionSchema = z.object({
  status: z.string().optional(),
  timeline: z.any().optional(),
  description: z.string().optional(),
});
