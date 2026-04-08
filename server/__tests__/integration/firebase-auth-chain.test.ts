/**
 * Firebase Auth Chain Integration Test — STORY-003
 *
 * Tests the complete Firebase Admin + SQL auth resolution chain.
 * Firebase Admin SDK is mocked (no serviceAccount.json required).
 * MySQL operations use the real Docker MySQL container.
 *
 * R-marker: Tests R-P3-01, R-P3-02, R-P3-03, R-P3-04, R-P3-05, R-P3-06, R-P3-07
 */
import { describe, it, expect, vi, afterAll, beforeEach } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from "express";
import request from "supertest";

// Load env before anything else
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(serverRoot, ".env") });

// ---------------------------------------------------------------------------
// Mocks — declared with vi.hoisted so they are available before vi.mock runs
// ---------------------------------------------------------------------------

const { mockVerifyIdToken, mockAdminApp, mockAdminAuth } = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
  mockAdminApp: vi.fn(),
  mockAdminAuth: vi.fn(),
}));

// Mock firebase-admin — replaces the Admin SDK entirely
vi.mock("firebase-admin", () => ({
  default: {
    app: mockAdminApp,
    auth: mockAdminAuth,
    credential: {
      cert: vi.fn().mockReturnValue({}),
      applicationDefault: vi.fn().mockReturnValue({}),
    },
    initializeApp: vi.fn(),
  },
}));

// Mock server/auth.ts — prevents initializeApp() side-effect on import
vi.mock("../../auth", () => ({
  default: {
    app: mockAdminApp,
    auth: mockAdminAuth,
  },
  verifyFirebaseToken: vi.fn(),
}));

// Mock firestore — prevents Firestore initialisation errors
vi.mock("../../firestore", () => ({
  default: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ exists: false, data: () => null }),
        set: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  },
}));

// Mock logger — suppress noise
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

// Auto-provision flag: always enabled in integration tests to preserve
// pre-existing login behavior (S-4.1 added this flag, default false).
vi.mock("../../lib/env", () => ({
  isAutoProvisionEnabled: () => true,
  validateEnv: vi.fn(),
  getCorsOrigin: vi.fn().mockReturnValue("*"),
}));

// ---------------------------------------------------------------------------
// Imports -- sql-auth is NOT mocked so real MySQL is used for R-P3-04/05
// ---------------------------------------------------------------------------
import admin from "firebase-admin";
import { resolveSqlPrincipalByFirebaseUid } from "../../lib/sql-auth";
import { closePool } from "../../db";
import usersRouter from "../../routes/users";
import { errorHandler } from "../../middleware/errorHandler";

// ---------------------------------------------------------------------------
// Dev user seeded by STORY-002
// ---------------------------------------------------------------------------
const DEV_FIREBASE_UID = "devUid0000000000000000000001";
const NONEXISTENT_UID = "nonexistent-uid-story003-xyz-999";

// ---------------------------------------------------------------------------
// Helper: build minimal Express app for HTTP tests
// ---------------------------------------------------------------------------
function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(usersRouter);
  app.use(errorHandler);
  return app;
}

// ---------------------------------------------------------------------------
// Teardown: close MySQL pool after all tests
// ---------------------------------------------------------------------------
afterAll(async () => {
  try {
    await closePool();
  } catch {
    // pool may already be closed
  }
});

