import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Correlation ID middleware.
 *
 * Assigns a unique correlation ID to each incoming request:
 * - Uses the `x-correlation-id` header if provided by the client
 * - Generates a new UUID v4 if not provided
 * - Sets the ID on `req.correlationId` for downstream use
 * - Returns it in the `X-Correlation-Id` response header
 *
 * @see OBSERVABILITY_BASELINE.md - Correlation ID Strategy
 */
export function correlationId(
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    const id =
        (req.headers['x-correlation-id'] as string | undefined) || uuidv4();

    req.correlationId = id;
    res.setHeader('X-Correlation-Id', id);

    next();
}
