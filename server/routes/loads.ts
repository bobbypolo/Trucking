import { Router, Response, NextFunction } from "express";
import type { RowDataPacket } from "mysql2/promise";
import { v4 as uuidv4 } from "uuid";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import pool from "../db";
import {
  redactData,
  getVisibilitySettings,
  sendNotification,
  checkBreakdownLateness,
} from "../helpers";
import { validateBody } from "../middleware/validate";
import { idempotencyMiddleware } from "../middleware/idempotency";
import {
  createLoadSchema,
  partialUpdateLoadSchema,
  updateLoadStatusSchema,
} from "../schemas/loads";
import { createRequestLogger } from "../lib/logger";
import { loadService } from "../services/load.service";
import { LoadStatus } from "../services/load-state-machine";
import { geocodeStopAddress } from "../services/geocoding.service";
import { isWithinGeofence } from "../geoUtils";
import {
  recordGeofenceEntry,
  recordBOLScan,
} from "../services/detentionPipeline";
import {
  compareWeights,
  recordLoadCompletion,
} from "../services/discrepancyPipeline";
import { exportLoadToBigQuery } from "../services/bigqueryPipeline";

const router = Router();
let cachedLoadNotesColumn: string | null | undefined;

async function resolveLoadNotesColumn(): Promise<string | null> {
  if (cachedLoadNotesColumn !== undefined) {
    return cachedLoadNotesColumn;
  }

  const candidates = ["dispatch_notes", "special_instructions", "notes"];
  for (const candidate of candidates) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'loads'
          AND COLUMN_NAME = ?`,
      [candidate],
    );

    if (Array.isArray(rows) && rows.length > 0) {
      cachedLoadNotesColumn = candidate;
      return candidate;
    }
  }

  cachedLoadNotesColumn = null;
  return null;
}

// Loads — companyId derived from auth context (req.user!.tenantId), NOT URL param
// Supports ?for=schedule to return only loads with valid dates (for CalendarView)
// Supports ?start=YYYY-MM-DD&end=YYYY-MM-DD for date-range filtering
router.get(
  "/api/loads",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const companyId = req.user!.tenantId;
    const isScheduleQuery = req.query.for === "schedule";
    const startDate = req.query.start as string | undefined;
    const endDate = req.query.end as string | undefined;

    try {
      // Base query: all non-deleted loads for this tenant
      let sql =
        "SELECT * FROM loads WHERE company_id = ? AND deleted_at IS NULL";
      const params: (string | number)[] = [companyId];

      // For schedule queries, only return loads that have a pickup_date
      if (isScheduleQuery) {
        sql += " AND pickup_date IS NOT NULL";
      }

      // Date-range filter: loads whose pickup_date falls within the range
      if (startDate) {
        sql += " AND pickup_date >= ?";
        params.push(startDate);
      }
      if (endDate) {
        sql += " AND pickup_date <= ?";
        params.push(endDate);
      }

      const [rows] = await pool.query<RowDataPacket[]>(sql, params);
      const settings = await getVisibilitySettings(companyId);

      const enrichedLoads = await Promise.all(
        rows.map(async (load) => {
          const [legs] = await pool.query<RowDataPacket[]>(
            "SELECT * FROM load_legs WHERE load_id = ? ORDER BY sequence_order",
            [load.id],
          );

          // Derive dropoff_date from the last Dropoff leg for schedule rendering
          const dropoffLeg = legs
            .slice()
            .reverse()
            .find((leg) => leg.type === "Dropoff");
          const dropoff_date = dropoffLeg?.date || null;

          let loadData = {
            ...load,
            legs,
            // Schedule-critical: expose dropoff_date derived from legs
            dropoff_date,
            notificationEmails: load.notification_emails
              ? typeof load.notification_emails === "string"
                ? JSON.parse(load.notification_emails)
                : load.notification_emails
              : [],
            gpsHistory: load.gps_history
              ? typeof load.gps_history === "string"
                ? JSON.parse(load.gps_history)
                : load.gps_history
              : [],
            podUrls: load.pod_urls
              ? typeof load.pod_urls === "string"
                ? JSON.parse(load.pod_urls)
                : load.pod_urls
              : [],
            customerUserId: load.customer_user_id,
          };

          return loadData;
        }),
      );

      // For schedule queries with a date range, also include loads whose
      // dropoff_date extends into the range (multi-day loads)
      let result = enrichedLoads;
      if (isScheduleQuery && startDate && endDate) {
        result = enrichedLoads.filter((load) => {
          const loadAny = load as Record<string, unknown>;
          const pickup = loadAny.pickup_date as string | undefined;
          const dropoff = loadAny.dropoff_date as string | undefined;
          if (!pickup) return false;
          // Load is visible if its span [pickup, dropoff||pickup] overlaps [start, end]
          const effectiveDropoff = dropoff || pickup;
          return effectiveDropoff >= startDate && pickup <= endDate;
        });
      }

      res.json(redactData(result, req.user!.role, settings));
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/api/loads",
  requireAuth,
  requireTenant,
  validateBody(createLoadSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const {
      id,
      customer_id,
      driver_id,
      dispatcher_id,
      load_number,
      status,
      carrier_rate,
      driver_pay,
      pickup_date,
      freight_type,
      commodity,
      weight,
      quoted_weight,
      quoted_commodity,
      container_number,
      chassis_number,
      equipment_id,
      bol_number,
      legs,
      notification_emails,
      contract_id,
      gpsHistory,
      podUrls,
      customerUserId,
      intake_source,
    } = req.body;

    // company_id derived from auth context — never trust the request body
    const company_id = req.user!.tenantId;

    // Reject if body explicitly provides a company_id that mismatches auth context
    if (req.body.company_id && req.body.company_id !== company_id) {
      return res.status(403).json({
        error:
          "Tenant mismatch: company_id in body does not match authenticated tenant",
      });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        "REPLACE INTO loads (id, company_id, customer_id, driver_id, dispatcher_id, load_number, status, carrier_rate, driver_pay, pickup_date, freight_type, commodity, weight, quoted_weight, quoted_commodity, container_number, chassis_number, equipment_id, bol_number, notification_emails, contract_id, gps_history, pod_urls, customer_user_id, intake_source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          company_id,
          customer_id,
          driver_id,
          dispatcher_id,
          load_number,
          status,
          carrier_rate,
          driver_pay,
          pickup_date,
          freight_type,
          commodity,
          weight,
          quoted_weight ?? weight ?? null,
          quoted_commodity ?? commodity ?? null,
          container_number,
          chassis_number,
          equipment_id || null,
          bol_number,
          JSON.stringify(notification_emails),
          contract_id,
          JSON.stringify(gpsHistory),
          JSON.stringify(podUrls),
          customerUserId,
          intake_source || "dispatcher",
        ],
      );

      if (legs && Array.isArray(legs)) {
        await connection.query("DELETE FROM load_legs WHERE load_id = ?", [id]);
        for (let i = 0; i < legs.length; i++) {
          const leg = legs[i];
          const legCity = leg.location?.city || leg.city;
          const legState = leg.location?.state || leg.state;
          const legFacility = leg.location?.facilityName || leg.facility_name;

          // Geocode at create time — populate canonical lat/lng from address
          let latitude = leg.latitude ?? null;
          let longitude = leg.longitude ?? null;
          if (latitude == null && longitude == null && legCity) {
            const coords = await geocodeStopAddress(
              legCity,
              legState,
              legFacility,
            );
            if (coords) {
              latitude = coords.latitude;
              longitude = coords.longitude;
            }
          }

          await connection.query(
            "INSERT INTO load_legs (id, load_id, type, facility_name, city, state, date, appointment_time, completed, sequence_order, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              leg.id || uuidv4(),
              id,
              leg.type,
              legFacility,
              legCity,
              legState,
              leg.date,
              leg.appointmentTime || leg.appointment_time,
              leg.completed,
              i,
              latitude,
              longitude,
            ],
          );
        }
      }

      // Issues are now created via /api/exceptions (canonical queue).
      // The legacy req.body.issues → issues table path has been removed.
      // Breakdown incidents are created client-side via createException()
      // and synced to incidents via exception-domain sync.

      await connection.commit();

      if (notification_emails && notification_emails.length > 0) {
        sendNotification(
          notification_emails,
          `Load Secured: #${load_number}`,
          `Manifest for ${load_number} has been synchronized. Status: ${status}.`,
        );
      }

      res.status(201).json({ message: "Load saved" });
    } catch (err) {
      await connection.rollback();
      next(err);
    } finally {
      connection.release();
    }
  },
);

