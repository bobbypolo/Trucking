import { Router } from "express";
import type { Request } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import admin from "../auth";
import { requireAuth } from "../middleware/requireAuth";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import db from "../firestore";
import { validateBody } from "../middleware/validate";
import {
  loginUserSchema,
  registerUserSchema,
  resetPasswordSchema,
  syncUserSchema,
} from "../schemas/users";
import { createRequestLogger } from "../lib/logger";
import { isAutoProvisionEnabled } from "../lib/env";
import { revokeUserTokens } from "../lib/token-revocation";
import {
  ensureMySqlCompany,
  findSqlUserById,
  findSqlUsersByCompany,
  linkSqlUserToFirebaseUid,
  mapUserRowToApiUser,
  mirrorCompanyToFirestore,
  mirrorUserToFirestore,
  resolveSqlPrincipalByFirebaseUid,
  upsertSqlUser,
} from "../lib/sql-auth";

const router = Router();

// Rate limiter for login endpoint: 10 requests per 15-minute window per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) =>
    ipKeyGenerator(
      req.ip || (req.headers["x-forwarded-for"] as string) || "unknown",
    ),
  message: { error: "Too many login attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for password reset endpoint: 3 requests per 15-minute window per IP
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  keyGenerator: (req) =>
    ipKeyGenerator(
      req.ip || (req.headers["x-forwarded-for"] as string) || "unknown",
    ),
  message: { error: "Too many password reset requests. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers?.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.split(" ")[1] || null;
}

function firebaseAdminReady(): boolean {
  try {
    admin.app();
    return true;
  } catch (_error: unknown) {
    return false;
  }
}

async function loadCompanyConfig(companyId: string) {
  try {
    const companyDoc = await db.collection("companies").doc(companyId).get();
    return companyDoc.exists ? companyDoc.data() : null;
  } catch (_error: unknown) {
    return null;
  }
}

function resolveString(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return null;
}

function resolveNumber(...values: Array<unknown>): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

router.post(
  "/api/auth/register",
  requireAuth,
  requireTenant,
  validateBody(registerUserSchema),
  async (req, res, next) => {
    const authReq = req as AuthenticatedRequest;
    const log = createRequestLogger(req, "POST /api/auth/register");

    const registerAdminRoles = [
      "admin",
      "OWNER_ADMIN",
      "ORG_OWNER_SUPER_ADMIN",
    ];
    if (!registerAdminRoles.includes(authReq.user!.role)) {
      return res.status(403).json({ error: "Admin role required." });
    }

    log.info(
      { data: { email: req.body.email } },
      "Registration request received",
    );

    try {
      const userInput = {
        id: resolveString(req.body.id) || uuidv4(),
        companyId: authReq.user!.tenantId,
        email: req.body.email,
        name: req.body.name,
        role: req.body.role,
        passwordHash: await bcrypt.hash(req.body.password, 10),
        payModel: resolveString(req.body.pay_model, req.body.payModel),
        payRate: resolveNumber(req.body.pay_rate, req.body.payRate),
        onboardingStatus: "Completed" as const,
        safetyScore: 100,
        firebaseUid: resolveString(req.body.firebaseUid, req.body.firebase_uid),
      };

      await upsertSqlUser(userInput);
      await mirrorUserToFirestore(userInput);

      res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/api/users",
  requireAuth,
  requireTenant,
  validateBody(syncUserSchema),
  async (req, res, next) => {
    const authReq = req as AuthenticatedRequest;
    const log = createRequestLogger(req, "POST /api/users");

    const adminRoles = ["admin", "OWNER_ADMIN", "ORG_OWNER_SUPER_ADMIN"];
    const isAdmin = adminRoles.includes(authReq.user!.role);
    const isSelfSync = authReq.user!.email === req.body.email;

    if (!isAdmin && !isSelfSync) {
      return res
        .status(403)
        .json({ error: "Forbidden: cannot sync another user." });
    }

    // Prevent self-escalation: non-admin users cannot change their own role
    if (
      isSelfSync &&
      !isAdmin &&
      req.body.role &&
      req.body.role !== authReq.user!.role
    ) {
      return res
        .status(403)
        .json({ error: "Forbidden: cannot change own role." });
    }

    const companyId = authReq.user!.tenantId;

    log.info({ data: { email: req.body.email } }, "User sync request received");

    try {
      const userInput = {
        id: resolveString(req.body.id) || uuidv4(),
        companyId,
        email: req.body.email,
        name: resolveString(req.body.name) || req.body.email,
        role:
          isSelfSync && !isAdmin
            ? authReq.user!.role
            : resolveString(req.body.role) || "driver",
        passwordHash: req.body.password
          ? await bcrypt.hash(req.body.password, 10)
          : null,
        payModel: resolveString(req.body.pay_model, req.body.payModel),
        payRate: resolveNumber(req.body.pay_rate, req.body.payRate),
        onboardingStatus: "Completed" as const,
        safetyScore:
          resolveNumber(req.body.safety_score, req.body.safetyScore) ?? 100,
        managedByUserId: resolveString(
          req.body.managed_by_user_id,
          req.body.managedByUserId,
        ),
        primaryWorkspace: resolveString(
          req.body.primary_workspace,
          req.body.primaryWorkspace,
        ),
        dutyMode: resolveString(req.body.duty_mode, req.body.dutyMode),
        phone: resolveString(req.body.phone),
        firebaseUid: resolveString(req.body.firebaseUid, req.body.firebase_uid),
      };

      await upsertSqlUser(userInput);
      await mirrorUserToFirestore(userInput);

      res.status(201).json({ message: "User updated/created" });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/api/auth/login",
  loginLimiter,
  validateBody(loginUserSchema),
  async (req, res) => {
    const log = createRequestLogger(req, "POST /api/auth/login");

    if (!firebaseAdminReady()) {
      return res.status(500).json({
        error: "Server authentication not configured.",
      });
    }

    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({
        error: "Authentication required. Bearer token missing.",
      });
    }

    const requestedFirebaseUid = resolveString(
      req.body.firebaseUid,
      req.body.firebase_uid,
    );

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);

      if (requestedFirebaseUid && requestedFirebaseUid !== decodedToken.uid) {
        return res.status(403).json({ error: "Firebase identity mismatch." });
      }

      let principal = await resolveSqlPrincipalByFirebaseUid(decodedToken.uid);
      if (!principal && decodedToken.email) {
        await linkSqlUserToFirebaseUid(decodedToken.email, decodedToken.uid);
        principal = await resolveSqlPrincipalByFirebaseUid(decodedToken.uid);
      }

      if (!principal) {
        // Feature flag: ALLOW_AUTO_PROVISION (default false)
        // When false: return 403 — unknown Firebase identities must be
        // pre-created by an admin before they can log in.
        if (!isAutoProvisionEnabled()) {
          log.warn(
            { firebaseUid: decodedToken.uid, email: decodedToken.email },
            "Login rejected — no SQL profile and auto-provision disabled",
          );
          return res.status(403).json({
            error:
              "Account not found. Please sign up or contact your administrator.",
          });
        }

        // Auto-provision: create a default company + admin user for verified
        // Firebase users who have no SQL record yet (e.g. created via console).
        const email = decodedToken.email;
        if (!email) {
          log.warn(
            { firebaseUid: decodedToken.uid },
            "Identity verified but no email on token — cannot auto-provision",
          );
          return res.status(404).json({
            error: "User profile not found. Please contact support.",
          });
        }

        const sourceIp =
          req.ip || (req.headers["x-forwarded-for"] as string) || "unknown";

        const newCompanyId = uuidv4();
        const newUserId = uuidv4();
        const displayName =
          email.split("@")[0].charAt(0).toUpperCase() +
          email.split("@")[0].slice(1);

        // Create company in MySQL (idempotent)
        await ensureMySqlCompany({
          id: newCompanyId,
          name: `${displayName}'s Company`,
          accountType: "owner_operator",
          email,
          subscriptionStatus: "active",
        });

        // Mirror company to Firestore so GET /api/companies/:id works
        await mirrorCompanyToFirestore({
          id: newCompanyId,
          name: `${displayName}'s Company`,
          accountType: "owner_operator",
          email,
          subscriptionStatus: "active",
        });

        // Create admin user
        await upsertSqlUser({
          id: newUserId,
          companyId: newCompanyId,
          email,
          name: displayName,
          role: "admin",
          firebaseUid: decodedToken.uid,
          onboardingStatus: "Completed",
          safetyScore: 100,
        });

        // Mirror to Firestore
        await mirrorUserToFirestore({
          id: newUserId,
          companyId: newCompanyId,
          email,
          name: displayName,
          role: "admin",
          firebaseUid: decodedToken.uid,
        });

        principal = await resolveSqlPrincipalByFirebaseUid(decodedToken.uid);
        if (!principal) {
          return res.status(500).json({
            error: "Auto-provisioning failed. Please contact support.",
          });
        }

        // Structured audit log for auto-provision event
        // Use "provisionedEmail" instead of "email" to avoid pino redaction
        // (top-level "email" is in the redact paths for PII safety)
        log.info(
          {
            event: "auto_provision",
            firebaseUid: decodedToken.uid,
            provisionedEmail: email,
            sourceIp:
              typeof sourceIp === "string" && sourceIp.includes(",")
                ? sourceIp.split(",")[0].trim()
                : sourceIp,
            timestamp: new Date().toISOString(),
            newCompanyId,
            newUserId,
          },
          "Auto-provisioned new tenant from Firebase login",
        );
      }

      const [userRow, company] = await Promise.all([
        findSqlUserById(principal.id),
        loadCompanyConfig(principal.companyId),
      ]);

      if (!userRow) {
        return res.status(404).json({
          error: "User profile not found. Please contact support.",
        });
      }

      res.json({
        user: mapUserRowToApiUser(userRow),
        company,
      });
    } catch (error) {
      log.error({ err: error }, "Login failed");
      res.status(401).json({
        error: "Invalid or expired authentication token.",
      });
    }
  },
);

router.post(
  "/api/auth/reset-password",
  resetPasswordLimiter,
  validateBody(resetPasswordSchema),
  async (req, res) => {
    const log = createRequestLogger(req, "POST /api/auth/reset-password");

    const { email } = req.body as { email: string };

    try {
      if (firebaseAdminReady()) {
        await admin.auth().generatePasswordResetLink(email);
        log.info({ data: { email } }, "Password reset link generated");
      }
    } catch (_error: unknown) {
      // Silently swallow errors — do not reveal whether the account exists
      log.info(
        { data: { email } },
        "Password reset attempted (account may not exist)",
      );
    }

    // Always return 200 to prevent account enumeration
    return res.status(200).json({
      message:
        "If an account exists for this email, a reset link has been sent.",
    });
  },
);

router.get("/api/users/me", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await findSqlUserById(req.user!.uid);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(mapUserRowToApiUser(user));
  } catch (error) {
    next(error);
  }
});

router.get(
  "/api/users/:companyId",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const users = await findSqlUsersByCompany(req.params.companyId);
      res.json(users.map(mapUserRowToApiUser));
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/api/users/:id/revoke",
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    const authReq = req as AuthenticatedRequest;
    const log = createRequestLogger(req, "POST /api/users/:id/revoke");

    const adminRoles = ["admin", "OWNER_ADMIN", "ORG_OWNER_SUPER_ADMIN"];
    if (!adminRoles.includes(authReq.user!.role)) {
      return res.status(403).json({ error: "Admin role required." });
    }

    const targetUserId = req.params.id;
    const { reason } = req.body as { reason?: string };

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({ error: "Reason is required." });
    }

    try {
      const targetUser = await findSqlUserById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found." });
      }

      if (!targetUser.firebase_uid) {
        return res
          .status(422)
          .json({ error: "User has no linked Firebase account." });
      }

      await revokeUserTokens(
        targetUserId,
        targetUser.firebase_uid,
        reason.trim(),
      );

      log.info(
        { targetUserId, revokedBy: authReq.user!.id },
        "User tokens revoked",
      );

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

export default router;
