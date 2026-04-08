import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for server/auth.ts
 *
 * auth.ts initializes Firebase Admin at module load time and exports
 * verifyFirebaseToken middleware. We need to control the initialization
 * via mocks to test all code paths.
 */

const {
  mockVerifyIdToken,
  mockResolveSqlPrincipalByFirebaseUid,
  mockInitializeApp,
  mockCert,
  mockAppDefault,
} = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
  mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
  mockInitializeApp: vi.fn(),
  mockCert: vi.fn().mockReturnValue("mock-credential"),
  mockAppDefault: vi.fn().mockReturnValue("mock-app-default"),
}));

// Mock firebase-admin (external)
vi.mock("firebase-admin", () => ({
  default: {
    initializeApp: mockInitializeApp,
    credential: {
      cert: mockCert,
      applicationDefault: mockAppDefault,
    },
    auth: () => ({
      verifyIdToken: mockVerifyIdToken,
    }),
  },
}));

// Mock sql-auth
vi.mock("../../lib/sql-auth", () => ({
  resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
}));

// Mock logger
vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child() {
      return this;
    },
  },
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  createRequestLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock dotenv
vi.mock("dotenv", () => ({
  default: { config: vi.fn() },
}));

function mockReq(headers: Record<string, string> = {}): any {
  return { headers };
}

