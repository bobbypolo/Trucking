import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { v4 as uuidv4 } from "uuid";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import {
  createTimeLogSchema,
  createDispatchEventSchema,
  bestMatchesSchema,
} from "../schemas/dispatch";
import pool from "../db";
import { calculateDistance } from "../geoUtils";
import { createRequestLogger } from "../lib/logger";

const router = Router();

// Driver Time Logs
router.post(
  "/api/time-logs",
  requireAuth,
  requireTenant,
  validateBody(createTimeLogSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user!;
    const {
      id,
      user_id,
      load_id,
      activity_type,
      location_lat,
      location_lng,
      clock_out,
    } = req.body;
    // Security: Only allow logging for oneself unless manager
    if (
      user.uid !== user_id &&
      user.role !== "admin" &&
      user.role !== "dispatcher"
    ) {
      return res.status(403).json({ error: "Access denied" });
    }
    try {
      // Validate user_id belongs to caller's tenant (4a: cross-tenant INSERT prevention)
      if (user_id !== user.uid) {
        const [targetUser] = await pool.query<RowDataPacket[]>(
          "SELECT company_id FROM users WHERE id = ?",
          [user_id],
        );
        if (!targetUser.length || targetUser[0].company_id !== user.tenantId) {
          return res.status(404).json({ error: "User not found" });
        }
      }
      if (clock_out) {
        // 4b: tenant-scoped clock-out UPDATE via JOIN
        const [result] = await pool.query<ResultSetHeader>(
          "UPDATE driver_time_logs t JOIN users u ON t.user_id = u.id SET t.clock_out = ? WHERE t.id = ? AND u.company_id = ?",
          [clock_out, id, user.tenantId],
        );
        if (!result.affectedRows) {
          return res.status(404).json({ error: "Time log not found" });
        }
      } else {
        await pool.query(
          "INSERT INTO driver_time_logs (id, user_id, load_id, activity_type, location_lat, location_lng) VALUES (?, ?, ?, ?, ?, ?)",
          [
            id || uuidv4(),
            user_id,
            load_id,
            activity_type,
            location_lat,
            location_lng,
          ],
        );
      }
      res.status(201).json({ message: "Time log recorded" });
    } catch (error) {
      const log = createRequestLogger(req, "POST /api/time-logs");
      log.error(
        { err: error, userId: user.uid },
        "SERVER ERROR [POST /api/time-logs]",
      );
      next(error);
    }
  },
);

router.get(
  "/api/time-logs/:userId",
  requireAuth,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user!;
    if (user.uid !== req.params.userId && user.role === "driver") {
      return res.status(403).json({ error: "Unauthorized profile access" });
    }
    try {
      // 4c: tenant-scoped SELECT via JOIN
      const [rows] = await pool.query(
        "SELECT t.* FROM driver_time_logs t JOIN users u ON t.user_id = u.id WHERE t.user_id = ? AND u.company_id = ? ORDER BY t.clock_in DESC LIMIT 50",
        [req.params.userId, user.tenantId],
      );
      res.json(rows);
    } catch (error) {
      const log = createRequestLogger(req, "GET /api/time-logs");
      log.error(
        { err: error, userId: user.uid },
        "SERVER ERROR [GET /api/time-logs]",
      );
      next(error);
    }
  },
);

router.get(
  "/api/time-logs/company/:companyId",
  requireAuth,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user!;
    try {
      const [rows] = await pool.query(
        "SELECT t.* FROM driver_time_logs t JOIN users u ON t.user_id = u.id WHERE u.company_id = ? ORDER BY t.clock_in DESC LIMIT 500",
        [req.params.companyId],
      );
      res.json(rows);
    } catch (error) {
      const log = createRequestLogger(req, "GET /api/time-logs-company");
      log.error(
        { err: error, userId: user.uid },
        "SERVER ERROR [GET /api/time-logs-company]",
      );
      next(error);
    }
  },
);

// Dispatch Events
router.get(
  "/api/dispatch-events/:companyId",
  requireAuth,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user!;
    try {
      const [rows] = await pool.query(
        "SELECT de.* FROM dispatch_events de JOIN loads l ON de.load_id = l.id WHERE l.company_id = ? ORDER BY de.created_at DESC",
        [req.params.companyId],
      );
      res.json(rows);
    } catch (error) {
      const log = createRequestLogger(req, "GET /api/dispatch-events");
      log.error(
        { err: error, userId: user.uid },
        "SERVER ERROR [GET /api/dispatch-events]",
      );
      next(error);
    }
  },
);

