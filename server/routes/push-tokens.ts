import { Router, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import pool from "../db";
import { createRequestLogger } from "../lib/logger";

const router = Router();

const ALLOWED_PLATFORMS = new Set(["ios", "android"]);

/**
 * POST /api/push-tokens
 *
 * Register an Expo push token for the authenticated user. Idempotent —
 * inserting the same `(user_id, expo_push_token)` pair simply re-enables
 * the row and bumps `updated_at`.
 *
 * Body: { token: string, platform: "ios" | "android" }
 * Returns: 201 { id }
 */
router.post(
  "/api/push-tokens",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const log = createRequestLogger(req, "POST /api/push-tokens");
    try {
      const token = req.body?.token;
      const platform = req.body?.platform;

      if (typeof token !== "string" || token.trim().length === 0) {
        res.status(400).json({ error: "token is required" });
        return;
      }
      if (typeof platform !== "string" || !ALLOWED_PLATFORMS.has(platform)) {
        res.status(400).json({ error: "platform must be 'ios' or 'android'" });
        return;
      }

      const id = randomUUID();
      const userId = req.user!.id;

      await pool.query(
        `INSERT INTO push_tokens (id, user_id, expo_push_token, platform, enabled)
         VALUES (?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE enabled = 1, updated_at = CURRENT_TIMESTAMP`,
        [id, userId, token, platform],
      );

      res.status(201).json({ id });
    } catch (error) {
      log.error({ err: error }, "Failed to register push token");
      next(error);
    }
  },
);

/**
 * POST /api/push-tokens/unregister
 *
 * Soft-disable a previously registered token for the authenticated user.
 *
 * Body: { token: string }
 * Returns: 204 No Content
 */
router.post(
  "/api/push-tokens/unregister",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const log = createRequestLogger(req, "POST /api/push-tokens/unregister");
    try {
      const token = req.body?.token;
      if (typeof token !== "string" || token.trim().length === 0) {
        res.status(400).json({ error: "token is required" });
        return;
      }

      const userId = req.user!.id;

      await pool.query(
        `UPDATE push_tokens SET enabled = 0
         WHERE user_id = ? AND expo_push_token = ?`,
        [userId, token],
      );

      res.status(204).send();
    } catch (error) {
      log.error({ err: error }, "Failed to unregister push token");
      next(error);
    }
  },
);

export default router;
