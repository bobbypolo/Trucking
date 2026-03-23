import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";

// Tests R-P5-01, R-P5-02, R-P5-03, R-P5-04, R-P5-05

// Mock the db module before importing requireTier
vi.mock("../../db", () => {
  const mockExecute = vi.fn();
  return {
    default: { execute: mockExecute },
    __mockExecute: mockExecute,
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
import pool from "../../db";
import { requireTier } from "../../middleware/requireTier";

const mockExecute = (pool as any).execute as ReturnType<typeof vi.fn>;

interface MockUser {
  id: string;
  uid: string;
  tenantId: string;
  companyId: string;
  role: string;
  email: string;
  firebaseUid: string;
}

function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user-1",
    uid: "user-1",
    tenantId: "company-1",
    companyId: "company-1",
    role: "dispatcher",
    email: "user@test.com",
    firebaseUid: "fb-uid-1",
    ...overrides,
  };
}

function mockReq(user: MockUser | null): Request {
  return {
    user,
    params: {},
    body: {},
    headers: {},
  } as unknown as Request;
}

function mockRes(): Response {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("R-P5-01: requireTier — allowed tier + active status calls next()", () => {
  let nextFn: NextFunction & ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nextFn = vi.fn() as NextFunction & ReturnType<typeof vi.fn>;
    mockExecute.mockReset();
  });

  it("calls next() for allowed tier with active status", async () => {
    mockExecute.mockResolvedValueOnce([
      [{ subscription_tier: "Fleet Core", subscription_status: "active" }],
    ]);

    const middleware = requireTier("Fleet Core", "Fleet Command");
    const req = mockReq(makeUser());
    const res = mockRes();

    await middleware(req, res, nextFn);

    expect(nextFn).toHaveBeenCalledOnce();
    expect(nextFn).toHaveBeenCalledWith(); // no error
  });

  it("calls next() for allowed tier with trial status", async () => {
    mockExecute.mockResolvedValueOnce([
      [{ subscription_tier: "Automation Pro", subscription_status: "trial" }],
    ]);

    const middleware = requireTier("Automation Pro");
    const req = mockReq(makeUser());
    const res = mockRes();

    await middleware(req, res, nextFn);

    expect(nextFn).toHaveBeenCalledOnce();
    expect(nextFn).toHaveBeenCalledWith(); // no error
  });
});

describe("R-P5-02: requireTier — disallowed tier returns 403", () => {
  let nextFn: NextFunction & ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nextFn = vi.fn() as NextFunction & ReturnType<typeof vi.fn>;
    mockExecute.mockReset();
  });

  it("returns 403 with required_tiers, current_tier, upgrade_url for wrong tier", async () => {
    mockExecute.mockResolvedValueOnce([
      [{ subscription_tier: "Records Vault", subscription_status: "active" }],
    ]);

    const middleware = requireTier("Fleet Core", "Fleet Command");
    const req = mockReq(makeUser());
    const res = mockRes();

    await middleware(req, res, nextFn);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(String),
        required_tiers: ["Fleet Core", "Fleet Command"],
        current_tier: "Records Vault",
        upgrade_url: expect.any(String),
      }),
    );
    expect(nextFn).not.toHaveBeenCalled();
  });
});

describe("R-P5-03: requireTier — past_due returns 403 regardless of tier", () => {
  let nextFn: NextFunction & ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nextFn = vi.fn() as NextFunction & ReturnType<typeof vi.fn>;
    mockExecute.mockReset();
  });

  it("blocks past_due even when tier matches", async () => {
    mockExecute.mockResolvedValueOnce([
      [{ subscription_tier: "Fleet Core", subscription_status: "past_due" }],
    ]);

    const middleware = requireTier("Fleet Core");
    const req = mockReq(makeUser());
    const res = mockRes();

    await middleware(req, res, nextFn);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("past due"),
      }),
    );
    expect(nextFn).not.toHaveBeenCalled();
  });
});

describe("R-P5-04: requireTier — missing tier defaults to Records Vault", () => {
  let nextFn: NextFunction & ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nextFn = vi.fn() as NextFunction & ReturnType<typeof vi.fn>;
    mockExecute.mockReset();
  });

  it("defaults to Records Vault when subscription_tier is null", async () => {
    mockExecute.mockResolvedValueOnce([
      [{ subscription_tier: null, subscription_status: "active" }],
    ]);

    // Require a higher tier — should fail because default is Records Vault
    const middleware = requireTier("Fleet Core");
    const req = mockReq(makeUser());
    const res = mockRes();

    await middleware(req, res, nextFn);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        current_tier: "Records Vault",
      }),
    );
  });

  it("defaults to Records Vault and passes when Records Vault is allowed", async () => {
    mockExecute.mockResolvedValueOnce([
      [{ subscription_tier: null, subscription_status: "active" }],
    ]);

    const middleware = requireTier("Records Vault");
    const req = mockReq(makeUser());
    const res = mockRes();

    await middleware(req, res, nextFn);

    expect(nextFn).toHaveBeenCalledOnce();
    expect(nextFn).toHaveBeenCalledWith(); // no error
  });
});

describe("R-P5-05: requireTier — tier lookup cached per-request", () => {
  let nextFn: NextFunction & ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nextFn = vi.fn() as NextFunction & ReturnType<typeof vi.fn>;
    mockExecute.mockReset();
  });

  it("makes only 1 DB query even with multiple requireTier calls on same request", async () => {
    mockExecute.mockResolvedValue([
      [{ subscription_tier: "Fleet Command", subscription_status: "active" }],
    ]);

    const req = mockReq(makeUser());
    const res = mockRes();

    const mw1 = requireTier("Fleet Command");
    const mw2 = requireTier("Fleet Core", "Fleet Command");
    const mw3 = requireTier("Records Vault", "Fleet Command");

    await mw1(req, res, nextFn);
    await mw2(req, res, nextFn);
    await mw3(req, res, nextFn);

    // All 3 should pass
    expect(nextFn).toHaveBeenCalledTimes(3);

    // Only 1 DB query despite 3 middleware calls
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("does not share cache between different requests", async () => {
    mockExecute
      .mockResolvedValueOnce([
        [
          {
            subscription_tier: "Fleet Command",
            subscription_status: "active",
          },
        ],
      ])
      .mockResolvedValueOnce([
        [
          {
            subscription_tier: "Records Vault",
            subscription_status: "active",
          },
        ],
      ]);

    const mw = requireTier("Fleet Command");

    const req1 = mockReq(makeUser({ companyId: "company-1" }));
    const req2 = mockReq(makeUser({ companyId: "company-2" }));
    const res = mockRes();

    await mw(req1, res, nextFn);
    await mw(req2, res, nextFn);

    // 2 different requests = 2 DB queries
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });
});

describe("requireTier — edge cases", () => {
  let nextFn: NextFunction & ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nextFn = vi.fn() as NextFunction & ReturnType<typeof vi.fn>;
    mockExecute.mockReset();
  });

  it("returns 403 when no user is present (requireAuth not called)", async () => {
    const middleware = requireTier("Fleet Core");
    const req = mockReq(null);
    const res = mockRes();

    await middleware(req, res, nextFn);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(nextFn).not.toHaveBeenCalled();
  });

  it("returns 403 when company not found in DB", async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const middleware = requireTier("Fleet Core");
    const req = mockReq(makeUser());
    const res = mockRes();

    await middleware(req, res, nextFn);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(nextFn).not.toHaveBeenCalled();
  });
});
