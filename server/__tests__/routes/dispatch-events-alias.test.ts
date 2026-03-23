import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P2-11

// Hoisted mocks
const { mockQuery, mockResolveSqlPrincipalByFirebaseUid } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  return { mockQuery, mockResolveSqlPrincipalByFirebaseUid: vi.fn() };
});

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
  },
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

// Mock firebase-admin for requireAuth
vi.mock("firebase-admin", () => {
  const mockAuth = {
    verifyIdToken: vi.fn().mockResolvedValue({ uid: "firebase-uid-1" }),
  };
  const mockFirestore = {
    collection: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            empty: false,
            docs: [
              {
                id: "user-1",
                data: () => ({
                  id: "user-1",
                  company_id: "company-aaa",
                  role: "admin",
                  email: "test@test.com",
                }),
              },
            ],
          }),
        }),
      }),
    }),
  };
  return {
    default: {
      app: vi.fn(),
      auth: () => mockAuth,
      firestore: () => mockFirestore,
    },
  };
});

vi.mock("../../lib/sql-auth", () => ({
  resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
}));

import express from "express";
import request from "supertest";
import dispatchRouter from "../../routes/dispatch";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(dispatchRouter);
  app.use(errorHandler);
  return app;
}

const AUTH_HEADER = "Bearer valid-firebase-token";

describe("GET /api/dispatch/events — tenant-scoped alias (R-P2-11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("returns 200 with dispatch events using tenantId from auth", async () => {
    const mockEvents = [
      {
        id: "evt-1",
        load_id: "load-1",
        event_type: "DISPATCHED",
        created_at: "2026-01-01T00:00:00Z",
      },
    ];
    mockQuery.mockResolvedValueOnce([mockEvents]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/dispatch/events")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe("evt-1");
  });

  it("uses tenantId from auth token, not URL param", async () => {
    mockQuery.mockResolvedValueOnce([[]]);

    const app = buildApp();
    await request(app)
      .get("/api/dispatch/events")
      .set("Authorization", AUTH_HEADER);

    expect(mockQuery).toHaveBeenCalled();
    const queryArgs = mockQuery.mock.calls[0];
    // The company_id param should be the tenant ID from the auth token
    expect(queryArgs[1]).toContain("company-aaa");
  });

  it("returns 401 without auth", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/dispatch/events");
    expect([401, 403]).toContain(res.status);
  });
});
