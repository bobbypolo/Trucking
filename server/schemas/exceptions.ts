import { z } from "zod";

export const createExceptionSchema = z.object({
  type: z.string().min(1),
  status: z.string().optional(),
  severity: z.union([z.number(), z.string()]).optional(),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  ownerUserId: z.string().optional(),
  team: z.string().optional(),
  slaDueAt: z.string().optional(),
  workflowStep: z.string().optional(),
  financialImpactEst: z.number().optional(),
  description: z.string().optional(),
  links: z.union([z.string(), z.object({}).passthrough()]).optional(),
  createdBy: z.string().optional(),
});

export const patchExceptionSchema = z
  .object({
    status: z.string().optional(),
    ownerUserId: z.string().optional(),
    workflowStep: z.string().optional(),
    severity: z.string().optional(),
    notes: z.string().optional(),
    actorName: z.string().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "At least one field is required",
  });
