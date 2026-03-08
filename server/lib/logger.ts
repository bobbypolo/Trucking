import pino from 'pino';

/**
 * Structured JSON logger for LoadPilot API.
 *
 * Follows OBSERVABILITY_BASELINE.md specification:
 * - JSON output with timestamp, level, service, correlationId, route, message, data
 * - Sensitive field redaction (authorization, password, token, tax_id)
 * - Child logger support for per-request context
 *
 * @see .claude/docs/recovery/OBSERVABILITY_BASELINE.md
 */
export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
        level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
        service: 'loadpilot-api',
        version: process.env.APP_VERSION || '0.0.0',
    },
    redact: {
        paths: [
            'req.headers.authorization',
            'data.password',
            'data.token',
            'data.tax_id',
        ],
        censor: '[REDACTED]',
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
