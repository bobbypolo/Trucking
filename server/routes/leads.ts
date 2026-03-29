import { Router } from "express";
import type { Request } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import { createLeadSchema, updateLeadSchema } from "../schemas/lead";
import { leadRepository } from "../repositories/lead.repository";
import { createRequestLogger } from "../lib/logger";

const router = Router();

// GET /api/leads — list leads for tenant
router.get(
  "/api/leads",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    try {
      const leads = await leadRepository.findByCompany(companyId, page, limit);
      res.json(leads);
    } catch (error) {
      const log = createRequestLogger(req, "GET /api/leads");
      log.error({ err: error }, "Failed to fetch leads");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// GET /api/leads/:id — get single lead
router.get(
  "/api/leads/:id",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    try {
      const lead = await leadRepository.findById(req.params.id);
      if (!lead || lead.company_id !== companyId) {
        res.status(404).json({ error: "Lead not found" });
        return;
      }
      res.json(lead);
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  },
);

// POST /api/leads — create lead
router.post(
  "/api/leads",
  requireAuth,
  requireTenant,
  validateBody(createLeadSchema),
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const userId = req.user!.uid;
    try {
      const lead = await leadRepository.create(req.body, companyId, userId);
      res.status(201).json(lead);
    } catch (error) {
      const log = createRequestLogger(req, "POST /api/leads");
      log.error({ err: error }, "Failed to create lead");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// PATCH /api/leads/:id — update lead
router.patch(
  "/api/leads/:id",
  requireAuth,
  requireTenant,
  validateBody(updateLeadSchema),
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const userId = req.user!.uid;
    try {
      const existing = await leadRepository.findById(req.params.id);
      if (!existing || existing.company_id !== companyId) {
        res.status(404).json({ error: "Lead not found" });
        return;
      }
      const updated = await leadRepository.update(
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

// DELETE /api/leads/:id — admin-only hard delete
router.delete(
  "/api/leads/:id",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    if (req.user!.role !== "admin") {
      res.status(403).json({ error: "Forbidden: admin access required" });
      return;
    }
    try {
      const existing = await leadRepository.findById(req.params.id);
      if (!existing || existing.company_id !== companyId) {
        res.status(404).json({ error: "Lead not found" });
        return;
      }
      await leadRepository.hardDelete(req.params.id);
      res.json({ message: "Lead deleted" });
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  },
);

export default router;
