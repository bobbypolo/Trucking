import { z } from 'zod';

/**
 * Schema for POST /api/auth/register — user registration.
 */
export const registerUserSchema = z.object({
    id: z.string().optional(),
    company_id: z.string().optional(),
    companyId: z.string().optional(),
    email: z.string().email(),
    password: z.string().optional(),
    name: z.string().min(1),
    role: z.string().min(1),
    pay_model: z.string().optional(),
    payModel: z.string().optional(),
    pay_rate: z.number().optional(),
    payRate: z.number().optional(),
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
});

/**
 * Schema for POST /api/auth/login — login request.
 */
export const loginUserSchema = z.object({
    email: z.string().email(),
    password: z.string().optional(),
    firebaseUid: z.string().optional(),
});
