import { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../errors/AppError";
import { AuthenticatedRequest } from "./requireAuth";

/**
 * requireTenant middleware — enforces tenant isolation on routes with :companyId param.
 *
 * Must be used AFTER requireAuth (depends on req.user being set).
 *
 * For routes with a :companyId URL parameter, verifies that the authenticated
 * user's tenantId matches the requested companyId.
 *
 * For routes that receive company_id in the request body (POST/PUT/PATCH),
 * verifies req.body.company_id or req.body.companyId matches the user's tenantId.
 *
 * Returns 403 ForbiddenError if tenant mismatch is detected.
 */
export function requireTenant(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user) {
    return next(
      new ForbiddenError(
        "Tenant verification requires authentication.",
        {},
        "TENANT_NO_AUTH_001",
      ),
    );
  }

  const userTenantId = authReq.user.tenantId;

  // Check URL parameter :companyId
  const paramCompanyId = req.params.companyId;
  if (paramCompanyId && paramCompanyId !== userTenantId) {
    return next(
      new ForbiddenError(
        "Access denied: tenant mismatch.",
        {},
        "TENANT_MISMATCH_001",
      ),
    );
  }

  // Check request body for company_id or companyId (POST/PUT/PATCH)
  if (req.body) {
    const bodyCompanyId = req.body.company_id || req.body.companyId;
    if (bodyCompanyId && bodyCompanyId !== userTenantId) {
      return next(
        new ForbiddenError(
          "Access denied: tenant mismatch.",
          {},
          "TENANT_MISMATCH_001",
        ),
      );
    }
  }

  next();
}
