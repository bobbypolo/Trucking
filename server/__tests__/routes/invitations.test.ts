import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks
const {
  mockQuery,
  mockGetConnection,
  mockResolveSqlPrincipalByFirebaseUid,
  mockSendEmail,
} = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockGetConnection: vi.fn(),
  mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
  mockSendEmail: vi.fn(),
}));

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
    getConnection: mockGetConnection,
  },
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

vi.mock("firebase-admin", () => {
  const mockAuth = {
    verifyIdToken: vi.fn().mockResolvedValue({
      uid: "firebase-uid-1",
      email_verified: true,
    }),
    createUser: vi.fn().mockResolvedValue({ uid: "firebase-uid-invited" }),
    deleteUser: vi.fn().mockResolvedValue(undefined),
    generateEmailVerificationLink: vi
      .fn()
      .mockResolvedValue("https://verify.link/test"),
  };
  return {
    default: {
      app: vi.fn(),
      auth: () => mockAuth,
    },
  };
});

vi.mock("../../lib/sql-auth", () => ({
  resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
}));

vi.mock("../../lib/token-revocation", () => ({
  isTokenRevoked: vi.fn().mockResolvedValue(false),
}));

vi.mock("../../services/notification-delivery.service", () => ({
  sendEmail: mockSendEmail,
}));

import express from "express";
import request from "supertest";
import invitationsRouter from "../../routes/invitations";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
mockSendEmail.mockResolvedValue({ success: true });

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(invitationsRouter);
  app.use(errorHandler);
  return app;
}

