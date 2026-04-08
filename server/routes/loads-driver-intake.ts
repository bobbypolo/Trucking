import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import { createDriverIntakeLoadSchema } from "../schemas/loads";
import pool from "../db";
import { generateNextLoadNumber } from "../lib/loadNumberGenerator";

const router = Router();

/**
 * POST /api/loads/driver-intake
 *
 * Creates a new Draft load submitted by a driver via OCR scan.
 * Server-derived fields: company_id, driver_id, status, intake_source, load_number.
 * All body fields are optional (OCR may return partial data).
 */
router.post(
  "/api/loads/driver-intake",
  requireAuth,
  requireTenant,
  validateBody(createDriverIntakeLoadSchema),
  async (req: any, res, next) => {
    const company_id = req.user.tenantId;
    const driver_id = req.user.id;
    const status = "draft";
    const intake_source = "driver";

    const {
      commodity,
      weight,
      bol_number,
      reference_number,
      pickup_date,
      pickup_city,
      pickup_state,
      pickup_facility_name,
      dropoff_city,
      dropoff_state,
      dropoff_facility_name,
    } = req.body;

    let load_number: string;
    try {
      load_number = await generateNextLoadNumber(company_id, pool);
    } catch {
      return res
        .status(503)
        .json({ error: "Failed to generate load number. Please retry." });
    }

    const id = uuidv4();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        `INSERT INTO loads
          (id, company_id, driver_id, load_number, status, intake_source,
           commodity, weight, bol_number, reference_number, pickup_date,
           pickup_city, pickup_state, pickup_facility_name,
           dropoff_city, dropoff_state, dropoff_facility_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          company_id,
          driver_id,
          load_number,
          status,
          intake_source,
          commodity ?? null,
          weight ?? null,
          bol_number ?? null,
          reference_number ?? null,
          pickup_date ?? null,
          pickup_city ?? null,
          pickup_state ?? null,
          pickup_facility_name ?? null,
          dropoff_city ?? null,
          dropoff_state ?? null,
          dropoff_facility_name ?? null,
        ],
      );
      await connection.commit();
      res
        .status(201)
        .json({
          id,
          load_number,
          status: "Draft",
          intake_source: "driver",
          driver_id,
        });
    } catch (err) {
      await connection.rollback();
      next(err);
    } finally {
      connection.release();
    }
  },
);

export default router;
