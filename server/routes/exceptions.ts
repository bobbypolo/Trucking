import { Router, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import type { RowDataPacket } from "mysql2/promise";
import { requireAuth } from "../middleware/requireAuth";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import {
  createExceptionSchema,
  patchExceptionSchema,
} from "../schemas/exceptions";
import pool from "../db";
import { createChildLogger } from "../lib/logger";

/**
 * Maps an exception status to the corresponding domain-record status.
 * Exception RESOLVED -> domain "Resolved"; CLOSED -> domain "Closed".
 */
function mapExceptionStatusToDomain(exceptionStatus: string): string {
  switch (exceptionStatus) {
    case "RESOLVED":
      return "Resolved";
    case "CLOSED":
      return "Closed";
    default:
      return exceptionStatus;
  }
}

/**
 * Syncs exception status changes to linked domain records.
 * Best-effort, non-blocking: failures are logged but do not block the response.
 */
async function syncExceptionToDomain(
  exceptionId: string,
  tenantId: string,
  newStatus: string,
  correlationId?: string,
): Promise<void> {
  const log = createChildLogger({
    correlationId: correlationId ?? "unknown",
    route: "syncExceptionToDomain",
  });

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT links, entity_type, entity_id FROM exceptions WHERE id = ? AND company_id = ?",
      [exceptionId, tenantId],
    );
    if (rows.length === 0) return;

    const exception = rows[0];
    let links: Record<string, string> = {};
    try {
      links =
        typeof exception.links === "string"
          ? JSON.parse(exception.links)
          : exception.links || {};
    } catch {
      log.warn({ exceptionId }, "Failed to parse exception links JSON");
      return;
    }

    const domainStatus = mapExceptionStatusToDomain(newStatus);

    // Sync to incident
    if (links.incidentId) {
      try {
        await pool.query(
          "UPDATE incidents SET status = ? WHERE id = ? AND company_id = ?",
          [domainStatus, links.incidentId, tenantId],
        );
        log.info(
          { incidentId: links.incidentId, domainStatus },
          "Synced exception status to incident",
        );
      } catch (err) {
        log.warn(
          { err, incidentId: links.incidentId },
          "Failed to sync exception status to incident (non-blocking)",
        );
      }
    }

    // Sync to service ticket
    if (links.serviceTicketId) {
      try {
        await pool.query(
          "UPDATE service_tickets SET status = ? WHERE id = ? AND company_id = ?",
          [domainStatus, links.serviceTicketId, tenantId],
        );
        log.info(
          { serviceTicketId: links.serviceTicketId, domainStatus },
          "Synced exception status to service ticket",
        );
      } catch (err) {
        log.warn(
          { err, serviceTicketId: links.serviceTicketId },
          "Failed to sync exception status to service ticket (non-blocking)",
        );
      }
    }

    // Sync to maintenance record
    if (links.maintenanceRecordId) {
      try {
        await pool.query(
          "UPDATE safety_maintenance SET status = ? WHERE id = ? AND company_id = ?",
          [domainStatus, links.maintenanceRecordId, tenantId],
        );
        log.info(
          { maintenanceRecordId: links.maintenanceRecordId, domainStatus },
          "Synced exception status to maintenance record",
        );
      } catch (err) {
        log.warn(
          { err, maintenanceRecordId: links.maintenanceRecordId },
          "Failed to sync exception status to maintenance record (non-blocking)",
        );
      }
    }
  } catch (err) {
    log.warn(
      { err, exceptionId },
      "syncExceptionToDomain failed (non-blocking)",
    );
  }
}

const router = Router();