// Dashboard — real status counts for authenticated tenant
router.get(
  "/api/loads/counts",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const companyId = req.user!.tenantId;
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT status, COUNT(*) as count FROM loads WHERE company_id = ? AND deleted_at IS NULL GROUP BY status",
        [companyId],
      );

      // Build counts map with all statuses defaulting to 0
      const counts: Record<string, number> = {
        draft: 0,
        planned: 0,
        dispatched: 0,
        in_transit: 0,
        arrived: 0,
        delivered: 0,
        completed: 0,
        cancelled: 0,
      };

      let total = 0;
      for (const row of rows) {
        const status = row.status as string;
        const count = Number(row.count);
        if (status in counts) {
          counts[status] = count;
        }
        total += count;
      }

      res.json({ ...counts, total });
    } catch (error) {
      next(error);
    }
  },
);

// Status Transition — wired to state machine via loadService.transitionLoad
// Idempotency enforced: duplicate transition requests with same key+hash replay stored response
router.patch(
  "/api/loads/:id",
  requireAuth,
  requireTenant,
  validateBody(partialUpdateLoadSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const loadId = req.params.id;
    const companyId = req.user!.tenantId;
    const {
      weight,
      commodity,
      bol_number,
      reference_number,
      reference_numbers,
      pickup_date,
      notes,
      equipment_id,
    } = req.body;

    const normalizedReference =
      reference_number ||
      (Array.isArray(reference_numbers) ? reference_numbers[0] : undefined);
    const normalizedBolNumber = bol_number || normalizedReference;

    try {
      const [existingRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM loads WHERE id = ? AND company_id = ? AND deleted_at IS NULL",
        [loadId, companyId],
      );

      if (!Array.isArray(existingRows) || existingRows.length === 0) {
        return res.status(404).json({ error: "Load not found" });
      }

      const updates: string[] = [];
      const params: (string | number)[] = [];

      if (weight !== undefined) {
        updates.push("weight = ?");
        params.push(weight);
      }

      if (commodity !== undefined) {
        updates.push("commodity = ?");
        params.push(commodity);
      }

      if (normalizedBolNumber !== undefined) {
        updates.push("bol_number = ?");
        params.push(normalizedBolNumber);
      }

      if (pickup_date !== undefined) {
        updates.push("pickup_date = ?");
        params.push(pickup_date);
      }

      if (notes !== undefined) {
        const notesColumn = await resolveLoadNotesColumn();
        if (notesColumn) {
          updates.push(`${notesColumn} = ?`);
          params.push(notes);
        }
      }

      if (equipment_id !== undefined) {
        updates.push("equipment_id = ?");
        params.push(equipment_id);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          error:
            "No supported persisted fields were provided for partial load update",
        });
      }

      await pool.query(
        `UPDATE loads SET ${updates.join(", ")} WHERE id = ? AND company_id = ?`,
        [...params, loadId, companyId],
      );

      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM loads WHERE id = ? AND company_id = ? AND deleted_at IS NULL",
        [loadId, companyId],
      );
      const load = rows?.[0];

      const [legs] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM load_legs WHERE load_id = ? ORDER BY sequence_order",
        [loadId],
      );

      const responseLoad = {
        ...load,
        legs,
        notificationEmails: load?.notification_emails
          ? typeof load.notification_emails === "string"
            ? JSON.parse(load.notification_emails)
            : load.notification_emails
          : [],
        gpsHistory: load?.gps_history
          ? typeof load.gps_history === "string"
            ? JSON.parse(load.gps_history)
            : load.gps_history
          : [],
        podUrls: load?.pod_urls
          ? typeof load.pod_urls === "string"
            ? JSON.parse(load.pod_urls)
            : load.pod_urls
          : [],
        customerUserId: load?.customer_user_id,
      };

      res.json(responseLoad);
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/api/loads/:id/status",
  requireAuth,
  requireTenant,
  validateBody(updateLoadStatusSchema),
  idempotencyMiddleware(),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { status } = req.body;
    const loadId = req.params.id;
    const companyId = req.user!.tenantId;
    const userId = req.user!.id;

    try {
      const result = await loadService.transitionLoad(
        loadId,
        status as LoadStatus,
        companyId,
        userId,
      );

      // Pipeline: increment broker load count + export to BigQuery when load is settled
      if (status === "Settled" || status === "Completed") {
        const [rows] = await pool.query<RowDataPacket[]>(
          "SELECT customer_id FROM loads WHERE id = ?",
          [loadId],
        );
        if (rows[0]?.customer_id) {
          await recordLoadCompletion(
            pool,
            rows[0].customer_id,
            new Date().toISOString(),
            null,
          );
        }
        // Fire-and-forget: export analytics snapshot to BigQuery (never blocks response)
        exportLoadToBigQuery(pool, loadId);
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// Statuses that allow deletion (soft-delete).
// Active loads (dispatched, in_transit, arrived, delivered, completed) cannot be deleted.
const DELETABLE_STATUSES: string[] = [
  LoadStatus.DRAFT,
  LoadStatus.PLANNED,
  LoadStatus.CANCELLED,
];

// Soft-delete a load — sets deleted_at timestamp instead of removing the row
router.delete(
  "/api/loads/:id",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const loadId = req.params.id;
    const companyId = req.user!.tenantId;

    try {
      // Look up the load, scoped to the requesting tenant and not already deleted
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT id, status FROM loads WHERE id = ? AND company_id = ? AND deleted_at IS NULL",
        [loadId, companyId],
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "Load not found" });
      }

      const load = rows[0];

      if (!DELETABLE_STATUSES.includes(load.status)) {
        return res.status(422).json({
          error: `Cannot delete load in "${load.status}" status. Only loads in draft, planned, or cancelled status can be deleted.`,
        });
      }

      await pool.query(
        "UPDATE loads SET deleted_at = NOW() WHERE id = ? AND company_id = ?",
        [loadId, companyId],
      );

      res.json({ message: "Load deleted" });
    } catch (error) {
      next(error);
    }
  },
);

