import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import { AuthError } from "../../errors/AppError";

// --- Hoisted mocks ---
const {
  mockVerifyIdToken,
  mockResolveSqlPrincipalByFirebaseUid,
  mockApp,
  mockIsTokenRevoked,
} = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
  mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
  mockApp: vi.fn(),
  mockIsTokenRevoked: vi.fn(),
}));

vi.mock("firebase-admin", () => ({
  default: {
    app: mockApp,
    auth: () => ({
      verifyIdToken: mockVerifyIdToken,
    }),
  },
}));

vi.mock("../../lib/sql-auth", () => ({
  resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
}));

vi.mock("../../lib/token-revocation", () => ({
  isTokenRevoked: mockIsTokenRevoked,
}));

import { requireAuth } from "../../middleware/requireAuth";

function mockReq(headers: Record<string, string> = {}): Request {
  return {
    headers,
    params: {},
    body: {},
  } as unknown as Request;
}

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnThis();
  res.json = vi.fn().mockReturnThis();
  return res;
}

const mockPrincipal = {
  id: "user-1",
  tenantId: "tenant-1",
  companyId: "company-1",
  role: "admin",
  email: "admin@test.com",
  firebaseUid: "fb-uid-1",
};

describe("requireAuth email_verified check", () => {
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApp.mockReturnValue(true);
    mockIsTokenRevoked.mockResolvedValue(false);
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(mockPrincipal);
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  // --- R-AUTH-05: requireAuth.ts checks email_verified ---
  it("# Tests R-AUTH-05 — rejects unverified email with AUTH_EMAIL_UNVERIFIED_001", async () => {
    process.env.NODE_ENV = "production";

    mockVerifyIdToken.mockResolvedValue({
      uid: "fb-uid-1",
      email: "admin@test.com",
      email_verified: false,
    });

    const req = mockReq({ authorization: "Bearer valid-token" });
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(AuthError);
    expect(error.error_code).toBe("AUTH_EMAIL_UNVERIFIED_001");
    expect(error.message).toContain("Email not verified");
  });

  // Positive path: verified email passes through
  it("allows verified email through", async () => {
    process.env.NODE_ENV = "production";

    mockVerifyIdToken.mockResolvedValue({
      uid: "fb-uid-1",
      email: "admin@test.com",
      email_verified: true,
    });

    const req = mockReq({ authorization: "Bearer valid-token" });
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    // next() called without error = passed through
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  // Test environment bypass: email_verified check skipped in test env
  it("skips email_verified check in test environment", async () => {
    process.env.NODE_ENV = "test";

    mockVerifyIdToken.mockResolvedValue({
      uid: "fb-uid-1",
      email: "admin@test.com",
      email_verified: false,
    });

    const req = mockReq({ authorization: "Bearer valid-token" });
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    // Should pass through even though email_verified is false
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  // Negative test: missing authorization header still returns AUTH_MISSING_001
  it("returns AUTH_MISSING_001 when no auth header provided", async () => {
    const req = mockReq({});
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(AuthError);
    expect(error.error_code).toBe("AUTH_MISSING_001");
  });
});
