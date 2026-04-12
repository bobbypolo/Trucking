import { Router } from "express";
import type { RowDataPacket } from "mysql2/promise";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import { patchStopSchema } from "../schemas/driver-stops";
import { NotFoundError } from "../errors/AppError";
import pool from "../db";

const router = Router();

/**
 * GET /api/loads/:loadId/stops
 *
 * Returns all stops (load_legs) for a given load, ordered by sequence_order.
 * Tenant-scoped: joins against loads to verify company_id ownership.
 */
router.get(
  "/api/loads/:loadId/stops",
  requireAuth,
  requireTenant,
  async (req: any, res, next) => {
    const { loadId } = req.params;
    const companyId = req.user.tenantId;

    try {
      // Verify the load exists and belongs to tenant
      const [loadRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM loads WHERE id = ? AND company_id = ?",
        [loadId, companyId],
      );

      if (!Array.isArray(loadRows) || loadRows.length === 0) {
        return next(
          new NotFoundError("Load not found", {}, "LOAD_NOT_FOUND_001"),
        );
      }

      // Fetch stops ordered by sequence_order
      const [stops] = await pool.query<RowDataPacket[]>(
        `SELECT ll.id, ll.load_id, ll.type, ll.facility_name, ll.city,
                ll.state, ll.date, ll.appointment_time, ll.completed,
                ll.sequence_order, ll.status, ll.arrived_at, ll.departed_at
           FROM load_legs ll
          WHERE ll.load_id = ?
          ORDER BY ll.sequence_order ASC`,
        [loadId],
      );

      res.json({ stops });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/loads/:loadId/stops/:stopId
 *
 * Updates stop status tracking fields (status, arrived_at, departed_at, completed).
 * Tenant-scoped: joins against loads to verify company_id ownership.
 */
router.patch(
  "/api/loads/:loadId/stops/:stopId",
  requireAuth,
  requireTenant,
  validateBody(patchStopSchema),
  async (req: any, res, next) => {
    const { loadId, stopId } = req.params;
    const companyId = req.user.tenantId;

    try {
      // Verify the stop exists and belongs to a load owned by the tenant
      const [stopRows] = await pool.query<RowDataPacket[]>(
        `SELECT ll.id FROM load_legs ll
           INNER JOIN loads l ON ll.load_id = l.id
          WHERE ll.id = ? AND ll.load_id = ? AND l.company_id = ?`,
        [stopId, loadId, companyId],
      );

      if (!Array.isArray(stopRows) || stopRows.length === 0) {
        return next(
          new NotFoundError("Stop not found", {}, "STOP_NOT_FOUND_001"),
        );
      }

      // Build dynamic SET clause from validated body
      const setClauses: string[] = [];
      const params: unknown[] = [];

      if (req.body.status !== undefined) {
        setClauses.push("status = ?");
        params.push(req.body.status);
      }
      if (req.body.arrived_at !== undefined) {
        setClauses.push("arrived_at = ?");
        params.push(req.body.arrived_at);
      }
      if (req.body.departed_at !== undefined) {
        setClauses.push("departed_at = ?");
        params.push(req.body.departed_at);
      }
      if (req.body.completed !== undefined) {
        setClauses.push("completed = ?");
        params.push(req.body.completed);
      }

      params.push(stopId);

      await pool.query(
        `UPDATE load_legs SET ${setClauses.join(", ")} WHERE id = ?`,
        params,
      );

      // Fetch the updated stop
      const [updatedRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, load_id, type, facility_name, city, state, date,
                appointment_time, completed, sequence_order, status,
                arrived_at, departed_at
           FROM load_legs WHERE id = ?`,
        [stopId],
      );

      res.json({ stop: updatedRows[0] });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