// ── Change Requests ─────────────────────────────────────────────────────────
// Change requests are stored as work_items with type="CHANGE_REQUEST".
// The entity_id links to the load, entity_type="load".

const VALID_CHANGE_REQUEST_TYPES = [
  "DETENTION",
  "LUMPER",
  "LAYOVER",
  "TONU",
  "REWORK",
  "OTHER",
];

router.post(
  "/api/loads/:id/change-requests",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const loadId = req.params.id;
    const companyId = req.user!.tenantId;
    const { type, notes, isUrgent } = req.body;

    if (!type || !VALID_CHANGE_REQUEST_TYPES.includes(type)) {
      return res
        .status(400)
        .json({ error: "Invalid or missing change request type" });
    }

    try {
      // Verify load belongs to this tenant
      const [loadRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM loads WHERE id = ? AND company_id = ? AND deleted_at IS NULL",
        [loadId, companyId],
      );

      if (loadRows.length === 0) {
        return res.status(404).json({ error: "Load not found" });
      }

      const id = uuidv4();
      const priority = isUrgent ? "High" : "Medium";

      await pool.query(
        `INSERT INTO work_items
          (id, company_id, type, priority, label, description, entity_id, entity_type, status, due_date)
         VALUES (?, ?, 'CHANGE_REQUEST', ?, ?, ?, ?, 'load', 'PENDING', NULL)`,
        [id, companyId, priority, type, notes || "", loadId],
      );

      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM work_items WHERE id = ? AND company_id = ?",
        [id, companyId],
      );

      res.status(201).json(rows[0]);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/api/loads/:id/change-requests",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const loadId = req.params.id;
    const companyId = req.user!.tenantId;

    try {
      // Verify load belongs to this tenant
      const [loadRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM loads WHERE id = ? AND company_id = ? AND deleted_at IS NULL",
        [loadId, companyId],
      );

      if (loadRows.length === 0) {
        return res.status(404).json({ error: "Load not found" });
      }

      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM work_items WHERE entity_id = ? AND entity_type = 'load' AND type = 'CHANGE_REQUEST' AND company_id = ? ORDER BY created_at DESC",
        [loadId, companyId],
      );

      res.json({ changeRequests: rows });
    } catch (error) {
      next(error);
    }
  },
);

