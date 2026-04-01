import { Router } from "express";
import type { Request } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import {
  createInvitationSchema,
  acceptInvitationSchema,
} from "../schemas/invitation";
import {
  createInvitation,
  acceptInvitation,
  listInvitations,
  cancelInvitation,
} from "../services/invitation.service";
import { createRequestLogger } from "../lib/logger";

const router = Router();

/**
 * Rate limiter for invitation acceptance: 5 requests per 15 minutes.
 * Prevents brute-force token guessing.
 */
const acceptRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many accept attempts, please try again later." },
});

/**
 * POST /api/invitations — Create a new team invitation.
 * Requires auth + tenant. Validates body against createInvitationSchema.
 */
router.post(
  "/api/invitations",
  requireAuth,
  requireTenant,
  validateBody(createInvitationSchema),
  async (req: Request, res, next) => {
    const { email, role } = req.body;
    const companyId = req.user!.tenantId;
    const invitedBy = req.user!.id;
    const log = createRequestLogger(req, "POST /api/invitations");

    try {
      const invitation = await createInvitation(companyId, email, role, invitedBy);
      log.info({ invitationId: invitation.id, email }, "Invitation created");
      res.status(201).json({ message: "Invitation created", invitation });
    } catch (err: unknown) {
      next(err);
    }
  },
);

/**
 * GET /api/invitations — List all invitations for the tenant.
 * Requires auth + tenant.
 */
router.get(
  "/api/invitations",
  requireAuth,
  requireTenant,
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;

    try {
      const invitations = await listInvitations(companyId);
      res.json({ invitations });
    } catch (err: unknown) {
      next(err);
    }
  },
);

/**
 * POST /api/invitations/accept — Accept an invitation by token.
 * Rate-limited to 5 requests per 15 minutes.
 * Public endpoint (no auth required — the user doesn't have an account yet).
 */
router.post(
  "/api/invitations/accept",
  acceptRateLimiter,
  validateBody(acceptInvitationSchema),
  async (req: Request, res, next) => {
    const { token, name, password } = req.body;
    const log = createRequestLogger(req, "POST /api/invitations/accept");

    try {
      const result = await acceptInvitation(token, name, password);
      log.info(
        { invitationId: result.invitation.id, userId: result.userId },
        "Invitation accepted",
      );
      res.json({
        message: "Invitation accepted",
        userId: result.userId,
        companyId: result.invitation.company_id,
        role: result.invitation.role,
      });
    } catch (err: unknown) {
      const typedErr = err as Error & { code?: string };
      if (typedErr.code === "INVITATION_NOT_FOUND") {
        return res.status(404).json({ message: "Invitation not found" });
      }
      if (typedErr.code === "INVITATION_EXPIRED") {
        return res.status(410).json({ message: "Invitation has expired" });
      }
      if (typedErr.code === "INVITATION_ALREADY_ACCEPTED") {
        return res.status(409).json({ message: "Invitation has already been accepted" });
      }
      if (typedErr.code === "INVITATION_CANCELLED") {
        return res.status(410).json({ message: "Invitation has been cancelled" });
      }
      next(err);
    }
  },
);

/**
 * DELETE /api/invitations/:id — Cancel a pending invitation.
 * Requires auth + tenant. Only the owning tenant can cancel.
 */
router.delete(
  "/api/invitations/:id",
  requireAuth,
  requireTenant,
  async (req: Request, res, next) => {
    const invitationId = req.params.id;
    const companyId = req.user!.tenantId;
    const log = createRequestLogger(req, "DELETE /api/invitations/:id");

    try {
      const cancelled = await cancelInvitation(invitationId, companyId);
      if (!cancelled) {
        return res.status(404).json({ message: "Invitation not found or already processed" });
      }
      log.info({ invitationId }, "Invitation cancelled");
      res.json({ message: "Invitation cancelled" });
    } catch (err: unknown) {
      next(err);
    }
  },
);

export default router;
