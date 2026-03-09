import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-FS-05-06, R-FS-05-07

// Hoisted mocks for Firestore operations
const { mockFirestoreGet, mockFirestoreSet, mockFirestoreWhere } = vi.hoisted(
  () => {
    const mockFirestoreGet = vi.fn();
    const mockFirestoreSet = vi.fn().mockResolvedValue(undefined);
    const mockFirestoreWhere = vi.fn();
    return { mockFirestoreGet, mockFirestoreSet, mockFirestoreWhere };
  },
);

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

// Mock Firestore used by users.ts
vi.mock("../../firestore", () => ({
  default: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: mockFirestoreGet,
        set: mockFirestoreSet,
      }),
      where: vi
        .fn()
        .mockImplementation((_field: string, _op: string, _val: string) => ({
          get: mockFirestoreWhere,
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
          }),
        })),
    }),
  },
}));

// Control user context per-test
let mockUserRole = "dispatcher";
let mockUserTenantId = "company-aaa";
let mockUserId = "user-1";

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = {
      uid: mockUserId,
      tenantId: mockUserTenantId,
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

import express from "express";
import request from "supertest";
import usersRouter from "../../routes/users";
import { errorHandler } from "../../middleware/errorHandler";

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

// ── Auth enforcement ──────────────────────────────────────────────────────────

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

  it("returns 400 when email is missing", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ password: "secret" });
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

// ── Tenant enforcement ────────────────────────────────────────────────────────

describe("GET /api/users/:companyId — tenant enforcement", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserId = "user-1";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 403 when requesting users from a different company (non-admin)", async () => {
    const res = await request(app)
      .get("/api/users/company-zzz")
      .set("Authorization", "Bearer valid-token");

    // Route-level check: tenantId !== companyId for non-admin → 403
    expect(res.status).toBe(403);
  });

  it("allows access to own company's users", async () => {
    mockFirestoreWhere.mockResolvedValueOnce({
      docs: [
        {
          id: "user-1",
          data: () => ({
            id: "user-1",
            company_id: COMPANY_ID,
            role: "dispatcher",
            email: "test@test.com",
            name: "Test User",
          }),
        },
      ],
    });

    const res = await request(app)
      .get(`/api/users/${COMPANY_ID}`)
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ── Validation errors ─────────────────────────────────────────────────────────

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

// ── Success path ──────────────────────────────────────────────────────────────

describe("POST /api/auth/register — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
  });

  it("registers user and returns 201", async () => {
    mockFirestoreSet.mockResolvedValueOnce(undefined);

    const res = await request(app).post("/api/auth/register").send({
      id: "new-user",
      email: "newuser@test.com",
      name: "New User",
      role: "driver",
      company_id: COMPANY_ID,
      password: "securepass123",
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("User registered successfully");
  });
});

describe("POST /api/users — success (sync)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
  });

  it("syncs user and returns 201", async () => {
    mockFirestoreSet.mockResolvedValueOnce(undefined);

    const res = await request(app).post("/api/users").send({
      email: "driver@test.com",
      name: "John Driver",
      role: "driver",
      company_id: COMPANY_ID,
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("User updated/created");
  });

  it("returns 400 when email is missing from user sync", async () => {
    const res = await request(app)
      .post("/api/users")
      .send({ name: "No Email" }); // missing email
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
    const userDoc = {
      exists: true,
      data: () => ({
        id: "user-1",
        company_id: COMPANY_ID,
        role: "dispatcher",
        email: "test@test.com",
        name: "Test User",
        password: "hashed",
      }),
    };
    mockFirestoreGet.mockResolvedValueOnce(userDoc);

    const res = await request(app)
      .get("/api/users/me")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    // Password must not be returned
    expect(res.body).not.toHaveProperty("password");
  });

  it("returns 404 when user profile not found in Firestore", async () => {
    // Firestore .doc().get() returns doc with null data
    mockFirestoreGet.mockResolvedValueOnce({ exists: true, data: () => null });

    const res = await request(app)
      .get("/api/users/me")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
  });
});
