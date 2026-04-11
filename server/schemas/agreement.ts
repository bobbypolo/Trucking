import { z } from "zod";

/**
 * Zod schema for POST /api/agreements body (R-P9-02, R-P9-07).
 * `load_id` is required — missing load_id must reject with 400.
 * `rate_con_data` is an opaque JSON snapshot of the rate confirmation payload.
 */
export const createAgreementSchema = z.object({
  load_id: z.string().min(1, "load_id is required"),
  rate_con_data: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Zod schema for PATCH /api/agreements/:id/sign body (R-P9-04, R-P9-08).
 * `signature_data` is required — missing signature must reject with 400.
 */
export const signAgreementSchema = z.object({
  signature_data: z.record(z.string(), z.unknown()),
});

export type CreateAgreementInput = z.infer<typeof createAgreementSchema>;
export type SignAgreementInput = z.infer<typeof signAgreementSchema>;
