import { Router } from "express";
import type { Request } from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import pool from "../db";
import { createChildLogger } from "../lib/logger";
import { incidentRepository } from "../repositories/incident.repository";

const router = Router();

// Emergency Management: Incidents
router.get(
  "/api/incidents",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    try {
      // TODO: add timeline/billingItems enrichment via batch queries (JOIN or IN clause)
      // to avoid N+1. Skipped for now — enrichment omitted intentionally.
      const incidents = await incidentRepository.findByCompany(companyId);
      res.json({ incidents });
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/incidents",
      });
      log.error({ err: error }, "SERVER ERROR [GET /api/incidents]");
      res.status(500).json({ error: "Failed to process incident" });
    }
  },
);

router.post(
  "/api/incidents",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const {
      load_id,
      type,
      severity,
      status,
      sla_deadline,
      description,
      location_lat,
      location_lng,
      recovery_plan,
    } = req.body;
    const companyId = req.user!.tenantId;

    // Validation: check if load exists to prevent FK violation
    try {
      const [loadRows]: any = await pool.query(
        "SELECT id FROM loads WHERE id = ?",
        [load_id],
      );
      if (loadRows.length === 0) {
        const log = createChildLogger({
          correlationId: req.correlationId,
          route: "POST /api/incidents",
        });
        log.warn({ load_id }, "Incident creation failed: Load not found");
        return res.status(400).json({
          error: "FK Violation",
          details: `Load ${load_id} does not exist. Please use a valid Load ID.`,
        });
      }

      const incident = await incidentRepository.create(
        {
          load_id,
          type,
          severity,
          status,
          sla_deadline,
          description,
          location_lat,
          location_lng,
          recovery_plan,
        },
        companyId,
      );
      const incLog = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/incidents",
      });
      incLog.info({ incidentId: incident.id }, "Incident created successfully");
      res.status(201).json({ message: "Incident created" });
    } catch (error) {
      const errLog = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/incidents",
      });
      errLog.error({ err: error }, "SERVER ERROR [POST /api/incidents]");
      res.status(500).json({ error: "Failed to process incident" });
    }
  },
);

router.post(
  "/api/incidents/:id/actions",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const { actor_name, action, notes, attachments } = req.body;
    const incidentId = req.params.id;
    const companyId = req.user!.tenantId;
    try {
      // Validation: check if incident exists and belongs to this tenant
      const incident = await incidentRepository.findById(incidentId, companyId);
      if (!incident) {
        const warnLog = createChildLogger({
          correlationId: req.correlationId,
          route: "POST /api/incidents/actions",
        });
        warnLog.warn({ incidentId }, "Action log failed: Incident not found");
        return res.status(404).json({
          error: "Not Found",
          details: `Incident ${incidentId} does not exist.`,
        });
      }

      await pool.query(
        "INSERT INTO incident_actions (id, incident_id, actor_name, action, notes, attachments) VALUES (?, ?, ?, ?, ?, ?)",
        [
          uuidv4(),
          incidentId,
          actor_name,
          action,
          notes,
          JSON.stringify(attachments),
        ],
      );
      const actionLog = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/incidents/actions",
      });
      actionLog.info({ incidentId }, "Action logged for incident");
      res.status(201).json({ message: "Action logged" });
    } catch (error) {
      const errLog = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/incidents/actions",
      });
      errLog.error(
        { err: error },
        "SERVER ERROR [POST /api/incidents/actions]",
      );
      res.status(500).json({ error: "Failed to process incident" });
    }
  },
);

router.post(
  "/api/incidents/:id/charges",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const {
      category,
      amount,
      provider_vendor,
      status,
      approved_by,
      receipt_url,
    } = req.body;
    const incidentId = req.params.id;
    try {
      await pool.query(
        "INSERT INTO emergency_charges (id, incident_id, category, amount, provider_vendor, status, approved_by, receipt_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          uuidv4(),
          incidentId,
          category,
          amount,
          provider_vendor,
          status,
          approved_by,
          receipt_url,
        ],
      );
      res.status(201).json({ message: "Charge recorded" });
    } catch (error) {
      res.status(500).json({ error: "Failed to process incident" });
    }
  },
);

export default router;
