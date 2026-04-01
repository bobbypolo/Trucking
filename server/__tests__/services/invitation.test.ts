import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks
const {
  mockQuery,
  mockGetConnection,
  mockSendEmail,
  mockCreateUser,
  mockDeleteUser,
  mockGenerateEmailVerificationLink,
} = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockGetConnection: vi.fn(),
  mockSendEmail: vi.fn(),
  mockCreateUser: vi.fn(),
  mockDeleteUser: vi.fn(),
  mockGenerateEmailVerificationLink: vi.fn(),
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
    child: vi.fn().mockReturnThis(),
  },
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("../../services/notification-delivery.service", () => ({
  sendEmail: mockSendEmail,
}));

vi.mock("firebase-admin", () => ({
  default: {
    auth: () => ({
      createUser: mockCreateUser,
      deleteUser: mockDeleteUser,
      generateEmailVerificationLink: mockGenerateEmailVerificationLink,
    }),
  },
}));

import {
  createInvitation,
  acceptInvitation,
  listInvitations,
  cancelInvitation,
} from "../../services/invitation.service";

describe("invitation.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue({ success: true });
    mockCreateUser.mockResolvedValue({ uid: "firebase-uid-invited" });
    mockGenerateEmailVerificationLink.mockResolvedValue(
      "https://verify.link/test",
    );
    mockDeleteUser.mockResolvedValue(undefined);
  });

  // Tests R-INV-02, R-INV-10
  describe("createInvitation", () => {
    // Tests R-INV-02
    it("inserts a new invitation into the database and returns it", async () => {
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, undefined]);

      const result = await createInvitation(
        "company-aaa",
        "newuser@test.com",
        "dispatcher",
        "user-admin-1",
      );

      expect(result.email).toBe("newuser@test.com");
      expect(result.role).toBe("dispatcher");
      expect(result.company_id).toBe("company-aaa");
      expect(result.status).toBe("pending");
      expect(result.invited_by).toBe("user-admin-1");
      expect(result.token).toHaveLength(64); // 32 bytes hex
      expect(result.id).toBeDefined();
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][0]).toContain("INSERT INTO invitations");
    });

    it("sends an invitation email after creating the invitation", async () => {
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, undefined]);

      await createInvitation(
        "company-aaa",
        "invitee@test.com",
        "driver",
        "user-admin-1",
      );

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail.mock.calls[0][0].to).toBe("invitee@test.com");
      expect(mockSendEmail.mock.calls[0][0].subject).toContain("invited");
    });

    it("does not throw when email sending fails", async () => {
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, undefined]);
      mockSendEmail.mockRejectedValueOnce(new Error("SMTP down"));

      const result = await createInvitation(
        "company-aaa",
        "invitee@test.com",
        "admin",
        "user-admin-1",
      );

      expect(result.email).toBe("invitee@test.com");
      expect(result.status).toBe("pending");
    });
  });

  // Tests R-INV-06, R-INV-07, R-INV-08, R-INV-10
  describe("acceptInvitation", () => {
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

    // Tests R-INV-06, R-INV-10
    it("creates a user with the correct company_id from the invitation", async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      mockQuery.mockResolvedValueOnce([
        [
          {
            id: "inv-1",
            company_id: "company-xyz",
            email: "user@test.com",
            role: "dispatcher",
            token: "abc123",
            status: "pending",
            invited_by: "admin-1",
            expires_at: futureDate,
            accepted_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        undefined,
      ]);
      mockConnQuery.mockResolvedValue([{ affectedRows: 1 }, undefined]);
      mockConnCommit.mockResolvedValue(undefined);

      const result = await acceptInvitation(
        "abc123",
        "New User",
        "password123",
      );

      expect(result.userId).toBeDefined();
      expect(result.invitation.company_id).toBe("company-xyz");
      expect(result.invitation.status).toBe("accepted");

      // Verify Firebase Auth account was created
      expect(mockCreateUser).toHaveBeenCalledWith({
        email: "user@test.com",
        password: "password123",
        displayName: "New User",
        emailVerified: false,
      });

      // Verify the INSERT INTO users includes firebase_uid
      const userInsertCall = mockConnQuery.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === "string" && call[0].includes("INSERT INTO users"),
      );
      expect(userInsertCall).toBeDefined();
      expect(userInsertCall![0]).toContain("firebase_uid");
      // The second parameter array should contain company_id = "company-xyz"
      expect(userInsertCall![1][1]).toBe("company-xyz");
      // firebase_uid should be in the params
      expect(userInsertCall![1]).toContain("firebase-uid-invited");
    });

    // Tests R-INV-07, R-INV-10
    it("returns error for expired invitation", async () => {
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
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          undefined,
        ])
        .mockResolvedValueOnce([{ affectedRows: 1 }, undefined]); // UPDATE to expired

      let caughtErr: (Error & { code?: string }) | undefined;
      try {
        await acceptInvitation("expired-token", "Late User", "password123");
      } catch (err: unknown) {
        caughtErr = err as Error & { code?: string };
      }
      expect(caughtErr).toBeDefined();
      expect(caughtErr!.message).toBe("Invitation has expired");
      expect(caughtErr!.code).toBe("INVITATION_EXPIRED");
    });

    // Tests R-INV-08, R-INV-10
    it("returns error for already-accepted invitation", async () => {
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
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        undefined,
      ]);

      let caughtErr: (Error & { code?: string }) | undefined;
      try {
        await acceptInvitation("accepted-token", "Dup User", "password123");
      } catch (err: unknown) {
        caughtErr = err as Error & { code?: string };
      }
      expect(caughtErr).toBeDefined();
      expect(caughtErr!.message).toBe("Invitation has already been accepted");
      expect(caughtErr!.code).toBe("INVITATION_ALREADY_ACCEPTED");
    });

    it("returns error when invitation token is not found", async () => {
      mockQuery.mockResolvedValueOnce([[], undefined]);

      await expect(
        acceptInvitation("nonexistent-token", "Ghost User", "password123"),
      ).rejects.toThrow("Invitation not found");
    });

    it("rolls back transaction on user creation failure", async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      mockQuery.mockResolvedValueOnce([
        [
          {
            id: "inv-tx-fail",
            company_id: "company-aaa",
            email: "txfail@test.com",
            role: "driver",
            token: "tx-fail-token",
            status: "pending",
            invited_by: "admin-1",
            expires_at: futureDate,
            accepted_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        undefined,
      ]);
      mockConnQuery.mockRejectedValueOnce(new Error("Duplicate entry"));
      mockConnRollback.mockResolvedValue(undefined);

      await expect(
        acceptInvitation("tx-fail-token", "Dup Email User", "password123"),
      ).rejects.toThrow("Duplicate entry");

      expect(mockConnRollback).toHaveBeenCalledTimes(1);
      expect(mockConnRelease).toHaveBeenCalledTimes(1);
    });
  });

  describe("listInvitations", () => {
    it("returns all invitations for a company ordered by created_at DESC", async () => {
      const mockRows = [
        {
          id: "inv-1",
          company_id: "company-aaa",
          email: "a@test.com",
          status: "pending",
        },
        {
          id: "inv-2",
          company_id: "company-aaa",
          email: "b@test.com",
          status: "accepted",
        },
      ];
      mockQuery.mockResolvedValueOnce([mockRows, undefined]);

      const result = await listInvitations("company-aaa");

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("inv-1");
      expect(result[1].id).toBe("inv-2");
      expect(mockQuery.mock.calls[0][0]).toContain("ORDER BY created_at DESC");
    });
  });

  describe("cancelInvitation", () => {
    it("cancels a pending invitation and returns true", async () => {
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, undefined]);

      const result = await cancelInvitation("inv-1", "company-aaa");

      expect(result).toBe(true);
      expect(mockQuery.mock.calls[0][0]).toContain(
        "UPDATE invitations SET status = 'cancelled'",
      );
    });

    it("returns false when invitation is not found or already processed", async () => {
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, undefined]);

      const result = await cancelInvitation("inv-nonexistent", "company-aaa");

      expect(result).toBe(false);
    });
  });
});
