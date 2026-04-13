import { Router, Request } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import { validateParams } from "../middleware/validateParams";
import { createMessageSchema, createThreadSchema } from "../schemas/message";
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
 * Accepts optional thread_id to associate with a thread.
 */
router.post(
  "/api/messages",
  requireAuth,
  requireTenant,
  validateBody(createMessageSchema),
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    const { load_id, sender_id, sender_name, text, attachments, thread_id } =
      req.body;

    try {
      const message = await messageRepository.create(
        { load_id, sender_id, sender_name, text, attachments, thread_id },
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

/**
 * POST /api/threads
 * Creates a new thread with company_id, participant_ids, and optional load_id.
 */
router.post(
  "/api/threads",
  requireAuth,
  requireTenant,
  validateBody(createThreadSchema),
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    const { title, load_id, participant_ids } = req.body;

    try {
      const thread = await messageRepository.createThread(
        { title, load_id, participant_ids },
        companyId,
      );
      res.status(201).json({ thread });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/threads
 * Returns all threads for the authenticated tenant, optionally filtered by loadId.
 */
router.get(
  "/api/threads",
  requireAuth,
  requireTenant,
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    const loadId = req.query.loadId as string | undefined;

    try {
      const threads = await messageRepository.findThreadsByCompany(
        companyId,
        loadId,
      );
      res.json({ threads });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/threads/:id/messages
 * Returns messages for a specific thread, ordered by created_at ASC, tenant-scoped.
 */
router.get(
  "/api/threads/:id/messages",
  requireAuth,
  requireTenant,
  validateParams(idParam),
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    const { id } = req.params;

    try {
      const messages = await messageRepository.findByThread(id, companyId);
      res.json({ messages });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/messages/:id/read
 * Marks a message as read by setting read_at timestamp.
 */
router.patch(
  "/api/messages/:id/read",
  requireAuth,
  requireTenant,
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    const { id } = req.params;

    try {
      const readAt = await messageRepository.markRead(id, companyId);
      if (readAt === null) {
        return res.status(404).json({ error: "Not Found" });
      }
      res.status(200).json({ read_at: readAt });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
