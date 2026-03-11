import { Request, Response, NextFunction } from "express";
import admin from "firebase-admin";
import { AuthError, InternalError } from "../errors/AppError";
import { resolveSqlPrincipalByFirebaseUid } from "../lib/sql-auth";

export interface AuthenticatedUser {
  id: string;
  uid: string;
  tenantId: string;
  companyId: string;
  role: string;
  email: string;
  firebaseUid: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

function isFirebaseInitialized(): boolean {
  try {
    admin.app();
    return true;
  } catch {
    return false;
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!isFirebaseInitialized()) {
    return next(
      new InternalError(
        "Server authentication not configured",
        {},
        "AUTH_CONFIG_001",
      ),
    );
  }

  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(
      new AuthError(
        "Authentication required. Bearer token missing.",
        {},
        "AUTH_MISSING_001",
      ),
    );
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return next(
      new AuthError(
        "Authentication required. Bearer token missing.",
        {},
        "AUTH_MISSING_001",
      ),
    );
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    let principal;

    try {
      principal = await resolveSqlPrincipalByFirebaseUid(decodedToken.uid);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown SQL auth resolution error";

      return next(
        new InternalError(
          "Failed to resolve authenticated user from SQL.",
          { reason: message },
          "AUTH_RESOLVE_001",
        ),
      );
    }

    if (!principal) {
      return next(
        new AuthError(
          "Identity verified but no linked account found.",
          { firebaseUid: decodedToken.uid },
          "AUTH_NO_PROFILE_001",
        ),
      );
    }

    (req as AuthenticatedRequest).user = {
      id: principal.id,
      uid: principal.id,
      tenantId: principal.tenantId,
      companyId: principal.companyId,
      role: principal.role,
      email: principal.email,
      firebaseUid: principal.firebaseUid || decodedToken.uid,
    };

    next();
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Token verification failed";

    return next(
      new AuthError(
        "Invalid or expired authentication token.",
        { reason: message },
        "AUTH_INVALID_001",
      ),
    );
  }
}
