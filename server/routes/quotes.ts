import { Router } from "express";
import type { Request } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import { createQuoteSchema, updateQuoteSchema } from "../schemas/quote";
import { quoteRepository } from "../repositories/quote.repository";

const router = Router();

// GET /api/quotes — list quotes for tenant
router.get(
  "/api/quotes",
  requireAuth,
  requireTenant,
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    try {
      const quotes = await quoteRepository.findByCompany(
        companyId,
        page,
        limit,
      );
      res.json(quotes);
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/quotes/:id — get single quote
router.get(
  "/api/quotes/:id",
  requireAuth,
  requireTenant,
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    try {
      const quote = await quoteRepository.findById(req.params.id);
      if (!quote || quote.company_id !== companyId) {
        res.status(404).json({ error: "Quote not found" });
        return;
      }
      res.json(quote);
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/quotes — create quote
router.post(
  "/api/quotes",
  requireAuth,
  requireTenant,
  validateBody(createQuoteSchema),
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    const userId = req.user!.uid;
    try {
      const quote = await quoteRepository.create(req.body, companyId, userId);
      res.status(201).json(quote);
    } catch (error) {
      next(error);
    }
  },
);

// PATCH /api/quotes/:id — update quote
router.patch(
  "/api/quotes/:id",
  requireAuth,
  requireTenant,
  validateBody(updateQuoteSchema),
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    const userId = req.user!.uid;
    try {
      const existing = await quoteRepository.findById(req.params.id);
      if (!existing || existing.company_id !== companyId) {
        res.status(404).json({ error: "Quote not found" });
        return;
      }
      const updated = await quoteRepository.update(
        req.params.id,
        req.body,
        userId,
      );
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },
);

// PATCH /api/quotes/:id/archive — soft-delete
router.patch(
  "/api/quotes/:id/archive",
  requireAuth,
  requireTenant,
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    const userId = req.user!.uid;
    try {
      const existing = await quoteRepository.findById(req.params.id);
      if (!existing || existing.company_id !== companyId) {
        res.status(404).json({ error: "Quote not found" });
        return;
      }
      await quoteRepository.archive(req.params.id, userId);
      res.json({ message: "Quote archived" });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
