/**
 * Settlement type definitions for the LoadPilot trucker app.
 *
 * Maps to the driver_settlements + settlement_lines tables returned
 * by GET /api/accounting/settlements (server-enforced driver self-scope).
 */

export interface SettlementLine {
  id: string;
  settlement_id: string;
  description: string;
  amount: number;
  load_id: string | null;
  type: string;
}

export interface Settlement {
  id: string;
  company_id: string;
  driver_id: string;
  settlement_date: string;
  period_start: string | null;
  period_end: string | null;
  total_earnings: number;
  total_deductions: number;
  total_reimbursements: number;
  net_pay: number;
  status: string;
  lines: SettlementLine[];
}
