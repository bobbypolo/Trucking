import { Router } from "express";
import type { Request } from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import pool from "../db";
import { createChildLogger } from "../lib/logger";
import { getSafetyScore } from "../services/fmcsa.service";
import { checkExpiring } from "../services/cert-expiry-checker";

const router = Router();

// ── Quizzes ──────────────────────────────────────────────────────────────────

// GET /api/safety/quizzes — list quizzes for authenticated tenant
router.get(
  "/api/safety/quizzes",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    try {
      const [rows] = await pool.query(
        "SELECT * FROM safety_quizzes WHERE company_id = ? ORDER BY created_at DESC",
        [companyId],
      );
      res.json(rows);
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/safety/quizzes",
      });
      log.error({ err: error }, "Failed to fetch safety quizzes");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// GET /api/safety/quizzes/:id — get single quiz (tenant-scoped)
router.get(
  "/api/safety/quizzes/:id",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const { id } = req.params;
    try {
      const [rows] = await pool.query(
        "SELECT * FROM safety_quizzes WHERE id = ? AND company_id = ?",
        [id, companyId],
      );
      const records = rows as any[];
      if (!records || records.length === 0) {
        return res.status(404).json({ error: "Quiz not found" });
      }
      res.json(records[0]);
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/safety/quizzes/:id",
      });
      log.error({ err: error }, "Failed to fetch safety quiz");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// POST /api/safety/quizzes — create a quiz
router.post(
  "/api/safety/quizzes",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const { title, description, status } = req.body;

    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }

    const id = uuidv4();
    try {
      await pool.query(
        "INSERT INTO safety_quizzes (id, company_id, title, description, status) VALUES (?, ?, ?, ?, ?)",
        [id, companyId, title, description ?? null, status ?? "draft"],
      );
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/safety/quizzes",
      });
      log.info({ quizId: id }, "Safety quiz created");
      res.status(201).json({ message: "Quiz created", id });
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/safety/quizzes",
      });
      log.error({ err: error }, "Failed to create safety quiz");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// ── Quiz Results ─────────────────────────────────────────────────────────────

// GET /api/safety/quiz-results — list quiz results for authenticated tenant
router.get(
  "/api/safety/quiz-results",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    try {
      const [rows] = await pool.query(
        "SELECT * FROM safety_quiz_results WHERE company_id = ? ORDER BY submitted_at DESC",
        [companyId],
      );
      res.json(rows);
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/safety/quiz-results",
      });
      log.error({ err: error }, "Failed to fetch safety quiz results");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// POST /api/safety/quiz-results — create a quiz result record
router.post(
  "/api/safety/quiz-results",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const { quiz_id, driver_id, driver_name, score, passed } = req.body;

    if (!quiz_id) {
      return res.status(400).json({ error: "quiz_id is required" });
    }

    const id = uuidv4();
    try {
      await pool.query(
        `INSERT INTO safety_quiz_results
          (id, company_id, quiz_id, driver_id, driver_name, score, passed)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          companyId,
          quiz_id,
          driver_id ?? null,
          driver_name ?? null,
          score ?? null,
          passed ? 1 : 0,
        ],
      );
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/safety/quiz-results",
      });
      log.info(
        { resultId: id, quizId: quiz_id },
        "Safety quiz result recorded",
      );
      res.status(201).json({ message: "Quiz result recorded", id });
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/safety/quiz-results",
      });
      log.error({ err: error }, "Failed to record safety quiz result");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// ── Maintenance ──────────────────────────────────────────────────────────────

// GET /api/safety/maintenance — list maintenance records for authenticated tenant
router.get(
  "/api/safety/maintenance",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    try {
      const [rows] = await pool.query(
        "SELECT * FROM safety_maintenance WHERE company_id = ? ORDER BY created_at DESC",
        [companyId],
      );
      res.json(rows);
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/safety/maintenance",
      });
      log.error({ err: error }, "Failed to fetch maintenance records");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// GET /api/safety/maintenance/:id — get single maintenance record (tenant-scoped)
router.get(
  "/api/safety/maintenance/:id",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const { id } = req.params;
    try {
      const [rows] = await pool.query(
        "SELECT * FROM safety_maintenance WHERE id = ? AND company_id = ?",
        [id, companyId],
      );
      const records = rows as any[];
      if (!records || records.length === 0) {
        return res.status(404).json({ error: "Maintenance record not found" });
      }
      res.json(records[0]);
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/safety/maintenance/:id",
      });
      log.error({ err: error }, "Failed to fetch maintenance record");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// POST /api/safety/maintenance — create maintenance record
router.post(
  "/api/safety/maintenance",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const {
      vehicle_id,
      type,
      description,
      status,
      scheduled_date,
      completed_date,
      mileage_at_service,
      cost,
      vendor_id,
      notes,
    } = req.body;

    if (!vehicle_id) {
      return res.status(400).json({ error: "vehicle_id is required" });
    }
    if (!type) {
      return res.status(400).json({ error: "type is required" });
    }

    const id = uuidv4();
    try {
      await pool.query(
        `INSERT INTO safety_maintenance
          (id, company_id, vehicle_id, type, description, status, scheduled_date,
           completed_date, mileage_at_service, cost, vendor_id, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          companyId,
          vehicle_id,
          type,
          description ?? null,
          status ?? "Scheduled",
          scheduled_date ?? null,
          completed_date ?? null,
          mileage_at_service ?? null,
          cost ?? null,
          vendor_id ?? null,
          notes ?? null,
        ],
      );

      // Cross-link: create a unified exception for Issues & Alerts visibility
      try {
        const exceptionId = uuidv4();
        const slaDueAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
        await pool.query(
          `INSERT INTO exceptions
             (id, tenant_id, type, status, severity, entity_type, entity_id,
              sla_due_at, workflow_step, description, links)
           VALUES (?, ?, 'MAINTENANCE_REQUEST', 'OPEN', 2, 'TRUCK', ?, ?, 'triage', ?, ?)`,
          [
            exceptionId,
            companyId,
            vehicle_id,
            slaDueAt,
            description || `Maintenance: ${type}`,
            JSON.stringify({ maintenanceRecordId: id }),
          ],
        );
        await pool.query(
          `INSERT INTO exception_events (id, exception_id, action, notes, actor_name)
           VALUES (?, ?, 'Exception Created', 'Auto-linked from maintenance record', ?)`,
          [uuidv4(), exceptionId, req.user!.uid || "System"],
        );
      } catch (linkErr) {
        const linkLog = createChildLogger({
          correlationId: req.correlationId,
          route: "POST /api/safety/maintenance",
        });
        linkLog.warn(
          { err: linkErr, maintenanceId: id },
          "Failed to create linked exception for maintenance (non-blocking)",
        );
      }

      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/safety/maintenance",
      });
      log.info({ maintenanceId: id }, "Maintenance record created");
      res.status(201).json({ message: "Maintenance record created", id });
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/safety/maintenance",
      });
      log.error({ err: error }, "Failed to create maintenance record");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// ── Vendors ──────────────────────────────────────────────────────────────────