// Tenant-scoped alias: GET /api/dispatch/events — extracts companyId from auth token (R-P2-11)
router.get(
  "/api/dispatch/events",
  requireAuth,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user!;
    try {
      const [rows] = await pool.query(
        "SELECT de.* FROM dispatch_events de JOIN loads l ON de.load_id = l.id WHERE l.company_id = ? ORDER BY de.created_at DESC",
        [user.tenantId],
      );
      res.json(rows);
    } catch (error) {
      const log = createRequestLogger(req, "GET /api/dispatch/events");
      log.error(
        { err: error, userId: user.uid },
        "SERVER ERROR [GET /api/dispatch/events]",
      );
      next(error);
    }
  },
);

router.post(
  "/api/dispatch-events",
  requireAuth,
  requireTenant,
  validateBody(createDispatchEventSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user!;
    const { id, load_id, dispatcher_id, event_type, message, payload } =
      req.body;

    try {
      // Verify load belongs to user's tenant before writing
      const [loadRows] = await pool.query(
        "SELECT company_id FROM loads WHERE id = ?",
        [load_id],
      );
      const loads = loadRows as Array<{ company_id: string }>;

      if (!loads || loads.length === 0) {
        return res.status(404).json({ error: "Load not found" });
      }

      if (loads[0].company_id !== user.tenantId) {
        return res
          .status(403)
          .json({ error: "Access denied: load belongs to different tenant" });
      }

      // Validate payload serialization
      let serializedPayload: string;
      try {
        serializedPayload = JSON.stringify(payload);
      } catch (error) {
        const log = createRequestLogger(req, "POST /api/dispatch-events");
        log.error({ err: error }, "Invalid payload — JSON.stringify failed");
        return res.status(400).json({ error: "Invalid payload structure" });
      }

      await pool.query(
        "INSERT INTO dispatch_events (id, load_id, dispatcher_id, event_type, message, payload) VALUES (?, ?, ?, ?, ?, ?)",
        [
          id || uuidv4(),
          load_id,
          dispatcher_id,
          event_type,
          message,
          serializedPayload,
        ],
      );
      res.status(201).json({ message: "Dispatch event logged" });
    } catch (error) {
      const log = createRequestLogger(req, "POST /api/dispatch-events");
      log.error(
        { err: error, userId: user.uid, loadId: load_id },
        "SERVER ERROR [POST /api/dispatch-events]",
      );
      next(error);
    }
  },
);

// Audit — Load Activity Audit endpoint (tenant from auth context, NOT URL param)
router.get(
  "/api/audit",
  requireAuth,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user!;
    const tenantId = user.tenantId;

    // Parse optional query params
    const limit = Math.min(
      parseInt((req.query.limit as string) || "50", 10),
      500,
    );
    const offset = parseInt((req.query.offset as string) || "0", 10);
    const eventType = req.query.type as string | undefined;
    const loadId = req.query.loadId as string | undefined;

    try {
      // Build WHERE clause — tenant scoped via auth-derived tenantId
      const conditions: string[] = ["l.company_id = ?"];
      const params: unknown[] = [tenantId];

      if (eventType) {
        conditions.push("de.event_type = ?");
        params.push(eventType);
      }
      if (loadId) {
        conditions.push("de.load_id = ?");
        params.push(loadId);
      }

      const whereClause = conditions.join(" AND ");

      const entriesQuery = `
        SELECT
          de.id,
          de.event_type,
          de.message,
          de.created_at,
          de.load_id,
          l.load_number,
          COALESCE(u.name, 'System') AS actor_name
        FROM dispatch_events de
        JOIN loads l ON de.load_id = l.id
        LEFT JOIN users u ON de.dispatcher_id = u.id
        WHERE ${whereClause}
        ORDER BY de.created_at DESC
        LIMIT ? OFFSET ?
      `;
      const entryParams = [...params, limit, offset];
      const [rows] = await pool.query(entriesQuery, entryParams);

      const countQuery = `
        SELECT COUNT(*) AS total
        FROM dispatch_events de
        JOIN loads l ON de.load_id = l.id
        WHERE ${whereClause}
      `;
      const [countRows] = await pool.query(countQuery, params);
      const total = (countRows as Array<{ total: number }>)[0]?.total ?? 0;

      res.json({ entries: rows, total });
    } catch (error) {
      const log = createRequestLogger(req, "GET /api/audit");
      log.error(
        { err: error, userId: user.uid },
        "SERVER ERROR [GET /api/audit]",
      );
      next(error);
    }
  },
);

// Dashboard
router.get(
  "/api/dashboard/cards",
  requireAuth,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [rows] = await pool.query(
        "SELECT * FROM dashboard_card ORDER BY sort_order ASC",
      );
      res.json(rows);
    } catch (error) {
      const log = createRequestLogger(req, "GET /api/dashboard/cards");
      log.error({ err: error }, "SERVER ERROR [GET /api/dashboard/cards]");
      next(error);
    }
  },
);

