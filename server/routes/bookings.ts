import { Router } from "express";
import type { Request } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import { createBookingSchema, updateBookingSchema } from "../schemas/booking";
import { bookingRepository } from "../repositories/booking.repository";
import { createChildLogger } from "../lib/logger";

const router = Router();

// GET /api/bookings — list bookings for tenant
router.get(
  "/api/bookings",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    try {
      const bookings = await bookingRepository.findByCompany(
        companyId,
        page,
        limit,
      );
      res.json(bookings);
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/bookings",
      });
      log.error({ err: error }, "Failed to fetch bookings");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// GET /api/bookings/:id — get single booking
router.get(
  "/api/bookings/:id",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    try {
      const booking = await bookingRepository.findById(req.params.id);
      if (!booking || booking.company_id !== companyId) {
        res.status(404).json({ error: "Booking not found" });
        return;
      }
      res.json(booking);
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  },
);

// POST /api/bookings — create booking
router.post(
  "/api/bookings",
  requireAuth,
  requireTenant,
  validateBody(createBookingSchema),
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const userId = req.user!.uid;
    try {
      const booking = await bookingRepository.create(
        req.body,
        companyId,
        userId,
      );
      res.status(201).json(booking);
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/bookings",
      });
      log.error({ err: error }, "Failed to create booking");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// PATCH /api/bookings/:id — update booking
router.patch(
  "/api/bookings/:id",
  requireAuth,
  requireTenant,
  validateBody(updateBookingSchema),
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const userId = req.user!.uid;
    try {
      const existing = await bookingRepository.findById(req.params.id);
      if (!existing || existing.company_id !== companyId) {
        res.status(404).json({ error: "Booking not found" });
        return;
      }
      const updated = await bookingRepository.update(
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
