import { z } from "zod";

export const createTaskSchema = z.object({
  id: z.string().optional(),
  type: z.string().min(1, "Type is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"]).default("OPEN"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  assignee_id: z.string().optional(),
  assigned_to: z.string().optional(),
  due_date: z.string().optional(),
  links: z.any().optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const createWorkItemSchema = z.object({
  id: z.string().optional(),
  type: z.string().min(1, "Type is required"),
  label: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum(["Low", "Medium", "High", "Critical"]).default("Medium"),
  status: z
    .enum(["Pending", "In_Progress", "Resolved", "Cancelled"])
    .default("Pending"),
  sla_deadline: z.string().optional(),
  assignee_id: z.string().optional(),
  entity_type: z.string().optional(),
  entity_id: z.string().optional(),
});

export const updateWorkItemSchema = createWorkItemSchema.partial();
