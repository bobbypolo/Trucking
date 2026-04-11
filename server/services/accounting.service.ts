import { v4 as uuidv4 } from "uuid";
import { detectState, calculateDistance } from "../geoUtils";
import {
  accountingRepository,
  type JournalPeriodAggRow,
  type JournalEntryInput,
  type InvoiceInput,
  type BillInput,
  type SettlementInput,
  type IftaAuditInput,
  type MileageInput,
  type FuelReceiptInput,
  type AdjustmentInput,
  type BatchImportItem,
} from "../repositories/accounting.repository";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SETTLEMENT_ADMIN_ROLES = [
  "admin",
  "payroll_manager",
  "dispatcher",
  "PAYROLL_SETTLEMENTS",
  "FINANCE",
  "OWNER_ADMIN",
  "ORG_OWNER_SUPER_ADMIN",
  "ACCOUNTING_AR",
];
const SETTLEMENT_EDIT_ROLES = [
  "admin",
  "payroll_manager",
  "PAYROLL_SETTLEMENTS",
  "FINANCE",
  "OWNER_ADMIN",
  "ORG_OWNER_SUPER_ADMIN",
];
const SETTLEMENT_APPROVE_ROLES = [
  "admin",
  "payroll_manager",
  "PAYROLL_SETTLEMENTS",
  "FINANCE",
  "OWNER_ADMIN",
  "ORG_OWNER_SUPER_ADMIN",
];
const DRIVER_ROLES = ["driver", "DRIVER_PORTAL"];
const CANONICAL_STATUSES = ["Draft", "Calculated", "Approved", "Paid"] as const;
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  Draft: ["Calculated"],
  Calculated: ["Approved"],
  Approved: ["Paid"],
  Paid: [],
};

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface LoadPnlResult {
  loadId: string;
  revenue: number;
  costs: number;
  margin: number;
  marginPercent: number;
  details: Array<{ account: string; type: string; amount: number }>;
}

export interface IftaAnalyzeResult {
  jurisdictionMiles: Record<string, number>;
  method: string;
  confidence: string;
}

export interface IftaSummaryRow {
  stateCode: string;
  totalMiles: number;
  totalGallons: number;
  taxableGallons: number;
  taxRate: number;
  taxRateSource: string;
  taxDue: number;
  taxPaidAtPump: number;
  netTax: number;
}

export interface IftaSummaryResult {
  quarter: string;
  year: string;
  rows: IftaSummaryRow[];
  totalMiles: number;
  totalGallons: number;
  fleetAvgMpg: number;
  netTaxDue: number;
}

