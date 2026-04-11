import { Router } from "express";
import type { Request } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import {
  createFinancialObjectiveSchema,
  QUARTER_REGEX,
} from "../schemas/financial-objective";
import { financialObjectiveRepository } from "../repositories/financial-objective.repository";

const router = Router();

// GET /api/financial-objectives?quarter=2026-Q2
// R-P10-02: returns 200 with array of objectives filtered by quarter
// R-P10-07: returns 400 when quarter param fails YYYY-QN format
router.get(
  "/api/financial-objectives",
  requireAuth,
  requireTenant,
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    const rawQuarter = req.query.quarter;

    if (rawQuarter !== undefined) {
      const quarterStr = Array.isArray(rawQuarter)
        ? String(rawQuarter[0])
        : String(rawQuarter);
      if (!QUARTER_REGEX.test(quarterStr)) {
        res.status(400).json({
          error: "quarter must be in YYYY-QN format (e.g., 2026-Q2)",
        });
        return;
      }
      try {
        const rows = await financialObjectiveRepository.list(
          companyId,
          quarterStr,
        );
        res.status(200).json(rows);
      } catch (err) {
        next(err);
      }
      return;
    }

    try {
      const rows = await financialObjectiveRepository.list(companyId);
      res.status(200).json(rows);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/financial-objectives
// R-P10-03: creates a new objective and returns 201
router.post(
  "/api/financial-objectives",
  requireAuth,
  requireTenant,
  validateBody(createFinancialObjectiveSchema),
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    try {
      const created = await financialObjectiveRepository.create(
        {
          quarter: req.body.quarter,
          revenue_target: req.body.revenue_target,
          expense_budget: req.body.expense_budget,
          profit_target: req.body.profit_target,
          notes: req.body.notes,
        },
        companyId,
      );
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
