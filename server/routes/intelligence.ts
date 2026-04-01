import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import pool from "../db";

const router = Router();

// ─────────────────────────────────────────────────────────
// INTELLIGENCE HUB API ENDPOINTS
// Powers the live data in the Intelligence tab.
// Queries run against MySQL operational DB (not BigQuery)
// until load volume justifies the switch.
// ─────────────────────────────────────────────────────────

// Broker Risk Leaderboard — sorted by discrepancy_score desc
router.get(
  "/api/intelligence/broker-risk",
  requireAuth,
  requireTenant,
  async (req: any, res, next) => {
    const companyId = req.user.tenantId;
    try {
      const [rows]: any = await pool.query(
        `SELECT
            c.id,
            c.name,
            c.discrepancy_score,
            c.total_loads_completed,
            c.avg_payment_days,
            c.last_discrepancy_at,
            c.payment_terms,
            COUNT(CASE WHEN l.discrepancy_flagged = 1 THEN 1 END) AS flagged_loads,
            ROUND(AVG(l.weight_discrepancy_pct), 1)               AS avg_discrepancy_pct
         FROM customers c
         LEFT JOIN loads l ON l.customer_id = c.id AND l.company_id = ?
         WHERE c.company_id = ?
         GROUP BY c.id
         ORDER BY c.discrepancy_score DESC, c.avg_payment_days DESC
         LIMIT 50`,
        [companyId, companyId],
      );
      res.json(rows);
    } catch (error) {
      next(error);
    }
  },
);

// Facility Index — avg detention + load count for a facility search
router.get(
  "/api/intelligence/facility-index",
  requireAuth,
  requireTenant,
  async (req: any, res, next) => {
    const { facility, state } = req.query as {
      facility?: string;
      state?: string;
    };
    const companyId = req.user.tenantId;

    if (!facility) {
      return res.status(400).json({ error: "facility query param required" });
    }

    try {
      const searchTerm = `%${facility}%`;
      const [rows]: any = await pool.query(
        `SELECT
            ll.facility_name,
            ll.city,
            ll.state,
            COUNT(ll.id)                           AS total_visits,
            ROUND(AVG(ll.detention_minutes), 0)    AS avg_detention_minutes,
            MAX(ll.detention_minutes)              AS max_detention_minutes,
            MIN(ll.detention_minutes)              AS min_detention_minutes,
            ROUND(AVG(ll.detention_minutes) / 60.0 * 50, 2) AS recommended_rate_increase
         FROM load_legs ll
         JOIN loads l ON l.id = ll.load_id AND l.company_id = ?
         WHERE ll.facility_name LIKE ?
           AND ll.arrived_at IS NOT NULL
           AND ll.loaded_at IS NOT NULL
           ${state ? "AND ll.state = ?" : ""}
         GROUP BY ll.facility_name, ll.city, ll.state
         ORDER BY total_visits DESC
         LIMIT 20`,
        state ? [companyId, searchTerm, state] : [companyId, searchTerm],
      );
      res.json(rows);
    } catch (error) {
      next(error);
    }
  },
);

// Missed Revenue — loads with unreceipted lumper or uninvoiced detention
router.get(
  "/api/intelligence/missed-revenue",
  requireAuth,
  requireTenant,
  async (req: any, res, next) => {
    const companyId = req.user.tenantId;
    try {
      const [rows]: any = await pool.query(
        `SELECT
            l.id         AS load_id,
            l.load_number,
            l.customer_id,
            c.name       AS broker_name,
            le_det.payload AS detention_payload,
            NULL         AS lumper_payload,
            'DETENTION_NOT_INVOICED' AS reason
         FROM load_events le_det
         JOIN loads l ON l.id = le_det.load_id AND l.company_id = ?
         LEFT JOIN customers c ON c.id = l.customer_id
         LEFT JOIN load_events le_inv
            ON le_inv.load_id = le_det.load_id
           AND le_inv.event_type = 'INVOICE_SENT'
         WHERE le_det.event_type = 'DETENTION_FLAGGED'
           AND le_inv.id IS NULL

         UNION ALL

         SELECT
            l.id         AS load_id,
            l.load_number,
            l.customer_id,
            c.name       AS broker_name,
            NULL         AS detention_payload,
            le_lump.payload AS lumper_payload,
            'LUMPER_NOT_INVOICED' AS reason
         FROM load_events le_lump
         JOIN loads l ON l.id = le_lump.load_id AND l.company_id = ?
         LEFT JOIN customers c ON c.id = l.customer_id
         LEFT JOIN load_events le_inv
            ON le_inv.load_id = le_lump.load_id
           AND le_inv.event_type = 'INVOICE_SENT'
         WHERE le_lump.event_type = 'LUMPER_SCANNED'
           AND le_inv.id IS NULL

         ORDER BY load_number DESC
         LIMIT 50`,
        [companyId, companyId],
      );
      res.json(rows);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
