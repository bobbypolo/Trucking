/**
 * requireTier middleware — subscription tier enforcement for LoadPilot SaaS.
 *
 * Factory function: requireTier(...allowedTiers) returns Express middleware
 * that checks the company's subscription_tier and subscription_status.
 *
 * - Allows requests when tier matches AND status is 'active' or 'trial'
 * - Blocks past_due status regardless of tier (403)
 * - Blocks wrong tier with 403 including required_tiers, current_tier, upgrade_url
 * - Missing tier defaults to "Records Vault"
 * - Caches tier lookup per-request (1 DB query even with multiple requireTier calls)
 *
 * Must be used AFTER requireAuth (depends on req.user being set).
 *
 * @see .claude/docs/PLAN.md S-501
 */

import { Request, Response, NextFunction } from "express";
import pool from "../db";
import { AuthenticatedRequest } from "./requireAuth";
import { createChildLogger } from "../lib/logger";

export type SubscriptionTier =
  | "Records Vault"
  | "Automation Pro"
  | "Fleet Core"
  | "Fleet Command";

interface TierInfo {
  tier: SubscriptionTier;
  status: string;
}

// Symbol used as key on the request object for per-request caching.
// Using a Symbol avoids collisions with any existing request properties.
const TIER_CACHE_KEY = Symbol.for("__tierCache");

interface TierCachedRequest extends Request {
  [TIER_CACHE_KEY]?: TierInfo;
}

/**
 * Looks up the company's subscription tier and status from the database.
 * Caches the result on the request object so subsequent requireTier calls
 * in the same middleware chain do not trigger additional DB queries.
 */
async function resolveTierInfo(
  req: TierCachedRequest,
  companyId: string,
): Promise<TierInfo | null> {
  // Return cached value if available (per-request cache)
  if (req[TIER_CACHE_KEY]) {
    return req[TIER_CACHE_KEY];
  }

  let resultRows: Array<{
    subscription_tier: string | null;
    subscription_status: string | null;
  }>;

  try {
    const [rows] = await pool.execute(
      "SELECT subscription_tier, subscription_status FROM companies WHERE id = ?",
      [companyId],
    );
    resultRows = rows as typeof resultRows;
  } catch (err: unknown) {
    // Legacy schema compatibility: if subscription_tier column doesn't exist
    // (migration 027/039 not yet applied), bypass tier enforcement entirely.
    // This allows dev/demo environments to function without all migrations.
    const errMessage = err instanceof Error ? err.message : "";
    const errCode = (err as { code?: string })?.code;
    if (
      errMessage.includes("Unknown column") ||
      errCode === "ER_BAD_FIELD_ERROR"
    ) {
      const log = createChildLogger({ route: "requireTier" });
      log.warn(
        { companyId },
        "subscription_tier column missing — bypassing tier enforcement (legacy schema)",
      );
      // Return a sentinel value that the middleware will recognize
      return { tier: "LEGACY_BYPASS" as SubscriptionTier, status: "active" };
    }
    throw err; // Re-throw real DB errors (connection failures, etc.)
  }

  if (!resultRows || resultRows.length === 0) {
    return null;
  }

  const row = resultRows[0];
  const tierInfo: TierInfo = {
    tier: (row.subscription_tier as SubscriptionTier) || "Records Vault",
    status: row.subscription_status || "active",
  };

  // Cache on the request object
  req[TIER_CACHE_KEY] = tierInfo;

  return tierInfo;
}

/**
 * requireTier — middleware factory for subscription tier enforcement.
 *
 * @param allowedTiers - One or more SubscriptionTier values that are permitted.
 * @returns Express middleware that checks the company's tier against the allowed list.
 *
 * @example
 * // Only Fleet Core and Fleet Command can access GPS tracking
 * router.get('/api/gps/positions', requireAuth, requireTier('Fleet Core', 'Fleet Command'), handler);
 */
export function requireTier(
  ...allowedTiers: SubscriptionTier[]
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const authReq = req as AuthenticatedRequest;

    // Guard: requireAuth must run first
    if (!authReq.user) {
      res.status(403).json({
        error: "Authentication required before tier check.",
        error_code: "TIER_NO_AUTH_001",
      });
      return;
    }

    const companyId = authReq.user.companyId;

    let tierInfo: TierInfo | null;
    try {
      tierInfo = await resolveTierInfo(req as TierCachedRequest, companyId);
    } catch (error) {
      const log = createChildLogger({
        correlationId: (req as any).correlationId,
        route: "requireTier",
      });
      log.error(
        { err: error, companyId, allowedTiers },
        "Failed to verify subscription tier",
      );
      res.status(503).json({
        error: "Failed to verify subscription tier.",
        error_code: "TIER_DB_ERROR_001",
        retryable: true,
      });
      return;
    }

    if (!tierInfo) {
      res.status(403).json({
        error: "Company not found. Cannot verify subscription tier.",
        error_code: "TIER_NO_COMPANY_001",
      });
      return;
    }

    // Legacy schema bypass: subscription_tier column missing, skip enforcement
    if ((tierInfo.tier as string) === "LEGACY_BYPASS") {
      next();
      return;
    }

    // Check subscription status first — past_due blocks everything
    if (tierInfo.status === "past_due") {
      res.status(403).json({
        error:
          "Subscription is past due. Please update your payment method to continue.",
        error_code: "TIER_PAST_DUE_001",
        current_tier: tierInfo.tier,
        upgrade_url: "/settings/billing",
      });
      return;
    }

    // Only allow active or trial statuses
    const allowedStatuses = ["active", "trial"];
    if (!allowedStatuses.includes(tierInfo.status)) {
      res.status(403).json({
        error: `Subscription status '${tierInfo.status}' is not active.`,
        error_code: "TIER_INACTIVE_001",
        current_tier: tierInfo.tier,
        upgrade_url: "/settings/billing",
      });
      return;
    }

    // Check if the company's tier is in the allowed list
    if (!allowedTiers.includes(tierInfo.tier)) {
      res.status(403).json({
        error: `This feature requires one of the following plans: ${allowedTiers.join(", ")}.`,
        error_code: "TIER_INSUFFICIENT_001",
        required_tiers: allowedTiers,
        current_tier: tierInfo.tier,
        upgrade_url: "/settings/billing",
      });
      return;
    }

    // Tier check passed
    next();
  };
}
