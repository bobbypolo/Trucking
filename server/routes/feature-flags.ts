/**
 * Feature Flags routes — read merged flag map (env + DB) and admin-only write.
 *
 * Mounted under /api/feature-flags in server/index.ts.
 *
 * Read priority: DB > env > default false.
 */
import { Router, Response, NextFunction } from "express";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/requireAuth";
import { ForbiddenError } from "../errors/AppError";
import { createRequestLogger } from "../lib/logger";
import db from "../db";

const router = Router();

/** Known feature flags with env-var fallback names. */
const FLAG_ENV_MAP: Record<string, string> = {
  FEATURE_TRUCKER_MOBILE_BETA: "FEATURE_TRUCKER_MOBILE_BETA",
  FEATURE_ELD_INTEGRATION: "FEATURE_ELD_INTEGRATION",
  FEATURE_OFFLINE_SYNC: "FEATURE_OFFLINE_SYNC",
  FEATURE_AI_DOCUMENT_SCAN: "FEATURE_AI_DOCUMENT_SCAN",
  FEATURE_FREEMIUM_QUOTA: "FEATURE_FREEMIUM_QUOTA",
  FEATURE_FORCE_UPGRADE: "FEATURE_FORCE_UPGRADE",
};

/**
 * GET /api/feature-flags
 *
 * Returns merged flag map for the authenticated user's tenant.
 * Priority: DB value > env var > default false.
 */
router.get(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const log = createRequestLogger(req, "GET /api/feature-flags");
    try {
      const tenantId = req.user!.tenantId;

      // Start with env defaults (all false unless env var is "1" or "true")
      const flags: Record<string, boolean> = {};
      for (const [flagName, envKey] of Object.entries(FLAG_ENV_MAP)) {
        const envVal = process.env[envKey];
        flags[flagName] = envVal === "1" || envVal === "true";
      }

      // Overlay DB values for this tenant
      const [rows] = await db.query(
        "SELECT flag_name, flag_value FROM feature_flags WHERE company_id = ?",
        [tenantId],
      );
      for (const row of rows as Array<{
        flag_name: string;
        flag_value: number;
      }>) {
        flags[row.flag_name] = row.flag_value === 1;
      }

      res.json(flags);
    } catch (error) {
      log.error({ err: error }, "SERVER ERROR [GET /api/feature-flags]");
      next(error);
    }
  },
);

/**
 * PUT /api/feature-flags/:name
 *
 * Admin-only: set a feature flag value for the authenticated user's tenant.
 * Non-admin users receive HTTP 403.
 */
router.put(
  "/:name",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const log = createRequestLogger(req, "PUT /api/feature-flags/:name");
    try {
      const userRole = req.user!.role;
      if (userRole !== "admin") {
        return next(
          new ForbiddenError(
            "Admin role required to modify feature flags.",
            {},
            "FEATURE_FLAG_ADMIN_ONLY",
          ),
        );
      }

      const tenantId = req.user!.tenantId;
      const flagName = req.params.name;
      const { value } = req.body as { value: boolean };

      const flagValue = value ? 1 : 0;

      await db.query(
        `INSERT INTO feature_flags (company_id, flag_name, flag_value, updated_by)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE flag_value = VALUES(flag_value), updated_by = VALUES(updated_by), updated_at = NOW()`,
        [tenantId, flagName, flagValue, req.user!.email],
      );

      res.json({ flag_name: flagName, flag_value: value, updated: true });
    } catch (error) {
      log.error({ err: error }, "SERVER ERROR [PUT /api/feature-flags/:name]");
      next(error);
    }
  },
);

export default router;
