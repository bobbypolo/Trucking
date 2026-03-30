import { Router, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import { createComplianceAlertSchema } from "../schemas/compliance";
import pool from "../db";
import { createRequestLogger } from "../lib/logger";

const router = Router();

// Compliance Records
router.get(
  "/api/compliance/:userId",
  requireAuth,
  requireTenant,
  async (req: any, res: any, next: NextFunction) => {
    if (
      req.user.id !== req.params.userId &&
      req.user.role !== "admin" &&
      req.user.role !== "dispatcher" &&
      req.user.role !== "safety_manager"
    ) {
      return res.status(403).json({ error: "Unauthorized profile access" });
    }
    try {
      const [rows] = await pool.query(
        "SELECT cr.* FROM compliance_records cr JOIN users u ON cr.user_id = u.id WHERE cr.user_id = ? AND u.company_id = ?",
        [req.params.userId, req.user.tenantId],
      );
      res.json(rows);
    } catch (error) {
      const log = createRequestLogger(req, "GET /api/compliance");
      log.error({ err: error }, "SERVER ERROR [GET /api/compliance]");
      next(error);
    }
  },
);

// POST /api/compliance/alert — create a compliance alert as a unified exception
router.post(
  "/api/compliance/alert",
  requireAuth,
  requireTenant,
  validateBody(createComplianceAlertSchema),
  async (req: any, res: any, next: NextFunction) => {
    const { entityType, entityId, description, severity, alertType } = req.body;
    const companyId = req.user.tenantId;

    const exceptionId = uuidv4();
    const numericSeverity = severity || 3;
    const slaHours = numericSeverity >= 4 ? 4 : numericSeverity >= 3 ? 24 : 72;
    const slaDueAt = new Date(
      Date.now() + slaHours * 3600 * 1000,
    ).toISOString();

    try {
      await pool.query(
        `INSERT INTO exceptions
           (id, tenant_id, type, status, severity, entity_type, entity_id,
            sla_due_at, workflow_step, description, links)
         VALUES (?, ?, ?, 'OPEN', ?, ?, ?, ?, 'triage', ?, '{}')`,
        [
          exceptionId,
          companyId,
          alertType || "COMPLIANCE_ALERT",
          numericSeverity,
          entityType,
          entityId,
          slaDueAt,
          description || "Compliance alert",
        ],
      );
      await pool.query(
        `INSERT INTO exception_events (id, exception_id, action, notes, actor_name)
         VALUES (?, ?, 'Exception Created', 'Compliance alert created', ?)`,
        [uuidv4(), exceptionId, req.user.uid || "System"],
      );
      res
        .status(201)
        .json({ message: "Compliance alert created", id: exceptionId });
    } catch (error) {
      const log = createRequestLogger(req, "POST /api/compliance/alert");
      log.error({ err: error }, "Failed to create compliance alert");
      next(error);
    }
  },
);

export default router;
