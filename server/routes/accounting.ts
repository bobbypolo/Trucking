import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import pool from "../db";
import { detectState, calculateDistance } from "../geoUtils";
import { validateBody } from "../middleware/validate";
import { createSettlementSchema } from "../schemas/settlements";
import {
  createJournalEntrySchema,
  createInvoiceSchema,
  createBillSchema,
  createDocumentVaultSchema,
  batchImportSchema,
  batchUpdateSettlementsSchema,
} from "../schemas/accounting";
import { createChildLogger } from "../lib/logger";

const router = Router();

// --- UNIFIED FINANCIAL LEDGER ---

// Chart of Accounts
router.get(
  "/api/accounting/accounts",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const [rows] = await pool.query(
        "SELECT * FROM gl_accounts WHERE tenant_id = ? AND is_active = TRUE ORDER BY account_number ASC",
        [tenantId],
      );
      res.json(rows);
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/accounting/accounts",
      });
      log.error({ err: error }, "SERVER ERROR [GET /api/accounting/accounts]");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// Load P&L (True Profitability Engine)
router.get(
  "/api/accounting/load-pl/:loadId",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const loadId = req.params.loadId;

      // Fetch revenue vs expense from journal lines allocated to this load
      const [rows]: any = await pool.query(
        `
            SELECT
                jl.allocation_id,
                a.name as account_name,
                a.type as account_type,
                SUM(jl.debit) as total_debit,
                SUM(jl.credit) as total_credit
            FROM journal_lines jl
            JOIN gl_accounts a ON jl.gl_account_id = a.id
            JOIN journal_entries je ON jl.journal_entry_id = je.id
            WHERE jl.allocation_type = 'Load' AND jl.allocation_id = ? AND je.tenant_id = ?
            GROUP BY jl.gl_account_id, a.name, a.type
        `,
        [loadId, tenantId],
      );

      let revenue = 0;
      let costs = 0;
      const details = rows.map((r: any) => {
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

      res.json({
        loadId,
        revenue,
        costs,
        margin: revenue - costs,
        marginPercent: revenue > 0 ? ((revenue - costs) / revenue) * 100 : 0,
        details,
      });
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/accounting/load-pl",
      });
      log.error({ err: error }, "SERVER ERROR [GET /api/accounting/load-pl]");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// Journal Entry Posting
router.post(
  "/api/accounting/journal",
  requireAuth,
  requireTenant,
  validateBody(createJournalEntrySchema),
  async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const {
      id,
      entryDate,
      referenceNumber,
      description,
      sourceDocumentType,
      sourceDocumentId,
      createdBy,
      lines,
    } = req.body;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Post Header — always use auth-derived tenantId
      await connection.query(
        "INSERT INTO journal_entries (id, tenant_id, entry_date, reference_number, description, source_document_type, source_document_id, posted_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)",
        [
          id,
          tenantId,
          entryDate,
          referenceNumber,
          description,
          sourceDocumentType,
          sourceDocumentId,
          createdBy,
        ],
      );

      // 2. Post Lines
      for (const line of lines) {
        await connection.query(
          "INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit, allocation_type, allocation_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            line.id || uuidv4(),
            id,
            line.glAccountId,
            line.debit || 0,
            line.credit || 0,
            line.allocationType,
            line.allocationId,
            line.notes,
          ],
        );
      }

      await connection.commit();
      res.status(201).json({ message: "Journal entry posted" });
    } catch (error) {
      await connection.rollback();
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/accounting/journal",
      });
      log.error({ err: error }, "SERVER ERROR [POST /api/accounting/journal]");
      res.status(500).json({ error: "Failed to post journal entry" });
    } finally {
      connection.release();
    }
  },
);

