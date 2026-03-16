import { z } from "zod";

/**
 * Schema for POST /api/auth/register — user registration.
 */
export const registerUserSchema = z.object({
  id: z.string().optional(),
  company_id: z.string().optional(),
  companyId: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.string().min(1),
  pay_model: z.string().optional(),
  payModel: z.string().optional(),
  pay_rate: z.number().optional(),
  payRate: z.number().optional(),
  firebase_uid: z.string().optional(),
  firebaseUid: z.string().optional(),
});

/**
 * Schema for POST /api/users — user sync/create.
 */
export const syncUserSchema = z.object({
  id: z.string().optional(),
  company_id: z.string().optional(),
  companyId: z.string().optional(),
  email: z.string().email(),
  password: z.string().optional(),
  name: z.string().min(1).optional(),
  role: z.string().optional(),
  pay_model: z.string().optional(),
  payModel: z.string().optional(),
  pay_rate: z.number().optional(),
  payRate: z.number().optional(),
  managed_by_user_id: z.string().optional(),
  managedByUserId: z.string().optional(),
  safety_score: z.number().optional(),
  safetyScore: z.number().optional(),
  primary_workspace: z.string().optional(),
  primaryWorkspace: z.string().optional(),
  duty_mode: z.string().optional(),
  dutyMode: z.string().optional(),
  phone: z.string().optional(),
  firebase_uid: z.string().optional(),
  firebaseUid: z.string().optional(),
});

/**
 * Schema for POST /api/auth/login — login request.
 */
export const loginUserSchema = z
  .object({
    email: z.string().email().optional(),
    password: z.string().optional(),
    firebaseUid: z.string().min(1).optional(),
    firebase_uid: z.string().optional(),
  })
  .refine((value) => Boolean(value.firebaseUid || value.firebase_uid), {
    message: "firebaseUid is required",
    path: ["firebaseUid"],
  });