// POST /api/dispatch/best-matches — GPS-based driver matching for a load
router.post(
  "/api/dispatch/best-matches",
  requireAuth,
  requireTenant,
  validateBody(bestMatchesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user!;
    const { loadId, maxCandidates } = req.body;

    const limit = maxCandidates && maxCandidates > 0 ? maxCandidates : 10;

    try {
      // 0. Verify load belongs to user's tenant
      const [loadCheck] = await pool.query<RowDataPacket[]>(
        "SELECT company_id FROM loads WHERE id = ?",
        [loadId],
      );
      if (!loadCheck.length || loadCheck[0].company_id !== user.tenantId) {
        return res.status(404).json({ error: "Load not found" });
      }

      // 1. Get load pickup coordinates
      const [legRows] = await pool.query<RowDataPacket[]>(
        "SELECT latitude, longitude FROM load_legs WHERE load_id = ? AND type = 'Pickup' LIMIT 1",
        [loadId],
      );

      if (
        !legRows.length ||
        legRows[0].latitude == null ||
        legRows[0].longitude == null
      ) {
        return res
          .status(400)
          .json({ error: "Load has no pickup coordinates" });
      }

      const pickupLat = Number(legRows[0].latitude);
      const pickupLng = Number(legRows[0].longitude);

      // 2. Get eligible drivers for this company
      const [driverRows] = await pool.query<RowDataPacket[]>(
        "SELECT id, name, role, safety_score, home_terminal_lat, home_terminal_lng FROM users WHERE company_id = ? AND role IN ('driver','owner_operator')",
        [user.tenantId],
      );

      const candidates: Array<{
        driverId: string;
        driverName: string;
        distanceMiles: number;
        lastGpsAt: string | null;
        score: number;
        safetyScore: number | null;
        estimatedArrivalHours: number;
      }> = [];

      for (const driver of driverRows) {
        // 3. Get latest GPS position (within 48 hours)
        const [gpsRows] = await pool.query<RowDataPacket[]>(
          "SELECT latitude, longitude, recorded_at FROM gps_positions WHERE driver_id = ? AND company_id = ? AND recorded_at > DATE_SUB(NOW(), INTERVAL 48 HOUR) ORDER BY recorded_at DESC LIMIT 1",
          [driver.id, user.tenantId],
        );

        let driverLat: number | null = null;
        let driverLng: number | null = null;
        let lastGpsAt: string | null = null;
        let gpsRecent = false;

        if (gpsRows.length > 0) {
          driverLat = Number(gpsRows[0].latitude);
          driverLng = Number(gpsRows[0].longitude);
          lastGpsAt = gpsRows[0].recorded_at;

          // Check if GPS is within 4 hours
          const gpsAge =
            Date.now() - new Date(gpsRows[0].recorded_at).getTime();
          gpsRecent = gpsAge < 4 * 3600000;
        } else if (
          driver.home_terminal_lat != null &&
          driver.home_terminal_lng != null
        ) {
          // Fallback to home terminal
          driverLat = Number(driver.home_terminal_lat);
          driverLng = Number(driver.home_terminal_lng);
        }

        // Skip drivers with no location data
        if (driverLat == null || driverLng == null) {
          continue;
        }

        // 4. Calculate distance using haversine
        const distanceMiles = calculateDistance(
          pickupLat,
          pickupLng,
          driverLat,
          driverLng,
        );

        // 5. Calculate score
        const safetyScore = driver.safety_score
          ? Number(driver.safety_score)
          : 0;
        let score = 100 - Math.min(distanceMiles / 5, 50);
        if (safetyScore > 95) score += 10;
        else if (safetyScore > 85) score += 5;
        if (gpsRecent) score += 10;

        // Estimated arrival at 55 mph average
        const estimatedArrivalHours = distanceMiles / 55;

        candidates.push({
          driverId: driver.id,
          driverName: driver.name,
          distanceMiles: Math.round(distanceMiles * 10) / 10,
          lastGpsAt,
          score: Math.round(score * 10) / 10,
          safetyScore,
          estimatedArrivalHours: Math.round(estimatedArrivalHours * 100) / 100,
        });
      }

      // 6. Sort by score DESC and take top N
      candidates.sort((a, b) => b.score - a.score);
      const topCandidates = candidates.slice(0, limit);

      res.json(topCandidates);
    } catch (error) {
      const log = createRequestLogger(req, "POST /api/dispatch/best-matches");
      log.error(
        { err: error, userId: user.uid },
        "SERVER ERROR [POST /api/dispatch/best-matches]",
      );
      next(error);
    }
  },
);

export default router;
