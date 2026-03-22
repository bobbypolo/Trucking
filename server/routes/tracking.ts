import { Router } from "express";
import { randomUUID } from "crypto";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import pool from "../db";
import { createChildLogger } from "../lib/logger";
import { getGpsProvider } from "../services/gps";
import type { GpsPosition } from "../services/gps";

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

/**
 * Store GPS positions in the gps_positions table.
 * Best-effort — errors are logged but do not fail the request.
 */
async function storePositions(
  companyId: string,
  positions: GpsPosition[],
  log: ReturnType<typeof createChildLogger>,
): Promise<void> {
  if (positions.length === 0) return;

  try {
    const values = positions.map((p) => [
      randomUUID(),
      companyId,
      p.vehicleId,
      p.driverId || null,
      p.latitude,
      p.longitude,
      p.speed ?? null,
      p.heading ?? null,
      p.recordedAt || new Date(),
      p.provider || null,
      p.providerVehicleId || null,
    ]);

    const placeholders = values
      .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .join(", ");

    await pool.query(
      `INSERT INTO gps_positions
         (id, company_id, vehicle_id, driver_id, latitude, longitude,
          speed, heading, recorded_at, provider, provider_vehicle_id)
       VALUES ${placeholders}`,
      values.flat(),
    );
  } catch (err) {
    log.error({ err }, "Failed to store GPS positions");
  }
}

/**
 * GET /api/tracking/live
 * Returns live GPS positions from the configured GPS provider.
 * Stores received positions in gps_positions table.
 * Requires Firebase auth + tenant.
 */
router.get(
  "/api/tracking/live",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const companyId = req.user.tenantId;
    const log = createChildLogger({
      correlationId: req.correlationId,
      route: "GET /api/tracking/live",
    });

    try {
      const gps = getGpsProvider();
      const positions = await gps.getVehicleLocations(companyId);

      // Store positions in DB (best-effort)
      await storePositions(companyId, positions, log);

      res.json({ positions });
    } catch (error) {
      log.error({ err: error }, "SERVER ERROR [GET /api/tracking/live]");
      res.status(500).json({ error: "GPS tracking error" });
    }
  },
);

/**
 * POST /api/tracking/webhook
 * Accepts GPS position pings from ELD/GPS providers.
 * Auth: X-GPS-API-Key header validated against GPS_WEBHOOK_SECRET env var.
 * Not Firebase auth — ELD providers can't do Firebase.
 */
router.post("/api/tracking/webhook", async (req: any, res) => {
  const log = createChildLogger({
    correlationId: req.correlationId,
    route: "POST /api/tracking/webhook",
  });

  // Validate X-GPS-API-Key header
  const apiKey = req.headers["x-gps-api-key"];
  const expectedKey = process.env.GPS_WEBHOOK_SECRET;

  if (!apiKey) {
    return res.status(401).json({ error: "Missing API key" });
  }

  if (!expectedKey || apiKey !== expectedKey) {
    return res.status(401).json({ error: "Invalid API key" });
  }

  // Validate required fields
  const { vehicleId, latitude, longitude, speed, heading, driverId } =
    req.body;

  const missing: string[] = [];
  if (!vehicleId) missing.push("vehicleId");
  if (latitude == null) missing.push("latitude");
  if (longitude == null) missing.push("longitude");

  if (missing.length > 0) {
    return res
      .status(400)
      .json({ error: `Missing required fields: ${missing.join(", ")}` });
  }

  try {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO gps_positions
         (id, company_id, vehicle_id, driver_id, latitude, longitude,
          speed, heading, recorded_at, provider, provider_vehicle_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        "webhook", // company_id placeholder for webhook-sourced data
        vehicleId,
        driverId || null,
        latitude,
        longitude,
        speed ?? null,
        heading ?? null,
        new Date(),
        "webhook",
        vehicleId,
      ],
    );

    res.status(201).json({ stored: true, id });
  } catch (error) {
    log.error({ err: error }, "SERVER ERROR [POST /api/tracking/webhook]");
    res.status(500).json({ error: "Failed to store position" });
  }
});

export default router;
