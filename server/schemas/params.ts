import { z } from "zod";

/** Standard UUID path parameter */
export const idParam = z.object({
  id: z.string().min(1, "id is required"),
});

/** Company ID path parameter */
export const companyIdParam = z.object({
  companyId: z.string().min(1, "companyId is required"),
});

/** User ID path parameter */
export const userIdParam = z.object({
  userId: z.string().min(1, "userId is required"),
});

/** Customer ID path parameter */
export const customerIdParam = z.object({
  customerId: z.string().min(1, "customerId is required"),
});
