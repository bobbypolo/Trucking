import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../middleware/requireAuth";
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
import { createLoadSchema, updateLoadStatusSchema } from "../schemas/loads";
import { createChildLogger } from "../lib/logger";
import { loadService } from "../services/load.service";
import { LoadStatus } from "../services/load-state-machine";
import { geocodeStopAddress } from "../services/geocoding.service";

const router = Router();

// Loads — companyId derived from auth context (req.user.tenantId), NOT URL param
// Supports ?for=schedule to return only loads with valid dates (for CalendarView)
// Supports ?start=YYYY-MM-DD&end=YYYY-MM-DD for date-range filtering
router.get("/api/loads", requireAuth, requireTenant, async (req: any, res) => {
  const companyId = req.user.tenantId;
  const isScheduleQuery = req.query.for === "schedule";
  const startDate = req.query.start as string | undefined;
  const endDate = req.query.end as string | undefined;

  try {
    // Base query: all non-deleted loads for this tenant
    let sql =
      "SELECT * FROM loads WHERE company_id = ? AND deleted_at IS NULL";
    const params: any[] = [companyId];

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

    const [rows]: any = await pool.query(sql, params);
    const settings = await getVisibilitySettings(companyId);

    const enrichedLoads = await Promise.all(
      rows.map(async (load: any) => {
        const [legs]: any = await pool.query(
          "SELECT * FROM load_legs WHERE load_id = ? ORDER BY sequence_order",
          [load.id],
        );

        // Derive dropoff_date from the last Dropoff leg for schedule rendering
        const dropoffLeg = legs
          .slice()
          .reverse()
          .find((leg: any) => leg.type === "Dropoff");
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
      result = enrichedLoads.filter((load: any) => {
        const pickup = load.pickup_date;
        const dropoff = load.dropoff_date;
        if (!pickup) return false;
        // Load is visible if its span [pickup, dropoff||pickup] overlaps [start, end]
        const effectiveDropoff = dropoff || pickup;
        return effectiveDropoff >= startDate && pickup <= endDate;
      });
    }

    res.json(redactData(result, req.user.role, settings));
  } catch (error) {
    const log = createChildLogger({
      correlationId: req.correlationId,
      route: "GET /api/loads",
    });
    log.error({ err: error }, "SERVER ERROR [GET /api/loads]");
    res.status(500).json({ error: "Database error" });
  }
});

router.post(
  "/api/loads",
  requireAuth,
  requireTenant,
  validateBody(createLoadSchema),
  async (req: any, res) => {
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
      container_number,
      chassis_number,
      bol_number,
      legs,
      notification_emails,
      contract_id,
      gpsHistory,
      podUrls,
      customerUserId,
    } = req.body;

    // company_id derived from auth context — never trust the request body
    const company_id = req.user.tenantId;

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
        "REPLACE INTO loads (id, company_id, customer_id, driver_id, dispatcher_id, load_number, status, carrier_rate, driver_pay, pickup_date, freight_type, commodity, weight, container_number, chassis_number, bol_number, notification_emails, contract_id, gps_history, pod_urls, customer_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
          container_number,
          chassis_number,
          bol_number,
          JSON.stringify(notification_emails),
          contract_id,
          JSON.stringify(gpsHistory),
          JSON.stringify(podUrls),
          customerUserId,
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

      // --- KCI BREAKDOWN INTELLIGENCE FLOW ---
      const issues = req.body.issues;
      if (issues && Array.isArray(issues)) {
        for (const issue of issues) {
          const issueId = issue.id || uuidv4();
          await connection.query(
            "REPLACE INTO issues (id, company_id, load_id, driver_id, category, description, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
              issueId,
              company_id,
              id,
              driver_id,
              issue.category,
              issue.description,
              issue.status || "Open",
            ],
          );

          if (issue.description.includes("BREAKDOWN")) {
            const incidentId = uuidv4();

            // 1. Get current driver location for lateness calculation
            const [logs]: any = await pool.query(
              "SELECT location_lat, location_lng FROM driver_time_logs WHERE user_id = ? ORDER BY clock_in DESC LIMIT 1",
              [driver_id],
            );
            const lat = logs[0]?.location_lat || 38.8794;
            const lng = logs[0]?.location_lng || -99.3267;

            const lateCalc = await checkBreakdownLateness(id, lat, lng);
            const severity = lateCalc.isLate ? "Critical" : "High";
            const recoveryPlan = lateCalc.isLate
              ? "REPOWER REQUIRED: Delivery at risk."
              : "Monitor recovery; possible on-time delivery.";

            // 2. Automated Incident Record
            await connection.query(
              "INSERT INTO incidents (id, load_id, type, severity, status, description, location_lat, location_lng, recovery_plan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
              [
                incidentId,
                id,
                "Breakdown",
                severity,
                "Open",
                issue.description,
                lat,
                lng,
                recoveryPlan,
              ],
            );

            // 3. Automated Work Items (Audit Trail for Safety & Dispatch)
            await connection.query(
              "INSERT INTO work_items (id, company_id, type, priority, label, description, entity_id, entity_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
              [
                uuidv4(),
                company_id,
                "SAFETY_ALARM",
                severity,
                `Breakdown Alert: Load #${load_number}`,
                `Driver reported breakdown at Lat: ${lat}, Lng: ${lng}. ${recoveryPlan}`,
                incidentId,
                "INCIDENT",
              ],
            );

            await connection.query(
              "INSERT INTO work_items (id, company_id, type, priority, label, description, entity_id, entity_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
              [
                uuidv4(),
                company_id,
                "LOAD_EXCEPTION",
                severity,
                `Repower Analysis: Load #${load_number}`,
                `System calculates ${lateCalc.dist} miles to destination. Est. ${lateCalc.required} hours with recovery.`,
                id,
                "LOAD",
              ],
            );
          }
        }
      }

      await connection.commit();

      if (notification_emails && notification_emails.length > 0) {
        sendNotification(
          notification_emails,
          `Load Secured: #${load_number}`,
          `Manifest for ${load_number} has been synchronized. Status: ${status}.`,
        );
      }

      res.status(201).json({ message: "Load saved" });
    } catch (error) {
      await connection.rollback();
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/loads",
      });
      log.error({ err: error }, "SERVER ERROR [POST /api/loads]");
      res.status(500).json({ error: "Database error" });
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
  async (req: any, res, next) => {
    const companyId = req.user.tenantId;
    try {
      const [rows]: any = await pool.query(
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
  "/api/loads/:id/status",
  requireAuth,
  requireTenant,
  validateBody(updateLoadStatusSchema),
  idempotencyMiddleware(),
  async (req: any, res, next) => {
    const { status } = req.body;
    const loadId = req.params.id;
    const companyId = req.user.tenantId;
    const userId = req.user.id;

    try {
      const result = await loadService.transitionLoad(
        loadId,
        status as LoadStatus,
        companyId,
        userId,
      );

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
  async (req: any, res, next) => {
    const loadId = req.params.id;
    const companyId = req.user.tenantId;

    try {
      // Look up the load, scoped to the requesting tenant and not already deleted
      const [rows]: any = await pool.query(
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
  async (req: any, res, next) => {
    const loadId = req.params.id;
    const companyId = req.user.tenantId;
    const { type, notes, isUrgent } = req.body;

    if (!type || !VALID_CHANGE_REQUEST_TYPES.includes(type)) {
      return res
        .status(400)
        .json({ error: "Invalid or missing change request type" });
    }

    try {
      // Verify load belongs to this tenant
      const [loadRows]: any = await pool.query(
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

      const [rows]: any = await pool.query(
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
  async (req: any, res, next) => {
    const loadId = req.params.id;
    const companyId = req.user.tenantId;

    try {
      // Verify load belongs to this tenant
      const [loadRows]: any = await pool.query(
        "SELECT id FROM loads WHERE id = ? AND company_id = ? AND deleted_at IS NULL",
        [loadId, companyId],
      );

      if (loadRows.length === 0) {
        return res.status(404).json({ error: "Load not found" });
      }

      const [rows]: any = await pool.query(
        "SELECT * FROM work_items WHERE entity_id = ? AND entity_type = 'load' AND type = 'CHANGE_REQUEST' AND company_id = ? ORDER BY created_at DESC",
        [loadId, companyId],
      );

      res.json({ changeRequests: rows });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
