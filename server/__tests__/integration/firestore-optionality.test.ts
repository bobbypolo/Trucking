/**
 * Firestore Optionality Integration Test -- STORY-004
 *
 * Verifies that Firestore unavailability (proxy throws) never blocks
 * login-critical or registration-critical paths.
 *
 * R-marker: Tests R-P4-01, R-P4-02, R-P4-03
 *
 * Strategy:
 *   - Firebase Admin SDK is mocked (no serviceAccount.json required)
 *   - Firestore is mocked to throw on every method call
 *   - MySQL operations use real Docker MySQL (for R-P4-01 / real login path)
 *   - mirrorUserToFirestore is imported directly from sql-auth for R-P4-02
 *   - loadCompanyConfig is tested via POST /api/auth/login with Firestore down (R-P4-03)
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
// Mocks -- declared with vi.hoisted so they are available before vi.mock runs
// ---------------------------------------------------------------------------
const {
  mockVerifyIdToken,
  mockAdminApp,
  mockAdminAuth,
  mockFirestoreGet,
  mockFirestoreSet,
  mockFirestoreDoc,
  mockFirestoreCollection,
  mockLoggerWarn,
  mockLoggerInfo,
  mockLoggerError,
  mockLoggerDebug,
  mockLoggerChild,
} = vi.hoisted(() => {
  const mockLoggerWarn = vi.fn();
  const mockLoggerInfo = vi.fn();
  const mockLoggerError = vi.fn();
  const mockLoggerDebug = vi.fn();
  const mockLoggerChild = vi.fn();

  return {
    mockVerifyIdToken: vi.fn(),
    mockAdminApp: vi.fn(),
    mockAdminAuth: vi.fn(),
    mockFirestoreGet: vi.fn(),
    mockFirestoreSet: vi.fn(),
    mockFirestoreDoc: vi.fn(),
    mockFirestoreCollection: vi.fn(),
    mockLoggerWarn,
    mockLoggerInfo,
    mockLoggerError,
    mockLoggerDebug,
    mockLoggerChild,
  };
});

// Mock firebase-admin -- replaces the Admin SDK entirely
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

// Mock server/auth.ts -- prevents initializeApp() side-effect on import
vi.mock("../../auth", () => ({
  default: {
    app: mockAdminApp,
    auth: mockAdminAuth,
  },
  verifyFirebaseToken: vi.fn(),
}));

// Mock Firestore -- configured per-test to either throw or return empty
vi.mock("../../firestore", () => ({
  default: {
    collection: mockFirestoreCollection,
  },
}));

// Mock logger -- captures logger.warn calls for R-P4-02 assertions
vi.mock("../../lib/logger", () => {
  const logger = {
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: mockLoggerWarn,
    debug: mockLoggerDebug,
    child: mockLoggerChild,
  };
  // child() returns itself to support createChildLogger chaining
  mockLoggerChild.mockReturnValue(logger);
  return {
    logger,
    createChildLogger: () => logger,
    createRequestLogger: () => logger,
  };
});

// Auto-provision flag: always enabled in integration tests to preserve
// pre-existing login behavior (S-4.1 added this flag, default false).
vi.mock("../../lib/env", () => ({
  isAutoProvisionEnabled: () => true,
  validateEnv: vi.fn(),
  getCorsOrigin: vi.fn().mockReturnValue("*"),
}));

// ---------------------------------------------------------------------------
// Imports -- after mocks are declared
// ---------------------------------------------------------------------------
import { mirrorUserToFirestore, type UserWriteInput } from "../../lib/sql-auth";
import { closePool } from "../../db";
import usersRouter from "../../routes/users";
import { errorHandler } from "../../middleware/errorHandler";

// ---------------------------------------------------------------------------
// Dev user seeded by STORY-002
// ---------------------------------------------------------------------------
const DEV_FIREBASE_UID = "devUid0000000000000000000001";

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
// Helper: configure Firestore mock to throw on all access
// ---------------------------------------------------------------------------
function setFirestoreToThrow(): void {
  const firestoreError = new Error(
    "Firestore is not available -- serviceAccount.json is missing",
  );
  mockFirestoreGet.mockRejectedValue(firestoreError);
  mockFirestoreSet.mockRejectedValue(firestoreError);
  mockFirestoreDoc.mockReturnValue({
    get: mockFirestoreGet,
    set: mockFirestoreSet,
  });
  mockFirestoreCollection.mockReturnValue({
    doc: mockFirestoreDoc,
  });
}

// ---------------------------------------------------------------------------
// Helper: configure Firestore mock to return empty (no doc)
// ---------------------------------------------------------------------------
function setFirestoreToReturnEmpty(): void {
  mockFirestoreGet.mockResolvedValue({ exists: false, data: () => null });
  mockFirestoreSet.mockResolvedValue(undefined);
  mockFirestoreDoc.mockReturnValue({
    get: mockFirestoreGet,
    set: mockFirestoreSet,
  });
  mockFirestoreCollection.mockReturnValue({
    doc: mockFirestoreDoc,
  });
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
// R-P4-01: /api/auth/login returns 200 with {user, company: null} when
//          Firestore is unreachable (proxy throws on collection().doc().get())
// ---------------------------------------------------------------------------
describe("R-P4-01: /api/auth/login succeeds when Firestore is unreachable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-bind child mock after clearAllMocks
    mockLoggerChild.mockReturnValue({
      info: mockLoggerInfo,
      error: mockLoggerError,
      warn: mockLoggerWarn,
      debug: mockLoggerDebug,
      child: mockLoggerChild,
    });
    // Configure Firebase Admin mocks
    mockAdminApp.mockReturnValue({ name: "[DEFAULT]" });
    mockVerifyIdToken.mockResolvedValue({
      uid: DEV_FIREBASE_UID,
      email: "admin@loadpilot.com",
    });
    mockAdminAuth.mockReturnValue({ verifyIdToken: mockVerifyIdToken });
    // Firestore THROWS
    setFirestoreToThrow();
  });

  it("returns 200 with {user, company} shape where company is null when Firestore throws", async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post("/api/auth/login")
      .set("Authorization", "Bearer mock-valid-token")
      .send({ firebaseUid: DEV_FIREBASE_UID });

    // Login must succeed -- Firestore down must not block authentication
    expect(res.status).toBe(200);

    // Response must have "user" key
    expect(res.body).toHaveProperty("user");
    expect(res.body.user).toBeTruthy();

    // user must have expected fields from SQL
    const { user } = res.body;
    expect(typeof user.id).toBe("string");
    expect(user.id.length).toBeGreaterThan(0);
    expect(typeof user.email).toBe("string");
    expect(user.email).toContain("@");

    // Response must have "company" key -- value MUST be null when Firestore throws
    expect("company" in res.body).toBe(true);
    expect(res.body.company).toBeNull();
  }, 15000);

  it("Firestore collection was invoked proving the try/catch path ran", async () => {
    const app = buildTestApp();
    await request(app)
      .post("/api/auth/login")
      .set("Authorization", "Bearer mock-valid-token")
      .send({ firebaseUid: DEV_FIREBASE_UID });

    // Verify that Firestore was actually invoked (not bypassed)
    expect(mockFirestoreCollection).toHaveBeenCalled();
  }, 15000);
});

// ---------------------------------------------------------------------------
// R-P4-02: mirrorUserToFirestore() logs logger.warn with "Firestore user
//          mirror failed" and does NOT propagate the error to the caller.
// ---------------------------------------------------------------------------
describe("R-P4-02: mirrorUserToFirestore() swallows Firestore error and logs warning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-bind child mock after clearAllMocks
    mockLoggerChild.mockReturnValue({
      info: mockLoggerInfo,
      error: mockLoggerError,
      warn: mockLoggerWarn,
      debug: mockLoggerDebug,
      child: mockLoggerChild,
    });
    // Firestore THROWS on set()
    setFirestoreToThrow();
  });

  const testInput: UserWriteInput = {
    id: "test-user-mirror-r-p4-02",
    companyId: "test-company-001",
    email: "mirror-test@loadpilot.com",
    name: "Mirror Test User",
    role: "driver",
    firebaseUid: DEV_FIREBASE_UID,
  };

  it("does not throw when Firestore.set() throws", async () => {
    let threwError = false;
    try {
      await mirrorUserToFirestore(testInput);
    } catch {
      threwError = true;
    }
    expect(threwError).toBe(false);
  });

  it("resolves to undefined (void) even when Firestore.set() throws", async () => {
    const result = await mirrorUserToFirestore(testInput);
    expect(result).toBeUndefined();
  });

  it("calls logger.warn with message containing Firestore user mirror failed", async () => {
    await mirrorUserToFirestore(testInput);

    // logger.warn must have been called at least once
    expect(mockLoggerWarn).toHaveBeenCalled();

    // At least one warn call must include the expected message substring.
    // pino uses logger.warn(obj, messageString) so the message is the last arg.
    const allWarnArgs = mockLoggerWarn.mock.calls as unknown[][];
    const hasExpectedMessage = allWarnArgs.some((callArgs) => {
      return callArgs.some(
        (arg) =>
          typeof arg === "string" &&
          arg.includes("Firestore user mirror failed"),
      );
    });

    expect(hasExpectedMessage).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// R-P4-03: loadCompanyConfig() returns null when Firestore throws.
//          Tested via POST /api/auth/login -- the route calls loadCompanyConfig
//          and must return { company: null } in the response.
// ---------------------------------------------------------------------------
describe("R-P4-03: loadCompanyConfig() returns null (not throws) when Firestore throws", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-bind child mock after clearAllMocks
    mockLoggerChild.mockReturnValue({
      info: mockLoggerInfo,
      error: mockLoggerError,
      warn: mockLoggerWarn,
      debug: mockLoggerDebug,
      child: mockLoggerChild,
    });
    mockAdminApp.mockReturnValue({ name: "[DEFAULT]" });
    mockVerifyIdToken.mockResolvedValue({
      uid: DEV_FIREBASE_UID,
      email: "admin@loadpilot.com",
    });
    mockAdminAuth.mockReturnValue({ verifyIdToken: mockVerifyIdToken });
  });

  it("response.company is null (not throws) when Firestore.get() throws", async () => {
    // Firestore THROWS on get()
    setFirestoreToThrow();

    const app = buildTestApp();
    const res = await request(app)
      .post("/api/auth/login")
      .set("Authorization", "Bearer mock-valid-token")
      .send({ firebaseUid: DEV_FIREBASE_UID });

    // Must succeed -- company config failure must not fail the request
    expect(res.status).toBe(200);

    // company must be null -- loadCompanyConfig catches the error and returns null
    expect(res.body.company).toBeNull();
  }, 15000);

  it("response.company is null when doc.exists is false (company not found in Firestore)", async () => {
    // Firestore returns empty (exists: false) -- simulates missing company document
    setFirestoreToReturnEmpty();

    const app = buildTestApp();
    const res = await request(app)
      .post("/api/auth/login")
      .set("Authorization", "Bearer mock-valid-token")
      .send({ firebaseUid: DEV_FIREBASE_UID });

    expect(res.status).toBe(200);
    // When doc.exists is false, loadCompanyConfig returns null
    expect(res.body.company).toBeNull();
  }, 15000);
});
