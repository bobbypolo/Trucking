import { Router } from "express";
import type { Request } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import {
  createServiceTicketSchema,
  updateServiceTicketSchema,
} from "../schemas/service-ticket";
import { serviceTicketRepository } from "../repositories/service-ticket.repository";
import { createChildLogger } from "../lib/logger";

const router = Router();

// GET /api/service-tickets — list service tickets for tenant
router.get(
  "/api/service-tickets",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    try {
      const tickets = await serviceTicketRepository.findByCompany(
        companyId,
        page,
        limit,
      );
      res.json(tickets);
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/service-tickets",
      });
      log.error({ err: error }, "Failed to fetch service tickets");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// POST /api/service-tickets — create service ticket
router.post(
  "/api/service-tickets",
  requireAuth,
  requireTenant,
  validateBody(createServiceTicketSchema),
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const userId = req.user!.uid;
    try {
      const ticket = await serviceTicketRepository.create(
        req.body,
        companyId,
        userId,
      );
      res.status(201).json(ticket);
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/service-tickets",
      });
      log.error({ err: error }, "Failed to create service ticket");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// PATCH /api/service-tickets/:id — update service ticket
router.patch(
  "/api/service-tickets/:id",
  requireAuth,
  requireTenant,
  validateBody(updateServiceTicketSchema),
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const userId = req.user!.uid;
    try {
      const existing = await serviceTicketRepository.findById(req.params.id);
      if (!existing || existing.company_id !== companyId) {
        res.status(404).json({ error: "Service ticket not found" });
        return;
      }

      // Lock after close: reject edits on closed tickets with locked_at set
      if (existing.locked_at && existing.status === "Closed") {
        res.status(403).json({ error: "Ticket is locked after closure" });
        return;
      }

      const updated = await serviceTicketRepository.update(
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

export default router;