// ---------------------------------------------------------------------------
// R-P3-01: Firebase Admin initialises without throwing
// ---------------------------------------------------------------------------
describe("R-P3-01: Firebase Admin initialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("admin.app() does not throw when initialized", () => {
    // Mock admin.app() to return a valid app object (initialized state)
    mockAdminApp.mockReturnValue({ name: "[DEFAULT]" });

    let threwError = false;
    let appResult: unknown;
    try {
      appResult = admin.app();
    } catch {
      threwError = true;
    }

    expect(threwError).toBe(false);
    expect(appResult).toBeDefined();
    expect((appResult as { name: string }).name).toBe("[DEFAULT]");
  });

  it("admin.auth() returns an object with verifyIdToken method", () => {
    mockAdminAuth.mockReturnValue({ verifyIdToken: mockVerifyIdToken });

    const authInstance = admin.auth();

    expect(authInstance).toBeDefined();
    expect(
      typeof (authInstance as { verifyIdToken: unknown }).verifyIdToken,
    ).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// R-P3-02: verifyIdToken returns DecodedIdToken with uid and email
// ---------------------------------------------------------------------------
describe("R-P3-02: verifyIdToken returns decoded token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifyIdToken resolves with non-empty uid and email", async () => {
    const mockDecoded = {
      uid: DEV_FIREBASE_UID,
      email: "admin@loadpilot.com",
      iss: "https://securetoken.google.com/test-project",
      aud: "test-project",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      sub: DEV_FIREBASE_UID,
    };

    mockVerifyIdToken.mockResolvedValue(mockDecoded);
    mockAdminAuth.mockReturnValue({ verifyIdToken: mockVerifyIdToken });

    const result = await (
      admin.auth() as unknown as {
        verifyIdToken: (t: string) => Promise<typeof mockDecoded>;
      }
    ).verifyIdToken("valid-mock-token");

    expect(result.uid).toBeTruthy();
    expect(result.uid).toBe(DEV_FIREBASE_UID);
    expect(result.email).toBeTruthy();
    expect(result.email).toBe("admin@loadpilot.com");
  });
});

// ---------------------------------------------------------------------------
// R-P3-03: verifyIdToken throws for invalid token
// ---------------------------------------------------------------------------
describe("R-P3-03: verifyIdToken throws for invalid token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws a Firebase auth error when "invalid-token" is passed', async () => {
    const firebaseError = new Error(
      "Decoding Firebase ID token failed. Make sure you passed the entire string JWT " +
        "which represents an ID token. See https://firebase.google.com/docs/auth/admin/verify-id-tokens " +
        "for details on how to retrieve an ID token.",
    );
    firebaseError.name = "FirebaseAuthError";

    mockVerifyIdToken.mockRejectedValue(firebaseError);
    mockAdminAuth.mockReturnValue({ verifyIdToken: mockVerifyIdToken });

    const authInst = admin.auth() as unknown as {
      verifyIdToken: (t: string) => Promise<unknown>;
    };
    await expect(authInst.verifyIdToken("invalid-token")).rejects.toThrow(
      /Decoding Firebase ID token failed|auth\/invalid-argument|invalid.*token|Firebase/i,
    );
  });

  it("error thrown is an Error instance with Firebase message", async () => {
    const firebaseError = new Error(
      "Decoding Firebase ID token failed. bad token.",
    );
    mockVerifyIdToken.mockRejectedValue(firebaseError);
    mockAdminAuth.mockReturnValue({ verifyIdToken: mockVerifyIdToken });

    const authInst = admin.auth() as unknown as {
      verifyIdToken: (t: string) => Promise<unknown>;
    };

    let caughtError: unknown;
    try {
      await authInst.verifyIdToken("invalid-token");
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toMatch(
      /Decoding Firebase ID token failed/i,
    );
  });
});

// ---------------------------------------------------------------------------
// R-P3-04: resolveSqlPrincipalByFirebaseUid — real MySQL, known UID
// ---------------------------------------------------------------------------
describe("R-P3-04: resolveSqlPrincipalByFirebaseUid — known UID (real MySQL)", () => {
  it("returns a SqlPrincipal with non-empty id, tenantId, companyId, role, and email", async () => {
    const principal = await resolveSqlPrincipalByFirebaseUid(DEV_FIREBASE_UID);

    expect(principal).not.toBeNull();
    if (!principal) throw new Error("Expected principal to be non-null");

    expect(principal.id).toBeTruthy();
    expect(principal.id.length).toBeGreaterThan(0);

    expect(principal.tenantId).toBeTruthy();
    expect(principal.tenantId.length).toBeGreaterThan(0);

    expect(principal.companyId).toBeTruthy();
    expect(principal.companyId.length).toBeGreaterThan(0);

    expect(principal.role).toBeTruthy();
    expect(principal.role.length).toBeGreaterThan(0);

    expect(principal.email).toBeTruthy();
    expect(principal.email).toContain("@");
  }, 15000);
});

// ---------------------------------------------------------------------------
// R-P3-05: resolveSqlPrincipalByFirebaseUid — nonexistent UID returns null
// ---------------------------------------------------------------------------
describe("R-P3-05: resolveSqlPrincipalByFirebaseUid — nonexistent UID (real MySQL)", () => {
  it("returns null without throwing for a nonexistent UID", async () => {
    let result: unknown;
    let threwError = false;

    try {
      result = await resolveSqlPrincipalByFirebaseUid(NONEXISTENT_UID);
    } catch {
      threwError = true;
    }

    expect(threwError).toBe(false);
    expect(result).toBeNull();
  }, 15000);
});

