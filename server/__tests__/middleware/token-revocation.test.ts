import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import { AuthError } from "../../errors/AppError";

// --- Hoisted mocks ---
const {
  mockVerifyIdToken,
  mockResolveSqlPrincipalByFirebaseUid,
  mockApp,
  mockIsTokenRevoked,
  mockPoolExecute,
  mockRevokeRefreshTokens,
} = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
  mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
  mockApp: vi.fn(),
  mockIsTokenRevoked: vi.fn(),
  mockPoolExecute: vi.fn(),
  mockRevokeRefreshTokens: vi.fn(),
}));

vi.mock("firebase-admin", () => ({
  default: {
    app: mockApp,
    auth: () => ({
      verifyIdToken: mockVerifyIdToken,
      revokeRefreshTokens: mockRevokeRefreshTokens,
    }),
  },
}));

vi.mock("../../lib/sql-auth", () => ({
  resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
}));

vi.mock("../../lib/token-revocation", () => ({
  isTokenRevoked: mockIsTokenRevoked,
  revokeUserTokens: vi.fn(),
}));

vi.mock("../../db", () => ({
  default: {
    execute: mockPoolExecute,
  },
}));

import {
  requireAuth,
  AuthenticatedRequest,
} from "../../middleware/requireAuth";

function mockReq(headers: Record<string, string> = {}): Request {
  return {
    headers,
    params: {},
    body: {},
  } as unknown as Request;
}

function mockRes(): Response {
  const res: Record<string, unknown> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as unknown as Response;
}

// --- Tests: token-revocation.ts exports ---
describe("R-SEC-07: token-revocation.ts exports isTokenRevoked", () => {
  it("isTokenRevoked is exported as a function", async () => {
    // Tests R-SEC-07
    const mod = await import("../../lib/token-revocation");
    expect(typeof mod.isTokenRevoked).toBe("function");
  });
});

describe("R-SEC-08: token-revocation.ts exports revokeUserTokens", () => {
  it("revokeUserTokens is exported as a function", async () => {
    // Tests R-SEC-08
    const mod = await import("../../lib/token-revocation");
    expect(typeof mod.revokeUserTokens).toBe("function");
  });
});

// --- Tests: requireAuth calls isTokenRevoked ---
describe("R-SEC-09: requireAuth calls isTokenRevoked", () => {
  let nextFn: NextFunction & ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nextFn = vi.fn() as NextFunction & ReturnType<typeof vi.fn>;
    vi.clearAllMocks();
    mockApp.mockReturnValue(true);
  });

  it("calls isTokenRevoked with the decoded token uid", async () => {
    // Tests R-SEC-09
    mockVerifyIdToken.mockResolvedValue({ uid: "firebase-uid-123" });
    mockIsTokenRevoked.mockResolvedValue(false);
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-1",
      companyId: "company-1",
      role: "admin",
      email: "test@test.com",
      firebaseUid: "firebase-uid-123",
    });

    const req = mockReq({ authorization: "Bearer valid-token" });
    const res = mockRes();

    await requireAuth(req, res, nextFn);

    expect(mockIsTokenRevoked).toHaveBeenCalledWith("firebase-uid-123");
    expect(nextFn).toHaveBeenCalledOnce();
    expect(nextFn.mock.calls[0][0]).toBeUndefined();
  });
});

// --- Tests: revoked user gets 401 with REVOKED ---
describe("R-SEC-10: revoked user gets 401 with REVOKED error code", () => {
  let nextFn: NextFunction & ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nextFn = vi.fn() as NextFunction & ReturnType<typeof vi.fn>;
    vi.clearAllMocks();
    mockApp.mockReturnValue(true);
  });

  it("returns 401 AUTH_REVOKED_001 when token is revoked", async () => {
    // Tests R-SEC-10
    mockVerifyIdToken.mockResolvedValue({ uid: "revoked-uid" });
    mockIsTokenRevoked.mockResolvedValue(true);

    const req = mockReq({ authorization: "Bearer valid-token" });
    const res = mockRes();

    await requireAuth(req, res, nextFn);

    expect(nextFn).toHaveBeenCalledOnce();
    const err = nextFn.mock.calls[0][0];
    expect(err).toBeInstanceOf(AuthError);
    expect(err.statusCode).toBe(401);
    expect(err.error_code).toBe("AUTH_REVOKED_001");
    expect(err.error_code).toContain("REVOKED");
  });

  it("does NOT call resolveSqlPrincipalByFirebaseUid for revoked users", async () => {
    // Tests R-SEC-10 — revoked users are blocked before principal resolution
    mockVerifyIdToken.mockResolvedValue({ uid: "revoked-uid" });
    mockIsTokenRevoked.mockResolvedValue(true);

    const req = mockReq({ authorization: "Bearer valid-token" });
    const res = mockRes();

    await requireAuth(req, res, nextFn);

    expect(mockResolveSqlPrincipalByFirebaseUid).not.toHaveBeenCalled();
  });

  it("allows non-revoked users through to principal resolution", async () => {
    // Tests R-SEC-10 — non-revoked path still works
    mockVerifyIdToken.mockResolvedValue({ uid: "active-uid" });
    mockIsTokenRevoked.mockResolvedValue(false);
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-1",
      companyId: "company-1",
      role: "driver",
      email: "driver@test.com",
      firebaseUid: "active-uid",
    });

    const req = mockReq({ authorization: "Bearer valid-token" });
    const res = mockRes();

    await requireAuth(req, res, nextFn);

    expect(mockResolveSqlPrincipalByFirebaseUid).toHaveBeenCalledWith(
      "active-uid",
    );
    expect(nextFn).toHaveBeenCalledOnce();
    const user = (req as AuthenticatedRequest).user!;
    expect(user.firebaseUid).toBe("active-uid");
    expect(user.role).toBe("driver");
  });
});
