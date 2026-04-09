import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for S-2.3: Company record creation in signup.
 *
 * R-P2-08: Signup handler creates company record in MySQL in addition to Firestore
 * R-P2-09: GET /api/companies/{id} returns 200 after signup — no more 404
 */

// Hoisted mocks
const {
  mockPoolQuery,
  mockVerifyIdToken,
  mockApp,
  mockFirestoreGet,
  mockFirestoreSet,
  mockFirestoreDoc,
  mockFirestoreCollection,
  mockFindSqlCompanyById,
  mockFindSqlUserById,
  mockFindSqlUsersByCompany,
  mockLinkSqlUserToFirebaseUid,
  mockMapCompanyRowToApiCompany,
  mockMapUserRowToApiUser,
  mockMirrorCompanyToFirestore,
  mockMirrorUserToFirestore,
  mockResolveSqlPrincipalByFirebaseUid,
  mockUpsertSqlUser,
  mockEnsureMySqlCompany,
} = vi.hoisted(() => ({
  mockPoolQuery: vi.fn(),
  mockVerifyIdToken: vi.fn(),
  mockApp: vi.fn(),
  mockFirestoreGet: vi.fn(),
  mockFirestoreSet: vi.fn(),
  mockFirestoreDoc: vi.fn(),
  mockFirestoreCollection: vi.fn(),
  mockFindSqlCompanyById: vi.fn(),
  mockFindSqlUserById: vi.fn(),
  mockFindSqlUsersByCompany: vi.fn(),
  mockLinkSqlUserToFirebaseUid: vi.fn(),
  mockMapCompanyRowToApiCompany: vi.fn((row: any) => ({
    id: row.id,
    name: row.name,
    account_type: row.account_type,
    email: row.email,
    subscription_status: row.subscription_status,
  })),
  mockMapUserRowToApiUser: vi.fn((row: any) => {
    if (!row) return row;
    const { password, ...rest } = row;
    return {
      ...rest,
      companyId: row.company_id,
      onboardingStatus: row.onboarding_status,
      safetyScore: row.safety_score,
      firebaseUid: row.firebase_uid,
    };
  }),
  mockMirrorCompanyToFirestore: vi.fn().mockResolvedValue(undefined),
  mockMirrorUserToFirestore: vi.fn().mockResolvedValue(undefined),
  mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
  mockUpsertSqlUser: vi.fn().mockResolvedValue(undefined),
  mockEnsureMySqlCompany: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../db", () => ({
  default: { query: mockPoolQuery },
}));

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

vi.mock("../../helpers", () => ({
  redactData: vi.fn((data: any) => data),
  getVisibilitySettings: vi.fn().mockResolvedValue({}),
}));

// Set up Firestore mock chain
vi.mock("../../firestore", () => {
  mockFirestoreDoc.mockReturnValue({
    get: mockFirestoreGet,
    set: mockFirestoreSet,
  });
  mockFirestoreCollection.mockReturnValue({
    doc: mockFirestoreDoc,
    where: vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({ docs: [] }),
      limit: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
      }),
    }),
  });
  return {
    default: {
      collection: mockFirestoreCollection,
    },
  };
});

vi.mock("firebase-admin", () => ({
  default: {
    app: mockApp,
    auth: () => ({
      verifyIdToken: mockVerifyIdToken,
    }),
  },
}));

vi.mock("../../auth", () => ({
  default: {
    app: mockApp,
    auth: () => ({
      verifyIdToken: mockVerifyIdToken,
    }),
  },
}));

vi.mock("../../lib/sql-auth", () => ({
  ensureMySqlCompany: mockEnsureMySqlCompany,
  findSqlCompanyById: mockFindSqlCompanyById,
  findSqlUserById: mockFindSqlUserById,
  findSqlUsersByCompany: mockFindSqlUsersByCompany,
  linkSqlUserToFirebaseUid: mockLinkSqlUserToFirebaseUid,
  mapCompanyRowToApiCompany: mockMapCompanyRowToApiCompany,
  mapUserRowToApiUser: mockMapUserRowToApiUser,
  mirrorCompanyToFirestore: mockMirrorCompanyToFirestore,
  mirrorUserToFirestore: mockMirrorUserToFirestore,
  resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
  upsertSqlUser: mockUpsertSqlUser,
}));

import express from "express";
import request from "supertest";
import usersRouter from "../../routes/users";
import clientsRouter from "../../routes/clients";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

