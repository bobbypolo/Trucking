import { z } from "zod";

/**
 * Schema for POST /api/invitations — create an invitation.
 */
export const createInvitationSchema = z.object({
  email: z
    .string()
    .min(1, "email is required")
    .email("Invalid email address"),
  role: z.enum(["admin", "dispatcher", "driver", "accountant"], {
    errorMap: () => ({ message: "role must be one of: admin, dispatcher, driver, accountant" }),
  }),
});

/**
 * Schema for POST /api/invitations/accept — accept an invitation.
 */
export const acceptInvitationSchema = z.object({
  token: z.string().min(1, "token is required"),
  name: z.string().min(1, "name is required"),
  password: z.string().min(8, "password must be at least 8 characters"),
});