// AR Invoices
router.post(
  "/api/accounting/invoices",
  requireAuth,
  requireTenant,
  validateBody(createInvoiceSchema),
  async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const invoice = req.body;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Create Invoice Header — always use auth-derived tenantId
      await connection.query(
        "INSERT INTO ar_invoices (id, tenant_id, customer_id, load_id, invoice_number, invoice_date, due_date, status, total_amount, balance_due) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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

      // 2. Create Invoice Lines (V3)
      if (invoice.lines && Array.isArray(invoice.lines)) {
        for (const line of invoice.lines) {
          await connection.query(
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

      // 3. AUTO-POST TO GL — always use auth-derived tenantId
      const entryId = uuidv4();
      await connection.query(
        "INSERT INTO journal_entries (id, tenant_id, entry_date, reference_number, description, source_document_type, source_document_id, posted_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)",
        [
          entryId,
          tenantId,
          invoice.invoiceDate,
          invoice.invoiceNumber,
          `Invoice ${invoice.invoiceNumber} for Load ${invoice.loadId}`,
          "Invoice",
          invoice.id,
          "SYSTEM",
        ],
      );

      // Debit AR
      await connection.query(
        "INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit, allocation_type, allocation_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          uuidv4(),
          entryId,
          "GL-1200",
          invoice.totalAmount,
          0,
          "Load",
          invoice.loadId,
        ],
      );

      // Credit Revenue (Itemized if lines exist, otherwise generic)
      if (invoice.lines && Array.isArray(invoice.lines)) {
        for (const line of invoice.lines) {
          await connection.query(
            "INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit, allocation_type, allocation_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
              uuidv4(),
              entryId,
              line.glAccountId || "GL-4000",
              0,
              line.totalAmount,
              "Load",
              invoice.loadId,
            ],
          );
        }
      } else {
        await connection.query(
          "INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit, allocation_type, allocation_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            uuidv4(),
            entryId,
            "GL-4000",
            0,
            invoice.totalAmount,
            "Load",
            invoice.loadId,
          ],
        );
      }

      await connection.commit();
      res.status(201).json({ message: "Invoice created and posted to GL" });
    } catch (error) {
      await connection.rollback();
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/accounting/invoices",
      });
      log.error({ err: error }, "SERVER ERROR [POST /api/accounting/invoices]");
      res.status(500).json({ error: "Failed to create invoice" });
    } finally {
      connection.release();
    }
  },
);

// AP Bills
router.post(
  "/api/accounting/bills",
  requireAuth,
  requireTenant,
  validateBody(createBillSchema),
  async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const bill = req.body;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Create Bill Header — always use auth-derived tenantId
      await connection.query(
        "INSERT INTO ap_bills (id, tenant_id, vendor_id, bill_number, bill_date, due_date, status, total_amount, balance_due) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
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

      // 2. Create Bill Lines (V3)
      if (bill.lines && Array.isArray(bill.lines)) {
        for (const line of bill.lines) {
          await connection.query(
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

      // 3. AUTO-POST TO GL — always use auth-derived tenantId
      const entryId = uuidv4();
      await connection.query(
        "INSERT INTO journal_entries (id, tenant_id, entry_date, reference_number, description, source_document_type, source_document_id, posted_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)",
        [
          entryId,
          tenantId,
          bill.billDate,
          bill.billNumber,
          `Bill ${bill.billNumber} from Vendor ${bill.vendorId}`,
          "Bill",
          bill.id,
          "SYSTEM",
        ],
      );

      // Header post for AP liability (Credit Accounts Payable)
      await connection.query(
        "INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit) VALUES (?, ?, ?, ?, ?)",
        [uuidv4(), entryId, "GL-2000", 0, bill.totalAmount],
      );

      // Detail lines post to expenses (Debit Expenses)
      if (bill.lines && Array.isArray(bill.lines)) {
        for (const line of bill.lines) {
          await connection.query(
            "INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit, allocation_type, allocation_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
              uuidv4(),
              entryId,
              line.glAccountId || "GL-6100",
              line.amount,
              0,
              line.allocationType,
              line.allocationId,
            ],
          );
        }
      } else {
        // Generic fallback if no lines provided
        await connection.query(
          "INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit, allocation_type, allocation_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [uuidv4(), entryId, "GL-6100", bill.totalAmount, 0, "Overhead", null],
        );
      }

      await connection.commit();
      res.status(201).json({ message: "Bill created and posted to GL" });
    } catch (error) {
      await connection.rollback();
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/accounting/bills",
      });
      log.error({ err: error }, "SERVER ERROR [POST /api/accounting/bills]");
      res.status(500).json({ error: "Failed to create bill" });
    } finally {
      connection.release();
    }
  },
);

