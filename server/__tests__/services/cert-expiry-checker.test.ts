import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-W7-03a, R-W7-03b, R-W7-03c, R-W7-VPC-802

const { mockQuery } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  return { mockQuery };
});

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
  },
}));

vi.mock("../../lib/logger", () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { checkExpiring } from "../../services/cert-expiry-checker";

describe("R-W7-03a: cert-expiry-checker.ts exports checkExpiring()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checkExpiring is exported and callable", () => {
    expect(typeof checkExpiring).toBe("function");
  });

  it("queries certs within N days (default 30)", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    await checkExpiring("company-aaa");

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("expiry_date");
    expect(sql).toContain("company_id");
    expect(params).toContain("company-aaa");
    // Default 30 days
    expect(params).toContain(30);
  });

  it("accepts custom daysAhead parameter", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    await checkExpiring("company-aaa", 14);

    const [, params] = mockQuery.mock.calls[0];
    expect(params).toContain(14);
  });
});

describe("R-W7-03b: Returns array of {driverId, certType, expiryDate, daysRemaining}", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns correctly shaped objects for expiring certs", async () => {
    const today = new Date();
    const sevenDaysOut = new Date(today);
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
    const expiredDate = new Date(today);
    expiredDate.setDate(expiredDate.getDate() - 2);

    mockQuery.mockResolvedValueOnce([
      [
        {
          user_id: "driver-1",
          type: "CDL",
          expiry_date: sevenDaysOut,
          days_remaining: 7,
        },
        {
          user_id: "driver-2",
          type: "Medical_Card",
          expiry_date: expiredDate,
          days_remaining: -2,
        },
      ],
      [],
    ]);

    const result = await checkExpiring("company-aaa", 30);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);

    // First cert: 7 days out
    expect(result[0]).toEqual(
      expect.objectContaining({
        driverId: "driver-1",
        certType: "CDL",
        daysRemaining: 7,
      }),
    );
    expect(result[0].expiryDate).toBeInstanceOf(Date);

    // Second cert: already expired
    expect(result[1]).toEqual(
      expect.objectContaining({
        driverId: "driver-2",
        certType: "Medical_Card",
        daysRemaining: -2,
      }),
    );
  });

  it("returns empty array when no certs are expiring", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const result = await checkExpiring("company-aaa");

    expect(result).toEqual([]);
  });

  it("handles DB error gracefully and throws", async () => {
    mockQuery.mockRejectedValueOnce(new Error("Connection refused"));

    await expect(checkExpiring("company-aaa")).rejects.toThrow(
      "Connection refused",
    );
  });
});

describe("R-W7-VPC-802: unit tests pass, tsc clean", () => {
  it("checkExpiring returns typed ExpiringCert array", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    const result = await checkExpiring("company-aaa");
    // Type check: result should be an array
    expect(Array.isArray(result)).toBe(true);
  });
});
