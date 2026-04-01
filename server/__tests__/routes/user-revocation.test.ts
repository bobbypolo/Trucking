import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// --- Hoisted mocks ---
const {
  mockVerifyIdToken,
  mockApp,
  mockFindSqlUserById,
  mockFindSqlUsersByCompany,
  mockRevokeUserTokens,
  mockResolveSqlPrincipalByFirebaseUid,
  mockIsTokenRevoked,
  mockPoolExecute,
  mockRevokeRefreshTokens,
  mockLinkSqlUserToFirebaseUid,
  mockUpsertSqlUser,
  mockMirrorUserToFirestore,
  mockMapUserRowToApiUser,
  mockEnsureMySqlCompany,
  mockMirrorCompanyToFirestore,
} = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
  mockApp: vi.fn().mockReturnValue(true),
  mockFindSqlUserById: vi.fn(),
  mockFindSqlUsersByCompany: vi.fn(),
  mockRevokeUserTokens: vi.fn(),
  mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
  mockIsTokenRevoked: vi.fn().mockResolvedValue(false),
  mockPoolExecute: vi.fn(),
  mockRevokeRefreshTokens: vi.fn(),
  mockLinkSqlUserToFirebaseUid: vi.fn(),
  mockUpsertSqlUser: vi.fn(),
  mockMirrorUserToFirestore: vi.fn(),
  mockMapUserRowToApiUser: vi.fn((row: Record<string, unknown>) => row),
  mockEnsureMySqlCompany: vi.fn(),
  mockMirrorCompanyToFirestore: vi.fn(),
}));

vi.mock("firebase-admin", () => ({
  default: {
    app: mockApp,
    auth: () => ({
      verifyIdToken: mockVerifyIdToken,
      revokeRefreshTokens: mockRevokeRefreshTokens,
    }),
  },
}));

vi.mock("../../auth", () => ({
  default: {
    app: mockApp,
    auth: () => ({
      verifyIdToken: mockVerifyIdToken,
      revokeRefreshTokens: mockRevokeRefreshTokens,
      generatePasswordResetLink: vi.fn(),
    }),
  },
}));

vi.mock("../../lib/sql-auth", () => ({
  resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
  findSqlUserById: mockFindSqlUserById,
  findSqlUsersByCompany: mockFindSqlUsersByCompany,
  linkSqlUserToFirebaseUid: mockLinkSqlUserToFirebaseUid,
  upsertSqlUser: mockUpsertSqlUser,
  mirrorUserToFirestore: mockMirrorUserToFirestore,
  mapUserRowToApiUser: mockMapUserRowToApiUser,
  ensureMySqlCompany: mockEnsureMySqlCompany,
  mirrorCompanyToFirestore: mockMirrorCompanyToFirestore,
}));

vi.mock("../../lib/token-revocation", () => ({
  isTokenRevoked: mockIsTokenRevoked,
  revokeUserTokens: mockRevokeUserTokens,
}));

vi.mock("../../db", () => ({
  default: {
    execute: mockPoolExecute,
  },
}));

vi.mock("../../firestore", () => ({
  default: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false, data: () => null }),
        set: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

vi.mock("../../lib/env", () => ({
  isAutoProvisionEnabled: vi.fn().mockReturnValue(false),
}));

vi.mock("../../schemas/users", () => ({
  loginUserSchema: {
    safeParse: vi.fn().mockReturnValue({ success: true, data: {} }),
  },
  registerUserSchema: {
    safeParse: vi.fn().mockReturnValue({ success: true, data: {} }),
  },
  resetPasswordSchema: {
    safeParse: vi.fn().mockReturnValue({ success: true, data: {} }),
  },
  syncUserSchema: {
    safeParse: vi.fn().mockReturnValue({ success: true, data: {} }),
  },
}));

import usersRouter from "../../routes/users";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(usersRouter);
  // Error handler for AppError
  app.use(
    (
      err: Record<string, unknown>,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const status = typeof err.statusCode === "number" ? err.statusCode : 500;
      res.status(status).json({
        error_code: err.error_code || "INTERNAL_001",
        message: err.message || "Internal error",
      });
    },
  );
  return app;
}

