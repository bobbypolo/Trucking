import { Router, Response, NextFunction } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import { createSettlementSchema } from "../schemas/settlements";
import {
  createJournalEntrySchema,
  createInvoiceSchema,
  createBillSchema,
  batchImportSchema,
  batchUpdateSettlementsSchema,
  fuelReceiptSchema,
  iftaAnalyzeSchema,
  iftaAuditLockSchema,
  mileageSchema,
  iftaPostSchema,
  adjustmentSchema,
} from "../schemas/accounting";
import { createRequestLogger } from "../lib/logger";
import {
  accountingService,
  ValidationError,
} from "../services/accounting.service";

const router = Router();

// --- UNIFIED FINANCIAL LEDGER ---

// Chart of Accounts
router.get(
  "/api/accounting/accounts",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rows = await accountingService.getChartOfAccounts(req.user!.tenantId);
      res.json(rows);
    } catch (error) {
      const log = createRequestLogger(req, "GET /api/accounting/accounts");
      log.error({ err: error }, "SERVER ERROR [GET /api/accounting/accounts]");
      next(error);
    }
  },
);

// Load P&L (True Profitability Engine)
router.get(
  "/api/accounting/load-pl/:loadId",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await accountingService.calculateLoadPnl(
        req.user!.tenantId,
        req.params.loadId,
      );
      res.json(result);
    } catch (error) {
      const log = createRequestLogger(req, "GET /api/accounting/load-pl");
      log.error({ err: error }, "SERVER ERROR [GET /api/accounting/load-pl]");
      next(error);
    }
  },
);

// Journal Entry Posting
router.post(
  "/api/accounting/journal",
  requireAuth,
  requireTenant,
  validateBody(createJournalEntrySchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await accountingService.postJournalEntry(req.user!.tenantId, req.body);
      res.status(201).json({ message: "Journal entry posted" });
    } catch (error) {
      const log = createRequestLogger(req, "POST /api/accounting/journal");
      log.error({ err: error }, "SERVER ERROR [POST /api/accounting/journal]");
      next(error);
    }
  },
);

// AR Invoices — Create
router.post(
  "/api/accounting/invoices",
  requireAuth,
  requireTenant,
  validateBody(createInvoiceSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await accountingService.createInvoiceWithGlPosting(
        req.user!.tenantId,
        req.body,
      );
      res.status(201).json({ message: "Invoice created and posted to GL" });
    } catch (error) {
      const log = createRequestLogger(req, "POST /api/accounting/invoices");
      log.error({ err: error }, "SERVER ERROR [POST /api/accounting/invoices]");
      next(error);
    }
  },
);

// AP Bills — Create
router.post(
  "/api/accounting/bills",
  requireAuth,
  requireTenant,
  validateBody(createBillSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await accountingService.createBillWithGlPosting(
        req.user!.tenantId,
        req.body,
      );
      res.status(201).json({ message: "Bill created and posted to GL" });
    } catch (error) {
      const log = createRequestLogger(req, "POST /api/accounting/bills");
      log.error({ err: error }, "SERVER ERROR [POST /api/accounting/bills]");
      next(error);
    }
  },
);

// --- ACCOUNTING V3 EXTENSIONS ---

// AR Invoices — List
router.get(
  "/api/accounting/invoices",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const enriched = await accountingService.listInvoicesWithLines(
        req.user!.tenantId,
      );
      res.json(enriched);
    } catch (error) {
      const log = createRequestLogger(req, "GET /api/accounting/invoices");
      log.error({ err: error }, "SERVER ERROR [GET /api/accounting/invoices]");
      next(error);
    }
  },
);

// AP Bills — List
router.get(
  "/api/accounting/bills",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const enriched = await accountingService.listBillsWithLines(
        req.user!.tenantId,
      );
      res.json(enriched);
    } catch (error) {
      const log = createRequestLogger(req, "GET /api/accounting/bills");
      log.error({ err: error }, "SERVER ERROR [GET /api/accounting/bills]");
      next(error);
    }
  },
);

// Driver Settlements — List (role-enforced)
router.get(
  "/api/accounting/settlements",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const perm = accountingService.checkSettlementViewPermission(
        req.user!.role,
      );
      if (!perm.allowed) {
        return res
          .status(403)
          .json({ error: "Insufficient permissions to view settlements" });
      }

      // Drivers can only see their own settlements (server-enforced self-scope)
      const driverId = perm.isDriver
        ? req.user!.id
        : (req.query.driverId as string | undefined);

      const enriched = await accountingService.listSettlementsWithLines(
        req.user!.tenantId,
        driverId,
      );
      res.json(enriched);
    } catch (error) {
      const log = createRequestLogger(req, "GET /api/accounting/settlements");
      log.error(
        { err: error },
        "SERVER ERROR [GET /api/accounting/settlements]",
      );
      next(error);
    }
  },
);

// Driver Settlements — Create
router.post(
  "/api/accounting/settlements",
  requireAuth,
  requireTenant,
  validateBody(createSettlementSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!accountingService.canCreateSettlement(req.user!.role)) {
      return res
        .status(403)
        .json({ error: "Insufficient permissions to create settlements" });
    }
    try {
      await accountingService.createSettlementWithGlPosting(
        req.user!.tenantId,
        req.body,
      );
      res.status(201).json({ message: "Settlement created and posted to GL" });
    } catch (error) {
      const log = createRequestLogger(req, "POST /api/accounting/settlements");
      log.error(
        { err: error },
        "SERVER ERROR [POST /api/accounting/settlements]",
      );
      next(error);
    }
  },
);

