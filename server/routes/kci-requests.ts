import { Router } from "express";
import type { Request } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import {
  createKciRequestSchema,
  updateKciRequestSchema,
} from "../schemas/kci-request";
import { kciRequestRepository } from "../repositories/kci-request.repository";
import { createRequestLogger } from "../lib/logger";

const router = Router();

const APPROVAL_ROLES = ["admin", "dispatcher", "payroll_manager"];

// GET /api/kci-requests — list KCI requests for tenant
router.get(
  "/api/kci-requests",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    try {
      const requests = await kciRequestRepository.findByCompany(
        companyId,
        page,
        limit,
      );
      res.json(requests);
    } catch (error) {
      const log = createRequestLogger(req, "GET /api/kci-requests");
      log.error({ err: error }, "Failed to fetch KCI requests");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// POST /api/kci-requests — create KCI request
router.post(
  "/api/kci-requests",
  requireAuth,
  requireTenant,
  validateBody(createKciRequestSchema),
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const userId = req.user!.uid;
    try {
      const kciRequest = await kciRequestRepository.create(
        req.body,
        companyId,
        userId,
      );
      res.status(201).json(kciRequest);
    } catch (error) {
      const log = createRequestLogger(req, "POST /api/kci-requests");
      log.error({ err: error }, "Failed to create KCI request");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// PATCH /api/kci-requests/:id — update KCI request (status updates, append decision_log)
router.patch(
  "/api/kci-requests/:id",
  requireAuth,
  requireTenant,
  validateBody(updateKciRequestSchema),
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const userId = req.user!.uid;
    try {
      const existing = await kciRequestRepository.findById(req.params.id);
      if (!existing || existing.company_id !== companyId) {
        res.status(404).json({ error: "KCI request not found" });
        return;
      }

      // Role check on approval fields
      if (
        (req.body.approved_amount !== undefined ||
          req.body.status === "Approved") &&
        !APPROVAL_ROLES.includes(req.user!.role)
      ) {
        res
          .status(403)
          .json({ error: "Insufficient role for approval actions" });
        return;
      }

      // Append to decision_log if provided
      if (req.body.decision_log) {
        const currentLog = existing.decision_log
          ? JSON.parse(
              typeof existing.decision_log === "string"
                ? existing.decision_log
                : JSON.stringify(existing.decision_log),
            )
          : [];
        const newEntries = Array.isArray(req.body.decision_log)
          ? req.body.decision_log
          : [req.body.decision_log];
        req.body.decision_log = [...currentLog, ...newEntries];
      }

      const updated = await kciRequestRepository.update(
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

// NO DELETE endpoint — KCI requests are never deletable per retention policy

export default router;