// Tests R-INV-01, R-INV-02, R-INV-03, R-INV-04, R-INV-05, R-INV-06, R-INV-07, R-INV-08, R-INV-09, R-INV-10, R-INV-11
describe("invitations routes", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    mockSendEmail.mockResolvedValue({ success: true });
    app = buildApp();
  });

  // Tests R-INV-03, R-INV-04, R-INV-11
  describe("POST /api/invitations", () => {
    // Tests R-INV-03, R-INV-04, R-INV-11
    it("creates an invitation with valid body and returns 201", async () => {
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, undefined]);

      const res = await request(app)
        .post("/api/invitations")
        .set("Authorization", "Bearer valid-token")
        .send({ email: "newuser@example.com", role: "dispatcher" });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("Invitation created");
      expect(res.body.invitation).toBeDefined();
      expect(res.body.invitation.email).toBe("newuser@example.com");
      expect(res.body.invitation.role).toBe("dispatcher");
    });

    // Tests R-INV-04, R-INV-11 — validateBody(createInvitationSchema)
    it("rejects missing email with 400 validation error", async () => {
      const res = await request(app)
        .post("/api/invitations")
        .set("Authorization", "Bearer valid-token")
        .send({ role: "dispatcher" });

      expect(res.status).toBe(400);
    });

    it("rejects invalid email format with 400", async () => {
      const res = await request(app)
        .post("/api/invitations")
        .set("Authorization", "Bearer valid-token")
        .send({ email: "not-an-email", role: "dispatcher" });

      expect(res.status).toBe(400);
    });

    it("rejects invalid role with 400", async () => {
      const res = await request(app)
        .post("/api/invitations")
        .set("Authorization", "Bearer valid-token")
        .send({ email: "valid@test.com", role: "superadmin" });

      expect(res.status).toBe(400);
    });

    it("rejects missing role with 400", async () => {
      const res = await request(app)
        .post("/api/invitations")
        .set("Authorization", "Bearer valid-token")
        .send({ email: "valid@test.com" });

      expect(res.status).toBe(400);
    });
  });

  // Tests R-INV-03, R-INV-11
  describe("GET /api/invitations", () => {
    // Tests R-INV-03, R-INV-11
    it("lists invitations for the authenticated tenant", async () => {
      const mockRows = [
        {
          id: "inv-1",
          company_id: "company-aaa",
          email: "a@test.com",
          role: "dispatcher",
          status: "pending",
        },
      ];
      mockQuery.mockResolvedValueOnce([mockRows, undefined]);

      const res = await request(app)
        .get("/api/invitations")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.invitations).toHaveLength(1);
      expect(res.body.invitations[0].email).toBe("a@test.com");
    });
  });

  // Tests R-INV-03, R-INV-05, R-INV-07, R-INV-08, R-INV-11
  describe("POST /api/invitations/accept", () => {
    const mockConnRelease = vi.fn();
    const mockConnCommit = vi.fn();
    const mockConnRollback = vi.fn();
    const mockConnBeginTransaction = vi.fn();
    const mockConnQuery = vi.fn();

    beforeEach(() => {
      mockConnRelease.mockReset();
      mockConnCommit.mockReset();
      mockConnRollback.mockReset();
      mockConnBeginTransaction.mockReset();
      mockConnQuery.mockReset();
      mockGetConnection.mockResolvedValue({
        beginTransaction: mockConnBeginTransaction,
        query: mockConnQuery,
        commit: mockConnCommit,
        rollback: mockConnRollback,
        release: mockConnRelease,
      });
    });

    // Tests R-INV-05, R-INV-11
    it("accepts a valid invitation and returns user info", async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      mockQuery.mockResolvedValueOnce([
        [
          {
            id: "inv-1",
            company_id: "company-aaa",
            email: "user@test.com",
            role: "dispatcher",
            token: "valid-invite-token",
            status: "pending",
            invited_by: "admin-1",
            expires_at: futureDate,
            accepted_at: null,
          },
        ],
        undefined,
      ]);
      mockConnQuery.mockResolvedValue([{ affectedRows: 1 }, undefined]);
      mockConnCommit.mockResolvedValue(undefined);

      const res = await request(app).post("/api/invitations/accept").send({
        token: "valid-invite-token",
        name: "New User",
        password: "securepassword123",
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Invitation accepted");
      expect(res.body.userId).toBeDefined();
      expect(res.body.companyId).toBe("company-aaa");
      expect(res.body.role).toBe("dispatcher");
    });

    // Tests R-INV-07, R-INV-11 — expired invitation returns 410 Gone
    it("returns 410 Gone for expired invitation", async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      mockQuery
        .mockResolvedValueOnce([
          [
            {
              id: "inv-expired",
              company_id: "company-aaa",
              email: "expired@test.com",
              role: "dispatcher",
              token: "expired-token",
              status: "pending",
              invited_by: "admin-1",
              expires_at: pastDate,
              accepted_at: null,
            },
          ],
          undefined,
        ])
        .mockResolvedValueOnce([{ affectedRows: 1 }, undefined]);

      const res = await request(app).post("/api/invitations/accept").send({
        token: "expired-token",
        name: "Late User",
        password: "securepassword123",
      });

      expect(res.status).toBe(410);
      expect(res.body.message).toContain("expired");
    });

    // Tests R-INV-08, R-INV-11 — already accepted returns 409 Conflict
    it("returns 409 Conflict for already-accepted invitation", async () => {
      mockQuery.mockResolvedValueOnce([
        [
          {
            id: "inv-accepted",
            company_id: "company-aaa",
            email: "accepted@test.com",
            role: "dispatcher",
            token: "accepted-token",
            status: "accepted",
            invited_by: "admin-1",
            expires_at: new Date(Date.now() + 86400000).toISOString(),
            accepted_at: new Date().toISOString(),
          },
        ],
        undefined,
      ]);

      const res = await request(app).post("/api/invitations/accept").send({
        token: "accepted-token",
        name: "Dup User",
        password: "securepassword123",
      });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("already been accepted");
    });

    it("rejects invalid body with 400 (missing token)", async () => {
      const res = await request(app)
        .post("/api/invitations/accept")
        .send({ name: "No Token", password: "password123" });

      expect(res.status).toBe(400);
    });

    it("rejects short password with 400", async () => {
      const res = await request(app)
        .post("/api/invitations/accept")
        .send({ token: "some-token", name: "User", password: "short" });

      expect(res.status).toBe(400);
    });
  });

  // Tests R-INV-03, R-INV-11
  describe("DELETE /api/invitations/:id", () => {
    // Tests R-INV-03, R-INV-11
    it("cancels a pending invitation and returns 200", async () => {
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, undefined]);

      const res = await request(app)
        .delete("/api/invitations/inv-1")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Invitation cancelled");
    });

    it("returns 404 when invitation not found or already processed", async () => {
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, undefined]);

      const res = await request(app)
        .delete("/api/invitations/inv-nonexistent")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(404);
    });
  });
});