// --- ACCOUNTING V3 EXTENSIONS ---

// AR Invoices List
router.get(
  "/api/accounting/invoices",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const [rows]: any = await pool.query(
        "SELECT * FROM ar_invoices WHERE tenant_id = ? ORDER BY invoice_date DESC",
        [tenantId],
      );
      const enriched = await Promise.all(
        rows.map(async (inv: any) => {
          const [lines] = await pool.query(
            "SELECT * FROM ar_invoice_lines WHERE invoice_id = ?",
            [inv.id],
          );
          return { ...inv, lines };
        }),
      );
      res.json(enriched);
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/accounting/invoices",
      });
      log.error({ err: error }, "SERVER ERROR [GET /api/accounting/invoices]");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// AP Bills List
router.get(
  "/api/accounting/bills",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const [rows]: any = await pool.query(
        "SELECT * FROM ap_bills WHERE tenant_id = ? ORDER BY bill_date DESC",
        [tenantId],
      );
      const enriched = await Promise.all(
        rows.map(async (bill: any) => {
          const [lines] = await pool.query(
            "SELECT * FROM ap_bill_lines WHERE bill_id = ?",
            [bill.id],
          );
          return { ...bill, lines };
        }),
      );
      res.json(enriched);
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/accounting/bills",
      });
      log.error({ err: error }, "SERVER ERROR [GET /api/accounting/bills]");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// Driver Settlements List
router.get(
  "/api/accounting/settlements",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { driverId } = req.query;
      let query = "SELECT * FROM driver_settlements WHERE tenant_id = ?";
      const params: any[] = [tenantId];
      if (driverId) {
        query += " AND driver_id = ?";
        params.push(driverId);
      }
      query += " ORDER BY settlement_date DESC";
      const [rows]: any = await pool.query(query, params);
      const enriched = await Promise.all(
        rows.map(async (set: any) => {
          const [lines] = await pool.query(
            "SELECT * FROM settlement_lines WHERE settlement_id = ?",
            [set.id],
          );
          return { ...set, lines };
        }),
      );
      res.json(enriched);
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/accounting/settlements",
      });
      log.error(
        { err: error },
        "SERVER ERROR [GET /api/accounting/settlements]",
      );
      res.status(500).json({ error: "Database error" });
    }
  },
);

