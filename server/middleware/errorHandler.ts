import { Request, Response, NextFunction } from 'express';
import { AppError, InternalError } from '../errors/AppError';

/**
 * Global Express error-handling middleware.
 *
 * - AppError instances → returns their structured JSON envelope
 * - Unknown errors → wraps as InternalError with generic message
 * - NEVER exposes stack traces in the response body
 * - Logs full error details (including stack) to console.error
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

    let appError: AppError;

    if (err instanceof AppError) {
        appError = err;
    } else {
        // Wrap unknown errors — never leak internal details to client
        appError = new InternalError('Internal server error');
    }

    // Log full details server-side (including stack for debugging)
    console.error(
        `[${appError.error_class}] ${appError.error_code}: ${appError.message}`,
        {
            correlation_id: appError.correlation_id,
            details: appError.details,
            stack: err instanceof Error ? err.stack : String(err),
        },
    );

    res.status(appError.statusCode).json(appError.toJSON());
}