const ADMIN_PRINCIPAL = {
  id: "admin-user-1",
  tenantId: "tenant-1",
  companyId: "tenant-1",
  role: "admin",
  email: "admin@test.com",
  firebaseUid: "admin-firebase-uid",
};

const DRIVER_PRINCIPAL = {
  id: "driver-user-1",
  tenantId: "tenant-1",
  companyId: "tenant-1",
  role: "driver",
  email: "driver@test.com",
  firebaseUid: "driver-firebase-uid",
};

describe("R-SEC-11: POST /api/users/:id/revoke endpoint", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApp.mockReturnValue(true);
    mockIsTokenRevoked.mockResolvedValue(false);
    app = createApp();
  });

  it("returns 204 when admin revokes a user with valid reason", async () => {
    // Tests R-SEC-11
    mockVerifyIdToken.mockResolvedValue({ uid: "admin-firebase-uid" });
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(ADMIN_PRINCIPAL);
    mockFindSqlUserById.mockResolvedValue({
      id: "target-user-1",
      firebase_uid: "target-firebase-uid",
      company_id: "tenant-1",
    });
    mockRevokeUserTokens.mockResolvedValue(undefined);

    const res = await request(app)
      .post("/api/users/target-user-1/revoke")
      .set("Authorization", "Bearer admin-token")
      .send({ reason: "Security breach" });

    expect(res.status).toBe(204);
    expect(mockRevokeUserTokens).toHaveBeenCalledWith(
      "target-user-1",
      "target-firebase-uid",
      "Security breach",
    );
  });

  it("returns 403 when non-admin attempts revocation", async () => {
    // Tests R-SEC-11 — non-admin rejection
    mockVerifyIdToken.mockResolvedValue({ uid: "driver-firebase-uid" });
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DRIVER_PRINCIPAL);

    const res = await request(app)
      .post("/api/users/target-user-1/revoke")
      .set("Authorization", "Bearer driver-token")
      .send({ reason: "Unauthorized attempt" });

    expect(res.status).toBe(403);
    expect(mockRevokeUserTokens).not.toHaveBeenCalled();
  });

  it("returns 400 when reason is missing", async () => {
    // Tests R-SEC-11 — validation
    mockVerifyIdToken.mockResolvedValue({ uid: "admin-firebase-uid" });
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(ADMIN_PRINCIPAL);

    const res = await request(app)
      .post("/api/users/target-user-1/revoke")
      .set("Authorization", "Bearer admin-token")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Reason is required.");
    expect(mockRevokeUserTokens).not.toHaveBeenCalled();
  });

  it("returns 404 when target user does not exist", async () => {
    // Tests R-SEC-11 — user not found
    mockVerifyIdToken.mockResolvedValue({ uid: "admin-firebase-uid" });
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(ADMIN_PRINCIPAL);
    mockFindSqlUserById.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/users/nonexistent/revoke")
      .set("Authorization", "Bearer admin-token")
      .send({ reason: "Test reason" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("User not found.");
    expect(mockRevokeUserTokens).not.toHaveBeenCalled();
  });

  it("returns 422 when target user has no firebase_uid", async () => {
    // Tests R-SEC-11 — no Firebase link
    mockVerifyIdToken.mockResolvedValue({ uid: "admin-firebase-uid" });
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(ADMIN_PRINCIPAL);
    mockFindSqlUserById.mockResolvedValue({
      id: "target-user-1",
      firebase_uid: null,
      company_id: "tenant-1",
    });

    const res = await request(app)
      .post("/api/users/target-user-1/revoke")
      .set("Authorization", "Bearer admin-token")
      .send({ reason: "Test reason" });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("User has no linked Firebase account.");
    expect(mockRevokeUserTokens).not.toHaveBeenCalled();
  });
});