// ─────────────────────────────────────────────────────────
// PIPELINE: GPS Ping → Geofence Detection
// ─────────────────────────────────────────────────────────
router.post(
  "/api/loads/:id/gps-ping",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const loadId = req.params.id;
    const { driver_lat, driver_lng, occurred_at } = req.body;

    if (!driver_lat || !driver_lng) {
      return res
        .status(400)
        .json({ error: "driver_lat and driver_lng are required" });
    }

    try {
      const [legs] = await pool.query<RowDataPacket[]>(
        `SELECT id, latitude, longitude
             FROM load_legs
             WHERE load_id = ? AND latitude IS NOT NULL AND arrived_at IS NULL AND completed = 0
             ORDER BY sequence_order ASC`,
        [loadId],
      );

      for (const leg of legs) {
        if (
          isWithinGeofence(driver_lat, driver_lng, leg.latitude, leg.longitude)
        ) {
          await recordGeofenceEntry(
            pool,
            leg.id,
            loadId,
            driver_lat,
            driver_lng,
            occurred_at,
          );
          return res.json({ geofence_triggered: true, load_leg_id: leg.id });
        }
      }

      res.json({ geofence_triggered: false });
    } catch (error) {
      const log = createRequestLogger(req);
      log.error(
        { err: error, route: "POST /api/loads/:id/gps-ping" },
        "gps-ping handler failed",
      );
      res.status(500).json({ error: "Database error" });
    }
  },
);

