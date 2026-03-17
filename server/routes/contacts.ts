import { Router } from "express";
import type { Request } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import { createContactSchema, updateContactSchema } from "../schemas/contact";
import { contactRepository } from "../repositories/contact.repository";
import { createChildLogger } from "../lib/logger";

const router = Router();

// GET /api/contacts — list contacts for tenant
router.get(
  "/api/contacts",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    try {
      const contacts = await contactRepository.findByCompany(
        companyId,
        page,
        limit,
      );
      res.json(contacts);
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/contacts",
      });
      log.error({ err: error }, "Failed to fetch contacts");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// POST /api/contacts — create contact
router.post(
  "/api/contacts",
  requireAuth,
  requireTenant,
  validateBody(createContactSchema),
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const userId = req.user!.uid;
    try {
      const contact = await contactRepository.create(
        req.body,
        companyId,
        userId,
      );
      res.status(201).json(contact);
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/contacts",
      });
      log.error({ err: error }, "Failed to create contact");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// PATCH /api/contacts/:id — update contact
router.patch(
  "/api/contacts/:id",
  requireAuth,
  requireTenant,
  validateBody(updateContactSchema),
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const userId = req.user!.uid;
    try {
      const existing = await contactRepository.findById(req.params.id);
      if (!existing || existing.company_id !== companyId) {
        res.status(404).json({ error: "Contact not found" });
        return;
      }
      const updated = await contactRepository.update(
        req.params.id,
        req.body,
        userId,
      );
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  },
);

// PATCH /api/contacts/:id/archive — soft-delete
router.patch(
  "/api/contacts/:id/archive",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const userId = req.user!.uid;
    try {
      const existing = await contactRepository.findById(req.params.id);
      if (!existing || existing.company_id !== companyId) {
        res.status(404).json({ error: "Contact not found" });
        return;
      }
      await contactRepository.archive(req.params.id, userId);
      res.json({ message: "Contact archived" });
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  },
);

export default router;
