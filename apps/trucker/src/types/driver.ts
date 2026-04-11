/**
 * Driver profile types — STORY-010 Phase 10 (mobile Profile screen).
 *
 * # Tests R-P10-06
 *
 * Shape matches the server `drivers/me` endpoint response contract
 * (see STORY-009 Phase 9, `server/routes/drivers/me.ts`). Fields that are
 * guaranteed present on a provisioned driver are `string`; `phone` is
 * nullable because drivers can sign up without a phone on file.
 */

export interface DriverProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  companyId: string;
}
