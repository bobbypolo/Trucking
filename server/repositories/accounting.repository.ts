import { v4 as uuidv4 } from "uuid";
import pool from "../db";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import type { PoolConnection } from "mysql2/promise";

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface GlAccountRow extends RowDataPacket {
  id: string;
  company_id: string;
  account_number: string;
  name: string;
  type: string;
  is_active: boolean;
}

export interface JournalLineAggRow extends RowDataPacket {
  allocation_id: string;
  account_name: string;
  account_type: string;
  total_debit: number;
  total_credit: number;
}

export interface JournalPeriodAggRow extends RowDataPacket {
  account_number: string;
  account_name: string;
  account_type: string;
  total_debit: number;
  total_credit: number;
}

export interface InvoiceRow extends RowDataPacket {
  id: string;
  company_id: string;
  customer_id: string;
  load_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  total_amount: number;
  balance_due: number;
}

export interface InvoiceLineRow extends RowDataPacket {
  id: string;
  invoice_id: string;
  catalog_item_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  gl_account_id: string;
}

export interface BillRow extends RowDataPacket {
  id: string;
  company_id: string;
  vendor_id: string;
  bill_number: string;
  bill_date: string;
  due_date: string;
  status: string;
  total_amount: number;
  balance_due: number;
}

export interface BillLineRow extends RowDataPacket {
  id: string;
  bill_id: string;
  description: string;
  amount: number;
  gl_account_id: string;
  allocation_type: string;
  allocation_id: string;
}

export interface DriverSettlementRow extends RowDataPacket {
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
}

export interface SettlementLineRow extends RowDataPacket {
  id: string;
  settlement_id: string;
  description: string;
  amount: number;
  load_id: string | null;
  gl_account_id: string | null;
  type: string;
}

export interface IftaEvidenceRow extends RowDataPacket {
  id: string;
  company_id: string;
  load_id: string;
  timestamp: string;
}

export interface IftaTaxRateRow extends RowDataPacket {
  state_code: string;
  rate_per_gallon: number;
}

export interface MileageRow extends RowDataPacket {
  state_code: string;
  total_miles: number;
}

export interface FuelRow extends RowDataPacket {
  state_code: string;
  total_gallons: number;
  total_cost: number;
}

