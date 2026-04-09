import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";

// Tests R-P5-01-AC2 (auth security)

/**
 * Auth Security Regression Test
 *
 * Verifies authentication enforcement at every layer:
 *   - Unauthenticated requests are rejected (401)
 *   - Expired/invalid tokens fail (401)
 *   - Missing Bearer prefix fails (401)
 *   - Firebase Admin not configured = fail-closed (500)
 *   - No JWT_SECRET bypass exists in codebase
 *   - User profile resolution from Firestore
 *   - Orphan Firebase UID (no linked profile) is rejected
 */

// --- Mock Firebase Admin ---
const {
  mockVerifyIdToken,
  mockResolvePrincipal,
  mockApp,
  mockIsTokenRevoked,
  mockDbExecute,
} = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
  mockResolvePrincipal: vi.fn(),
  mockApp: vi.fn(),
  mockIsTokenRevoked: vi.fn(),
  mockDbExecute: vi.fn(),
}));

vi.mock("firebase-admin", () => ({
  default: {
    app: mockApp,
    auth: () => ({
      verifyIdToken: mockVerifyIdToken,
    }),
  },
}));

vi.mock("../../lib/sql-auth", () => ({
  resolveSqlPrincipalByFirebaseUid: mockResolvePrincipal,
}));

vi.mock("../../lib/token-revocation", () => ({
  isTokenRevoked: mockIsTokenRevoked,
}));

vi.mock("../../db", () => ({
  default: {
    execute: mockDbExecute,
  },
}));

import {
  requireAuth,
  AuthenticatedRequest,
} from "../../middleware/requireAuth";
import { requireTenant } from "../../middleware/requireTenant";
import {
  AuthError,
  InternalError,
  ForbiddenError,
} from "../../errors/AppError";

function mockReq(headers: Record<string, string> = {}): Request {
  return {
    headers,
    params: {},
    body: {},
  } as unknown as Request;
}

function mockRes(): Response {
  const res: Record<string, unknown> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as unknown as Response;
}

