import { Router } from "express";
import type { Request, NextFunction } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import {
  createBookingSchema,
  updateBookingSchema,
  convertBookingSchema,
} from "../schemas/booking";
import { bookingRepository } from "../repositories/booking.repository";
import { createRequestLogger } from "../lib/logger";

const router = Router();

// GET /api/bookings — list bookings for tenant
router.get(
  "/api/bookings",
  requireAuth,
  requireTenant,
  async (req: Request, res, next: NextFunction) => {
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
      const log = createRequestLogger(req, "GET /api/bookings");
      log.error({ err: error }, "Failed to fetch bookings");
      next(error);
    }
  },
);

// GET /api/bookings/:id — get single booking
router.get(
  "/api/bookings/:id",
  requireAuth,
  requireTenant,
  async (req: Request, res, next: NextFunction) => {
    const companyId = req.user!.tenantId;
    try {
      const booking = await bookingRepository.findById(req.params.id);
      if (!booking || booking.company_id !== companyId) {
        res.status(404).json({ error: "Booking not found" });
        return;
      }
      res.json(booking);
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/bookings — create booking
router.post(
  "/api/bookings",
  requireAuth,
  requireTenant,
  validateBody(createBookingSchema),
  async (req: Request, res, next: NextFunction) => {
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
      const log = createRequestLogger(req, "POST /api/bookings");
      log.error({ err: error }, "Failed to create booking");
      next(error);
    }
  },
);

// PATCH /api/bookings/:id — update booking
router.patch(
  "/api/bookings/:id",
  requireAuth,
  requireTenant,
  validateBody(updateBookingSchema),
  async (req: Request, res, next: NextFunction) => {
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
      next(error);
    }
  },
);

// POST /api/bookings/convert — atomically create booking + canonical operational load
// This is the canonical quote-to-load conversion endpoint.
// It creates a booking record AND an operational load in a single DB transaction.
// Financial estimates from the quote (driver pay, margin) are NOT carried into the load —
// only carrier_rate is set as a reference. driver_pay on the load is always 0 until
// settlement is explicitly created by accounting.
router.post(
  "/api/bookings/convert",
  requireAuth,
  requireTenant,
  validateBody(convertBookingSchema),
  async (req: Request, res, next: NextFunction) => {
    const companyId = req.user!.tenantId;
    const userId = req.user!.uid;
    try {
      const {
        load_number,
        freight_type,
        commodity,
        weight,
        carrier_rate,
        pickup_city,
        pickup_state,
        pickup_facility,
        dropoff_city,
        dropoff_state,
        dropoff_facility,
        ...bookingData
      } = req.body;

      const loadInput = {
        load_number,
        customer_id: bookingData.customer_id ?? null,
        pickup_date: bookingData.pickup_date ?? null,
        delivery_date: bookingData.delivery_date ?? null,
        freight_type: freight_type ?? null,
        commodity: commodity ?? null,
        weight: weight ?? null,
        carrier_rate: carrier_rate ?? 0,
        pickup_city: pickup_city ?? null,
        pickup_state: pickup_state ?? null,
        pickup_facility: pickup_facility ?? null,
        dropoff_city: dropoff_city ?? null,
        dropoff_state: dropoff_state ?? null,
        dropoff_facility: dropoff_facility ?? null,
      };

      const booking = await bookingRepository.createWithLoad(
        bookingData,
        loadInput,
        companyId,
        userId,
      );
      res.status(201).json(booking);
    } catch (error) {
      const log = createRequestLogger(req, "POST /api/bookings/convert");
      log.error({ err: error }, "Failed to convert booking to load");
      next(error);
    }
  },
);

export default router;
