/**
 * Tests for Invoice Aging Nightly Job
 *
 * Tests R-B1-03: 5 invoice fixtures produce correct aging bucket assignments
 * Tests R-B1-04: null issued_at results in null aging_bucket
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
    getConnection: vi.fn(),
  },
}));

vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  computeAgingBucket,
  runInvoiceAgingNightly,
} from "../../jobs/invoice-aging-nightly";

describe("computeAgingBucket", () => {
  const now = new Date("2026-04-09T00:00:00.000Z");

  // Tests R-B1-03
  it("assigns 'current' for age 0 days", () => {
    const issuedAt = new Date("2026-04-09T00:00:00.000Z"); // 0 days ago
    const result = computeAgingBucket(issuedAt, now);
    expect(result).toBe("current");
  });

  // Tests R-B1-03
  it("assigns '1_30' for age 15 days", () => {
    const issuedAt = new Date("2026-03-25T00:00:00.000Z"); // 15 days ago
    const result = computeAgingBucket(issuedAt, now);
    expect(result).toBe("1_30");
  });

  // Tests R-B1-03
  it("assigns '31_60' for age 45 days", () => {
    const issuedAt = new Date("2026-02-23T00:00:00.000Z"); // 45 days ago
    const result = computeAgingBucket(issuedAt, now);
    expect(result).toBe("31_60");
  });

  // Tests R-B1-03
  it("assigns '61_90' for age 75 days", () => {
    const issuedAt = new Date("2026-01-24T00:00:00.000Z"); // 75 days ago
    const result = computeAgingBucket(issuedAt, now);
    expect(result).toBe("61_90");
  });

  // Tests R-B1-03
  it("assigns '90_plus' for age 120 days", () => {
    const issuedAt = new Date("2025-12-11T00:00:00.000Z"); // 120 days ago
    const result = computeAgingBucket(issuedAt, now);
    expect(result).toBe("90_plus");
  });

  // Tests R-B1-04
  it("returns null when issued_at is null", () => {
    const result = computeAgingBucket(null, now);
    expect(result).toBeNull();
  });
});

describe("runInvoiceAgingNightly", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Tests R-B1-03
  it("persists correct aging_bucket for 5 invoices with different ages", async () => {
    const now = new Date("2026-04-09T00:00:00.000Z");
    const seededInvoices = [
      { id: "inv-0d", issued_at: new Date("2026-04-09T00:00:00.000Z") },
      { id: "inv-15d", issued_at: new Date("2026-03-25T00:00:00.000Z") },
      { id: "inv-45d", issued_at: new Date("2026-02-23T00:00:00.000Z") },
      { id: "inv-75d", issued_at: new Date("2026-01-24T00:00:00.000Z") },
      { id: "inv-120d", issued_at: new Date("2025-12-11T00:00:00.000Z") },
    ];

    mockQuery.mockResolvedValueOnce([seededInvoices]);
    mockQuery.mockResolvedValue([{ affectedRows: 1 }]);

    const result = await runInvoiceAgingNightly(now);

    expect(result.updated).toBe(5);
    expect(result.snapshots.length).toBe(5);

    const bucketMap = new Map(
      result.snapshots.map((s) => [s.invoiceId, s.agingBucket]),
    );
    expect(bucketMap.get("inv-0d")).toBe("current");
    expect(bucketMap.get("inv-15d")).toBe("1_30");
    expect(bucketMap.get("inv-45d")).toBe("31_60");
    expect(bucketMap.get("inv-75d")).toBe("61_90");
    expect(bucketMap.get("inv-120d")).toBe("90_plus");
  });

  // Tests R-B1-04
  it("sets aging_bucket to null for invoice with null issued_at", async () => {
    const now = new Date("2026-04-09T00:00:00.000Z");
    const seededInvoices = [{ id: "inv-null", issued_at: null }];

    mockQuery.mockResolvedValueOnce([seededInvoices]);
    mockQuery.mockResolvedValue([{ affectedRows: 1 }]);

    const result = await runInvoiceAgingNightly(now);

    expect(result.updated).toBe(1);
    expect(result.snapshots[0].agingBucket).toBeNull();
  });

  it("returns updated:0 when no invoices exist", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    const result = await runInvoiceAgingNightly(
      new Date("2026-04-09T00:00:00.000Z"),
    );
    expect(result.updated).toBe(0);
    expect(result.snapshots).toEqual([]);
  });
});
