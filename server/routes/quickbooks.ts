/**
 * quickbooks.ts — QuickBooks integration routes for LoadPilot.
 *
 * Routes:
 *   GET  /api/quickbooks/auth-url      — Generate OAuth authorization URL
 *   GET  /api/quickbooks/callback       — Handle OAuth callback, store tokens
 *   POST /api/quickbooks/sync-invoice   — Sync invoice to QuickBooks Online
 *   POST /api/quickbooks/sync-bill      — Sync bill to QuickBooks Online
 *   GET  /api/quickbooks/status         — Check QuickBooks connection status
 *
 * All routes enforce requireAuth + requireTenant.
 *
 * @see .claude/docs/PLAN.md S-302
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import {
  getAuthorizationUrl,
  handleCallback,
  syncInvoiceToQBO,
  syncBillToQBO,
  getConnectionStatus,
} from "../services/quickbooks.service";
import { createChildLogger, createRequestLogger } from "../lib/logger";

const router = Router();
const log = createChildLogger({ route: "quickbooks" });

// ── GET /api/quickbooks/auth-url ──────────────────────────────────────────────

router.get(
  "/api/quickbooks/auth-url",
  requireAuth,
  requireTenant,
  async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).user?.companyId;
      const result = await getAuthorizationUrl(companyId);

      if ("available" in result && result.available === false) {
        return res.status(503).json({
          error: "QuickBooks integration is not configured",
          reason: result.reason,
        });
      }

      return res.json({ url: (result as { url: string }).url });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err: message }, "Failed to generate QuickBooks auth URL");
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ── GET /api/quickbooks/callback ──────────────────────────────────────────────

router.get(
  "/api/quickbooks/callback",
  requireAuth,
  requireTenant,
  async (req: Request, res: Response) => {
    try {
      const { code, realmId } = req.query;

      if (!code || typeof code !== "string") {
        return res
          .status(400)
          .json({ error: "Missing required query parameter: code" });
      }

      if (!realmId || typeof realmId !== "string") {
        return res
          .status(400)
          .json({ error: "Missing required query parameter: realmId" });
      }

      const companyId = (req as any).user?.companyId;
      const result = await handleCallback(companyId, code, realmId);

      if (!result.success) {
        return res.status(502).json({ error: result.error });
      }

      // Redirect to settings page on successful token exchange
      return res.redirect(302, "/settings?qb=connected");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err: message }, "QuickBooks callback failed");
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ── POST /api/quickbooks/sync-invoice ─────────────────────────────────────────

router.post(
  "/api/quickbooks/sync-invoice",
  requireAuth,
  requireTenant,
  async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).user?.companyId;
      const result = await syncInvoiceToQBO(companyId, req.body);

      if (!result.success) {
        if ("available" in result && result.available === false) {
          return res.status(503).json({
            error: "QuickBooks integration is not configured",
            reason: (result as any).reason,
          });
        }
        return res.status(502).json({ error: result.error });
      }

      return res.json({
        success: true,
        qboInvoiceId: result.invoiceId,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err: message }, "Failed to sync invoice to QuickBooks");
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ── POST /api/quickbooks/sync-bill ────────────────────────────────────────────

router.post(
  "/api/quickbooks/sync-bill",
  requireAuth,
  requireTenant,
  async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).user?.companyId;
      const result = await syncBillToQBO(companyId, req.body);

      if (!result.success) {
        if ("available" in result && result.available === false) {
          return res.status(503).json({
            error: "QuickBooks integration is not configured",
            reason: (result as any).reason,
          });
        }
        return res.status(502).json({ error: result.error });
      }

      return res.json({
        success: true,
        qboBillId: result.billId,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err: message }, "Failed to sync bill to QuickBooks");
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ── GET /api/quickbooks/status ────────────────────────────────────────────────

router.get(
  "/api/quickbooks/status",
  requireAuth,
  requireTenant,
  async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).user?.companyId;
      const result = await getConnectionStatus(companyId);

      if ("available" in result && result.available === false) {
        return res.status(503).json({
          error: "QuickBooks integration is not configured",
          reason: result.reason,
        });
      }

      return res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err: message }, "Failed to check QuickBooks status");
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
