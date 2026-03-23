import { Router } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import admin from "../auth";
import pool from "../db";
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
import { createChildLogger } from "../lib/logger";
import {
  findSqlUserById,
  findSqlUsersByCompany,
  linkSqlUserToFirebaseUid,
  mapUserRowToApiUser,
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

function getBearerToken(req: any): string | null {
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
  async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const log = createChildLogger({
      correlationId: req.correlationId,
      route: "POST /api/auth/register",
    });

    if (authReq.user.role !== "admin") {
      return res.status(403).json({ error: "Admin role required." });
    }

    log.info(
      { data: { email: req.body.email } },
      "Registration request received",
    );

    try {
      const userInput = {
        id: resolveString(req.body.id) || uuidv4(),
        companyId: authReq.user.tenantId,
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
      log.error({ err: error }, "Registration failed");
      res.status(500).json({
        error: "Registration failed",
        details: "Internal error",
      });
    }
  },
);

router.post(
  "/api/users",
  requireAuth,
  requireTenant,
  validateBody(syncUserSchema),
  async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const log = createChildLogger({
      correlationId: req.correlationId,
      route: "POST /api/users",
    });

    const isAdmin = authReq.user.role === "admin";
    const isSelfSync = authReq.user.email === req.body.email;

    if (!isAdmin && !isSelfSync) {
      return res
        .status(403)
        .json({ error: "Forbidden: cannot sync another user." });
    }

    const companyId = authReq.user.tenantId;

    log.info({ data: { email: req.body.email } }, "User sync request received");

    try {
      const userInput = {
        id: resolveString(req.body.id) || uuidv4(),
        companyId,
        email: req.body.email,
        name: resolveString(req.body.name) || req.body.email,
        role: resolveString(req.body.role) || "driver",
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
      log.error({ err: error }, "User sync failed");
      res.status(500).json({
        error: "User sync failed",
        details: "Internal error",
      });
    }
  },
);

router.post(
  "/api/auth/login",
  loginLimiter,
  validateBody(loginUserSchema),
  async (req, res) => {
    const log = createChildLogger({
      correlationId: req.correlationId,
      route: "POST /api/auth/login",
    });

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

        log.info(
          { firebaseUid: decodedToken.uid, email },
          "Auto-provisioning SQL user for verified Firebase identity",
        );

        const newCompanyId = uuidv4();
        const newUserId = uuidv4();
        const displayName =
          email.split("@")[0].charAt(0).toUpperCase() +
          email.split("@")[0].slice(1);

        // Create company
        await pool.query(
          `INSERT INTO companies (id, name, account_type, email, subscription_status)
           VALUES (?, ?, 'owner_operator', ?, 'active')`,
          [newCompanyId, `${displayName}'s Company`, email],
        );

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
    const log = createChildLogger({
      correlationId: req.correlationId,
      route: "POST /api/auth/reset-password",
    });

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

router.get("/api/users/me", requireAuth, async (req: any, res) => {
  try {
    const user = await findSqlUserById(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(mapUserRowToApiUser(user));
  } catch (error) {
    const log = createChildLogger({
      correlationId: req.correlationId,
      route: "GET /api/users/me",
    });
    log.error({ err: error }, "SERVER ERROR [GET /api/users/me]");
    res.status(500).json({ error: "Server error" });
  }
});

router.get(
  "/api/users/:companyId",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    try {
      const users = await findSqlUsersByCompany(req.params.companyId);
      res.json(users.map(mapUserRowToApiUser));
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/users",
      });
      log.error({ err: error }, "SERVER ERROR [GET /api/users]");
      res.status(500).json({ error: "Database error" });
    }
  },
);

export default router;