router.post(
  "/api/accounting/settlements",
  requireAuth,
  requireTenant,
  validateBody(createSettlementSchema),
  async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const set = req.body;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Create Settlement Header — always use auth-derived tenantId
      await connection.query(
        "INSERT INTO driver_settlements (id, tenant_id, driver_id, settlement_date, period_start, period_end, total_earnings, total_deductions, total_reimbursements, net_pay, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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

      // 2. Create Settlement Lines (V3)
      if (set.lines && Array.isArray(set.lines)) {
        for (const line of set.lines) {
          await connection.query(
            "INSERT INTO settlement_lines (id, settlement_id, description, amount, load_id, gl_account_id, type) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
              line.id || uuidv4(),
              set.id,
              line.description,
              line.amount,
              line.loadId,
              line.glAccountId,
              line.type,
            ],
          );
        }
      }

      // 3. AUTO-POST TO GL — always use auth-derived tenantId
      const entryId = uuidv4();
      await connection.query(
        "INSERT INTO journal_entries (id, tenant_id, entry_date, reference_number, description, source_document_type, source_document_id, posted_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)",
        [
          entryId,
          tenantId,
          set.settlementDate,
          `SETTLE-${set.id.substring(0, 8)}`,
          `Settlement for Driver ${set.driverId}`,
          "Settlement",
          set.id,
          "SYSTEM",
        ],
      );

      // Debit Expenses (Earnings/Reimb), Credit Liabilities (Net Pay), Credit Offsets (Deductions)
      // Net Pay (Credit Liability)
      await connection.query(
        "INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit) VALUES (?, ?, ?, ?, ?)",
        [uuidv4(), entryId, "GL-2100", 0, set.netPay],
      );

      if (set.lines && Array.isArray(set.lines)) {
        for (const line of set.lines) {
          if (line.type === "Earning" || line.type === "Reimbursement") {
            // Debit Expense
            await connection.query(
              "INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit, allocation_type, allocation_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
              [
                uuidv4(),
                entryId,
                line.glAccountId || "GL-6000",
                line.amount,
                0,
                "Driver",
                set.driverId,
              ],
            );
          } else if (line.type === "Deduction") {
            // Credit Offset
            await connection.query(
              "INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit, allocation_type, allocation_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
              [
                uuidv4(),
                entryId,
                line.glAccountId || "GL-6000",
                0,
                line.amount,
                "Driver",
                set.driverId,
              ],
            );
          }
        }
      }

      await connection.commit();
      res.status(201).json({ message: "Settlement created and posted to GL" });
    } catch (error) {
      await connection.rollback();
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/accounting/settlements",
      });
      log.error(
        { err: error },
        "SERVER ERROR [POST /api/accounting/settlements]",
      );
      res.status(500).json({ error: "Failed to create settlement" });
    } finally {
      connection.release();
    }
  },
);

// Batch Update Settlement Status
router.patch(
  "/api/accounting/settlements/batch",
  requireAuth,
  requireTenant,
  validateBody(batchUpdateSettlementsSchema),
  async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const { ids, status } = req.body;
    try {
      const placeholders = ids.map(() => "?").join(",");
      const [result]: any = await pool.query(
        `UPDATE driver_settlements SET status = ? WHERE tenant_id = ? AND id IN (${placeholders})`,
        [status, tenantId, ...ids],
      );
      const updated = result.affectedRows || 0;
      res.json({ updated });
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "PATCH /api/accounting/settlements/batch",
      });
      log.error(
        { err: error },
        "SERVER ERROR [PATCH /api/accounting/settlements/batch]",
      );
      res.status(500).json({ error: "Failed to batch update settlements" });
    }
  },
);

// Document Vault
router.get(
  "/api/accounting/docs",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { loadId, driverId, truckId } = req.query;
      let query = "SELECT * FROM document_vault WHERE tenant_id = ?";
      const params: any[] = [tenantId];
      if (loadId) {
        query += " AND load_id = ?";
        params.push(loadId);
      }
      if (driverId) {
        query += " AND driver_id = ?";
        params.push(driverId);
      }
      if (truckId) {
        query += " AND truck_id = ?";
        params.push(truckId);
      }
      query += " ORDER BY created_at DESC";
      const [rows] = await pool.query(query, params);
      res.json(rows);
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/accounting/docs",
      });
      log.error({ err: error }, "SERVER ERROR [GET /api/accounting/docs]");
      res.status(500).json({ error: "Database error" });
    }
  },
);

router.post(
  "/api/accounting/docs",
  requireAuth,
  requireTenant,
  validateBody(createDocumentVaultSchema),
  async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const doc = req.body;
    try {
      await pool.query(
        "INSERT INTO document_vault (id, tenant_id, type, url, filename, load_id, driver_id, truck_id, vendor_id, customer_id, amount, date, state_code, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          doc.id || uuidv4(),
          tenantId,
          doc.type,
          doc.url,
          doc.filename,
          doc.loadId,
          doc.driverId,
          doc.truckId,
          doc.vendorId,
          doc.customerId,
          doc.amount,
          doc.date,
          doc.stateCode,
          doc.status || "Draft",
        ],
      );
      res.status(201).json({ message: "Document archived in vault" });
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/accounting/docs",
      });
      log.error({ err: error }, "SERVER ERROR [POST /api/accounting/docs]");
      res.status(500).json({ error: "Database error" });
    }
  },
);

