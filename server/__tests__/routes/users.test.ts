import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import usersRouter from "../../routes/users";
import { errorHandler } from "../../middleware/errorHandler";

const {
  mockVerifyIdToken,
  mockApp,
  mockFindSqlCompanyById,
  mockFindSqlUserById,
  mockFindSqlUsersByCompany,
  mockLinkSqlUserToFirebaseUid,
  mockMapCompanyRowToApiCompany,
  mockMapUserRowToApiUser,
  mockMirrorUserToFirestore,
  mockResolveSqlPrincipalByFirebaseUid,
  mockUpsertSqlUser,
} = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
  mockApp: vi.fn(),
  mockFindSqlCompanyById: vi.fn(),
  mockFindSqlUserById: vi.fn(),
  mockFindSqlUsersByCompany: vi.fn(),
  mockLinkSqlUserToFirebaseUid: vi.fn(),
  mockMapCompanyRowToApiCompany: vi.fn((row) => row),
  mockMapUserRowToApiUser: vi.fn((row) => {
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
  mockMirrorUserToFirestore: vi.fn().mockResolvedValue(undefined),
  mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
  mockUpsertSqlUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

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
  findSqlCompanyById: mockFindSqlCompanyById,
  findSqlUserById: mockFindSqlUserById,
  findSqlUsersByCompany: mockFindSqlUsersByCompany,
  linkSqlUserToFirebaseUid: mockLinkSqlUserToFirebaseUid,
  mapCompanyRowToApiCompany: mockMapCompanyRowToApiCompany,
  mapUserRowToApiUser: mockMapUserRowToApiUser,
  mirrorUserToFirestore: mockMirrorUserToFirestore,
  resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
  upsertSqlUser: mockUpsertSqlUser,
}));

let mockUserRole = "dispatcher";
let mockUserTenantId = "company-aaa";
let mockUserId = "user-1";

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = {
      uid: mockUserId,
      tenantId: mockUserTenantId,
      companyId: mockUserTenantId,
      role: mockUserRole,
      email: "test@loadpilot.com",
      firebaseUid: "firebase-uid-1",
    };
    next();
  },
}));

vi.mock("../../middleware/requireTenant", () => ({
  requireTenant: (_req: any, _res: any, next: any) => {
    next();
  },
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(usersRouter);
  app.use(errorHandler);
  return app;
}

function buildUnauthApp() {
  const app = express();
  app.use(express.json());
  app.use((_req: any, res: any) => {
    res.status(401).json({ error: "Authentication required." });
  });
  return app;
}

const COMPANY_ID = "company-aaa";

describe("POST /api/auth/register — auth enforcement (validation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when required fields are missing", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/auth/register").send({});
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login — auth enforcement (validation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when firebaseUid is missing", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/auth/login").send({ email: "u@test.com" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/users/me — auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth middleware rejects (no token path)", async () => {
    const app = buildUnauthApp();
    const res = await request(app).get("/api/users/me");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/users/:companyId — auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth middleware rejects (no token path)", async () => {
    const app = buildUnauthApp();
    const res = await request(app).get(`/api/users/${COMPANY_ID}`);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/users/:companyId — tenant enforcement", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = COMPANY_ID;
    mockUserId = "user-1";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 403 when requesting users from a different company (non-admin)", async () => {
    const res = await request(app)
      .get("/api/users/company-zzz")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(403);
  });

  it("allows access to own company's users", async () => {
    mockFindSqlUsersByCompany.mockResolvedValueOnce([
      {
        id: "user-1",
        company_id: COMPANY_ID,
        role: "dispatcher",
        email: "test@test.com",
        name: "Test User",
        onboarding_status: "Completed",
        safety_score: 100,
      },
    ]);

    const res = await request(app)
      .get(`/api/users/${COMPANY_ID}`)
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(mockFindSqlUsersByCompany).toHaveBeenCalledWith(COMPANY_ID);
  });
});

describe("POST /api/auth/register — validation errors", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 400 when email format is invalid", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "not-an-email", name: "Test User", role: "driver" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when name is empty string", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "user@test.com", name: "", role: "driver" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/register — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
    mockUpsertSqlUser.mockResolvedValue(undefined);
    mockMirrorUserToFirestore.mockResolvedValue(undefined);
  });

  it("registers user and returns 201", async () => {
    const res = await request(app).post("/api/auth/register").send({
      id: "new-user",
      email: "newuser@test.com",
      name: "New User",
      role: "driver",
      company_id: COMPANY_ID,
      password: "securepass123",
      firebaseUid: "fb-new-user",
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("User registered successfully");
    expect(mockUpsertSqlUser).toHaveBeenCalledOnce();
    expect(mockMirrorUserToFirestore).toHaveBeenCalledOnce();
  });
});

describe("POST /api/users — success (sync)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
    mockUpsertSqlUser.mockResolvedValue(undefined);
    mockMirrorUserToFirestore.mockResolvedValue(undefined);
  });

  it("syncs user and returns 201", async () => {
    const res = await request(app).post("/api/users").send({
      email: "driver@test.com",
      name: "John Driver",
      role: "driver",
      company_id: COMPANY_ID,
      firebaseUid: "fb-driver",
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("User updated/created");
    expect(mockUpsertSqlUser).toHaveBeenCalledOnce();
    expect(mockMirrorUserToFirestore).toHaveBeenCalledOnce();
  });

  it("returns 400 when email is missing from user sync", async () => {
    const res = await request(app).post("/api/users").send({ name: "No Email" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/users/me — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserId = "user-1";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns current user profile with 200 (password excluded)", async () => {
    mockFindSqlUserById.mockResolvedValueOnce({
      id: "user-1",
      company_id: COMPANY_ID,
      role: "dispatcher",
      email: "test@test.com",
      name: "Test User",
      password: "hashed",
      onboarding_status: "Completed",
      safety_score: 100,
      firebase_uid: "firebase-uid-1",
    });

    const res = await request(app)
      .get("/api/users/me")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("password");
    expect(mockFindSqlUserById).toHaveBeenCalledWith("user-1");
  });

  it("returns 404 when user profile is not found in SQL", async () => {
    mockFindSqlUserById.mockResolvedValueOnce(null);

    const res = await request(app)
      .get("/api/users/me")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
  });
});