// Exception Management
router.get(
  "/api/exceptions",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const {
        status,
        status_not_in,
        type,
        severity,
        entityType,
        entityId,
        ownerId,
        category,
      } = req.query;
      let query = "SELECT * FROM exceptions WHERE company_id = ?";
      const params: (string | number)[] = [req.user!.tenantId];
      if (status) {
        query += " AND status = ?";
        params.push(String(status));
      }
      if (status_not_in) {
        const excluded = (status_not_in as string)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (excluded.length > 0) {
          const placeholders = excluded.map(() => "?").join(", ");
          query += ` AND status NOT IN (${placeholders})`;
          params.push(...excluded);
        }
      }
      if (type) {
        query += " AND type = ?";
        params.push(String(type));
      }
      if (severity) {
        query += " AND severity = ?";
        params.push(String(severity));
      }
      if (entityType) {
        query += " AND entity_type = ?";
        params.push(String(entityType));
      }
      if (entityId) {
        query += " AND entity_id = ?";
        params.push(String(entityId));
      }
      if (ownerId) {
        query += " AND owner_user_id = ?";
        params.push(String(ownerId));
      }
      // Category filter — maps unified workspace tabs to exception types
      if (category) {
        const categoryMap: Record<string, string[]> = {
          safety: [
            "SAFETY_INCIDENT",
            "SAFETY_ALERT",
            "COMPLIANCE_ALERT",
            "INCIDENT_GENERAL",
          ],
          maintenance: [
            "MAINTENANCE_REQUEST",
            "MAINTENANCE_INCIDENT",
            "SERVICE_TICKET",
          ],
          compliance: ["COMPLIANCE_ALERT", "COMPLIANCE_VIOLATION"],
          billing: [
            "UNBILLED_LOAD",
            "INVOICE_OVERDUE",
            "DISPUTED_INVOICE",
            "SHORT_PAY",
            "BILLING_DISPUTE",
          ],
          documents: ["MISSING_POD", "DOCUMENT_ISSUE"],
        };
        const types = categoryMap[category as string];
        if (types && types.length > 0) {
          const placeholders = types.map(() => "?").join(", ");
          query += ` AND type IN (${placeholders})`;
          params.push(...types);
        }
      }
      query += " ORDER BY severity DESC, sla_due_at ASC";
      const [rows] = await pool.query(query, params);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/api/exceptions",
  requireAuth,
  requireTenant,
  validateBody(createExceptionSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const ex = req.body;
    const id = uuidv4();
    try {
      await pool.query(
        "INSERT INTO exceptions (id, company_id, type, status, severity, entity_type, entity_id, owner_user_id, team, sla_due_at, workflow_step, financial_impact_est, description, links) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          req.user!.tenantId,
          ex.type,
          ex.status || "OPEN",
          ex.severity || 2,
          ex.entityType,
          ex.entityId,
          ex.ownerUserId,
          ex.team,
          ex.slaDueAt,
          ex.workflowStep || "triage",
          ex.financialImpactEst || 0,
          ex.description,
          JSON.stringify(ex.links || {}),
        ],
      );
      // Log creation event
      await pool.query(
        "INSERT INTO exception_events (id, exception_id, action, notes, actor_name) VALUES (?, ?, ?, ?, ?)",
        [
          uuidv4(),
          id,
          "Exception Created",
          "Initial intake",
          ex.createdBy || "System",
        ],
      );
      res.status(201).json({ message: "Exception recorded", id });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/api/exceptions/:id",
  requireAuth,
  requireTenant,
  validateBody(patchExceptionSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status, ownerUserId, workflowStep, severity, notes, actorName } =
      req.body;
    try {
      const [old] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM exceptions WHERE id = ? AND company_id = ?",
        [id, req.user!.tenantId],
      );
      if (old.length === 0) return res.status(404).json({ error: "Not found" });

      let query = "UPDATE exceptions SET updated_at = CURRENT_TIMESTAMP";
      const params: (string | number)[] = [];
      if (status) {
        query += ", status = ?";
        params.push(status);
      }
      if (ownerUserId) {
        query += ", owner_user_id = ?";
        params.push(ownerUserId);
      }
      if (workflowStep) {
        query += ", workflow_step = ?";
        params.push(workflowStep);
      }
      if (severity) {
        query += ", severity = ?";
        params.push(severity);
      }
      if (status === "RESOLVED" || status === "CLOSED") {
        query += ", resolved_at = CURRENT_TIMESTAMP";
      }

      query += " WHERE id = ? AND company_id = ?";
      params.push(id, req.user!.tenantId);

      await pool.query(query, params);

      // Bidirectional sync: propagate status changes to linked domain records
      if (status === "RESOLVED" || status === "CLOSED") {
        await syncExceptionToDomain(
          id,
          req.user!.tenantId,
          status,
          req.correlationId,
        );
      }

      // Log event
      await pool.query(
        "INSERT INTO exception_events (id, exception_id, action, notes, actor_name, before_state, after_state) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          uuidv4(),
          id,
          "Status/Owner Updated",
          notes || "Update via command center",
          actorName || "System",
          JSON.stringify(old[0]),
          JSON.stringify({ status, ownerUserId, workflowStep, severity }),
        ],
      );

      res.json({ message: "Exception updated" });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/api/exceptions/:id/events",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const [rows] = await pool.query(
        "SELECT ee.* FROM exception_events ee INNER JOIN exceptions e ON ee.exception_id = e.id WHERE ee.exception_id = ? AND e.company_id = ? ORDER BY ee.timestamp DESC",
        [req.params.id, req.user!.tenantId],
      );
      res.json(rows);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/api/exception-types",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const [rows] = await pool.query(
        "SELECT * FROM exception_type ORDER BY display_name ASC",
      );
      res.json(rows);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
