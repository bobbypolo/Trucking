import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { messageRepository } from "../repositories/message.repository";
import { createChildLogger } from "../lib/logger";

const router = Router();

/**
 * GET /api/messages
 * Returns all messages for the authenticated tenant, optionally filtered by load.
 */
router.get(
  "/api/messages",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const companyId: string = req.user?.companyId ?? req.user?.tenantId;
    const loadId = req.query.loadId as string | undefined;

    try {
      const messages = await messageRepository.findByCompany(companyId, loadId);
      res.json({ messages });
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/messages",
      });
      log.error({ err: error }, "SERVER ERROR [GET /api/messages]");
      res.status(500).json({ error: "Database error" });
    }
  },
);

/**
 * POST /api/messages
 * Creates a new message scoped to the authenticated tenant.
 */
router.post(
  "/api/messages",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const companyId: string = req.user?.companyId ?? req.user?.tenantId;
    const { load_id, sender_id, sender_name, text, attachments } = req.body;

    if (!load_id || !sender_id) {
      return res
        .status(400)
        .json({
          error: "Validation error",
          details: "load_id and sender_id are required",
        });
    }

    try {
      const message = await messageRepository.create(
        { load_id, sender_id, sender_name, text, attachments },
        companyId,
      );
      res.status(201).json({ message });
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/messages",
      });
      log.error({ err: error }, "SERVER ERROR [POST /api/messages]");
      res.status(500).json({ error: "Database error" });
    }
  },
);

/**
 * DELETE /api/messages/:id
 * Deletes a message scoped to the authenticated tenant.
 */
router.delete(
  "/api/messages/:id",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const companyId: string = req.user?.companyId ?? req.user?.tenantId;
    const { id } = req.params;

    try {
      const deleted = await messageRepository.delete(id, companyId);
      if (!deleted) {
        return res.status(404).json({ error: "Not Found" });
      }
      res.status(204).send();
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "DELETE /api/messages/:id",
      });
      log.error({ err: error }, "SERVER ERROR [DELETE /api/messages/:id]");
      res.status(500).json({ error: "Database error" });
    }
  },
);

export default router;
