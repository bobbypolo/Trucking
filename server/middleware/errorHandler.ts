import { Request, Response, NextFunction } from "express";
import { AppError, InternalError } from "../errors/AppError";
import { createChildLogger } from "../lib/logger";
import { captureException } from "../lib/sentry";

/**
 * Global Express error-handling middleware.
 *
 * - AppError instances → returns their structured JSON envelope
 * - Unknown errors → wraps as InternalError with generic message
 * - NEVER exposes stack traces in the response body
 * - Logs full error details (including stack) via structured logger
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  // If headers already sent, delegate to Express default handler
  if (res.headersSent) {
    next(err);
    return;
  }

  if (
    typeof err === "object" &&
    err !== null &&
    ("type" in err || "status" in err || "statusCode" in err)
  ) {
    const candidate = err as {
      type?: string;
      status?: number;
      statusCode?: number;
    };

    if (
      candidate.type === "entity.too.large" ||
      candidate.status === 413 ||
      candidate.statusCode === 413
    ) {
      const log = createChildLogger({
        route: `${_req.method} ${_req.path}`,
      });
      log.warn({ err }, "Request body exceeded configured size limit");
      res.status(413).json({ error: "Payload too large" });
      return;
    }
  }

  let appError: AppError;

  if (err instanceof AppError) {
    appError = err;
  } else {
    // Wrap unknown errors — never leak internal details to client
    appError = new InternalError("Internal server error");
  }

  // Log full details server-side (including stack for debugging)
  const log = createChildLogger({
    correlationId: appError.correlation_id,
    route: `${_req.method} ${_req.path}`,
  });
  log.error(
    {
      error_class: appError.error_class,
      error_code: appError.error_code,
      details: appError.details,
      stack: err instanceof Error ? err.stack : String(err),
    },
    appError.message,
  );

  // Report to Sentry APM (no-op when DSN is not configured)
  captureException(err instanceof Error ? err : appError, {
    route: `${_req.method} ${_req.path}`,
    correlationId: appError.correlation_id,
    errorCode: appError.error_code,
  });

  const payload = appError.toJSON();
  // Strip internal details from security-sensitive responses
  if (appError.statusCode === 401 || appError.statusCode === 403) {
    delete payload.details;
  }
  res.status(appError.statusCode).json(payload);
}
