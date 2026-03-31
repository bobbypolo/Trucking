import { Router, Request } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import { validateParams } from "../middleware/validateParams";
import { createMessageSchema } from "../schemas/message";
import { idParam } from "../schemas/params";
import { messageRepository } from "../repositories/message.repository";


const router = Router();

/**
 * GET /api/messages
 * Returns all messages for the authenticated tenant, optionally filtered by load.
 */
router.get(
  "/api/messages",
  requireAuth,
  requireTenant,
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    const loadId = req.query.loadId as string | undefined;

    try {
      const messages = await messageRepository.findByCompany(companyId, loadId);
      res.json({ messages });
    } catch (err) {
      next(err);
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
  validateBody(createMessageSchema),
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    const { load_id, sender_id, sender_name, text, attachments } = req.body;

    try {
      const message = await messageRepository.create(
        { load_id, sender_id, sender_name, text, attachments },
        companyId,
      );
      res.status(201).json({ message });
    } catch (err) {
      next(err);
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
  validateParams(idParam),
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    const { id } = req.params;

    try {
      const deleted = await messageRepository.delete(id, companyId);
      if (!deleted) {
        return res.status(404).json({ error: "Not Found" });
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
