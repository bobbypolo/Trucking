import { Router } from "express";
import type { Request } from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import pool from "../db";
import { createRequestLogger } from "../lib/logger";
import { incidentRepository } from "../repositories/incident.repository";
import { NotFoundError } from "../errors/AppError";
import { syncDomainToException } from "../lib/exception-sync";

/**
 * Creates a linked exception record for an incident so it appears
 * in the unified Issues & Alerts workspace (ExceptionConsole).
 * Best-effort: failures are logged but do not block the incident response.
 */
async function createLinkedExceptionForIncident(
  tenantId: string,
  incidentId: string,
  body: {
    type?: string;
    severity?: string;
    description?: string;
    load_id?: string;
  },
  actorName: string,
) {
  const exceptionId = uuidv4();
  const severityMap: Record<string, number> = {
    Critical: 4,
    High: 3,
    Medium: 2,
    Low: 1,
  };
  const numericSeverity = severityMap[body.severity || ""] || 3;
  const slaHours = numericSeverity >= 4 ? 2 : numericSeverity >= 3 ? 4 : 24;
  const slaDueAt = new Date(Date.now() + slaHours * 3600 * 1000).toISOString();

  await pool.query(
    `INSERT INTO exceptions
       (id, tenant_id, type, status, severity, entity_type, entity_id,
        sla_due_at, workflow_step, description, links)
     VALUES (?, ?, ?, 'OPEN', ?, 'LOAD', ?, ?, 'triage', ?, ?)`,
    [
      exceptionId,
      tenantId,
      body.type === "Safety"
        ? "SAFETY_INCIDENT"
        : body.type === "Maintenance"
          ? "MAINTENANCE_INCIDENT"
          : "INCIDENT_GENERAL",
      numericSeverity,
      body.load_id || "",
      slaDueAt,
      body.description || "Incident created",
      JSON.stringify({ incidentId }),
    ],
  );
  await pool.query(
    `INSERT INTO exception_events (id, exception_id, action, notes, actor_name)
     VALUES (?, ?, 'Exception Created', 'Auto-linked from incident', ?)`,
    [uuidv4(), exceptionId, actorName],
  );
  return exceptionId;
}

const router = Router();

// Emergency Management: Incidents
router.get(
  "/api/incidents",
  requireAuth,
  requireTenant,
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    try {
      // NOTE: timeline/billingItems enrichment via batch queries deferred.
      // Tracked: loadpilot-backend#issue-enrichment — N+1 avoidance, not blocking for production.
      const incidents = await incidentRepository.findByCompany(companyId);
      res.json(incidents);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/api/incidents",
  requireAuth,
  requireTenant,
  async (req: Request, res, next) => {
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
        const log = createRequestLogger(req, "POST /api/incidents");
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
      // Cross-link: create a unified exception for Issues & Alerts visibility
      try {
        await createLinkedExceptionForIncident(
          companyId,
          incident.id,
          { type, severity, description, load_id },
          req.user!.uid || "System",
        );
      } catch (linkErr) {
        const linkLog = createRequestLogger(req, "POST /api/incidents");
        linkLog.warn(
          { err: linkErr, incidentId: incident.id },
          "Failed to create linked exception for incident (non-blocking)",
        );
      }

      const incLog = createRequestLogger(req, "POST /api/incidents");
      incLog.info({ incidentId: incident.id }, "Incident created successfully");
      res.status(201).json({ message: "Incident created", id: incident.id });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/api/incidents/:id/actions",
  requireAuth,
  requireTenant,
  async (req: Request, res, next) => {
    const { actor_name, action, notes, attachments } = req.body;
    const incidentId = req.params.id;
    const companyId = req.user!.tenantId;
    try {
      // Validation: check if incident exists and belongs to this tenant
      const incident = await incidentRepository.findById(incidentId, companyId);
      if (!incident) {
        const warnLog = createRequestLogger(req, "POST /api/incidents/actions");
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
      const actionLog = createRequestLogger(req, "POST /api/incidents/actions");
      actionLog.info({ incidentId }, "Action logged for incident");
      res.status(201).json({ message: "Action logged" });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/incidents/:id — update incident with reverse exception sync
router.patch(
  "/api/incidents/:id",
  requireAuth,
  requireTenant,
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    const incidentId = req.params.id;
    const patchLog = createRequestLogger(req, "PATCH /api/incidents/:id");

    try {
      const existing = await incidentRepository.findById(incidentId, companyId);
      if (!existing) {
        return res.status(404).json({ error: "Incident not found" });
      }

      const updated = await incidentRepository.update(
        incidentId,
        req.body,
        companyId,
      );

      // Reverse sync: if status changed, update linked exception
      if (req.body.status && req.body.status !== existing.status) {
        try {
          await syncDomainToException(
            "incidentId",
            incidentId,
            companyId,
            req.body.status,
            req.correlationId,
          );
        } catch (syncErr) {
          patchLog.warn(
            { err: syncErr, incidentId },
            "Failed to sync incident status to exception (non-blocking)",
          );
        }
      }

      patchLog.info({ incidentId }, "Incident updated");
      res.json({ message: "Incident updated", incident: updated });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/api/incidents/:id/charges",
  requireAuth,
  requireTenant,
  async (req: Request, res, next) => {
    const {
      category,
      amount,
      provider_vendor,
      status,
      approved_by,
      receipt_url,
    } = req.body;
    const incidentId = req.params.id;
    const tenantId = req.user!.tenantId;
    const chargeLog = createRequestLogger(req, "POST /api/incidents/charges");
    try {
      // Verify incident belongs to the requesting tenant
      const [rows] = await pool.query(
        "SELECT company_id FROM incidents WHERE id = ?",
        [incidentId],
      );
      const incident = (rows as any[])[0];
      if (!incident || incident.company_id !== tenantId) {
        if (incident && incident.company_id !== tenantId) {
          chargeLog.warn(
            { incidentId, attemptedTenantId: tenantId },
            "Cross-tenant charge attempt blocked",
          );
        }
        throw new NotFoundError("Incident not found");
      }

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
    } catch (err) {
      next(err);
    }
  },
);

export default router;
