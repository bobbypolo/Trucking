import { Router } from "express";
import type { Request } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import {
  createCrisisActionSchema,
  updateCrisisActionSchema,
} from "../schemas/crisis-action";
import { crisisActionRepository } from "../repositories/crisis-action.repository";
import { createRequestLogger } from "../lib/logger";

const router = Router();

const MODIFICATION_ROLES = ["admin", "dispatcher", "safety_manager"];

// GET /api/crisis-actions — list crisis actions for tenant
router.get(
  "/api/crisis-actions",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    try {
      const actions = await crisisActionRepository.findByCompany(
        companyId,
        page,
        limit,
      );
      res.json(actions);
    } catch (error) {
      const log = createRequestLogger(req, "GET /api/crisis-actions");
      log.error({ err: error }, "Failed to fetch crisis actions");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// POST /api/crisis-actions — create crisis action
router.post(
  "/api/crisis-actions",
  requireAuth,
  requireTenant,
  validateBody(createCrisisActionSchema),
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const userId = req.user!.uid;
    try {
      const action = await crisisActionRepository.create(
        req.body,
        companyId,
        userId,
      );
      res.status(201).json(action);
    } catch (error) {
      const log = createRequestLogger(req, "POST /api/crisis-actions");
      log.error({ err: error }, "Failed to create crisis action");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// PATCH /api/crisis-actions/:id — update crisis action (append timeline only)
router.patch(
  "/api/crisis-actions/:id",
  requireAuth,
  requireTenant,
  validateBody(updateCrisisActionSchema),
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const userId = req.user!.uid;

    // Role check on modification
    if (!MODIFICATION_ROLES.includes(req.user!.role)) {
      res
        .status(403)
        .json({ error: "Insufficient role for crisis action modification" });
      return;
    }

    try {
      const existing = await crisisActionRepository.findById(req.params.id);
      if (!existing || existing.company_id !== companyId) {
        res.status(404).json({ error: "Crisis action not found" });
        return;
      }

      // Append to timeline if provided
      if (req.body.timeline) {
        const currentTimeline = existing.timeline
          ? JSON.parse(
              typeof existing.timeline === "string"
                ? existing.timeline
                : JSON.stringify(existing.timeline),
            )
          : [];
        const newEntries = Array.isArray(req.body.timeline)
          ? req.body.timeline
          : [req.body.timeline];
        req.body.timeline = [...currentTimeline, ...newEntries];
      }

      const updated = await crisisActionRepository.update(
        req.params.id,
        req.body,
        userId,
      );
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  },
);

// NO DELETE endpoint — crisis actions are never deletable per retention policy

export default router;