export interface BatchSettlementResult {
  updated: number;
  blocked?: string[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const accountingService = {
  // --- Chart of Accounts ---

  async getChartOfAccounts(tenantId: string) {
    return accountingRepository.getChartOfAccounts(tenantId);
  },

  // --- Load P&L ---

  async calculateLoadPnl(
    tenantId: string,
    loadId: string,
  ): Promise<LoadPnlResult> {
    const rows = await accountingRepository.getLoadJournalAggregations(
      tenantId,
      loadId,
    );

    let revenue = 0;
    let costs = 0;
    const details = rows.map((r) => {
      const val =
        r.account_type === "Income"
          ? r.total_credit - r.total_debit
          : r.total_debit - r.total_credit;
      if (r.account_type === "Income") revenue += val;
      if (r.account_type === "Expense") costs += val;
      return {
        account: r.account_name,
        type: r.account_type,
        amount: val,
      };
    });

    return {
      loadId,
      revenue,
      costs,
      margin: revenue - costs,
      marginPercent: revenue > 0 ? ((revenue - costs) / revenue) * 100 : 0,
      details,
    };
  },

  // --- Financial Reports ---

  async getProfitLoss(companyId: string, startDate: string, endDate: string) {
    const rows = await accountingRepository.getJournalAggregationsByPeriod(
      companyId,
      startDate,
      endDate,
      ["Income", "Expense", "COGS"],
    );
    let revenue = 0;
    let expenses = 0;
    const details = rows.map((row) => {
      const amount =
        row.account_type === "Income"
          ? Number(row.total_credit) - Number(row.total_debit)
          : Number(row.total_debit) - Number(row.total_credit);
      if (row.account_type === "Income") revenue += amount;
      else expenses += amount;
      return {
        accountNumber: row.account_number,
        accountName: row.account_name,
        type: row.account_type,
        amount,
      };
    });
    return {
      revenue,
      expenses,
      netIncome: revenue - expenses,
      startDate,
      endDate,
      details,
    };
  },

  async getBalanceSheet(companyId: string, asOfDate: string) {
    const rows = await accountingRepository.getJournalAggregationsByPeriod(
      companyId,
      undefined,
      asOfDate,
    );
    let assets = 0;
    let liabilities = 0;
    let equity = 0;
    const details = rows.map((row) => {
      let amount: number;
      if (row.account_type === "Asset") {
        amount = Number(row.total_debit) - Number(row.total_credit);
        assets += amount;
      } else if (row.account_type === "Liability") {
        amount = Number(row.total_credit) - Number(row.total_debit);
        liabilities += amount;
      } else if (row.account_type === "Equity") {
        amount = Number(row.total_credit) - Number(row.total_debit);
        equity += amount;
      } else {
        amount =
          row.account_type === "Income"
            ? Number(row.total_credit) - Number(row.total_debit)
            : Number(row.total_debit) - Number(row.total_credit);
      }
      return {
        accountNumber: row.account_number,
        accountName: row.account_name,
        type: row.account_type,
        amount,
      };
    });
    return { assets, liabilities, equity, asOfDate, details };
  },

  async getTrialBalance(companyId: string) {
    const rows =
      await accountingRepository.getJournalAggregationsByPeriod(companyId);
    let totalDebits = 0;
    let totalCredits = 0;
    const accounts = rows.map((row) => {
      const debit = Number(row.total_debit);
      const credit = Number(row.total_credit);
      totalDebits += debit;
      totalCredits += credit;
      return {
        accountNumber: row.account_number,
        accountName: row.account_name,
        type: row.account_type,
        debit,
        credit,
      };
    });
    return { accounts, totalDebits, totalCredits };
  },

  // --- Journal Entry ---

  async postJournalEntry(
    tenantId: string,
    entry: JournalEntryInput,
  ): Promise<void> {
    const conn = await accountingRepository.getConnection();
    try {
      await conn.beginTransaction();
      await accountingRepository.createJournalEntry(tenantId, entry, conn);
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  },

  // --- Invoices ---

  async listInvoicesWithLines(tenantId: string) {
    const invoices = await accountingRepository.listInvoices(tenantId);
    return Promise.all(
      invoices.map(async (inv) => {
        const lines = await accountingRepository.getInvoiceLines(inv.id);
        return { ...inv, lines };
      }),
    );
  },

  async createInvoiceWithGlPosting(
    tenantId: string,
    invoice: InvoiceInput,
  ): Promise<void> {
    const conn = await accountingRepository.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Create invoice header + lines
      await accountingRepository.createInvoice(tenantId, invoice, conn);

      // 2. Auto-post to GL
      const entryId = uuidv4();
      await accountingRepository.createJournalEntry(
        tenantId,
        {
          id: entryId,
          entryDate: invoice.invoiceDate,
          referenceNumber: invoice.invoiceNumber,
          description: `Invoice ${invoice.invoiceNumber} for Load ${invoice.loadId}`,
          sourceDocumentType: "Invoice",
          sourceDocumentId: invoice.id,
          createdBy: "SYSTEM",
          lines: [],
        },
        conn,
      );

      // Debit AR
      await accountingRepository.insertJournalLine(
        conn,
        entryId,
        "GL-1200",
        invoice.totalAmount,
        0,
        "Load",
        invoice.loadId,
      );

      // Credit Revenue (itemized if lines exist)
      if (invoice.lines && Array.isArray(invoice.lines)) {
        for (const line of invoice.lines) {
          await accountingRepository.insertJournalLine(
            conn,
            entryId,
            line.glAccountId || "GL-4000",
            0,
            line.totalAmount,
            "Load",
            invoice.loadId,
          );
        }
      } else {
        await accountingRepository.insertJournalLine(
          conn,
          entryId,
          "GL-4000",
          0,
          invoice.totalAmount,
          "Load",
          invoice.loadId,
        );
      }

      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  },

  // --- Bills ---

  async listBillsWithLines(tenantId: string) {
    const bills = await accountingRepository.listBills(tenantId);
    return Promise.all(
      bills.map(async (bill) => {
        const lines = await accountingRepository.getBillLines(bill.id);
        return { ...bill, lines };
      }),
    );
  },

  async createBillWithGlPosting(
    tenantId: string,
    bill: BillInput,
  ): Promise<void> {
    const conn = await accountingRepository.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Create bill header + lines
      await accountingRepository.createBill(tenantId, bill, conn);

      // 2. Auto-post to GL
      const entryId = uuidv4();
      await accountingRepository.createJournalEntry(
        tenantId,
        {
          id: entryId,
          entryDate: bill.billDate,
          referenceNumber: bill.billNumber,
          description: `Bill ${bill.billNumber} from Vendor ${bill.vendorId}`,
          sourceDocumentType: "Bill",
          sourceDocumentId: bill.id,
          createdBy: "SYSTEM",
          lines: [],
        },
        conn,
      );

      // Credit AP
      await accountingRepository.insertJournalLineSimple(
        conn,
        entryId,
        "GL-2000",
        0,
        bill.totalAmount,
      );

      // Debit Expenses (itemized or generic)
      if (bill.lines && Array.isArray(bill.lines)) {
        for (const line of bill.lines) {
          await accountingRepository.insertJournalLine(
            conn,
            entryId,
            line.glAccountId || "GL-6100",
            line.amount,
            0,
            line.allocationType,
            line.allocationId,
          );
        }
      } else {
        await accountingRepository.insertJournalLine(
          conn,
          entryId,
          "GL-6100",
          bill.totalAmount,
          0,
          "Overhead",
          undefined,
        );
      }

      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  },

  // --- Settlements ---

  checkSettlementViewPermission(
    userRole: string,
  ): { allowed: true; isDriver: boolean } | { allowed: false } {
    const isDriver = DRIVER_ROLES.includes(userRole);
    const isAdmin = SETTLEMENT_ADMIN_ROLES.includes(userRole);
    if (!isDriver && !isAdmin) return { allowed: false };
    return { allowed: true, isDriver };
  },

  canCreateSettlement(userRole: string): boolean {
    return SETTLEMENT_EDIT_ROLES.includes(userRole);
  },

  canApproveSettlement(userRole: string): boolean {
    return SETTLEMENT_APPROVE_ROLES.includes(userRole);
  },

  async listSettlementsWithLines(tenantId: string, driverId?: string) {
    const settlements = await accountingRepository.listSettlements(
      tenantId,
      driverId,
    );
    return Promise.all(
      settlements.map(async (set) => {
        const lines = await accountingRepository.getSettlementLines(set.id);
        return { ...set, lines };
      }),
    );
  },

  async createSettlementWithGlPosting(
    tenantId: string,
    set: SettlementInput,
  ): Promise<void> {
    const conn = await accountingRepository.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Create settlement header + lines
      await accountingRepository.createSettlementHeader(tenantId, set, conn);
      await accountingRepository.createSettlementLines(set.id, set.lines, conn);

      // 2. Auto-post to GL
      const entryId = uuidv4();
      await accountingRepository.createJournalEntry(
        tenantId,
        {
          id: entryId,
          entryDate: set.settlementDate,
          referenceNumber: `SETTLE-${set.id.substring(0, 8)}`,
          description: `Settlement for Driver ${set.driverId}`,
          sourceDocumentType: "Settlement",
          sourceDocumentId: set.id,
          createdBy: "SYSTEM",
          lines: [],
        },
        conn,
      );

      // Net Pay (Credit Liability)
      await accountingRepository.insertJournalLineSimple(
        conn,
        entryId,
        "GL-2100",
        0,
        set.netPay,
      );

      // Post individual lines
      if (set.lines && Array.isArray(set.lines)) {
        for (const line of set.lines) {
          if (line.type === "Earning" || line.type === "Reimbursement") {
            await accountingRepository.insertJournalLine(
              conn,
              entryId,
              line.glAccountId || "GL-6000",
              line.amount,
              0,
              "Driver",
              set.driverId,
            );
          } else if (line.type === "Deduction") {
            await accountingRepository.insertJournalLine(
              conn,
              entryId,
              line.glAccountId || "GL-6000",
              0,
              line.amount,
              "Driver",
              set.driverId,
            );
          }
        }
      }

      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  },

  async batchUpdateSettlementStatus(
    tenantId: string,
    ids: string[],
    targetStatus: string,
  ): Promise<BatchSettlementResult> {
    // Normalize "Finalized" to canonical "Paid"
    const normalizedStatus =
      targetStatus === "Finalized" ? "Paid" : targetStatus;

    // Validate target status is canonical
    if (
      !CANONICAL_STATUSES.includes(
        normalizedStatus as (typeof CANONICAL_STATUSES)[number],
      )
    ) {
      throw new ValidationError(
        `Invalid status "${targetStatus}". Allowed: ${CANONICAL_STATUSES.join(", ")}`,
      );
    }

    // Fetch current statuses to enforce valid transitions
    const currentRows = await accountingRepository.getSettlementStatuses(
      tenantId,
      ids,
    );

    const blocked: string[] = [];
    const allowed: string[] = [];
    for (const row of currentRows) {
      const validNext = ALLOWED_TRANSITIONS[row.status] || [];
      if (validNext.includes(normalizedStatus)) {
        allowed.push(row.id);
      } else {
        blocked.push(
          `${row.id}: cannot transition from ${row.status} to ${normalizedStatus}`,
        );
      }
    }

    let updated = 0;
    if (allowed.length > 0) {
      updated = await accountingRepository.updateSettlementStatuses(
        tenantId,
        allowed,
        normalizedStatus,
      );
    }

    return {
      updated,
      blocked: blocked.length > 0 ? blocked : undefined,
    };
  },

  // --- IFTA ---

  async getIftaEvidence(tenantId: string, loadId: string) {
    return accountingRepository.getIftaEvidence(tenantId, loadId);
  },

  async analyzeIftaJurisdictions(
    pings: Array<{
      lat: number;
      lng: number;
      state_code?: string;
      stateCode?: string;
    }>,
  ): Promise<IftaAnalyzeResult> {
    const jurisdictionMiles: Record<string, number> = {};
    for (let i = 1; i < pings.length; i++) {
      const p1 = pings[i - 1];
      const p2 = pings[i];
      const dist = calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);
      const state =
        p2.state_code || p2.stateCode || (await detectState(p2.lat, p2.lng));
      if (state) {
        jurisdictionMiles[state] = (jurisdictionMiles[state] || 0) + dist;
      }
    }
    return {
      jurisdictionMiles,
      method: "ACTUAL_GPS",
      confidence: "HIGH",
    };
  },

  async lockIftaAudit(tenantId: string, audit: IftaAuditInput): Promise<void> {
    await accountingRepository.createIftaAudit(tenantId, audit);

    // Sync to legacy mileage_jurisdiction for backward compatibility
    for (const state in audit.jurisdictionMiles) {
      await accountingRepository.createMileageEntry(
        tenantId,
        audit.truckId,
        audit.loadId,
        state,
        audit.jurisdictionMiles[state],
        audit.tripDate,
        audit.method === "ACTUAL_GPS" ? "ELD" : "Manual",
      );
    }
  },

  async getIftaSummary(
    tenantId: string,
    quarter: string,
    year: string,
  ): Promise<IftaSummaryResult> {
    const qNum = parseInt(quarter, 10) || 4;
    const yNum = parseInt(year, 10) || new Date().getFullYear();
    if (qNum < 1 || qNum > 4) {
      throw new ValidationError("quarter must be 1-4");
    }

    const quarterEndDays: Record<number, string> = {
      1: "03-31",
      2: "06-30",
      3: "09-30",
      4: "12-31",
    };
    const quarterEnd = `${yNum}-${quarterEndDays[qNum]}`;

    const [rateRows, mileageRows, fuelRows] = await Promise.all([
      accountingRepository.getIftaTaxRates(quarterEnd),
      accountingRepository.getMileageByState(tenantId),
      accountingRepository.getFuelByState(tenantId),
    ]);

    const rateMap: Record<string, number> = {};
    for (const r of rateRows) {
      rateMap[r.state_code] = Number(r.rate_per_gallon);
    }

    const totalMilesAll = mileageRows.reduce(
      (sum, r) => sum + Number(r.total_miles),
      0,
    );
    const totalGallonsAll = fuelRows.reduce(
      (sum, r) => sum + Number(r.total_gallons),
      0,
    );
    const fleetAvgMpg =
      totalGallonsAll > 0 ? totalMilesAll / totalGallonsAll : 6.0;

    const rows: IftaSummaryRow[] = mileageRows.map((m) => {
      const f = fuelRows.find((fr) => fr.state_code === m.state_code) || {
        total_gallons: 0,
        total_cost: 0,
      };
      const totalMiles = Number(m.total_miles);
      const stateGallons = Number(f.total_gallons);
      const taxRate = rateMap[m.state_code] ?? 0.2;
      const taxableGallons = fleetAvgMpg > 0 ? totalMiles / fleetAvgMpg : 0;
      const taxDue = taxableGallons * taxRate;
      const taxPaidAtPump = stateGallons * taxRate;
      const netTax = taxDue - taxPaidAtPump;
      return {
        stateCode: m.state_code,
        totalMiles,
        totalGallons: stateGallons,
        taxableGallons: Math.round(taxableGallons * 100) / 100,
        taxRate,
        taxRateSource: "IRP",
        taxDue: Math.round(taxDue * 100) / 100,
        taxPaidAtPump: Math.round(taxPaidAtPump * 100) / 100,
        netTax: Math.round(netTax * 100) / 100,
      };
    });

    const totalMiles = rows.reduce((s, r) => s + r.totalMiles, 0);
    const totalGallons = rows.reduce((s, r) => s + r.totalGallons, 0);
    const netTaxDue = rows.reduce((s, r) => s + r.netTax, 0);

    return {
      quarter,
      year,
      rows,
      totalMiles,
      totalGallons,
      fleetAvgMpg: Math.round(fleetAvgMpg * 100) / 100,
      netTaxDue: Math.round(netTaxDue * 100) / 100,
    };
  },

  async postIftaTaxes(
    tenantId: string,
    quarter: string | number,
    year: string | number,
    netTaxDue: number,
  ): Promise<void> {
    const conn = await accountingRepository.getConnection();
    try {
      await conn.beginTransaction();
      await accountingRepository.createIftaJournalEntry(
        tenantId,
        quarter,
        year,
        netTaxDue,
        conn,
      );
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  },

  // --- Mileage ---

  async listMileage(tenantId: string) {
    return accountingRepository.listMileage(tenantId);
  },

  async createMileage(tenantId: string, input: MileageInput): Promise<void> {
    await accountingRepository.createMileageEntry(
      tenantId,
      input.truckId,
      input.loadId,
      input.stateCode,
      input.miles,
      input.date,
      input.source || "Manual",
    );
  },

  // --- Fuel Receipt ---

  async createFuelReceipt(
    tenantId: string,
    receipt: FuelReceiptInput,
  ): Promise<string> {
    return accountingRepository.createFuelReceipt(tenantId, receipt);
  },

  // --- Adjustments ---

  async createAdjustment(
    tenantId: string,
    adj: AdjustmentInput,
  ): Promise<void> {
    return accountingRepository.createAdjustment(tenantId, adj);
  },

  // --- Batch Import ---

  async batchImport(
    tenantId: string,
    type: string,
    data: BatchImportItem[],
  ): Promise<number> {
    const conn = await accountingRepository.getConnection();
    try {
      await conn.beginTransaction();
      for (const item of data) {
        if (type === "Fuel") {
          await accountingRepository.batchImportFuel(tenantId, item, conn);
        } else if (type === "Bills") {
          await accountingRepository.batchImportBill(tenantId, item, conn);
        } else if (type === "Invoices") {
          await accountingRepository.batchImportInvoice(tenantId, item, conn);
        } else if (type === "Settlements") {
          await accountingRepository.batchImportSettlement(
            tenantId,
            item,
            conn,
          );
        }
      }
      await conn.commit();
      return data.length;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  },
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