// Batch Update Settlement Status
router.patch(
  "/api/accounting/settlements/batch",
  requireAuth,
  requireTenant,
  validateBody(batchUpdateSettlementsSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!accountingService.canApproveSettlement(req.user!.role)) {
      return res
        .status(403)
        .json({ error: "Insufficient permissions to update settlements" });
    }
    try {
      const { ids, status } = req.body;
      const result = await accountingService.batchUpdateSettlementStatus(
        req.user!.tenantId,
        ids,
        status,
      );
      res.json(result);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      const log = createRequestLogger(
        req,
        "PATCH /api/accounting/settlements/batch",
      );
      log.error(
        { err: error },
        "SERVER ERROR [PATCH /api/accounting/settlements/batch]",
      );
      next(error);
    }
  },
);

// IFTA Evidence
router.get(
  "/api/accounting/ifta-evidence/:loadId",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rows = await accountingService.getIftaEvidence(
        req.user!.tenantId,
        req.params.loadId,
      );
      res.json(rows);
    } catch (e) {
      const log = createRequestLogger(req, "GET /api/accounting/ifta-evidence");
      log.error({ err: e }, "SERVER ERROR [GET /api/accounting/ifta-evidence]");
      next(e);
    }
  },
);

// IFTA Analyze
router.post(
  "/api/accounting/ifta-analyze",
  requireAuth,
  requireTenant,
  validateBody(iftaAnalyzeSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await accountingService.analyzeIftaJurisdictions(
        req.body.pings,
      );
      res.json(result);
    } catch (e) {
      const log = createRequestLogger(req, "POST /api/accounting/ifta-analyze");
      log.error(
        { err: e },
        "SERVER ERROR [POST /api/accounting/ifta-analyze]",
      );
      next(e);
    }
  },
);

// IFTA Audit Lock
router.post(
  "/api/accounting/ifta-audit-lock",
  requireAuth,
  requireTenant,
  validateBody(iftaAuditLockSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await accountingService.lockIftaAudit(req.user!.tenantId, req.body);
      res.json({ message: "Trip locked for audit" });
    } catch (e) {
      const log = createRequestLogger(
        req,
        "POST /api/accounting/ifta-audit-lock",
      );
      log.error(
        { err: e },
        "SERVER ERROR [POST /api/accounting/ifta-audit-lock]",
      );
      next(e);
    }
  },
);

// IFTA Summary
router.get(
  "/api/accounting/ifta-summary",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await accountingService.getIftaSummary(
        req.user!.tenantId,
        req.query.quarter as string,
        req.query.year as string,
      );
      res.json(result);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      const log = createRequestLogger(req, "GET /api/accounting/ifta-summary");
      log.error(
        { err: error },
        "SERVER ERROR [GET /api/accounting/ifta-summary]",
      );
      next(error);
    }
  },
);

// Mileage — List
router.get(
  "/api/accounting/mileage",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rows = await accountingService.listMileage(req.user!.tenantId);
      res.json(rows);
    } catch (e) {
      const log = createRequestLogger(req, "GET /api/accounting/mileage");
      log.error({ err: e }, "SERVER ERROR [GET /api/accounting/mileage]");
      next(e);
    }
  },
);

// Mileage — Create
router.post(
  "/api/accounting/mileage",
  requireAuth,
  requireTenant,
  validateBody(mileageSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await accountingService.createMileage(req.user!.tenantId, req.body);
      res.status(201).json({ message: "Mileage logged" });
    } catch (e) {
      const log = createRequestLogger(req, "POST /api/accounting/mileage");
      log.error({ err: e }, "SERVER ERROR [POST /api/accounting/mileage]");
      next(e);
    }
  },
);

// Fuel Receipt (from AI scan)
router.post(
  "/api/accounting/fuel-receipt",
  requireAuth,
  requireTenant,
  validateBody(fuelReceiptSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = await accountingService.createFuelReceipt(
        req.user!.tenantId,
        req.body,
      );
      res.status(201).json({ id, message: "Fuel receipt recorded" });
    } catch (e) {
      const log = createRequestLogger(
        req,
        "POST /api/accounting/fuel-receipt",
      );
      log.error(
        { err: e },
        "SERVER ERROR [POST /api/accounting/fuel-receipt]",
      );
      next(e);
    }
  },
);

// IFTA Post (GL posting)
router.post(
  "/api/accounting/ifta-post",
  requireAuth,
  requireTenant,
  validateBody(iftaPostSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { quarter, year, netTaxDue } = req.body;
      await accountingService.postIftaTaxes(
        req.user!.tenantId,
        quarter,
        year,
        netTaxDue,
      );
      res.json({ message: "IFTA posted successfully" });
    } catch (e) {
      const log = createRequestLogger(req, "POST /api/accounting/ifta-post");
      log.error({ err: e }, "SERVER ERROR [POST /api/accounting/ifta-post]");
      next(e);
    }
  },
);

// Adjustment Entries (V3)
router.post(
  "/api/accounting/adjustments",
  requireAuth,
  requireTenant,
  validateBody(adjustmentSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await accountingService.createAdjustment(req.user!.tenantId, req.body);
      res.status(201).json({ message: "Adjustment recorded" });
    } catch (e) {
      const log = createRequestLogger(req, "POST /api/accounting/adjustments");
      log.error({ err: e }, "SERVER ERROR [POST /api/accounting/adjustments]");
      next(e);
    }
  },
);

// Batch Imports
router.post(
  "/api/accounting/batch-import",
  requireAuth,
  requireTenant,
  validateBody(batchImportSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { type, data } = req.body;
      const count = await accountingService.batchImport(
        req.user!.tenantId,
        type,
        data,
      );
      res.json({ message: `Successfully imported ${count} records` });
    } catch (e) {
      const log = createRequestLogger(req, "POST /api/accounting/batch-import");
      log.error({ err: e }, "SERVER ERROR [POST /api/accounting/batch-import]");
      next(e);
    }
  },
);

export default router;