const COMPANY_ID = "company-aaa";
const AUTH_HEADER = "Bearer valid-firebase-token";

function buildUsersApp() {
  const app = express();
  app.use(express.json());
  app.use(usersRouter);
  app.use(errorHandler);
  return app;
}

function buildClientsApp() {
  const app = express();
  app.use(express.json());
  app.use(clientsRouter);
  app.use(errorHandler);
  return app;
}

// ── R-P2-08: Signup handler creates company record in MySQL ─────────────────

describe("R-P2-08: Login auto-provisioning creates company in MySQL AND Firestore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApp.mockReturnValue(true);
  });

  it("calls ensureMySqlCompany and mirrorCompanyToFirestore during auto-provisioning", async () => {
    // First call: no principal found (triggers auto-provisioning)
    // Second call (after provisioning): principal found
    mockResolveSqlPrincipalByFirebaseUid
      .mockResolvedValueOnce(null) // first lookup
      .mockResolvedValueOnce(null) // after linkSqlUserToFirebaseUid
      .mockResolvedValueOnce({
        // after auto-provisioning
        id: "new-user-id",
        tenantId: "new-company-id",
        companyId: "new-company-id",
        role: "admin",
        email: "newuser@test.com",
        firebaseUid: "firebase-uid-new",
      });

    mockLinkSqlUserToFirebaseUid.mockResolvedValue(false);
    mockVerifyIdToken.mockResolvedValue({
      uid: "firebase-uid-new",
      email: "newuser@test.com",
    });

    // Pool.query for INSERT INTO companies (auto-provisioning)
    mockPoolQuery.mockResolvedValue([{ affectedRows: 1 }]);

    mockFindSqlUserById.mockResolvedValue({
      id: "new-user-id",
      company_id: "new-company-id",
      email: "newuser@test.com",
      name: "Newuser",
      role: "admin",
      onboarding_status: "Completed",
      safety_score: 100,
      firebase_uid: "firebase-uid-new",
    });

    // Firestore loadCompanyConfig
    mockFirestoreGet.mockResolvedValue({
      exists: true,
      data: () => ({ id: "new-company-id", name: "Newuser's Company" }),
    });

    const app = buildUsersApp();
    const res = await request(app)
      .post("/api/auth/login")
      .set("Authorization", AUTH_HEADER)
      .send({ firebaseUid: "firebase-uid-new" });

    // Should succeed and auto-provision
    expect(res.status).toBe(200);

    // R-P2-08: Must create MySQL company record
    expect(mockEnsureMySqlCompany).toHaveBeenCalled();

    // R-P2-08: Must also mirror company to Firestore
    expect(mockMirrorCompanyToFirestore).toHaveBeenCalled();
  });
});

// ── R-P2-09: GET /api/companies/{id} returns 200 after signup ───────────────

describe("R-P2-09: GET /api/companies/:id returns 200 — MySQL fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    mockVerifyIdToken.mockResolvedValue({ uid: "firebase-uid-1" });
  });

  it("returns 200 from Firestore when company exists there", async () => {
    mockFirestoreGet.mockResolvedValue({
      exists: true,
      data: () => ({
        id: COMPANY_ID,
        name: "Test Company",
        account_type: "fleet",
      }),
    });

    const app = buildClientsApp();
    const res = await request(app)
      .get(`/api/companies/${COMPANY_ID}`)
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(COMPANY_ID);
  });

  it("falls back to MySQL and returns 200 when Firestore has no company", async () => {
    // Firestore returns not found
    mockFirestoreGet.mockResolvedValue({
      exists: false,
      data: () => null,
    });

    // MySQL has the company record
    mockFindSqlCompanyById.mockResolvedValue({
      id: COMPANY_ID,
      name: "Test Company",
      account_type: "fleet",
      email: "test@test.com",
      subscription_status: "active",
    });

    const app = buildClientsApp();
    const res = await request(app)
      .get(`/api/companies/${COMPANY_ID}`)
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(COMPANY_ID);
    expect(mockFindSqlCompanyById).toHaveBeenCalledWith(COMPANY_ID);
  });

  it("returns 404 only when company is missing from BOTH Firestore and MySQL", async () => {
    // Firestore returns not found
    mockFirestoreGet.mockResolvedValue({
      exists: false,
      data: () => null,
    });

    // MySQL also has no record
    mockFindSqlCompanyById.mockResolvedValue(null);

    const app = buildClientsApp();
    const res = await request(app)
      .get(`/api/companies/${COMPANY_ID}`)
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(404);
  });
});