// GET /api/safety/vendors — list vendors for authenticated tenant
router.get(
  "/api/safety/vendors",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    try {
      const [rows] = await pool.query(
        "SELECT * FROM safety_vendors WHERE company_id = ? ORDER BY name ASC",
        [companyId],
      );
      res.json(rows);
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/safety/vendors",
      });
      log.error({ err: error }, "Failed to fetch safety vendors");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// GET /api/safety/vendors/:id — get single vendor (tenant-scoped)
router.get(
  "/api/safety/vendors/:id",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const { id } = req.params;
    try {
      const [rows] = await pool.query(
        "SELECT * FROM safety_vendors WHERE id = ? AND company_id = ?",
        [id, companyId],
      );
      const records = rows as any[];
      if (!records || records.length === 0) {
        return res.status(404).json({ error: "Vendor not found" });
      }
      res.json(records[0]);
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/safety/vendors/:id",
      });
      log.error({ err: error }, "Failed to fetch safety vendor");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// POST /api/safety/vendors — create vendor
router.post(
  "/api/safety/vendors",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const {
      name,
      type,
      contact_name,
      contact_email,
      contact_phone,
      address,
      status,
      notes,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    const id = uuidv4();
    try {
      await pool.query(
        `INSERT INTO safety_vendors
          (id, company_id, name, type, contact_name, contact_email, contact_phone, address, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          companyId,
          name,
          type ?? null,
          contact_name ?? null,
          contact_email ?? null,
          contact_phone ?? null,
          address ?? null,
          status ?? "active",
          notes ?? null,
        ],
      );
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/safety/vendors",
      });
      log.info({ vendorId: id }, "Safety vendor created");
      res.status(201).json({ message: "Vendor created", id });
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/safety/vendors",
      });
      log.error({ err: error }, "Failed to create safety vendor");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// ── Activity Log ─────────────────────────────────────────────────────────────

// GET /api/safety/activity — list activity log (max 50 entries) for authenticated tenant
router.get(
  "/api/safety/activity",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    try {
      const [rows] = await pool.query(
        "SELECT * FROM safety_activity_log WHERE company_id = ? ORDER BY created_at DESC LIMIT 50",
        [companyId],
      );
      res.json(rows);
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/safety/activity",
      });
      log.error({ err: error }, "Failed to fetch safety activity log");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// POST /api/safety/activity — record activity log entry
router.post(
  "/api/safety/activity",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const { action, entity_type, entity_id, actor, details } = req.body;

    if (!action) {
      return res.status(400).json({ error: "action is required" });
    }

    const id = uuidv4();
    try {
      await pool.query(
        `INSERT INTO safety_activity_log
          (id, company_id, action, entity_type, entity_id, actor, details)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          companyId,
          action,
          entity_type ?? null,
          entity_id ?? null,
          actor ?? null,
          details ? JSON.stringify(details) : null,
        ],
      );
      res.status(201).json({ message: "Activity logged", id });
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/safety/activity",
      });
      log.error({ err: error }, "Failed to log safety activity");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// ── Expiring Certificates ────────────────────────────────────────────────────

// GET /api/safety/expiring-certs — list driver certificates expiring within N days
router.get(
  "/api/safety/expiring-certs",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const daysAhead = req.query.days
      ? parseInt(req.query.days as string, 10)
      : 30;
    try {
      const certs = await checkExpiring(companyId, daysAhead);
      res.json(certs);
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/safety/expiring-certs",
      });
      log.error({ err: error }, "Failed to check expiring certificates");
      res.status(500).json({ error: "Failed to check expiring certificates" });
    }
  },
);

// ---- FMCSA Safety Scores ----

// GET /api/safety/fmcsa/:dotNumber -- fetch FMCSA safety score for a carrier
router.get(
  "/api/safety/fmcsa/:dotNumber",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const { dotNumber } = req.params;
    try {
      const result = await getSafetyScore(dotNumber);
      res.json(result);
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/safety/fmcsa/:dotNumber",
      });
      log.error(
        { err: error, dotNumber },
        "Failed to fetch FMCSA safety score",
      );
      res.status(500).json({ error: "Failed to fetch FMCSA safety score" });
    }
  },
);

export default router;
