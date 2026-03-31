import { z } from "zod";

/**
 * Schema for POST /api/quickbooks/sync-invoice — sync invoice to QBO.
 */
export const syncInvoiceSchema = z.object({
  loadId: z.string().min(1, "loadId is required"),
  totalAmount: z.number().min(0, "totalAmount must be >= 0"),
  customerId: z.string().optional(),
  lineItems: z.array(z.any()).optional(),
  dueDate: z.string().optional(),
});

/**
 * Schema for POST /api/quickbooks/sync-bill — sync bill to QBO.
 */
export const syncBillSchema = z.object({
  vendorId: z.string().min(1, "vendorId is required"),
  totalAmount: z.number().min(0, "totalAmount must be >= 0"),
  loadId: z.string().optional(),
  lineItems: z.array(z.any()).optional(),
  dueDate: z.string().optional(),
});