function mockRes(): any {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("server/auth.ts — verifyFirebaseToken middleware", () => {
  describe("when Firebase Admin is NOT initialized (authReady = false)", () => {
    let verifyFirebaseToken: any;

    beforeEach(async () => {
      vi.clearAllMocks();
      vi.resetModules();

      // Clear env vars so authReady stays false
      const savedProjectId = process.env.FIREBASE_PROJECT_ID;
      const savedGoogleCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

      // Make initializeApp throw so authReady stays false
      mockInitializeApp.mockImplementation(() => {
        throw new Error("no credentials");
      });

      const mod = await import("../../auth");
      verifyFirebaseToken = mod.verifyFirebaseToken;

      // Restore env vars
      if (savedProjectId) process.env.FIREBASE_PROJECT_ID = savedProjectId;
      if (savedGoogleCreds)
        process.env.GOOGLE_APPLICATION_CREDENTIALS = savedGoogleCreds;
    });

    it("returns 500 when Firebase Admin is not initialized", async () => {
      const req = mockReq({ authorization: "Bearer valid-token" });
      const res = mockRes();
      const next = vi.fn();

      await verifyFirebaseToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining("Security Configuration Error"),
        }),
      );
    });

    it("returns 500 even with no Authorization header when authReady is false", async () => {
      const req = mockReq({});
      const res = mockRes();
      const next = vi.fn();

      await verifyFirebaseToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("when Firebase Admin IS initialized (authReady = true)", () => {
    let verifyFirebaseToken: any;

    beforeEach(async () => {
      vi.clearAllMocks();
      vi.resetModules();

      // Ensure initializeApp succeeds (reset any prior throw mock)
      mockInitializeApp.mockImplementation(() => {});

      // Set env vars so the app credentials branch runs
      process.env.FIREBASE_PROJECT_ID = "test-project";

      const mod = await import("../../auth");
      verifyFirebaseToken = mod.verifyFirebaseToken;
    });

    afterEach(() => {
      delete process.env.FIREBASE_PROJECT_ID;
    });

    it("initializes Firebase Admin with application default credentials", () => {
      expect(mockInitializeApp).toHaveBeenCalled();
    });

    it("returns 401 when no authorization header is present", async () => {
      const req = mockReq({});
      const res = mockRes();
      const next = vi.fn();

      await verifyFirebaseToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining("Token missing"),
        }),
      );
    });

    it("returns 401 when token is empty after Bearer", async () => {
      const req = mockReq({ authorization: "Bearer " });
      const res = mockRes();
      const next = vi.fn();

      await verifyFirebaseToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("returns 403 when Firebase verifyIdToken fails (expired/invalid)", async () => {
      mockVerifyIdToken.mockRejectedValue(new Error("Token expired"));

      const req = mockReq({ authorization: "Bearer expired-token" });
      const res = mockRes();
      const next = vi.fn();

      await verifyFirebaseToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining("Invalid or expired"),
        }),
      );
    });

    it("returns 403 when verified Firebase UID has no SQL user record", async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: "orphan-uid",
        email: "orphan@test.com",
      });
      mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(null);

      const req = mockReq({ authorization: "Bearer valid-token" });
      const res = mockRes();
      const next = vi.fn();

      await verifyFirebaseToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining("no linked LoadPilot account"),
        }),
      );
    });

    it("calls next() with req.user on successful auth", async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: "firebase-uid-456",
        email: "admin@test.com",
      });
      mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
        id: "user-123",
        tenantId: "company-abc",
        companyId: "company-abc",
        role: "admin",
        email: "admin@test.com",
        firebaseUid: "firebase-uid-456",
      });

      const req = mockReq({ authorization: "Bearer valid-token" });
      const res = mockRes();
      const next = vi.fn();

      await verifyFirebaseToken(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe("user-123");
      expect(req.user.uid).toBe("user-123");
      expect(req.user.tenantId).toBe("company-abc");
      expect(req.user.companyId).toBe("company-abc");
      expect(req.user.role).toBe("admin");
      expect(req.user.email).toBe("admin@test.com");
      expect(req.user.firebaseUid).toBe("firebase-uid-456");
    });

    it("uses decodedToken.uid as fallback when principal.firebaseUid is empty", async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: "decoded-uid-789",
        email: "driver@test.com",
      });
      mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
        id: "user-456",
        tenantId: "company-xyz",
        companyId: "company-xyz",
        role: "driver",
        email: "driver@test.com",
        firebaseUid: "", // empty
      });

      const req = mockReq({ authorization: "Bearer valid-token" });
      const res = mockRes();
      const next = vi.fn();

      await verifyFirebaseToken(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.user.firebaseUid).toBe("decoded-uid-789");
    });

    it("passes the token (not the full header) to verifyIdToken", async () => {
      mockVerifyIdToken.mockResolvedValue({ uid: "test-uid" });
      mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
        id: "u1",
        tenantId: "t1",
        companyId: "t1",
        role: "admin",
        email: "a@b.com",
        firebaseUid: "test-uid",
      });

      const req = mockReq({ authorization: "Bearer my-actual-token" });
      const res = mockRes();
      const next = vi.fn();

      await verifyFirebaseToken(req, res, next);

      expect(mockVerifyIdToken).toHaveBeenCalledWith("my-actual-token");
    });
  });

  describe("when Firebase initializeApp throws during module load", () => {
    it("sets authReady to false and returns 500 on requests", async () => {
      vi.clearAllMocks();
      vi.resetModules();

      // Make initializeApp throw
      mockInitializeApp.mockImplementation(() => {
        throw new Error("Firebase init failed");
      });
      process.env.FIREBASE_PROJECT_ID = "test-project";

      const mod = await import("../../auth");
      const verifyFirebaseToken = mod.verifyFirebaseToken;

      const req = mockReq({ authorization: "Bearer token" });
      const res = mockRes();
      const next = vi.fn();

      await verifyFirebaseToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);

      delete process.env.FIREBASE_PROJECT_ID;
      mockInitializeApp.mockReset();
    });
  });

  describe("Module exports", () => {
    it("exports default as firebase admin module", async () => {
      const mod = await import("../../auth");
      expect(mod.default).toBeDefined();
    });

    it("exports verifyFirebaseToken as named export", async () => {
      const mod = await import("../../auth");
      expect(mod.verifyFirebaseToken).toBeDefined();
      expect(typeof mod.verifyFirebaseToken).toBe("function");
    });
  });

});

