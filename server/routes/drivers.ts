import { Router, Response, NextFunction } from "express";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/requireAuth";
import pool from "../db";
import { createRequestLogger } from "../lib/logger";

const router = Router();

/**
 * Phone validation regex — matches 7-20 chars made up of digits, +, -, (, ),
 * or whitespace. Intentionally strict so that obvious non-phone inputs like
 * "not-a-phone-!!" are rejected. (Rejects letters and the trailing `!`.)
 */
const PHONE_REGEX = /^[0-9+\-()\s]{7,20}$/;

/**
 * GET /api/drivers/me
 *
 * Returns the authenticated user's profile. The response body has exactly
 * these keys (sorted): companyId, email, id, name, phone, role.
 *
 * 200 → profile row
 * 401 → no/invalid auth
 * 404 → row missing for req.user.id
 */
router.get(
  "/api/drivers/me",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const log = createRequestLogger(req, "GET /api/drivers/me");
    try {
      const userId = req.user!.id;

      const [rows] = (await pool.query(
        `SELECT id, name, email, phone, role, company_id AS companyId
         FROM users
         WHERE id = ?`,
        [userId],
      )) as [Array<Record<string, unknown>>, unknown];

      if (!Array.isArray(rows) || rows.length === 0) {
        res.status(404).json({ error: "Driver profile not found" });
        return;
      }

      const row = rows[0];
      const body = {
        companyId: (row.companyId ?? null) as string | null,
        email: (row.email ?? null) as string | null,
        id: (row.id ?? null) as string | null,
        name: (row.name ?? null) as string | null,
        phone: (row.phone ?? null) as string | null,
        role: (row.role ?? null) as string | null,
      };

      res.status(200).json(body);
    } catch (error) {
      log.error({ err: error }, "Failed to load driver profile");
      next(error);
    }
  },
);

/**
 * PATCH /api/drivers/me
 *
 * Updates the authenticated user's phone number. This endpoint is
 * *intentionally* hard-coded to a single-column UPDATE so that no client
 * can smuggle extra fields (e.g. `role`) into the SQL. Any non-allowlisted
 * body field is silently ignored.
 *
 * Body: { phone: string }
 * 200 → { id, phone }
 * 400 → phone missing or fails validation
 * 401 → no auth
 */
router.patch(
  "/api/drivers/me",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const log = createRequestLogger(req, "PATCH /api/drivers/me");
    try {
      const rawPhone = req.body?.phone;

      if (typeof rawPhone !== "string" || !PHONE_REGEX.test(rawPhone)) {
        res.status(400).json({ error: "phone must be a valid phone number" });
        return;
      }

      const userId = req.user!.id;

      // NOTE: This SQL is *hard-coded* to `phone` only. Do NOT template
      // arbitrary column names from req.body into this statement — doing so
      // would reopen the privilege-escalation vector this endpoint exists
      // to close (R-P9-06).
      await pool.query(`UPDATE users SET phone = ? WHERE id = ?`, [
        rawPhone,
        userId,
      ]);

      res.status(200).json({ id: userId, phone: rawPhone });
    } catch (error) {
      log.error({ err: error }, "Failed to update driver profile");
      next(error);
    }
  },
);

export default router;