router.patch(
  "/api/accounting/docs/:id",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const { status, is_locked } = req.body;
    const tenantId = req.user.tenantId;
    try {
      await pool.query(
        "UPDATE document_vault SET status = ?, is_locked = ? WHERE id = ? AND tenant_id = ?",
        [status, is_locked, req.params.id, tenantId],
      );
      res.json({ message: "Document status updated" });
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "PATCH /api/accounting/docs/:id",
      });
      log.error(
        { err: error },
        "SERVER ERROR [PATCH /api/accounting/docs/:id]",
      );
      res.status(500).json({ error: "Database error" });
    }
  },
);

// IFTA Intelligence & Auditing
router.get(
  "/api/accounting/ifta-evidence/:loadId",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const [rows] = await pool.query(
        "SELECT * FROM ifta_trip_evidence WHERE tenant_id = ? AND load_id = ? ORDER BY timestamp ASC",
        [tenantId, req.params.loadId],
      );
      res.json(rows);
    } catch (e) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/accounting/ifta-evidence",
      });
      log.error({ err: e }, "SERVER ERROR [GET /api/accounting/ifta-evidence]");
      res.status(500).json({ error: "Failed to fetch evidence" });
    }
  },
);

router.post(
  "/api/accounting/ifta-analyze",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const { pings, mode } = req.body; // mode: 'GPS' | 'ROUTES'

    if (!Array.isArray(pings) || pings.length > 10_000) {
      res.status(400).json({
        error:
          "pings must be an array with at most 10,000 items. Received: " +
          (Array.isArray(pings) ? pings.length + " items" : typeof pings),
      });
      return;
    }

    if (mode === "GPS") {
      const jurisdictionMiles: any = {};
      for (let i = 1; i < pings.length; i++) {
        const p1 = pings[i - 1];
        const p2 = pings[i];
        const dist = calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);
        const state = detectState(p2.lat, p2.lng);
        jurisdictionMiles[state] = (jurisdictionMiles[state] || 0) + dist;
      }
      return res.json({
        jurisdictionMiles,
        method: "ACTUAL_GPS",
        confidence: "HIGH",
      });
    }

    // Tier C logic placeholder (actual Google call would happen here or frontend)
    res.json({ message: "Routing engine ready" });
  },
);

router.post(
  "/api/accounting/ifta-audit-lock",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const audit = req.body;
    try {
      await pool.query(
        "INSERT INTO ifta_trips_audit (id, tenant_id, truck_id, load_id, trip_date, start_odometer, end_odometer, total_miles, method, confidence_level, jurisdiction_miles, status, attested_by, attested_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
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

      // Sync to legacy mileage_jurisdiction for backward compatibility
      for (const state in audit.jurisdictionMiles) {
        await pool.query(
          "INSERT INTO mileage_jurisdiction (id, tenant_id, truck_id, load_id, state_code, miles, date, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            uuidv4(),
            tenantId,
            audit.truckId,
            audit.loadId,
            state,
            audit.jurisdictionMiles[state],
            audit.tripDate,
            audit.method === "ACTUAL_GPS" ? "ELD" : "Manual",
          ],
        );
      }

      res.json({ message: "Trip locked for audit" });
    } catch (e) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/accounting/ifta-audit-lock",
      });
      log.error(
        { err: e },
        "SERVER ERROR [POST /api/accounting/ifta-audit-lock]",
      );
      res.status(500).json({ error: "Locking failed" });
    }
  },
);

