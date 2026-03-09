/**
 * Express Request type augmentation.
 *
 * Extends the default Express Request with properties that middleware
 * attaches during the request lifecycle. This eliminates all `as any`
 * casts on req.correlationId, req.user, and req.tenantId.
 *
 * Set by middleware:
 *   - correlationId.ts  -> req.correlationId
 *   - requireAuth.ts    -> req.user
 *
 * @see server/middleware/correlationId.ts
 * @see server/middleware/requireAuth.ts
 */

import { AuthenticatedUser } from "../middleware/requireAuth";

declare global {
  namespace Express {
    interface Request {
      /**
       * Unique correlation ID for tracing this request across logs.
       * Set by correlationId middleware on every incoming request.
       */
      correlationId: string;

      /**
       * Authenticated user context.
       * Set by requireAuth middleware after successful token verification.
       * Only present on routes protected by requireAuth.
       */
      user?: AuthenticatedUser;
    }
  }
}
