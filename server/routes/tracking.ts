import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import pool from "../db";
import { createChildLogger } from "../lib/logger";

const router = Router();

interface TrackingLeg {
  id: string;
  load_id: string;
  type: string;
  facility_name: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  completed: boolean;
  sequence_order: number;
}

interface TrackingPosition {
  latitude: number;
  longitude: number;
}

interface TrackingLoad {
  id: string;
  loadNumber: string;
  status: string;
  driverId: string | null;
  legs: TrackingLeg[];
  currentPosition: TrackingPosition | null;
}

/**
 * Derive the current position from DB-stored stop coordinates.
 * Uses the last completed stop that has coordinates.
 */
function deriveCurrentPosition(legs: TrackingLeg[]): TrackingPosition | null {
  const completedWithCoords = legs
    .filter(
      (leg) => leg.completed && leg.latitude != null && leg.longitude != null,
    )
    .sort((a, b) => b.sequence_order - a.sequence_order);

  if (completedWithCoords.length === 0) {
    return null;
  }

  const lastCompleted = completedWithCoords[0];
  return {
    latitude: lastCompleted.latitude!,
    longitude: lastCompleted.longitude!,
  };
}

/**
 * GET /api/loads/tracking
 * Returns tracking positions for all active loads belonging to the tenant.
 * Coordinates come from stored lat/lng in load_legs (DB-backed, not mock).
 */
router.get(
  "/api/loads/tracking",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const companyId = req.user.tenantId;
    try {
      const [loads]: any = await pool.query(
        `SELECT id, load_number, status, driver_id
             FROM loads
             WHERE company_id = ? AND status IN ('in_transit', 'dispatched', 'planned', 'arrived')
             ORDER BY created_at DESC`,
        [companyId],
      );

      if (loads.length === 0) {
        return res.json([]);
      }

      const result: TrackingLoad[] = [];
      for (const load of loads) {
        const [legs]: any = await pool.query(
          `SELECT id, load_id, type, facility_name, city, state,
                        latitude, longitude, completed, sequence_order
                 FROM load_legs
                 WHERE load_id = ?
                 ORDER BY sequence_order ASC`,
          [load.id],
        );

        result.push({
          id: load.id,
          loadNumber: load.load_number,
          status: load.status,
          driverId: load.driver_id,
          legs,
          currentPosition: deriveCurrentPosition(legs),
        });
      }

      res.json(result);
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/loads/tracking",
      });
      log.error({ err: error }, "SERVER ERROR [GET /api/loads/tracking]");
      res.status(500).json({ error: "Database error" });
    }
  },
);

/**
 * GET /api/loads/:id/tracking
 * Returns tracking data for a specific load.
 */
router.get(
  "/api/loads/:id/tracking",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const companyId = req.user.tenantId;
    const loadId = req.params.id;

    try {
      const [loads]: any = await pool.query(
        "SELECT id, load_number, status, driver_id FROM loads WHERE id = ? AND company_id = ?",
        [loadId, companyId],
      );

      if (loads.length === 0) {
        return res.status(404).json({ error: "Load not found" });
      }

      const load = loads[0];
      const [legs]: any = await pool.query(
        `SELECT id, load_id, type, facility_name, city, state,
                    latitude, longitude, completed, sequence_order
             FROM load_legs
             WHERE load_id = ?
             ORDER BY sequence_order ASC`,
        [load.id],
      );

      res.json({
        id: load.id,
        loadNumber: load.load_number,
        status: load.status,
        driverId: load.driver_id,
        legs,
        currentPosition: deriveCurrentPosition(legs),
      });
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: `GET /api/loads/${req.params.id}/tracking`,
      });
      log.error(
        { err: error },
        `SERVER ERROR [GET /api/loads/${req.params.id}/tracking]`,
      );
      res.status(500).json({ error: "Database error" });
    }
  },
);

export default router;