describe("R-P5-01-AC2: Auth Security Regression", () => {
  let nextFn: NextFunction & ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nextFn = vi.fn() as NextFunction & ReturnType<typeof vi.fn>;
    vi.clearAllMocks();
    mockApp.mockReturnValue(true);
    mockIsTokenRevoked.mockResolvedValue(false);
  });

  describe("Unauthenticated requests are rejected (401)", () => {
    it("rejects when no Authorization header is present", async () => {
      mockApp.mockReturnValue(true);
      const req = mockReq({});
      const res = mockRes();

      await requireAuth(req, res, nextFn);

      expect(nextFn).toHaveBeenCalledOnce();
      const err = nextFn.mock.calls[0][0];
      expect(err).toBeInstanceOf(AuthError);
      expect(err.statusCode).toBe(401);
      expect(err.error_code).toBe("AUTH_MISSING_001");
    });

    it("rejects when Authorization header has empty Bearer token", async () => {
      mockApp.mockReturnValue(true);
      const req = mockReq({ authorization: "Bearer " });
      const res = mockRes();

      await requireAuth(req, res, nextFn);

      expect(nextFn).toHaveBeenCalledOnce();
      const err = nextFn.mock.calls[0][0];
      expect(err).toBeInstanceOf(AuthError);
      expect(err.statusCode).toBe(401);
    });

    it("rejects when Authorization header has no Bearer prefix", async () => {
      mockApp.mockReturnValue(true);
      const req = mockReq({ authorization: "Basic dXNlcjpwYXNz" });
      const res = mockRes();

      await requireAuth(req, res, nextFn);

      expect(nextFn).toHaveBeenCalledOnce();
      const err = nextFn.mock.calls[0][0];
      expect(err).toBeInstanceOf(AuthError);
      expect(err.statusCode).toBe(401);
    });

    it("rejects when Authorization header uses wrong case", async () => {
      mockApp.mockReturnValue(true);
      const req = mockReq({ authorization: "bearer valid-token" });
      const res = mockRes();

      await requireAuth(req, res, nextFn);

      const err = nextFn.mock.calls[0][0];
      expect(err).toBeInstanceOf(AuthError);
      expect(err.statusCode).toBe(401);
    });
  });

  describe("Expired/invalid tokens fail (401)", () => {
    it("rejects expired tokens", async () => {
      mockApp.mockReturnValue(true);
      mockVerifyIdToken.mockRejectedValue(new Error("Token expired"));

      const req = mockReq({ authorization: "Bearer expired-token-abc123" });
      const res = mockRes();

      await requireAuth(req, res, nextFn);

      expect(nextFn).toHaveBeenCalledOnce();
      const err = nextFn.mock.calls[0][0];
      expect(err).toBeInstanceOf(AuthError);
      expect(err.statusCode).toBe(401);
      expect(err.error_code).toBe("AUTH_INVALID_001");
    });

    it("rejects malformed tokens", async () => {
      mockApp.mockReturnValue(true);
      mockVerifyIdToken.mockRejectedValue(new Error("Decoding error"));

      const req = mockReq({ authorization: "Bearer not.a.valid.jwt.token" });
      const res = mockRes();

      await requireAuth(req, res, nextFn);

      const err = nextFn.mock.calls[0][0];
      expect(err).toBeInstanceOf(AuthError);
      expect(err.statusCode).toBe(401);
    });

    it("rejects revoked tokens", async () => {
      mockApp.mockReturnValue(true);
      mockVerifyIdToken.mockRejectedValue(
        new Error("Firebase ID token has been revoked"),
      );

      const req = mockReq({ authorization: "Bearer revoked-token" });
      const res = mockRes();

      await requireAuth(req, res, nextFn);

      const err = nextFn.mock.calls[0][0];
      expect(err).toBeInstanceOf(AuthError);
      expect(err.statusCode).toBe(401);
    });
  });

  describe("Firebase Admin not configured = fail-closed (500)", () => {
    it("returns 500 InternalError when Firebase Admin SDK is not initialized", async () => {
      mockApp.mockImplementation(() => {
        throw new Error("No Firebase app");
      });

      const req = mockReq({ authorization: "Bearer valid-token" });
      const res = mockRes();

      await requireAuth(req, res, nextFn);

      expect(nextFn).toHaveBeenCalledOnce();
      const err = nextFn.mock.calls[0][0];
      expect(err).toBeInstanceOf(InternalError);
      expect(err.statusCode).toBe(500);
      expect(err.error_code).toBe("AUTH_CONFIG_001");
    });

    it("never falls back to a bypass mode when Firebase is down", async () => {
      mockApp.mockImplementation(() => {
        throw new Error("Firebase unavailable");
      });

      const req = mockReq({ authorization: "Bearer any-token" });
      const res = mockRes();

      await requireAuth(req, res, nextFn);

      // Must call next with an error (not next() with no args)
      const errArg = nextFn.mock.calls[0][0];
      expect(errArg).toBeDefined();
      expect(errArg).toBeInstanceOf(InternalError);
    });
  });

  describe("No JWT_SECRET bypass in codebase", () => {
    it("requireAuth source code does not reference JWT_SECRET or jsonwebtoken", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const middlewarePath = path.resolve(
        __dirname,
        "../../middleware/requireAuth.ts",
      );
      const content = fs.readFileSync(middlewarePath, "utf-8");

      expect(content).not.toContain("JWT_SECRET");
      expect(content).not.toContain("jsonwebtoken");
      expect(content).not.toContain("jwt.sign");
      expect(content).not.toContain("jwt.verify");
    });
  });

  describe("User profile resolution from SQL", () => {
    it("authenticates valid token and resolves user profile", async () => {
      mockApp.mockReturnValue(true);
      mockVerifyIdToken.mockResolvedValue({
        uid: "firebase-uid-security-001",
        email: "driver@security-test.com",
      });
      mockResolvePrincipal.mockResolvedValue({
        id: "user-security-001",
        tenantId: "company-security-001",
        companyId: "company-security-001",
        role: "driver",
        email: "driver@security-test.com",
        firebaseUid: "firebase-uid-security-001",
      });

      const req = mockReq({ authorization: "Bearer valid-token-abc123" });
      const res = mockRes();

      await requireAuth(req, res, nextFn);

      expect(nextFn).toHaveBeenCalledOnce();
      expect(nextFn.mock.calls[0][0]).toBeUndefined();

      const authReq = req as unknown as AuthenticatedRequest;
      expect(authReq.user).toBeDefined();
      expect(authReq.user!.uid).toBe("user-security-001");
      expect(authReq.user!.tenantId).toBe("company-security-001");
      expect(authReq.user!.role).toBe("driver");
      expect(authReq.user!.firebaseUid).toBe("firebase-uid-security-001");
    });

    it("rejects when Firebase UID has no linked user profile (orphan)", async () => {
      mockApp.mockReturnValue(true);
      mockVerifyIdToken.mockResolvedValue({
        uid: "firebase-uid-orphan",
        email: "orphan@test.com",
      });

      mockResolvePrincipal.mockResolvedValue(null);

      const req = mockReq({ authorization: "Bearer valid-but-orphan" });
      const res = mockRes();

      await requireAuth(req, res, nextFn);

      expect(nextFn).toHaveBeenCalledOnce();
      const err = nextFn.mock.calls[0][0];
      expect(err).toBeInstanceOf(AuthError);
      expect(err.error_code).toBe("AUTH_NO_PROFILE_001");
    });
  });

  describe("Auth + Tenant middleware chain", () => {
    it("tenant check fails when auth middleware was not called first", () => {
      const req = mockReq({});
      // No user attached (requireAuth was skipped)
      const res = mockRes();

      requireTenant(req, res, nextFn);

      const err = nextFn.mock.calls[0][0];
      expect(err).toBeInstanceOf(ForbiddenError);
    });

    it("authenticated user with correct tenant passes both middleware", async () => {
      // Step 1: requireAuth
      mockApp.mockReturnValue(true);
      mockVerifyIdToken.mockResolvedValue({
        uid: "fb-uid-chain-001",
        email: "user@chain.com",
      });

      mockResolvePrincipal.mockResolvedValue({
        id: "user-chain-001",
        tenantId: "company-chain-001",
        companyId: "company-chain-001",
        role: "dispatcher",
        email: "user@chain.com",
        firebaseUid: "fb-uid-chain-001",
      });

      const req = {
        headers: { authorization: "Bearer chain-token" },
        params: { companyId: "company-chain-001" },
        body: {},
      } as unknown as Request;
      const res = mockRes();

      // Run requireAuth
      const authNext = vi.fn() as NextFunction & ReturnType<typeof vi.fn>;
      await requireAuth(req, res, authNext);

      expect(authNext).toHaveBeenCalledOnce();
      expect(authNext.mock.calls[0][0]).toBeUndefined();

      // Run requireTenant
      const tenantNext = vi.fn() as NextFunction & ReturnType<typeof vi.fn>;
      requireTenant(req, res, tenantNext);

      expect(tenantNext).toHaveBeenCalledOnce();
      expect(tenantNext.mock.calls[0][0]).toBeUndefined();
    });

    it("authenticated user accessing wrong tenant is blocked by requireTenant", async () => {
      mockApp.mockReturnValue(true);
      mockVerifyIdToken.mockResolvedValue({
        uid: "fb-uid-chain-002",
        email: "user@chain.com",
      });

      mockResolvePrincipal.mockResolvedValue({
        id: "user-chain-002",
        tenantId: "company-chain-001",
        companyId: "company-chain-001",
        role: "dispatcher",
        email: "user@chain.com",
        firebaseUid: "fb-uid-chain-002",
      });

      const req = {
        headers: { authorization: "Bearer chain-token-2" },
        params: { companyId: "company-DIFFERENT" },
        body: {},
      } as unknown as Request;
      const res = mockRes();

      // Auth passes
      const authNext = vi.fn() as NextFunction & ReturnType<typeof vi.fn>;
      await requireAuth(req, res, authNext);
      expect(authNext.mock.calls[0][0]).toBeUndefined();

      // Tenant check blocks
      const tenantNext = vi.fn() as NextFunction & ReturnType<typeof vi.fn>;
      requireTenant(req, res, tenantNext);

      const err = tenantNext.mock.calls[0][0];
      expect(err).toBeInstanceOf(ForbiddenError);
      expect(err.statusCode).toBe(403);
    });
  });
});
