import { Router } from "express";
import type { Request } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import pool from "../db";
import { v4 as uuidv4 } from "uuid";
import { createChildLogger } from "../lib/logger";

const router = Router();

// POST /api/call-logs — log a phone interaction
router.post(
  "/api/call-logs",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    try {
      const { phoneNumber, context, contactName, direction = "outbound" } =
        req.body;
      if (!phoneNumber) {
        return res.status(400).json({ error: "phoneNumber is required" });
      }
      const id = uuidv4();
      const companyId = req.user!.tenantId;
      const userId = req.user!.uid;
      await pool.query(
        `INSERT INTO call_logs (id, company_id, user_id, phone_number, contact_name, context, direction, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          id,
          companyId,
          userId,
          phoneNumber,
          contactName || null,
          context || null,
          direction,
        ],
      );
      res.status(201).json({ id });
    } catch (err: unknown) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/call-logs",
      });
      log.error({ err }, "Failed to log call");
      res.status(500).json({ error: "Failed to log call" });
    }
  },
);

// GET /api/call-logs — list call logs for tenant
router.get(
  "/api/call-logs",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    try {
      const companyId = req.user!.tenantId;
      const [rows] = await pool.query(
        "SELECT * FROM call_logs WHERE company_id = ? ORDER BY created_at DESC LIMIT 100",
        [companyId],
      );
      res.json({ callLogs: rows });
    } catch (err: unknown) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/call-logs",
      });
      log.error({ err }, "Failed to fetch call logs");
      res.status(500).json({ error: "Failed to fetch call logs" });
    }
  },
);

export default router;