// IFTA Summary
router.get(
  "/api/accounting/ifta-summary",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { quarter, year } = req.query;

      // Determine quarter end date for rate lookup
      const qNum = parseInt(quarter as string, 10) || 4;
      const yNum = parseInt(year as string, 10) || new Date().getFullYear();
      const quarterEndMonth = qNum * 3;
      const quarterEnd = `${yNum}-${String(quarterEndMonth).padStart(2, "0")}-30`;

      // Query per-jurisdiction tax rates from the ifta_tax_rates table
      const [rateRows]: any = await pool.query(
        `SELECT r.state_code, r.rate_per_gallon FROM ifta_tax_rates r
         INNER JOIN (SELECT state_code, MAX(effective_date) as max_date FROM ifta_tax_rates WHERE effective_date <= ? GROUP BY state_code) latest
         ON r.state_code = latest.state_code AND r.effective_date = latest.max_date`,
        [quarterEnd],
      );
      const rateMap: Record<string, number> = {};
      for (const r of rateRows) {
        rateMap[r.state_code] = Number(r.rate_per_gallon);
      }

      const [mileageRows]: any = await pool.query(
        "SELECT state_code, SUM(miles) as total_miles FROM mileage_jurisdiction WHERE tenant_id = ? GROUP BY state_code",
        [tenantId],
      );
      const [fuelRows]: any = await pool.query(
        "SELECT state_code, SUM(gallons) as total_gallons, SUM(total_cost) as total_cost FROM fuel_ledger WHERE tenant_id = ? GROUP BY state_code",
        [tenantId],
      );

      // Calculate fleet average MPG from totals
      const totalMilesAll = mileageRows.reduce(
        (sum: number, r: any) => sum + Number(r.total_miles),
        0,
      );
      const totalGallonsAll = fuelRows.reduce(
        (sum: number, r: any) => sum + Number(r.total_gallons),
        0,
      );
      const fleetAvgMpg =
        totalGallonsAll > 0 ? totalMilesAll / totalGallonsAll : 6.0;

      const rows = mileageRows.map((m: any) => {
        const f = fuelRows.find(
          (fr: any) => fr.state_code === m.state_code,
        ) || { total_gallons: 0, total_cost: 0 };
        const totalMiles = Number(m.total_miles);
        const stateGallons = Number(f.total_gallons);
        const taxRate = rateMap[m.state_code] ?? 0.20;
        const taxableGallons =
          fleetAvgMpg > 0 ? totalMiles / fleetAvgMpg : 0;
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

      const totalMiles = rows.reduce(
        (s: number, r: any) => s + r.totalMiles,
        0,
      );
      const totalGallons = rows.reduce(
        (s: number, r: any) => s + r.totalGallons,
        0,
      );
      const netTaxDue = rows.reduce(
        (s: number, r: any) => s + r.netTax,
        0,
      );

      res.json({
        quarter,
        year,
        rows,
        totalMiles,
        totalGallons,
        fleetAvgMpg: Math.round(fleetAvgMpg * 100) / 100,
        netTaxDue: Math.round(netTaxDue * 100) / 100,
      });
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/accounting/ifta-summary",
      });
      log.error(
        { err: error },
        "SERVER ERROR [GET /api/accounting/ifta-summary]",
      );
      res.status(500).json({ error: "Database error" });
    }
  },
);

router.get(
  "/api/accounting/mileage",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const [rows] = await pool.query(
        "SELECT * FROM mileage_jurisdiction WHERE tenant_id = ? ORDER BY entry_date DESC LIMIT 50",
        [tenantId],
      );
      res.json(rows);
    } catch (e) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/accounting/mileage",
      });
      log.error({ err: e }, "SERVER ERROR [GET /api/accounting/mileage]");
      res.status(500).json({ error: "Failed to fetch mileage" });
    }
  },
);

router.post(
  "/api/accounting/mileage",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const { truckId, loadId, date, stateCode, miles, source } = req.body;
    try {
      await pool.query(
        "INSERT INTO mileage_jurisdiction (id, tenant_id, truck_id, load_id, state_code, miles, date, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          uuidv4(),
          tenantId,
          truckId,
          loadId,
          stateCode,
          miles,
          date,
          source || "Manual",
        ],
      );
      res.status(201).json({ message: "Mileage logged" });
    } catch (e) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/accounting/mileage",
      });
      log.error({ err: e }, "SERVER ERROR [POST /api/accounting/mileage]");
      res.status(500).json({ error: "Failed to log mileage" });
    }
  },
);

