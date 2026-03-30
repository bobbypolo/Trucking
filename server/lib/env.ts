/**
 * Environment variable validation — fail fast on boot.
 *
 * Required env vars (all environments):
 *   DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
 *   FIREBASE_PROJECT_ID  OR  GOOGLE_APPLICATION_CREDENTIALS
 *
 * Fail-closed in staging/prod (NODE_ENV=staging|production):
 *   CORS_ORIGIN must be set — missing causes startup THROW (not just warn)
 *   All critical vars must be set — missing causes startup THROW
 *
 * Warn-only in dev/undefined (NODE_ENV=development|test|undefined):
 *   CORS_ORIGIN missing → logger.warn (non-blocking)
 *   NODE_ENV not set → logger.warn (non-blocking)
 *
 * JWT_SECRET is NOT required (Firebase-only auth per R-P1-05).
 * No hardcoded fallback values — empty strings are treated as missing.
 *
 * Optional vars documented here for reference:
 *   CLOUD_RUN_SERVICE_URL  — set automatically by Cloud Run, optional
 *   RATE_LIMIT_MAX         — defaults to 100 if not set
 *   GEMINI_API_KEY         — optional; AI endpoints unavailable if missing
 *   ALLOW_AUTO_PROVISION   — "true" to allow auto-provisioning of new
 *                            tenants on first Firebase login. Default "false"
 *                            (production-safe). When false, login without an
 *                            existing SQL profile returns 403.
 */

import { logger } from "./logger";

const REQUIRED_DB_VARS = [
  "DB_HOST",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
] as const;

/** Environments that require fail-closed validation */
const STRICT_ENVIRONMENTS = new Set(["staging", "production"]);

/** Safe localhost origins allowed in development/test mode */
const DEV_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5000",
];

/**
 * Returns the CORS origin configuration for the Express cors() middleware.
 *
 * - In staging/production: uses CORS_ORIGIN from env (validated by validateEnv).
 *   If CORS_ORIGIN contains commas, splits into an array.
 * - In development/test/undefined: if CORS_ORIGIN is set, uses it;
 *   otherwise restricts to localhost origins only.
 * - Never returns "*" when credentials are enabled (CORS spec violation).
 */
export function getCorsOrigin(): string | string[] {
  const corsOrigin = process.env.CORS_ORIGIN;
  const nodeEnv = process.env.NODE_ENV;
  const isStrict = nodeEnv !== undefined && STRICT_ENVIRONMENTS.has(nodeEnv);

  if (corsOrigin && corsOrigin.trim() !== "") {
    // If the value contains commas, treat as multiple origins
    if (corsOrigin.includes(",")) {
      return corsOrigin
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
    }
    return corsOrigin.trim();
  }

  if (isStrict) {
    // This should not be reached because validateEnv() throws first,
    // but defend in depth.
    throw new Error(
      `CORS_ORIGIN is required in ${nodeEnv} but was not set. ` +
        "Cannot start server without explicit CORS origin.",
    );
  }

  // Development/test: allow only localhost origins
  logger.info(
    { origins: DEV_ALLOWED_ORIGINS },
    "CORS_ORIGIN not set — restricting to localhost origins for development",
  );
  return DEV_ALLOWED_ORIGINS;
}

/**
 * Validates that all required environment variables are set.
 * Throws an Error with a descriptive message listing ALL missing vars.
 *
 * In staging/production: also validates CORS_ORIGIN (throws if missing).
 * In development/test/undefined: warns on missing CORS_ORIGIN and NODE_ENV.
 */
export function validateEnv(): void {
  const missing: string[] = [];

  for (const varName of REQUIRED_DB_VARS) {
    const value = process.env[varName];
    if (!value || value.trim() === "") {
      missing.push(varName);
    }
  }

  // Firebase: need at least one of FIREBASE_PROJECT_ID or GOOGLE_APPLICATION_CREDENTIALS
  const hasProjectId =
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PROJECT_ID.trim() !== "";
  const hasCredentials =
    process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    process.env.GOOGLE_APPLICATION_CREDENTIALS.trim() !== "";

  if (!hasProjectId && !hasCredentials) {
    missing.push("FIREBASE_PROJECT_ID or GOOGLE_APPLICATION_CREDENTIALS");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        "Server cannot start without these. " +
        "Set them in your .env file or environment.",
    );
  }

  const nodeEnv = process.env.NODE_ENV;
  const isStrict = nodeEnv !== undefined && STRICT_ENVIRONMENTS.has(nodeEnv);

  if (isStrict) {
    // Fail-closed: staging/prod must have CORS_ORIGIN configured
    const corsOrigin = process.env.CORS_ORIGIN;
    if (!corsOrigin || corsOrigin.trim() === "") {
      throw new Error(
        `Missing required environment variable for ${nodeEnv}: CORS_ORIGIN. ` +
          "Server cannot start in staging/production without CORS_ORIGIN configured. " +
          "Set CORS_ORIGIN to your frontend domain (e.g. https://app.yourdomain.com).",
      );
    }
  } else {
    // Warn-only in development/test/undefined
    if (!nodeEnv || nodeEnv.trim() === "") {
      logger.warn(
        "NODE_ENV is not set — defaulting to development behavior. " +
          "Set NODE_ENV=staging or NODE_ENV=production for production deployments.",
      );
    }

    const corsOrigin = process.env.CORS_ORIGIN;
    if (!corsOrigin || corsOrigin.trim() === "") {
      logger.warn(
        "CORS_ORIGIN is not set — restricting to localhost origins only. " +
          "Configure CORS_ORIGIN before staging/production deployment.",
      );
    }
  }
}

/**
 * Returns true if auto-provisioning of new tenants on first Firebase login
 * is enabled. Reads ALLOW_AUTO_PROVISION env var (case-insensitive "true").
 * Default: false (production-safe — unknown Firebase identities get 403).
 */
export function isAutoProvisionEnabled(): boolean {
  const raw = process.env.ALLOW_AUTO_PROVISION;
  return raw !== undefined && raw.trim().toLowerCase() === "true";
}
