import { Router } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import admin from "../auth";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import db from "../firestore";
import { validateBody } from "../middleware/validate";
import {
  loginUserSchema,
  registerUserSchema,
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
const DEFAULT_COMPANY_ID = "iscope-authority-001";

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
  } catch {
    return false;
  }
}

async function loadCompanyConfig(companyId: string) {
  try {
    const companyDoc = await db.collection("companies").doc(companyId).get();
    return companyDoc.exists ? companyDoc.data() : null;
  } catch {
    return null;
  }
}

function resolveCompanyId(body: Record<string, unknown>): string {
  const value = body.company_id || body.companyId;
  if (typeof value === "string" && value.trim() && value !== "null") {
    return value;
  }
  return DEFAULT_COMPANY_ID;
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
  validateBody(registerUserSchema),
  async (req, res) => {
    const log = createChildLogger({
      correlationId: req.correlationId,
      route: "POST /api/auth/register",
    });
    log.info({ data: { email: req.body.email } }, "Registration request received");

    try {
      const userInput = {
        id: resolveString(req.body.id) || uuidv4(),
        companyId: resolveCompanyId(req.body),
        email: req.body.email,
        name: req.body.name,
        role: req.body.role,
        passwordHash: await bcrypt.hash(req.body.password || "admin123", 10),
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
        details: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

router.post("/api/users", validateBody(syncUserSchema), async (req, res) => {
  const log = createChildLogger({
    correlationId: req.correlationId,
    route: "POST /api/users",
  });
  log.info({ data: { email: req.body.email } }, "User sync request received");

  try {
    const userInput = {
      id: resolveString(req.body.id) || uuidv4(),
      companyId: resolveCompanyId(req.body),
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
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post(
  "/api/auth/login",
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
        log.warn(
          { firebaseUid: decodedToken.uid, email: decodedToken.email },
          "Identity verified but no SQL user record found",
        );
        return res.status(404).json({
          error: "User profile not found. Please contact support.",
        });
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
        details: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

router.get("/api/users/me", requireAuth, async (req: any, res) => {
  try {
    const user = await findSqlUserById(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(mapUserRowToApiUser(user));
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get(
  "/api/users/:companyId",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    if (req.user.tenantId !== req.params.companyId && req.user.role !== "admin") {
      return res.status(403).json({ error: "Resource unauthorized" });
    }

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
