import { Router, Request, NextFunction } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateParams } from "../middleware/validateParams";
import { idParam } from "../schemas/params";
import { callSessionRepository } from "../repositories/call-session.repository";
import { createRequestLogger } from "../lib/logger";

const router = Router();

/**
 * GET /api/call-sessions
 * Returns all call sessions for the authenticated tenant.
 */
router.get(
  "/api/call-sessions",
  requireAuth,
  requireTenant,
  async (req: Request, res, next: NextFunction) => {
    const companyId = req.user!.tenantId;

    try {
      const sessions = await callSessionRepository.findByCompany(companyId);
      res.json({ sessions });
    } catch (error) {
      const log = createRequestLogger(req, "GET /api/call-sessions");
      log.error({ err: error }, "SERVER ERROR [GET /api/call-sessions]");
      next(error);
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
  async (req: Request, res, next: NextFunction) => {
    const companyId = req.user!.tenantId;
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

    if (!status) {
      return res.status(400).json({
        error: "Validation error",
        details: "status is required",
      });
    }

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
      const log = createRequestLogger(req, "POST /api/call-sessions");
      log.error({ err: error }, "SERVER ERROR [POST /api/call-sessions]");
      next(error);
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
  validateParams(idParam),
  async (req: Request, res, next: NextFunction) => {
    const companyId = req.user!.tenantId;
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
      const log = createRequestLogger(req, "PUT /api/call-sessions/:id");
      log.error({ err: error }, "SERVER ERROR [PUT /api/call-sessions/:id]");
      next(error);
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
  validateParams(idParam),
  async (req: Request, res, next: NextFunction) => {
    const companyId = req.user!.tenantId;
    const { id } = req.params;

    try {
      const deleted = await callSessionRepository.delete(id, companyId);
      if (!deleted) {
        return res.status(404).json({ error: "Not Found" });
      }
      res.status(204).send();
    } catch (error) {
      const log = createRequestLogger(req, "DELETE /api/call-sessions/:id");
      log.error({ err: error }, "SERVER ERROR [DELETE /api/call-sessions/:id]");
      next(error);
    }
  },
);

export default router;
