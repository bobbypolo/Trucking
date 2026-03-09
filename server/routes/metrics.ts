import { Router, Request, Response, NextFunction } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { ForbiddenError } from "../errors/AppError";
import { getMetricsSnapshot } from "../middleware/metrics";
import { createChildLogger } from "../lib/logger";

const router = Router();

/**
 * Admin role allowlist for metrics access.
 * Only users with these roles can view operational metrics.
 */
const ADMIN_ROLES: ReadonlySet<string> = new Set([
  "admin",
  "ORG_OWNER_SUPER_ADMIN",
  "OWNER_ADMIN",
]);

/**
 * requireAdmin — middleware that checks the authenticated user has an admin role.
 * Must be chained AFTER requireAuth.
 *
 * Returns 403 ForbiddenError if the user's role is not in ADMIN_ROLES.
 */
function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user || !ADMIN_ROLES.has(user.role)) {
    return next(
      new ForbiddenError(
        "Admin access required. This endpoint is restricted to admin users.",
        { requiredRoles: [...ADMIN_ROLES] },
        "METRICS_FORBIDDEN_001",
      ),
    );
  }
  next();
}

/**
 * GET /api/metrics — Admin-only operational metrics endpoint.
 *
 * Returns per-route request counts, error rates, and latency percentiles.
 * Includes SLO baseline documentation.
 *
 * SECURITY: Protected by requireAuth + requireAdmin.
 * PRODUCTION: Consider disabling or restricting to internal network.
 *
 * Response shape:
 * {
 *   routes: [{ method, path, request_count, error_count, error_rate, latency_ms: { p50, p95, p99 } }],
 *   uptime_seconds: number,
 *   collected_since: string,
 *   slo_baselines: { read_p99_ms, write_p99_ms, error_rate_threshold },
 *   production_note: string
 * }
 */
router.get(
  "/api/metrics",
  requireAuth,
  requireAdmin,
  (req: Request, res: Response) => {
    const log = createChildLogger({
      correlationId: req.correlationId,
      route: "GET /api/metrics",
    });
    log.info({ data: { userId: req.user!.uid } }, "Metrics endpoint accessed");

    const snapshot = getMetricsSnapshot();
    res.json(snapshot);
  },
);

export default router;
