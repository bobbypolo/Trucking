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
  createRequestLogger: () => ({
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

import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

// Default: admin principal (most tests need admin to pass role checks)
const ADMIN_PRINCIPAL = { ...DEFAULT_SQL_PRINCIPAL, role: "admin" };
const DISPATCHER_PRINCIPAL = {
  ...DEFAULT_SQL_PRINCIPAL,
  role: "dispatcher",
  email: "test@loadpilot.com",
};
const DRIVER_PRINCIPAL = {
  ...DEFAULT_SQL_PRINCIPAL,
  role: "driver",
  email: "test@loadpilot.com",
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(usersRouter);
  app.use(errorHandler);
  return app;
}

const COMPANY_ID = "company-aaa";
const AUTH_HEADER = "Bearer valid-firebase-token";

// Helper to set up principal for authenticated requests
function setupPrincipal(principal = ADMIN_PRINCIPAL) {
  mockVerifyIdToken.mockResolvedValue({ uid: "firebase-uid-1" });
  mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(principal);
}

describe("POST /api/auth/register — auth enforcement (validation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPrincipal(ADMIN_PRINCIPAL);
  });

  it("returns 400 when required fields are missing", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", AUTH_HEADER)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login — auth enforcement (validation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when firebaseUid is missing", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "u@test.com" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/users/me — auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth middleware rejects (no token path)", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/users/me");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/users/:companyId — auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth middleware rejects (no token path)", async () => {
    const app = buildApp();
    const res = await request(app).get(`/api/users/${COMPANY_ID}`);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/users/:companyId — tenant enforcement", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    setupPrincipal(DISPATCHER_PRINCIPAL);
    app = buildApp();
  });

  it("returns 403 when requesting users from a different company (non-admin)", async () => {
    const res = await request(app)
      .get("/api/users/company-zzz")
      .set("Authorization", AUTH_HEADER);

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
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(mockFindSqlUsersByCompany).toHaveBeenCalledWith(COMPANY_ID);
  });
});

describe("POST /api/auth/register — validation errors", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    setupPrincipal(ADMIN_PRINCIPAL);
    app = buildApp();
  });

  it("returns 400 when email format is invalid", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: "not-an-email",
        name: "Test User",
        role: "driver",
        password: "securepass123",
      });
    expect(res.status).toBe(400);
  });

  it("returns 400 when name is empty string", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: "user@test.com",
        name: "",
        role: "driver",
        password: "securepass123",
      });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/register — role enforcement (AUTH-01a)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();
    mockUpsertSqlUser.mockResolvedValue(undefined);
    mockMirrorUserToFirestore.mockResolvedValue(undefined);
  });

  it("returns 403 when non-admin tries to register", async () => {
    setupPrincipal(DISPATCHER_PRINCIPAL);
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: "newuser@test.com",
        name: "New User",
        role: "driver",
        password: "securepass123",
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin/i);
  });

  it("returns 403 when driver tries to register", async () => {
    setupPrincipal(DRIVER_PRINCIPAL);
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: "newuser@test.com",
        name: "New User",
        role: "driver",
        password: "securepass123",
      });
    expect(res.status).toBe(403);
  });

  it("returns 201 when admin registers a user", async () => {
    setupPrincipal(ADMIN_PRINCIPAL);
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: "newuser@test.com",
        name: "New User",
        role: "driver",
        password: "securepass123",
      });
    expect(res.status).toBe(201);
    expect(mockUpsertSqlUser).toHaveBeenCalledOnce();
  });
});

describe("POST /api/auth/register — password validation (AUTH-02)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    setupPrincipal(ADMIN_PRINCIPAL);
    app = buildApp();
  });

  it("returns 400 when password is missing", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: "newuser@test.com",
        name: "New User",
        role: "driver",
      });
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is shorter than 8 chars", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: "newuser@test.com",
        name: "New User",
        role: "driver",
        password: "short",
      });
    expect(res.status).toBe(400);
  });

  it("returns 201 when password is exactly 8 chars", async () => {
    mockUpsertSqlUser.mockResolvedValue(undefined);
    mockMirrorUserToFirestore.mockResolvedValue(undefined);
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: "newuser@test.com",
        name: "New User",
        role: "driver",
        password: "12345678",
      });
    expect(res.status).toBe(201);
  });
});