// ─────────────────────────────────────────────────────────
// PIPELINE: BOL Scan → Detention + Discrepancy Check
// ─────────────────────────────────────────────────────────
router.post(
  "/api/loads/:id/bol-scan",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const loadId = req.params.id;
    const {
      load_leg_id,
      load_number,
      driver_lat,
      driver_lng,
      scanned_weight,
      scanned_commodity,
      occurred_at,
    } = req.body;

    if (!load_leg_id) {
      return res.status(400).json({ error: "load_leg_id is required" });
    }

    try {
      const [loadRows] = await pool.query<RowDataPacket[]>(
        `SELECT customer_id, quoted_weight, quoted_commodity FROM loads WHERE id = ?`,
        [loadId],
      );

      if (!loadRows.length)
        return res.status(404).json({ error: "Load not found" });

      const { customer_id, quoted_weight, quoted_commodity } = loadRows[0];

      const detentionResult = await recordBOLScan(
        pool,
        load_leg_id,
        loadId,
        load_number || loadId,
        driver_lat ?? null,
        driver_lng ?? null,
        occurred_at,
      );

      let discrepancyResult = { flagged: false, discrepancyPct: 0 };
      if (scanned_weight != null) {
        discrepancyResult = await compareWeights(
          pool,
          loadId,
          quoted_weight ?? 0,
          scanned_weight,
          scanned_commodity ?? "",
          customer_id,
        );
      }

      res.json({ detention: detentionResult, discrepancy: discrepancyResult });
    } catch (error) {
      const log = createRequestLogger(req);
      log.error(
        { err: error, route: "POST /api/loads/:id/bol-scan" },
        "bol-scan handler failed",
      );
      res.status(500).json({ error: "Database error" });
    }
  },
);

export default router;
