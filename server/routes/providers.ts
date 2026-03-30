import { Router } from "express";
import type { Request } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import {
  createProviderSchema,
  updateProviderSchema,
} from "../schemas/provider";
import { providerRepository } from "../repositories/provider.repository";
import { createRequestLogger } from "../lib/logger";

const router = Router();

// GET /api/providers — list providers for tenant
router.get(
  "/api/providers",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    try {
      const providers = await providerRepository.findByCompany(
        companyId,
        page,
        limit,
      );
      res.json(providers);
    } catch (error) {
      const log = createRequestLogger(req, "GET /api/providers");
      log.error({ err: error }, "Failed to fetch providers");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// POST /api/providers — create provider
router.post(
  "/api/providers",
  requireAuth,
  requireTenant,
  validateBody(createProviderSchema),
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const userId = req.user!.uid;
    try {
      const provider = await providerRepository.create(
        req.body,
        companyId,
        userId,
      );
      res.status(201).json(provider);
    } catch (error) {
      const log = createRequestLogger(req, "POST /api/providers");
      log.error({ err: error }, "Failed to create provider");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// PATCH /api/providers/:id — update provider
router.patch(
  "/api/providers/:id",
  requireAuth,
  requireTenant,
  validateBody(updateProviderSchema),
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const userId = req.user!.uid;
    try {
      const existing = await providerRepository.findById(req.params.id);
      if (!existing || existing.company_id !== companyId) {
        res.status(404).json({ error: "Provider not found" });
        return;
      }
      const updated = await providerRepository.update(
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

// PATCH /api/providers/:id/archive — soft-delete
router.patch(
  "/api/providers/:id/archive",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const userId = req.user!.uid;
    try {
      const existing = await providerRepository.findById(req.params.id);
      if (!existing || existing.company_id !== companyId) {
        res.status(404).json({ error: "Provider not found" });
        return;
      }
      await providerRepository.archive(req.params.id, userId);
      res.json({ message: "Provider archived" });
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  },
);

export default router;
