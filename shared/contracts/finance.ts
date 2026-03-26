/**
 * Shared Finance Domain Contracts — FROZEN
 *
 * These types define the cross-team contract for financial data: quotes,
 * bookings, settlements, invoices, and financial documents.
 * Any team may read these types; changes require cross-team agreement.
 *
 * Derived from types.ts canonical definitions.
 */

export type QuoteStatus =
  | "Draft"
  | "Sent"
  | "Negotiating"
  | "Accepted"
  | "Declined"
  | "Expired";

export type BookingStatus =
  | "Accepted"
  | "Tendered"
  | "Pending_Docs"
  | "Ready_for_Dispatch";

export type SettlementStatus =
  | "pending_generation"
  | "generated"
  | "reviewed"
  | "posted"
  | "adjusted";

export interface Quote {
  id: string;
  leadId?: string;
  companyId: string;
  status: QuoteStatus;
  pickup: { city: string; state: string; facilityName?: string };
  dropoff: { city: string; state: string; facilityName?: string };
  equipmentType: string;
  equipmentRequirements?: string;
  linehaul: number;
  fuelSurcharge: number;
  accessorials: { type: string; amount: number; notes?: string }[];
  totalRate: number;
  margin?: number;
  version: number;
  validUntil: string;
  assumptions?: string;
  notes?: string;
  ownerId: string;
  createdAt: string;
  attachments?: string[];
  discount?: number;
  commission?: number;
  estimatedDriverPay?: number;
  companyCostFactor?: number;
}

export interface Booking {
  id: string;
  quoteId: string;
  companyId: string;
  status: BookingStatus;
  tenderDocUrl?: string;
  requiresAppt: boolean;
  appointmentWindow?: { start: string; end: string };
  constraints?: string;
  loadId?: string;
  createdAt: string;
}

export interface Settlement {
  id: string;
  tenantId: string;
  driverId: string;
  settlementDate: string;
  periodStart: string;
  periodEnd: string;
  totalEarnings: number;
  totalDeductions: number;
  totalReimbursements: number;
  netPay: number;
  status: "Draft" | "Calculated" | "Approved" | "Paid";
  lines: SettlementLine[];
}

export interface SettlementLine {
  id: string;
  settlementId: string;
  type: "Earning" | "Deduction" | "Reimbursement";
  description: string;
  amount: number;
  loadId?: string;
  glAccountId?: string;
}

export interface FinancialDocument {
  id: string;
  tenantId: string;
  type:
    | "BOL"
    | "POD"
    | "Fuel"
    | "Lumper"
    | "Repair"
    | "Toll"
    | "Scale"
    | "Insurance"
    | "Permit"
    | "RateCon"
    | "Statement"
    | "Other";
  url: string;
  filename: string;
  status: "Draft" | "Submitted" | "Approved" | "Rejected" | "Locked";
  amount?: number;
  date?: string;
  entityId?: string;
  loadId?: string;
  createdBy: string;
  createdAt: string;
}