export interface MileageJurisdictionRow extends RowDataPacket {
  id: string;
  company_id: string;
  truck_id: string;
  load_id: string;
  state_code: string;
  miles: number;
  date: string;
  source: string;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface JournalEntryInput {
  id: string;
  entryDate: string;
  referenceNumber: string;
  description: string;
  sourceDocumentType: string;
  sourceDocumentId: string;
  createdBy: string;
  lines: Array<{
    id?: string;
    glAccountId: string;
    debit: number;
    credit: number;
    allocationType?: string;
    allocationId?: string;
    notes?: string;
  }>;
}

export interface InvoiceInput {
  id: string;
  customerId: string;
  loadId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  totalAmount: number;
  lines?: Array<{
    id?: string;
    catalogItemId?: string;
    description: string;
    quantity?: number;
    unitPrice: number;
    totalAmount: number;
    glAccountId?: string;
  }>;
}

export interface BillInput {
  id: string;
  vendorId: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  status: string;
  totalAmount: number;
  lines?: Array<{
    id?: string;
    description: string;
    amount: number;
    glAccountId?: string;
    allocationType?: string;
    allocationId?: string;
  }>;
}

export interface SettlementInput {
  id: string;
  driverId: string;
  settlementDate: string;
  periodStart?: string;
  periodEnd?: string;
  totalEarnings: number;
  totalDeductions: number;
  totalReimbursements: number;
  netPay: number;
  status?: string;
  lines?: Array<{
    id?: string;
    description: string;
    amount: number;
    loadId?: string;
    glAccountId?: string;
    type: string;
  }>;
}

export interface IftaAuditInput {
  truckId?: string;
  loadId?: string;
  tripDate: string;
  startOdometer?: number;
  endOdometer?: number;
  totalMiles: number;
  method: string;
  confidenceLevel: string;
  jurisdictionMiles: Record<string, number>;
  attestedBy?: string;
}

export interface MileageInput {
  truckId?: string;
  loadId?: string;
  date: string;
  stateCode: string;
  miles: number;
  source?: string;
}

export interface FuelReceiptInput {
  vendorName: string;
  gallons: number;
  pricePerGallon: number;
  totalCost: number;
  transactionDate: string;
  stateCode: string;
  truckId?: string;
  cardNumber?: string;
}

export interface AdjustmentInput {
  parentEntityType: string;
  parentEntityId: string;
  reasonCode?: string;
  description?: string;
  amountAdjustment: number;
  createdBy?: string;
}

export interface BatchImportItem {
  id?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const accountingRepository = {
  // --- Chart of Accounts ---

  async getChartOfAccounts(tenantId: string): Promise<GlAccountRow[]> {
    const [rows] = await pool.query<GlAccountRow[]>(
      "SELECT * FROM gl_accounts WHERE company_id = ? AND is_active = TRUE ORDER BY account_number ASC",
      [tenantId],
    );
    return rows;
  },

  // --- Load P&L ---

  async getLoadJournalAggregations(
    tenantId: string,
    loadId: string,
  ): Promise<JournalLineAggRow[]> {
    const [rows] = await pool.query<JournalLineAggRow[]>(
      `SELECT
          jl.allocation_id,
          a.name as account_name,
          a.type as account_type,
          SUM(jl.debit) as total_debit,
          SUM(jl.credit) as total_credit
       FROM journal_lines jl
       JOIN gl_accounts a ON jl.gl_account_id = a.id
       JOIN journal_entries je ON jl.journal_entry_id = je.id
       WHERE jl.allocation_type = 'Load' AND jl.allocation_id = ? AND je.company_id = ?
       GROUP BY jl.gl_account_id, a.name, a.type`,
      [loadId, tenantId],
    );
    return rows;
  },

  async getJournalAggregationsByPeriod(
    companyId: string,
    startDate?: string,
    endDate?: string,
    accountTypes?: string[],
  ): Promise<JournalPeriodAggRow[]> {
    const conditions: string[] = ["je.company_id = ?"];
    const params: (string | string[])[] = [companyId];

    if (startDate) {
      conditions.push("je.entry_date >= ?");
      params.push(startDate);
    }
    if (endDate) {
      conditions.push("je.entry_date <= ?");
      params.push(endDate);
    }
    if (accountTypes && accountTypes.length > 0) {
      conditions.push(`a.type IN (${accountTypes.map(() => "?").join(",")})`);
      params.push(...accountTypes);
    }

    const [rows] = await pool.query<JournalPeriodAggRow[]>(
      `SELECT
          a.account_number, a.name AS account_name, a.type AS account_type,
          SUM(jl.debit) as total_debit, SUM(jl.credit) as total_credit
       FROM journal_lines jl
       JOIN journal_entries je ON jl.journal_entry_id = je.id
       JOIN gl_accounts a ON jl.gl_account_id = a.id
       WHERE ${conditions.join(" AND ")}
       GROUP BY a.id, a.account_number, a.name, a.type
       ORDER BY a.account_number`,
      params,
    );
    return rows;
  },

  // --- Journal Entries ---

  async createJournalEntry(
    tenantId: string,
    entry: JournalEntryInput,
    conn?: PoolConnection,
  ): Promise<void> {
    const db = conn ?? pool;
    await db.query(
      "INSERT INTO journal_entries (id, company_id, entry_date, reference_number, description, source_document_type, source_document_id, posted_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)",
      [
        entry.id,
        tenantId,
        entry.entryDate,
        entry.referenceNumber,
        entry.description,
        entry.sourceDocumentType,
        entry.sourceDocumentId,
        entry.createdBy,
      ],
    );

    for (const line of entry.lines) {
      await db.query(
        "INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit, allocation_type, allocation_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          line.id || uuidv4(),
          entry.id,
          line.glAccountId,
          line.debit || 0,
          line.credit || 0,
          line.allocationType,
          line.allocationId,
          line.notes,
        ],
      );
    }
  },

  // --- Journal Line helpers (for GL auto-posting) ---

  async insertJournalLine(
    conn: PoolConnection,
    entryId: string,
    glAccountId: string,
    debit: number,
    credit: number,
    allocationType?: string,
    allocationId?: string,
  ): Promise<void> {
    await conn.query(
      "INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit, allocation_type, allocation_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        uuidv4(),
        entryId,
        glAccountId,
        debit,
        credit,
        allocationType,
        allocationId,
      ],
    );
  },

  async insertJournalLineSimple(
    conn: PoolConnection,
    entryId: string,
    glAccountId: string,
    debit: number,
    credit: number,
  ): Promise<void> {
    await conn.query(
      "INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit) VALUES (?, ?, ?, ?, ?)",
      [uuidv4(), entryId, glAccountId, debit, credit],
    );
  },

  // --- AR Invoices ---

