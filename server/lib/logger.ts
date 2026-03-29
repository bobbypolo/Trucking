import pino from "pino";
import type { Request } from "express";

/**
 * Structured JSON logger for LoadPilot API.
 *
 * Follows OBSERVABILITY_BASELINE.md specification:
 * - JSON output with timestamp, level, service, correlationId, route, message, data
 * - Sensitive field redaction (authorization, password, token, tax_id, email, ssn, phone)
 * - Child logger support for per-request context
 * - Every log entry carries request_id, user_id, company_id
 *
 * @see .claude/docs/recovery/OBSERVABILITY_BASELINE.md
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: "loadpilot-api",
    version: process.env.APP_VERSION || "0.0.0",
  },
  redact: {
    paths: [
      "req.headers.authorization",
      "data.password",
      "data.token",
      "data.tax_id",
      "data.email",
      "data.ssn",
      "data.social_security",
      "data.social_security_number",
      "data.phone",
      "data.phone_number",
      "email",
      "ssn",
      "social_security",
      "password",
      "phone",
    ],
    censor: "[REDACTED]",
  },
});

/**
 * Creates a child logger with request-scoped context.
 *
 * Usage in routes/middleware:
 *   const log = createChildLogger({ correlationId: req.correlationId, route: 'GET /api/loads' });
 *   log.info({ data: { loadId } }, 'Load fetched');
 */
export function createChildLogger(context: {
  correlationId?: string;
  route?: string;
  [key: string]: unknown;
}): pino.Logger {
  return logger.child(context);
}

/**
 * Creates a child logger pre-populated with request_id, user_id, and company_id
 * extracted from the Express request object. Every log entry produced by this
 * logger automatically includes these three fields for traceability.
 *
 * Falls back gracefully when req.user is undefined (e.g. unauthenticated
 * health-check endpoints).
 *
 * Usage:
 *   const log = createRequestLogger(req, 'GET /api/loads');
 *   log.info({ data: { loadId } }, 'Load fetched');
 */
export function createRequestLogger(req: Request, route: string): pino.Logger {
  const user = (req as any).user;
  return logger.child({
    request_id:
      (req as any).correlationId ||
      req.headers["x-correlation-id"] ||
      "unknown",
    user_id: user?.uid || user?.id || "anonymous",
    company_id: user?.tenantId || user?.companyId || "unknown",
    route,
  });
}