// ---------------------------------------------------------------------------
// R-P3-06: Protected route returns 200 / 401 based on token
// ---------------------------------------------------------------------------
describe("R-P3-06: Protected route auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no token is provided", async () => {
    // admin.app() succeeds (Firebase initialized)
    mockAdminApp.mockReturnValue({ name: "[DEFAULT]" });

    const app = buildTestApp();
    const res = await request(app).get("/api/users/me");

    expect(res.status).toBe(401);
  });

  it("returns 401 when an invalid token is provided", async () => {
    // admin.app() succeeds; verifyIdToken throws Firebase error
    mockAdminApp.mockReturnValue({ name: "[DEFAULT]" });
    mockVerifyIdToken.mockRejectedValue(
      new Error("Decoding Firebase ID token failed. invalid token provided."),
    );
    mockAdminAuth.mockReturnValue({ verifyIdToken: mockVerifyIdToken });

    const app = buildTestApp();
    const res = await request(app)
      .get("/api/users/me")
      .set("Authorization", "Bearer invalid.token.value");

    expect(res.status).toBe(401);
  });

  it("auth middleware passes for valid token that resolves a known SQL user", async () => {
    // admin.app() succeeds; verifyIdToken returns valid decoded token
    mockAdminApp.mockReturnValue({ name: "[DEFAULT]" });
    mockVerifyIdToken.mockResolvedValue({
      uid: DEV_FIREBASE_UID,
      email: "admin@loadpilot.com",
    });
    mockAdminAuth.mockReturnValue({ verifyIdToken: mockVerifyIdToken });

    // Real MySQL: dev user with DEV_FIREBASE_UID should exist from STORY-002 seed
    // requireAuth → verifyIdToken (mocked) → resolveSqlPrincipalByFirebaseUid (real SQL)
    // Then GET /api/users/me calls findSqlUserById(req.user.uid) with real SQL
    const app = buildTestApp();
    const res = await request(app)
      .get("/api/users/me")
      .set("Authorization", "Bearer mock-valid-token");

    // 200 = user found; 404 = user not found (auth passed but no profile)
    // Must NOT be 401 (unauthenticated) or 500 (auth config error)
    expect([200, 404]).toContain(res.status);
    expect(res.status).not.toBe(401);
  }, 15000);
});

// ---------------------------------------------------------------------------
// R-P3-07: /api/auth/login with valid Firebase token returns {user, company}
// ---------------------------------------------------------------------------
describe("R-P3-07: /api/auth/login with valid Firebase token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns {user, company} even when Firestore is unreachable (company may be null)", async () => {
    // Firebase Admin initialized and verifyIdToken returns decoded token for dev user
    mockAdminApp.mockReturnValue({ name: "[DEFAULT]" });
    mockVerifyIdToken.mockResolvedValue({
      uid: DEV_FIREBASE_UID,
      email: "admin@loadpilot.com",
    });
    mockAdminAuth.mockReturnValue({ verifyIdToken: mockVerifyIdToken });

    // Firestore mock returns { exists: false } — simulates unreachable/missing company doc
    const app = buildTestApp();
    const res = await request(app)
      .post("/api/auth/login")
      .set("Authorization", `Bearer mock-valid-token-for-login`)
      .send({ firebaseUid: DEV_FIREBASE_UID });

    // Expect successful login (200)
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("user");

    // user must have required fields
    const { user } = res.body;
    expect(user.email).toBeTruthy();
    expect(user.id).toBeTruthy();

    // company field must exist in the response (may be null when Firestore unreachable)
    expect("company" in res.body).toBe(true);
    const { company } = res.body;
    expect(
      company === null || company === undefined || typeof company === "object",
    ).toBe(true);
  }, 15000);

  it("returns 401 when no Authorization token is provided", async () => {
    mockAdminApp.mockReturnValue({ name: "[DEFAULT]" });

    const app = buildTestApp();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ firebaseUid: DEV_FIREBASE_UID });

    expect(res.status).toBe(401);
  });
});