  async listInvoices(tenantId: string): Promise<InvoiceRow[]> {
    const [rows] = await pool.query<InvoiceRow[]>(
      "SELECT * FROM ar_invoices WHERE company_id = ? ORDER BY invoice_date DESC",
      [tenantId],
    );
    return rows;
  },

  async getInvoiceLines(invoiceId: string): Promise<InvoiceLineRow[]> {
    const [rows] = await pool.query<InvoiceLineRow[]>(
      "SELECT * FROM ar_invoice_lines WHERE invoice_id = ?",
      [invoiceId],
    );
    return rows;
  },

  async createInvoice(
    tenantId: string,
    invoice: InvoiceInput,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.query(
      "INSERT INTO ar_invoices (id, company_id, customer_id, load_id, invoice_number, invoice_date, due_date, status, total_amount, balance_due) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        invoice.id,
        tenantId,
        invoice.customerId,
        invoice.loadId,
        invoice.invoiceNumber,
        invoice.invoiceDate,
        invoice.dueDate,
        invoice.status,
        invoice.totalAmount,
        invoice.totalAmount,
      ],
    );

    if (invoice.lines && Array.isArray(invoice.lines)) {
      for (const line of invoice.lines) {
        await conn.query(
          "INSERT INTO ar_invoice_lines (id, invoice_id, catalog_item_id, description, quantity, unit_price, total_amount, gl_account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            line.id || uuidv4(),
            invoice.id,
            line.catalogItemId,
            line.description,
            line.quantity || 1,
            line.unitPrice,
            line.totalAmount,
            line.glAccountId,
          ],
        );
      }
    }
  },

  // --- AP Bills ---

  async listBills(tenantId: string): Promise<BillRow[]> {
    const [rows] = await pool.query<BillRow[]>(
      "SELECT * FROM ap_bills WHERE company_id = ? ORDER BY bill_date DESC",
      [tenantId],
    );
    return rows;
  },

  async getBillLines(billId: string): Promise<BillLineRow[]> {
    const [rows] = await pool.query<BillLineRow[]>(
      "SELECT * FROM ap_bill_lines WHERE bill_id = ?",
      [billId],
    );
    return rows;
  },

  async createBill(
    tenantId: string,
    bill: BillInput,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.query(
      "INSERT INTO ap_bills (id, company_id, vendor_id, bill_number, bill_date, due_date, status, total_amount, balance_due) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        bill.id,
        tenantId,
        bill.vendorId,
        bill.billNumber,
        bill.billDate,
        bill.dueDate,
        bill.status,
        bill.totalAmount,
        bill.totalAmount,
      ],
    );

    if (bill.lines && Array.isArray(bill.lines)) {
      for (const line of bill.lines) {
        await conn.query(
          "INSERT INTO ap_bill_lines (id, bill_id, description, amount, gl_account_id, allocation_type, allocation_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            line.id || uuidv4(),
            bill.id,
            line.description,
            line.amount,
            line.glAccountId,
            line.allocationType || "Overhead",
            line.allocationId,
          ],
        );
      }
    }
  },

  // --- Settlements ---

  async listSettlements(
    tenantId: string,
    driverId?: string,
  ): Promise<DriverSettlementRow[]> {
    let query = "SELECT * FROM driver_settlements WHERE company_id = ?";
    const params: (string | undefined)[] = [tenantId];

    if (driverId) {
      query += " AND driver_id = ?";
      params.push(driverId);
    }

    query += " ORDER BY settlement_date DESC";
    const [rows] = await pool.query<DriverSettlementRow[]>(query, params);
    return rows;
  },

  async getSettlementLines(settlementId: string): Promise<SettlementLineRow[]> {
    const [rows] = await pool.query<SettlementLineRow[]>(
      "SELECT * FROM settlement_lines WHERE settlement_id = ?",
      [settlementId],
    );
    return rows;
  },

  async createSettlementHeader(
    tenantId: string,
    set: SettlementInput,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.query(
      "INSERT INTO driver_settlements (id, company_id, driver_id, settlement_date, period_start, period_end, total_earnings, total_deductions, total_reimbursements, net_pay, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        set.id,
        tenantId,
        set.driverId,
        set.settlementDate,
        set.periodStart,
        set.periodEnd,
        set.totalEarnings,
        set.totalDeductions,
        set.totalReimbursements,
        set.netPay,
        set.status || "Draft",
      ],
    );
  },

  async createSettlementLines(
    settlementId: string,
    lines: SettlementInput["lines"],
    conn: PoolConnection,
  ): Promise<void> {
    if (!lines || !Array.isArray(lines)) return;
    for (const line of lines) {
      await conn.query(
        "INSERT INTO settlement_lines (id, settlement_id, description, amount, load_id, gl_account_id, type) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          line.id || uuidv4(),
          settlementId,
          line.description,
          line.amount,
          line.loadId,
          line.glAccountId,
          line.type,
        ],
      );
    }
  },

  async getSettlementStatuses(
    tenantId: string,
    ids: string[],
  ): Promise<RowDataPacket[]> {
    const placeholders = ids.map(() => "?").join(",");
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, status FROM driver_settlements WHERE company_id = ? AND id IN (${placeholders})`,
      [tenantId, ...ids],
    );
    return rows;
  },

  async updateSettlementStatuses(
    tenantId: string,
    ids: string[],
    status: string,
  ): Promise<number> {
    const placeholders = ids.map(() => "?").join(",");
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE driver_settlements SET status = ? WHERE company_id = ? AND id IN (${placeholders})`,
      [status, tenantId, ...ids],
    );
    return result.affectedRows || 0;
  },

  // --- IFTA ---

  async getIftaEvidence(
    tenantId: string,
    loadId: string,
  ): Promise<IftaEvidenceRow[]> {
    const [rows] = await pool.query<IftaEvidenceRow[]>(
      "SELECT * FROM ifta_trip_evidence WHERE company_id = ? AND load_id = ? ORDER BY timestamp ASC",
      [tenantId, loadId],
    );
    return rows;
  },

  async createIftaAudit(
    tenantId: string,
    audit: IftaAuditInput,
  ): Promise<void> {
    await pool.query(
      "INSERT INTO ifta_trips_audit (id, company_id, truck_id, load_id, trip_date, start_odometer, end_odometer, total_miles, method, confidence_level, jurisdiction_miles, status, attested_by, attested_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
      [
        uuidv4(),
        tenantId,
        audit.truckId,
        audit.loadId,
        audit.tripDate,
        audit.startOdometer,
        audit.endOdometer,
        audit.totalMiles,
        audit.method,
        audit.confidenceLevel,
        JSON.stringify(audit.jurisdictionMiles),
        "LOCKED",
        audit.attestedBy,
      ],
    );
  },

  async createMileageEntry(
    tenantId: string,
    truckId: string | undefined,
    loadId: string | undefined,
    stateCode: string,
    miles: number,
    date: string,
    source: string,
  ): Promise<void> {
    await pool.query(
      "INSERT INTO mileage_jurisdiction (id, company_id, truck_id, load_id, state_code, miles, date, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [uuidv4(), tenantId, truckId, loadId, stateCode, miles, date, source],
    );
  },

  // --- IFTA Summary queries ---

  async getIftaTaxRates(quarterEnd: string): Promise<IftaTaxRateRow[]> {
    const [rows] = await pool.query<IftaTaxRateRow[]>(
      `SELECT r.state_code, r.rate_per_gallon FROM ifta_tax_rates r
       INNER JOIN (SELECT state_code, MAX(effective_date) as max_date FROM ifta_tax_rates WHERE effective_date <= ? GROUP BY state_code) latest
       ON r.state_code = latest.state_code AND r.effective_date = latest.max_date`,
      [quarterEnd],
    );
    return rows;
  },

  async getMileageByState(tenantId: string): Promise<MileageRow[]> {
    const [rows] = await pool.query<MileageRow[]>(
      "SELECT state_code, SUM(miles) as total_miles FROM mileage_jurisdiction WHERE company_id = ? GROUP BY state_code",
      [tenantId],
    );
    return rows;
  },

  async getFuelByState(tenantId: string): Promise<FuelRow[]> {
    const [rows] = await pool.query<FuelRow[]>(
      "SELECT state_code, SUM(gallons) as total_gallons, SUM(total_cost) as total_cost FROM fuel_ledger WHERE company_id = ? GROUP BY state_code",
      [tenantId],
    );
    return rows;
  },

  // --- Mileage list ---

  async listMileage(tenantId: string): Promise<MileageJurisdictionRow[]> {
    const [rows] = await pool.query<MileageJurisdictionRow[]>(
      "SELECT * FROM mileage_jurisdiction WHERE company_id = ? ORDER BY entry_date DESC LIMIT 50",
      [tenantId],
    );
    return rows;
  },

  // --- Fuel Receipt ---

  async createFuelReceipt(
    tenantId: string,
    receipt: FuelReceiptInput,
  ): Promise<string> {
    const id = uuidv4();
    await pool.query(
      `INSERT INTO fuel_ledger
         (id, company_id, truck_id, state_code, gallons, total_cost,
          price_per_gallon, vendor_name, entry_date, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Receipt')`,
      [
        id,
        tenantId,
        receipt.truckId || null,
        receipt.stateCode,
        receipt.gallons,
        receipt.totalCost,
        receipt.pricePerGallon,
        receipt.vendorName,
        receipt.transactionDate,
      ],
    );
    return id;
  },

  // --- IFTA Post (GL posting) ---

  async createIftaJournalEntry(
    tenantId: string,
    quarter: string | number,
    year: string | number,
    netTaxDue: number,
    conn: PoolConnection,
  ): Promise<void> {
    const entryId = uuidv4();
    await conn.query(
      "INSERT INTO journal_entries (id, company_id, entry_date, reference_number, description, source_document_type) VALUES (?, ?, NOW(), ?, ?, ?)",
      [
        entryId,
        tenantId,
        `IFTA-Q${quarter}-${year}`,
        `IFTA Tax Liability Q${quarter} ${year}`,
        "IFTA_POSTING",
      ],
    );
    // Debit IFTA Expense
    await conn.query(
      "INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit) VALUES (?, ?, ?, ?, ?)",
      [uuidv4(), entryId, "GL-6900", netTaxDue, 0],
    );
    // Credit IFTA Payable
    await conn.query(
      "INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit) VALUES (?, ?, ?, ?, ?)",
      [uuidv4(), entryId, "GL-2200", 0, netTaxDue],
    );
  },

  // --- Adjustments ---

  async createAdjustment(
    tenantId: string,
    adj: AdjustmentInput,
  ): Promise<void> {
    await pool.query(
      "INSERT INTO adjustment_entries (id, company_id, parent_entity_type, parent_entity_id, reason_code, description, amount_adjustment, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        uuidv4(),
        tenantId,
        adj.parentEntityType,
        adj.parentEntityId,
        adj.reasonCode,
        adj.description,
        adj.amountAdjustment,
        adj.createdBy,
      ],
    );
  },

  // --- Batch Import ---

  async batchImportFuel(
    tenantId: string,
    item: BatchImportItem,
    conn: PoolConnection,
  ): Promise<void> {
    const id = (item.id as string) || uuidv4();
    await conn.query(
      `INSERT INTO fuel_ledger
         (id, company_id, state_code, gallons, total_cost, entry_date,
          truck_id, vendor_name, price_per_gallon, receipt_url, source, load_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tenantId,
        item.stateCode,
        item.gallons,
        item.totalCost,
        item.date,
        item.truckId,
        (item.vendorName as string) ?? null,
        (item.pricePerGallon as number) ?? null,
        (item.receiptUrl as string) ?? null,
        (item.source as string) ?? "Import",
        (item.loadId as string) ?? null,
      ],
    );
  },

  async batchImportBill(
    tenantId: string,
    item: BatchImportItem,
    conn: PoolConnection,
  ): Promise<void> {
    const id = (item.id as string) || uuidv4();
    await conn.query(
      "INSERT INTO ap_bills (id, company_id, bill_number, total_amount, bill_date, status) VALUES (?, ?, ?, ?, ?, ?)",
      [
        id,
        tenantId,
        item.billNumber,
        item.totalAmount,
        item.billDate,
        (item.status as string) || "Draft",
      ],
    );
  },

  async batchImportInvoice(
    tenantId: string,
    item: BatchImportItem,
    conn: PoolConnection,
  ): Promise<void> {
    const id = (item.id as string) || uuidv4();
    await conn.query(
      "INSERT INTO ar_invoices (id, company_id, invoice_number, total_amount, invoice_date, status, customer_id, load_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        tenantId,
        item.invoiceNumber,
        item.totalAmount,
        item.invoiceDate,
        (item.status as string) || "Draft",
        item.customerId,
        item.loadId,
      ],
    );
  },

  async batchImportSettlement(
    tenantId: string,
    item: BatchImportItem,
    conn: PoolConnection,
  ): Promise<void> {
    const id = (item.id as string) || uuidv4();
    await conn.query(
      "INSERT INTO driver_settlements (id, company_id, driver_id, settlement_date, net_pay, status) VALUES (?, ?, ?, ?, ?, ?)",
      [
        id,
        tenantId,
        item.driverId,
        item.settlementDate,
        item.netPay,
        (item.status as string) || "Draft",
      ],
    );
  },

  // --- Connection helper ---

  async getConnection(): Promise<PoolConnection> {
    return pool.getConnection();
  },
};