describe("POST /api/auth/register — company resolution (AUTH-03)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    setupPrincipal(ADMIN_PRINCIPAL);
    app = buildApp();
    mockUpsertSqlUser.mockResolvedValue(undefined);
    mockMirrorUserToFirestore.mockResolvedValue(undefined);
  });

  it("uses req.user.tenantId when no company_id in body", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: "newuser@test.com",
        name: "New User",
        role: "driver",
        password: "securepass123",
      });
    expect(res.status).toBe(201);
    expect(mockUpsertSqlUser).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_ID }),
    );
  });

  it("returns 403 when company_id in body does not match auth tenant (tenant lock)", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: "newuser@test.com",
        name: "New User",
        role: "driver",
        password: "securepass123",
        company_id: "foreign-company",
      });
    expect(res.status).toBe(403);
    expect(mockUpsertSqlUser).not.toHaveBeenCalled();
  });

  it("always uses auth tenant even when matching company_id provided in body", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: "newuser@test.com",
        name: "New User",
        role: "driver",
        password: "securepass123",
        company_id: COMPANY_ID,
      });
    expect(res.status).toBe(201);
    expect(mockUpsertSqlUser).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_ID }),
    );
  });
});

describe("POST /api/auth/register — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    setupPrincipal(ADMIN_PRINCIPAL);
    app = buildApp();
    mockUpsertSqlUser.mockResolvedValue(undefined);
    mockMirrorUserToFirestore.mockResolvedValue(undefined);
  });

  it("registers user and returns 201", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", AUTH_HEADER)
      .send({
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

describe("POST /api/auth/register — role enum enforcement (Issue 7)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    setupPrincipal(ADMIN_PRINCIPAL);
    app = buildApp();
  });

  it("returns 400 when role is not in the valid enum (e.g. superadmin)", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: "newuser@test.com",
        name: "New User",
        role: "superadmin",
        password: "securepass123",
      });
    expect(res.status).toBe(400);
    expect(mockUpsertSqlUser).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/register — error sanitization (SERVER-06a)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    setupPrincipal(ADMIN_PRINCIPAL);
    app = buildApp();
  });

  it("does not expose error.message in 500 response", async () => {
    mockUpsertSqlUser.mockRejectedValueOnce(
      new Error("ECONNREFUSED mysql connection"),
    );
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: "newuser@test.com",
        name: "New User",
        role: "driver",
        password: "securepass123",
      });
    expect(res.status).toBe(500);
    expect(res.body.message).toBeDefined();
    expect(JSON.stringify(res.body)).not.toContain("ECONNREFUSED");
  });
});

describe("POST /api/users — auth + role enforcement (AUTH-01b)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();
    mockUpsertSqlUser.mockResolvedValue(undefined);
    mockMirrorUserToFirestore.mockResolvedValue(undefined);
  });

  it("returns 201 when admin syncs any user", async () => {
    setupPrincipal(ADMIN_PRINCIPAL);
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: "driver@test.com",
        name: "John Driver",
        role: "driver",
        company_id: COMPANY_ID,
      });
    expect(res.status).toBe(201);
  });

  it("returns 201 when user self-syncs (matching email)", async () => {
    setupPrincipal({
      ...DEFAULT_SQL_PRINCIPAL,
      role: "driver",
      email: "test@loadpilot.com",
    });
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: "test@loadpilot.com",
        name: "Self Sync",
        company_id: COMPANY_ID,
      });
    expect(res.status).toBe(201);
  });

  it("returns 403 when non-admin syncs different user", async () => {
    setupPrincipal({
      ...DEFAULT_SQL_PRINCIPAL,
      role: "driver",
      email: "test@loadpilot.com",
    });
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: "other@test.com",
        name: "Someone Else",
        company_id: COMPANY_ID,
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/forbidden/i);
  });
});

describe("POST /api/users — company resolution (AUTH-03)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    setupPrincipal(ADMIN_PRINCIPAL);
    app = buildApp();
    mockUpsertSqlUser.mockResolvedValue(undefined);
    mockMirrorUserToFirestore.mockResolvedValue(undefined);
  });

  it("uses req.user.tenantId when no company_id in body", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: "driver@test.com",
      });
    expect(res.status).toBe(201);
    expect(mockUpsertSqlUser).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_ID }),
    );
  });

  it("returns 403 when company_id in body does not match auth tenant (tenant lock)", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: "driver@test.com",
        company_id: "foreign-company",
      });
    expect(res.status).toBe(403);
    expect(mockUpsertSqlUser).not.toHaveBeenCalled();
  });

  it("always uses auth tenant even when matching company_id provided in body", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: "driver@test.com",
        company_id: COMPANY_ID,
      });
    expect(res.status).toBe(201);
    expect(mockUpsertSqlUser).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_ID }),
    );
  });
});

