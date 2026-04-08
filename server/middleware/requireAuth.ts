import { Request, Response, NextFunction } from "express";
import admin from "firebase-admin";
import { AuthError, InternalError } from "../errors/AppError";
import { resolveSqlPrincipalByFirebaseUid } from "../lib/sql-auth";
import { isTokenRevoked } from "../lib/token-revocation";

export interface AuthenticatedUser {
  id: string;
  uid: string;
  tenantId: string;
  companyId: string;
  role: string;
  email: string;
  firebaseUid: string;
}

/**
 * Request shape after `requireAuth` middleware has run.
 *
 * NOTE: `user` is declared optional here (matching the global Express
 * Request augmentation in `types/express.d.ts`) so that handlers using
 * `AuthenticatedRequest` remain assignable to Express's `RequestHandler`
 * type (which expects the base `Request`). The runtime guarantee from
 * `requireAuth` middleware means handlers can safely use `req.user!.X`
 * without an additional null check.
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

function isFirebaseInitialized(): boolean {
  try {
    admin.app();
    return true;
  } catch (_error: unknown) {
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

    // Gate: reject unverified email addresses (skip in test environment)
    if (!decodedToken.email_verified && process.env.NODE_ENV !== "test") {
      return next(
        new AuthError(
          "Email not verified. Please check your inbox.",
          {},
          "AUTH_EMAIL_UNVERIFIED_001",
        ),
      );
    }

    // Check if user's tokens have been revoked
    const revoked = await isTokenRevoked(decodedToken.uid);
    if (revoked) {
      return next(
        new AuthError(
          "Access revoked. Please contact your administrator.",
          {},
          "AUTH_REVOKED_001",
        ),
      );
    }

    let principal;

    try {
      principal = await resolveSqlPrincipalByFirebaseUid(decodedToken.uid);
    } catch (_error: unknown) {
      return next(
        new InternalError(
          "Failed to resolve authenticated user from SQL.",
          {},
          "AUTH_RESOLVE_001",
        ),
      );
    }

    if (!principal) {
      return next(
        new AuthError(
          "Identity verified but no linked account found.",
          {},
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
  } catch (_error: unknown) {
    return next(
      new AuthError(
        "Invalid or expired authentication token.",
        {},
        "AUTH_INVALID_001",
      ),
    );
  }
}
