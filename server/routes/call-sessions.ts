import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { callSessionRepository } from "../repositories/call-session.repository";
import { createChildLogger } from "../lib/logger";

const router = Router();

/**
 * GET /api/call-sessions
 * Returns all call sessions for the authenticated tenant.
 */
router.get(
  "/api/call-sessions",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const companyId: string = req.user?.companyId ?? req.user?.tenantId;

    try {
      const sessions = await callSessionRepository.findByCompany(companyId);
      res.json({ sessions });
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/call-sessions",
      });
      log.error({ err: error }, "SERVER ERROR [GET /api/call-sessions]");
      res.status(500).json({ error: "Database error" });
    }
  },
);

/**
 * POST /api/call-sessions
 * Creates a new call session scoped to the authenticated tenant.
 */
router.post(
  "/api/call-sessions",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const companyId: string = req.user?.companyId ?? req.user?.tenantId;
    const {
      start_time,
      end_time,
      duration_seconds,
      status,
      assigned_to,
      team,
      notes,
      participants,
      links,
    } = req.body;

    try {
      const session = await callSessionRepository.create(
        {
          start_time,
          end_time,
          duration_seconds,
          status,
          assigned_to,
          team,
          notes,
          participants,
          links,
        },
        companyId,
      );
      res.status(201).json({ session });
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/call-sessions",
      });
      log.error({ err: error }, "SERVER ERROR [POST /api/call-sessions]");
      res.status(500).json({ error: "Database error" });
    }
  },
);

/**
 * PUT /api/call-sessions/:id
 * Updates a call session scoped to the authenticated tenant.
 */
router.put(
  "/api/call-sessions/:id",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const companyId: string = req.user?.companyId ?? req.user?.tenantId;
    const { id } = req.params;

    try {
      const session = await callSessionRepository.update(
        id,
        req.body,
        companyId,
      );
      if (!session) {
        return res.status(404).json({ error: "Not Found" });
      }
      res.json({ session });
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "PUT /api/call-sessions/:id",
      });
      log.error({ err: error }, "SERVER ERROR [PUT /api/call-sessions/:id]");
      res.status(500).json({ error: "Database error" });
    }
  },
);

/**
 * DELETE /api/call-sessions/:id
 * Deletes a call session scoped to the authenticated tenant.
 */
router.delete(
  "/api/call-sessions/:id",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const companyId: string = req.user?.companyId ?? req.user?.tenantId;
    const { id } = req.params;

    try {
      const deleted = await callSessionRepository.delete(id, companyId);
      if (!deleted) {
        return res.status(404).json({ error: "Not Found" });
      }
      res.status(204).send();
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "DELETE /api/call-sessions/:id",
      });
      log.error({ err: error }, "SERVER ERROR [DELETE /api/call-sessions/:id]");
      res.status(500).json({ error: "Database error" });
    }
  },
);

export default router;