describe("POST /api/users — success (sync)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    setupPrincipal(ADMIN_PRINCIPAL);
    app = buildApp();
    mockUpsertSqlUser.mockResolvedValue(undefined);
    mockMirrorUserToFirestore.mockResolvedValue(undefined);
  });

  it("syncs user and returns 201", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", AUTH_HEADER)
      .send({
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
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", AUTH_HEADER)
      .send({ name: "No Email" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/users — error sanitization (SERVER-06a)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    setupPrincipal(ADMIN_PRINCIPAL);
    app = buildApp();
  });

  it("does not expose error.message in 500 response", async () => {
    mockUpsertSqlUser.mockRejectedValueOnce(
      new Error("Duplicate entry for key 'PRIMARY'"),
    );
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: "driver@test.com",
        company_id: COMPANY_ID,
      });
    expect(res.status).toBe(500);
    expect(res.body.message).toBeDefined();
    expect(JSON.stringify(res.body)).not.toContain("Duplicate entry");
  });
});

describe("GET /api/users/me — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    setupPrincipal(DISPATCHER_PRINCIPAL);
    app = buildApp();
  });

  it("returns current user profile with 200 (password excluded)", async () => {
    mockFindSqlUserById.mockResolvedValueOnce({
      id: "1",
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
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("password");
    expect(mockFindSqlUserById).toHaveBeenCalledWith("1");
  });

  it("returns 404 when user profile is not found in SQL", async () => {
    mockFindSqlUserById.mockResolvedValueOnce(null);

    const res = await request(app)
      .get("/api/users/me")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(404);
  });
});

// =============================================================================
// OWNER_ADMIN and ORG_OWNER_SUPER_ADMIN role acceptance
// =============================================================================
describe("POST /api/auth/register — extended admin roles", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();
    mockUpsertSqlUser.mockResolvedValue(undefined);
    mockMirrorUserToFirestore.mockResolvedValue(undefined);
  });

  it("allows OWNER_ADMIN to register users", async () => {
    setupPrincipal({ ...DEFAULT_SQL_PRINCIPAL, role: "OWNER_ADMIN" });
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: "newuser@test.com",
        name: "New User",
        role: "driver",
        password: "securepass123",
      });
    expect(res.status).toBe(201);
  });

  it("allows ORG_OWNER_SUPER_ADMIN to register users", async () => {
    setupPrincipal({
      ...DEFAULT_SQL_PRINCIPAL,
      role: "ORG_OWNER_SUPER_ADMIN",
    });
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: "newuser@test.com",
        name: "New User",
        role: "driver",
        password: "securepass123",
      });
    expect(res.status).toBe(201);
  });
});

describe("POST /api/users — extended admin roles for user sync", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();
    mockUpsertSqlUser.mockResolvedValue(undefined);
    mockMirrorUserToFirestore.mockResolvedValue(undefined);
  });

  it("allows OWNER_ADMIN to sync another user", async () => {
    setupPrincipal({ ...DEFAULT_SQL_PRINCIPAL, role: "OWNER_ADMIN" });
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: "another@test.com",
        name: "Another User",
        role: "driver",
      });
    expect(res.status).toBe(201);
  });

  it("returns 403 when dispatcher syncs another user", async () => {
    setupPrincipal(DISPATCHER_PRINCIPAL);
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: "another@test.com",
        name: "Another User",
        role: "driver",
      });
    expect(res.status).toBe(403);
  });

  it("allows dispatcher to sync their own profile (self-sync)", async () => {
    setupPrincipal(DISPATCHER_PRINCIPAL);
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: DISPATCHER_PRINCIPAL.email,
        name: "My Updated Name",
      });
    expect(res.status).toBe(201);
  });
});

describe("POST /api/users — self-escalation prevention (SEC-01)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();
    mockUpsertSqlUser.mockResolvedValue(undefined);
    mockMirrorUserToFirestore.mockResolvedValue(undefined);
  });

  it("returns 403 when driver attempts to self-escalate to admin", async () => {
    setupPrincipal(DRIVER_PRINCIPAL);
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: DRIVER_PRINCIPAL.email,
        role: "admin",
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain("cannot change own role");
    expect(mockUpsertSqlUser).not.toHaveBeenCalled();
  });

  it("returns 403 when dispatcher attempts to self-escalate to OWNER_ADMIN", async () => {
    setupPrincipal(DISPATCHER_PRINCIPAL);
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: DISPATCHER_PRINCIPAL.email,
        role: "OWNER_ADMIN",
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain("cannot change own role");
    expect(mockUpsertSqlUser).not.toHaveBeenCalled();
  });

  it("self-sync preserves existing role even if role field is omitted", async () => {
    setupPrincipal(DRIVER_PRINCIPAL);
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: DRIVER_PRINCIPAL.email,
        name: "Updated Name",
      });
    expect(res.status).toBe(201);
    expect(mockUpsertSqlUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: "driver" }),
    );
  });

  it("admin CAN change another user's role", async () => {
    setupPrincipal(ADMIN_PRINCIPAL);
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", AUTH_HEADER)
      .send({
        email: "driver@test.com",
        role: "dispatcher",
      });
    expect(res.status).toBe(201);
    expect(mockUpsertSqlUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: "dispatcher" }),
    );
  });
});
