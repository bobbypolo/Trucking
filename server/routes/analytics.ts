/**
 * STORY-011 Phase 11 — Analytics routes.
 *
 * Exposes GET /api/analytics/lane-trends which returns a per-lane,
 * per-month aggregate of carrier rates for the requesting tenant along
 * with a direction classifier (R-P11-01, R-P11-02).
 */
import { Router } from "express";
import type { Request } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { getLaneTrends, parseMonths } from "../services/lane-trends";

const router = Router();

// GET /api/analytics/lane-trends?months=6
// R-P11-01: returns 200 with array of { lane, month, avgRate, volume, trend }
// R-P11-02: trend classification done in service (getLaneTrends)
router.get(
  "/api/analytics/lane-trends",
  requireAuth,
  requireTenant,
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    const months = parseMonths(req.query.months);
    if (months === null) {
      res.status(400).json({
        error: "months must be a positive integer between 1 and 60",
      });
      return;
    }
    try {
      const rows = await getLaneTrends(companyId, months);
      res.status(200).json(rows);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
