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

vi.mock("uuid", () => ({
  v4: vi
    .fn()
    .mockReturnValueOnce("job-uuid-1")
    .mockReturnValueOnce("job-uuid-2")
    .mockReturnValueOnce("job-uuid-3"),
}));

import {
  checkExpiring,
  createExpiryAlerts,
} from "../../services/cert-expiry-checker";

describe("R-W7-03a: checkExpiring scans certs within configurable threshold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checkExpiring is exported and callable", () => {
    expect(typeof checkExpiring).toBe("function");
  });

  it("queries certs within default 30 days", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    await checkExpiring("company-aaa");

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("expiry_date");
    expect(sql).toContain("company_id");
    expect(params).toContain("company-aaa");
    expect(params).toContain(30);
  });

  it("accepts custom daysAhead parameter (14 days)", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    await checkExpiring("company-aaa", 14);

    const [, params] = mockQuery.mock.calls[0];
    expect(params).toContain(14);
  });

  it("accepts daysAhead = 7 for urgent threshold", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    await checkExpiring("company-aaa", 7);

    const [, params] = mockQuery.mock.calls[0];
    expect(params).toContain(7);
  });

  it("accepts daysAhead = 90 for extended lookahead", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    await checkExpiring("company-aaa", 90);

    const [, params] = mockQuery.mock.calls[0];
    expect(params).toContain(90);
  });

  it("scopes query by company_id", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    await checkExpiring("tenant-xyz");

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("company_id");
    expect(params[0]).toBe("tenant-xyz");
  });
});

describe("R-W7-03b: Returns/generates alert records for expiring certifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns correctly shaped ExpiringCert objects", async () => {
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

    expect(result[0]).toEqual(
      expect.objectContaining({
        driverId: "driver-1",
        certType: "CDL",
        daysRemaining: 7,
      }),
    );
    expect(result[0].expiryDate).toBeInstanceOf(Date);

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

  it("handles string expiry_date from DB (auto-converts to Date)", async () => {
    mockQuery.mockResolvedValueOnce([
      [
        {
          user_id: "driver-3",
          type: "HazMat",
          expiry_date: "2026-04-15",
          days_remaining: 25,
        },
      ],
      [],
    ]);

    const result = await checkExpiring("company-aaa");

    expect(result[0].expiryDate).toBeInstanceOf(Date);
    expect(result[0].certType).toBe("HazMat");
  });

  it("createExpiryAlerts creates notification jobs for each expiring cert", async () => {
    const today = new Date();
    const sevenDaysOut = new Date(today);
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
    const expiredDate = new Date(today);
    expiredDate.setDate(expiredDate.getDate() - 2);

    // First call: checkExpiring query
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
    // INSERT calls for notification jobs
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const result = await createExpiryAlerts("company-aaa", 30);

    expect(result.alertsCreated).toBe(2);
    expect(result.expiringCerts).toHaveLength(2);
    expect(result.jobIds).toHaveLength(2);
    // Verify INSERT queries were called (1 SELECT + 2 INSERTs)
    expect(mockQuery).toHaveBeenCalledTimes(3);
  });

  it("createExpiryAlerts returns zero alerts when no certs expiring", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const result = await createExpiryAlerts("company-aaa");

    expect(result.alertsCreated).toBe(0);
    expect(result.expiringCerts).toEqual([]);
    expect(result.jobIds).toEqual([]);
    // Only the SELECT query, no INSERTs
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("createExpiryAlerts inserts with channel=email and status=PENDING", async () => {
    mockQuery.mockResolvedValueOnce([
      [
        {
          user_id: "driver-1",
          type: "CDL",
          expiry_date: new Date("2026-04-01"),
          days_remaining: 11,
        },
      ],
      [],
    ]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

    await createExpiryAlerts("company-aaa");

    // Second call is the INSERT
    const [insertSql] = mockQuery.mock.calls[1];
    expect(insertSql).toContain("notification_jobs");
    expect(insertSql).toContain("email");
    expect(insertSql).toContain("PENDING");
  });
});

describe("R-W7-03c: Unit tests cover normal, edge, and error cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles DB connection error gracefully", async () => {
    mockQuery.mockRejectedValueOnce(new Error("Connection refused"));

    await expect(checkExpiring("company-aaa")).rejects.toThrow(
      "Connection refused",
    );
  });

  it("handles DB timeout error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("Query timed out"));

    await expect(checkExpiring("company-aaa")).rejects.toThrow(
      "Query timed out",
    );
  });

  it("createExpiryAlerts propagates DB error from checkExpiring", async () => {
    mockQuery.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(createExpiryAlerts("company-aaa")).rejects.toThrow(
      "ECONNREFUSED",
    );
  });

  it("createExpiryAlerts handles INSERT failure mid-batch", async () => {
    mockQuery.mockResolvedValueOnce([
      [
        {
          user_id: "driver-1",
          type: "CDL",
          expiry_date: new Date("2026-04-01"),
          days_remaining: 11,
        },
      ],
      [],
    ]);
    mockQuery.mockRejectedValueOnce(new Error("INSERT failed"));

    await expect(createExpiryAlerts("company-aaa")).rejects.toThrow(
      "INSERT failed",
    );
  });

  it("handles large result sets", async () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      user_id: `driver-${i}`,
      type: "CDL",
      expiry_date: new Date("2026-04-01"),
      days_remaining: 10,
    }));
    mockQuery.mockResolvedValueOnce([rows, []]);

    const result = await checkExpiring("company-aaa");

    expect(result).toHaveLength(100);
    expect(result[99].driverId).toBe("driver-99");
  });

  it("handles zero daysRemaining (expires today)", async () => {
    mockQuery.mockResolvedValueOnce([
      [
        {
          user_id: "driver-today",
          type: "TWIC",
          expiry_date: new Date(),
          days_remaining: 0,
        },
      ],
      [],
    ]);

    const result = await checkExpiring("company-aaa");

    expect(result[0].daysRemaining).toBe(0);
    expect(result[0].certType).toBe("TWIC");
  });
});

describe("R-W7-VPC-802: unit tests pass, tsc clean", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checkExpiring returns typed ExpiringCert array", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    const result = await checkExpiring("company-aaa");
    expect(Array.isArray(result)).toBe(true);
  });

  it("createExpiryAlerts returns typed ExpiryAlertResult", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);
    const result = await createExpiryAlerts("company-aaa");
    expect(typeof result.alertsCreated).toBe("number");
    expect(Array.isArray(result.expiringCerts)).toBe(true);
    expect(Array.isArray(result.jobIds)).toBe(true);
  });

  it("ExpiringCert shape has all required fields", async () => {
    mockQuery.mockResolvedValueOnce([
      [
        {
          user_id: "d-1",
          type: "CDL",
          expiry_date: new Date("2026-04-01"),
          days_remaining: 11,
        },
      ],
      [],
    ]);

    const result = await checkExpiring("company-aaa");
    const cert = result[0];

    expect(cert).toHaveProperty("driverId");
    expect(cert).toHaveProperty("certType");
    expect(cert).toHaveProperty("expiryDate");
    expect(cert).toHaveProperty("daysRemaining");
    expect(typeof cert.driverId).toBe("string");
    expect(typeof cert.certType).toBe("string");
    expect(cert.expiryDate).toBeInstanceOf(Date);
    expect(typeof cert.daysRemaining).toBe("number");
  });
});