router.post(
  "/api/accounting/ifta-post",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const { quarter, year, netTaxDue } = req.body;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const entryId = uuidv4();
      await connection.query(
        "INSERT INTO journal_entries (id, tenant_id, entry_date, reference_number, description, source_document_type) VALUES (?, ?, NOW(), ?, ?, ?)",
        [
          entryId,
          tenantId,
          `IFTA-Q${quarter}-${year}`,
          `IFTA Tax Liability Q${quarter} ${year}`,
          "IFTA_POSTING",
        ],
      );
      // Debit IFTA Expense, Credit IFTA Payable
      await connection.query(
        "INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit) VALUES (?, ?, ?, ?, ?)",
        [uuidv4(), entryId, "GL-6900", netTaxDue, 0],
      );
      await connection.query(
        "INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit) VALUES (?, ?, ?, ?, ?)",
        [uuidv4(), entryId, "GL-2200", 0, netTaxDue],
      );
      await connection.commit();
      res.json({ message: "IFTA posted successfully" });
    } catch (e) {
      await connection.rollback();
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/accounting/ifta-post",
      });
      log.error({ err: e }, "SERVER ERROR [POST /api/accounting/ifta-post]");
      res.status(500).json({ error: "Posting failed" });
    } finally {
      connection.release();
    }
  },
);

// Adjustment Entries (V3)
router.post(
  "/api/accounting/adjustments",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const adj = req.body;
    try {
      await pool.query(
        "INSERT INTO adjustment_entries (id, tenant_id, parent_entity_type, parent_entity_id, reason_code, description, amount_adjustment, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
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
      res.status(201).json({ message: "Adjustment recorded" });
    } catch (e) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/accounting/adjustments",
      });
      log.error({ err: e }, "SERVER ERROR [POST /api/accounting/adjustments]");
      res.status(500).json({ error: "Failed to record adjustment" });
    }
  },
);

// Batch Imports
router.post(
  "/api/accounting/batch-import",
  requireAuth,
  requireTenant,
  validateBody(batchImportSchema),
  async (req: any, res) => {
    const tenantId = req.user.tenantId;
    const { type, data } = req.body;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const item of data) {
        const id = item.id || uuidv4();
        if (type === "Fuel") {
          await connection.query(
            "INSERT INTO fuel_ledger (id, tenant_id, state_code, gallons, total_cost, entry_date, truck_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
              id,
              tenantId,
              item.stateCode,
              item.gallons,
              item.totalCost,
              item.date,
              item.truckId,
            ],
          );
        } else if (type === "Bills") {
          await connection.query(
            "INSERT INTO ap_bills (id, tenant_id, bill_number, total_amount, bill_date, status) VALUES (?, ?, ?, ?, ?, ?)",
            [
              id,
              tenantId,
              item.billNumber,
              item.totalAmount,
              item.billDate,
              item.status || "Draft",
            ],
          );
        } else if (type === "Invoices") {
          await connection.query(
            "INSERT INTO ar_invoices (id, tenant_id, invoice_number, total_amount, invoice_date, status, customer_id, load_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
              id,
              tenantId,
              item.invoiceNumber,
              item.totalAmount,
              item.invoiceDate,
              item.status || "Draft",
              item.customerId,
              item.loadId,
            ],
          );
        } else if (type === "Settlements") {
          await connection.query(
            "INSERT INTO driver_settlements (id, tenant_id, driver_id, settlement_date, net_pay, status) VALUES (?, ?, ?, ?, ?, ?)",
            [
              id,
              tenantId,
              item.driverId,
              item.settlementDate,
              item.netPay,
              item.status || "Draft",
            ],
          );
        }
      }
      await connection.commit();
      res.json({ message: `Successfully imported ${data.length} records` });
    } catch (e) {
      await connection.rollback();
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/accounting/batch-import",
      });
      log.error({ err: e }, "SERVER ERROR [POST /api/accounting/batch-import]");
      res.status(500).json({ error: "Import failed" });
    } finally {
      connection.release();
    }
  },
);

export default router;
