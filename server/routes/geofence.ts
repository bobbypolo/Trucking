import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import type { RowDataPacket } from "mysql2/promise";
import { v4 as uuidv4 } from "uuid";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import {
  createGeofenceEventSchema,
  calculateDetentionSchema,
} from "../schemas/geofence";
import pool from "../db";


const router = Router();

// POST /api/geofence-events — record ENTRY/EXIT geofence event
router.post(
  "/api/geofence-events",
  requireAuth,
  requireTenant,
  validateBody(createGeofenceEventSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user!;
    const {
      loadId,
      driverId,
      facilityName,
      facilityLat,
      facilityLng,
      geofenceRadiusMeters,
      eventType,
      eventTimestamp,
    } = req.body;

    try {
      // Verify load belongs to user's tenant
      const [loadRows] = await pool.query<RowDataPacket[]>(
        "SELECT company_id FROM loads WHERE id = ?",
        [loadId],
      );
      if (!loadRows.length || loadRows[0].company_id !== user.tenantId) {
        return res.status(404).json({ error: "Load not found" });
      }

      const id = uuidv4();
      const timestamp = eventTimestamp || new Date().toISOString();

      await pool.query(
        "INSERT INTO geofence_events (id, company_id, load_id, driver_id, facility_name, facility_lat, facility_lng, geofence_radius_meters, event_type, event_timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          user.tenantId,
          loadId,
          driverId || null,
          facilityName || null,
          facilityLat,
          facilityLng,
          geofenceRadiusMeters || 500,
          eventType,
          timestamp,
        ],
      );

      res.status(201).json({ id, message: "Geofence event recorded" });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/geofence-events — list events by loadId
router.get(
  "/api/geofence-events",
  requireAuth,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user!;
    const loadId = req.query.loadId as string;

    if (!loadId) {
      return res.status(400).json({ error: "loadId query parameter is required" });
    }

    try {
      const [rows] = await pool.query(
        "SELECT * FROM geofence_events WHERE load_id = ? AND company_id = ? ORDER BY event_timestamp ASC",
        [loadId, user.tenantId],
      );
      res.json(rows);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/detention/calculate — calculate detention for a load
router.post(
  "/api/detention/calculate",
  requireAuth,
  requireTenant,
  validateBody(calculateDetentionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user!;
    const { loadId } = req.body;

    try {
      // Get all geofence events for this load, ordered by timestamp
      const [events] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM geofence_events WHERE load_id = ? AND company_id = ? ORDER BY event_timestamp ASC",
        [loadId, user.tenantId],
      );

      // Get detention rules for this company (or use defaults)
      const [ruleRows] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM detention_rules WHERE company_id = ? LIMIT 1",
        [user.tenantId],
      );

      const freeHours = ruleRows.length > 0 ? Number(ruleRows[0].free_hours) : 2.0;
      const hourlyRate =
        ruleRows.length > 0 ? Number(ruleRows[0].hourly_rate) : 75.0;
      const maxBillableHours =
        ruleRows.length > 0 ? Number(ruleRows[0].max_billable_hours) : 24.0;

      // Pair ENTRY/EXIT events by facility proximity
      const detentionRecords: Array<{
        facilityName: string | null;
        entryTime: string;
        exitTime: string;
        dwellHours: number;
        billableHours: number;
        charge: number;
        freeHours: number;
        hourlyRate: number;
      }> = [];

      // Track pending entries (keyed by facility name or coords)
      const pendingEntries: Map<string, any> = new Map();

      for (const event of events) {
        const facilityKey =
          event.facility_name ||
          `${Number(event.facility_lat).toFixed(4)},${Number(event.facility_lng).toFixed(4)}`;

        if (event.event_type === "ENTRY") {
          pendingEntries.set(facilityKey, event);
        } else if (event.event_type === "EXIT") {
          const entry = pendingEntries.get(facilityKey);
          if (entry) {
            const entryTime = new Date(entry.event_timestamp).getTime();
            const exitTime = new Date(event.event_timestamp).getTime();
            const dwellHours = (exitTime - entryTime) / 3600000;
            const billableHours = Math.max(
              0,
              Math.min(dwellHours - freeHours, maxBillableHours),
            );
            const charge = billableHours * hourlyRate;

            detentionRecords.push({
              facilityName: event.facility_name || facilityKey,
              entryTime: entry.event_timestamp,
              exitTime: event.event_timestamp,
              dwellHours: Math.round(dwellHours * 100) / 100,
              billableHours: Math.round(billableHours * 100) / 100,
              charge: Math.round(charge * 100) / 100,
              freeHours,
              hourlyRate,
            });

            pendingEntries.delete(facilityKey);
          }
          // EXIT without ENTRY is silently skipped (no pair to calculate)
        }
      }

      const totalCharge = detentionRecords.reduce(
        (sum, r) => sum + r.charge,
        0,
      );

      res.json({
        loadId,
        records: detentionRecords,
        totalCharge: Math.round(totalCharge * 100) / 100,
        rules: { freeHours, hourlyRate, maxBillableHours },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
